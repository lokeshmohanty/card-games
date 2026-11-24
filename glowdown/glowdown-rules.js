// glowdown/glowdown-rules.js — Glowdown's rules: the deck, the house rules,
// the plays, the bots.
//
// No document here and no platform: glowdown.js (the page) hands `game()` to
// the platform as SDK v2 managed rules (docs/sdk-v2.md in lokeshmohanty/games),
// and test-glowdown.mjs loads this file straight into Node.
//
// ## The game
//
// A shedding game with a deck of its own (redesigned 2026-11-24, Lokesh:
// "Redesign as our own"): be the first to play out every card.
//
//   - FIVE suits of the night sky: Nova, Comet, Crystal, Orbit and Eclipse,
//     each with its own glyph, in colours that are none of red, yellow,
//     green and blue (the page: --p4, --p6, --p7, --p8 and grey).
//   - Numbers 1 to 8, ONCE in each suit (40 cards).
//   - Three action cards in each suit, once each:
//       SPARK +1  the next player draws one card and misses their turn;
//       ECHO      play again at once: a card of the same suit (or a PRISM),
//                 or pass;
//       GIFT      hand one of your cards to the next player.
//   - Five PRISMs, no suit: three PRISM (name the suit) and two PRISM +3
//     (name the suit; the next player draws three and misses their turn).
//
// 60 cards; five each. A card plays when it matches the suit in play or the
// top card's face (a 6 on a 6, a GIFT on a GIFT); a PRISM plays on anything.
// Play always goes the same way round. Can't play? Draw one; if it plays you
// may play it, or pass.
//
// ## House rules (the host sets them before the first game; all off)
//
//   stack      SPARK +1 on a SPARK +1, PRISM +3 on either: the draws add up
//              and the first player who cannot answer draws them all.
//   snap       a number card with the same number as the top card may be
//              played by anyone, out of turn ("snap!"); play goes on from them.
//   pass       a PRISM (the plain one) also passes every hand on one seat.
//   drawUntil  drawing goes on until you draw a card that plays.
//
// The setup only the first time (Lokesh, 2026-11-23, as Ludo): PLAY AGAIN
// deals straight away with the same rules, or with the ones the host picked
// at the end ("Next game: … · CHANGE": `nextGame()` / `setNext()`); one
// person with bots deals straight away with the rules last played on the
// host's phone (`last()`), or the defaults. Friends at a first game, or a
// fresh table (CHANGE PLAYERS), get the setup, with the last rules picked.
//
// ## A match
//
// One deal: the first out wins, everyone else is placed by how many cards
// they still hold, fewest first (a tie shares the place). A player who left
// is not placed. The dealer — the first to play — goes round the table
// between matches (docs/sdk-v2.md "Who starts").

(() => {
	const SUITS = ["nova", "comet", "crystal", "orbit", "eclipse"];
	const SUIT_NAMES = { nova: "Nova", comet: "Comet", crystal: "Crystal", orbit: "Orbit", eclipse: "Eclipse" };
	const NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8"];
	const ACTIONS = ["spark", "echo", "gift"];
	const FACE_NAMES = { spark: "SPARK +1", echo: "ECHO", gift: "GIFT", prism: "PRISM", prism3: "PRISM +3" };
	const HAND = 5;
	const LOG = 12; // events kept for the pages
	const HOUSE = ["stack", "snap", "pass", "drawUntil"];
	const HOUSE_NAMES = { stack: "Stack sparks", snap: "Snap", pass: "Prisms pass hands", drawUntil: "Draw until you can play" };

	/** The deck: card id → { s: suit or null, f: face }. Faces are "1"…"8", the actions, "prism" and "prism3". */
	const DECK = [];
	for (const s of SUITS) {
		for (const f of NUMBERS) DECK.push({ s, f });
		for (const f of ACTIONS) DECK.push({ s, f });
	}
	for (let k = 0; k < 3; k++) DECK.push({ s: null, f: "prism" });
	for (let k = 0; k < 2; k++) DECK.push({ s: null, f: "prism3" });

	const isWild = (id) => DECK[id].s === null;
	const isNumber = (id) => /^\d$/.test(DECK[id].f);
	const nameOf = (id) => (isWild(id) ? FACE_NAMES[DECK[id].f] : `${SUIT_NAMES[DECK[id].s]} ${FACE_NAMES[DECK[id].f] ?? DECK[id].f}`);
	/** How many cards a draw card makes the next player take. */
	const drawOf = (id) => (DECK[id].f === "spark" ? 1 : DECK[id].f === "prism3" ? 3 : 0);

	/** A seeded generator whose state is one integer, so a snapshot carries it. */
	function rng(state) {
		let a = state >>> 0;
		const next = () => {
			a = (a + 0x6d2b79f5) >>> 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
		return { next, int: (n) => Math.floor(next() * n), state: () => a };
	}
	function shuffle(list, r) {
		for (let i = list.length - 1; i > 0; i--) {
			const j = r.int(i + 1);
			[list[i], list[j]] = [list[j], list[i]];
		}
		return list;
	}

	const DEFAULT_HOUSE = Object.fromEntries(HOUSE.map((k) => [k, false]));
	/** House rules from anything (kept on a phone, carried over): each known rule that is true or false, the rest the defaults. */
	function cleanHouse(h) {
		const out = { ...DEFAULT_HOUSE };
		if (h && typeof h === "object" && !Array.isArray(h)) for (const k of HOUSE) if (typeof h[k] === "boolean") out[k] = h[k];
		return out;
	}
	/** Why `patch` is not a change of house rules; null when it is. */
	function houseProblem(patch) {
		if (!patch || typeof patch !== "object" || Array.isArray(patch)) return "no such rule";
		for (const [k, v] of Object.entries(patch)) if (!HOUSE.includes(k) || typeof v !== "boolean") return "no such rule";
		return null;
	}

	/**
	 * The managed rules (docs/sdk-v2.md, Layer 2). `isHost(id)`: whether that
	 * player may set the house rules and deal (the page passes the party's
	 * host; tests leave it open). `last()`: the house rules last played on the
	 * host's phone, or null (the page keeps them in the game's storage).
	 */
	function game({ isHost = () => true, last = () => null } = {}) {
		let s = null;

		const seatOf = (id) => s.seats.indexOf(id);
		const active = (i) => !s.out[i];
		const activeCount = () => s.seats.filter((_, i) => active(i)).length;
		/** The next seat still playing from `i`; play always goes the same way round. */
		const after = (i) => {
			const n = s.seats.length;
			for (let k = 1; k <= n; k++) {
				const j = (i + k) % n;
				if (active(j)) return j;
			}
			return i;
		};
		const before = (i) => {
			const n = s.seats.length;
			for (let k = 1; k <= n; k++) {
				const j = (((i - k) % n) + n) % n;
				if (active(j)) return j;
			}
			return i;
		};
		const top = () => s.pile[s.pile.length - 1];

		/** Take the draw pile's top card, reshuffling the pile under the top card when it runs out; null when none is left. */
		function take() {
			if (!s.draw.length && s.pile.length > 1) {
				const r = rng(s.rng);
				s.draw = shuffle(s.pile.splice(0, s.pile.length - 1), r);
				s.rng = r.state();
				s.reshuffles++;
			}
			return s.draw.length ? s.draw.pop() : null;
		}
		function give(i, n) {
			let got = 0;
			for (let k = 0; k < n; k++) {
				const c = take();
				if (c === null) break;
				s.hands[i].push(c);
				got++;
			}
			return got;
		}

		/** Whether `id` may go on the pile now, on a turn. */
		function plays(id) {
			const c = DECK[id];
			if (s.pending > 0) return s.pendingKind === "spark" ? c.f === "spark" || c.f === "prism3" : c.f === "prism3";
			if (c.s === null) return true;
			if (s.echo) return c.s === s.suit;
			return c.s === s.suit || c.f === DECK[top()].f;
		}
		/** Whether `id` may be snapped in out of turn: a number, the same number as the top card, nothing owed. */
		function snaps(id) {
			if (!s.house.snap || s.pending > 0 || s.echo || !isNumber(id)) return false;
			return isNumber(top()) && DECK[id].f === DECK[top()].f;
		}
		function legal(i) {
			if (s.phase !== "play" || i < 0 || !active(i)) return [];
			if (i !== s.turn) return s.hands[i].filter(snaps);
			if (s.drawn !== null) return s.hands[i].includes(s.drawn) && plays(s.drawn) ? [s.drawn] : [];
			return s.hands[i].filter(plays);
		}

		/** What happened, for the pages to show: the newest few, numbered. */
		function event(e) {
			s.n++;
			s.last = { n: s.n, ...e };
			s.log.push(s.last);
			if (s.log.length > LOG) s.log.splice(0, s.log.length - LOG);
		}
		function finish(i) {
			s.phase = "over";
			s.winner = i;
			s.echo = false;
		}

		/** Seat `i` takes `n` and misses its turn (a draw card not answered). */
		function penalise(i, n, by) {
			const got = give(i, n);
			event({ kind: "penalty", seat: i, count: got, by });
			s.turn = after(i);
		}

		/** Play `id` from seat `i` (already checked): the card's effect, and whose turn it is next. */
		function play(i, id, { suit, gift, snap }) {
			s.hands[i].splice(s.hands[i].indexOf(id), 1);
			s.pile.push(id);
			s.played++;
			s.drawn = null;
			s.echo = false;
			const c = DECK[id];
			s.suit = c.s ?? suit;
			event({ kind: snap ? "snap" : "play", seat: i, card: id, suit: s.suit });
			if (!s.hands[i].length) return finish(i);
			const next = after(i);
			if (c.f === "gift" && gift != null) {
				s.hands[i].splice(s.hands[i].indexOf(gift), 1);
				s.hands[next].push(gift);
				event({ kind: "gift", seat: i, target: next, card: id, suit: s.suit });
				if (!s.hands[i].length) return finish(i);
			}
			if (c.f === "prism" && s.house.pass) {
				// Every hand moves on one seat, the way play goes.
				const order = [];
				for (let j = i; !order.includes(j); j = after(j)) order.push(j);
				const held = order.map((j) => s.hands[j]);
				order.forEach((j, k) => (s.hands[order[(k + 1) % order.length]] = held[k]));
				event({ kind: "pass", seat: i, card: id, suit: s.suit });
			}
			const draw = drawOf(id);
			if (draw && s.house.stack) {
				s.pending += draw;
				s.pendingKind = c.f === "prism3" || s.pendingKind === "prism3" ? "prism3" : "spark";
				s.turn = next;
			} else if (draw) penalise(next, draw, i);
			else if (c.f === "echo") {
				// Again at once, in the same suit; on to the next if nothing can follow.
				s.echo = true;
				s.turn = i;
				if (!s.hands[i].some(plays)) {
					s.echo = false;
					event({ kind: "pass", seat: i, quiet: true });
					s.turn = next;
				}
			} else s.turn = next;
		}

		/** Seat `i` draws on its turn: what is owed, or one (until one plays, with drawUntil). */
		function drawFor(i) {
			if (s.pending > 0) {
				const n = s.pending;
				s.pending = 0;
				s.pendingKind = null;
				penalise(i, n);
				return;
			}
			let got = 0;
			let card = null;
			for (;;) {
				const c = take();
				if (c === null) break;
				s.hands[i].push(c);
				got++;
				if (plays(c)) {
					card = c;
					break;
				}
				if (!s.house.drawUntil) break;
			}
			event({ kind: "draw", seat: i, count: got });
			if (card !== null) s.drawn = card;
			else s.turn = after(i);
		}

		function deal() {
			const r = rng(s.rng);
			const deck = shuffle(DECK.map((_, id) => id), r);
			s.hands = s.seats.map((_, i) => (active(i) ? deck.splice(0, HAND) : []));
			// The first card up is a number: an action or a PRISM goes back in.
			const k = deck.findIndex((id) => isNumber(id));
			const first = deck.splice(k, 1)[0];
			s.draw = deck;
			s.pile = [first];
			s.suit = DECK[first].s;
			s.rng = r.state();
			s.phase = "play";
			s.turn = active(s.opener) ? s.opener : after(s.opener);
			event({ kind: "deal", seat: s.opener, card: first });
		}

		/** The ranking: the winner, then fewest cards left (ties together). A player who left is not placed. */
		function standings() {
			const left = s.hands.map((h) => h.length);
			const rest = s.seats.map((_, i) => i).filter((i) => i !== s.winner && active(i));
			const levels = [...new Set(rest.map((i) => left[i]))].sort((a, b) => a - b);
			const ranking = [...(s.winner != null ? [[s.winner]] : []), ...levels.map((n) => rest.filter((i) => left[i] === n))];
			return { left, ranking };
		}

		// ------------------------------------------------------------ the bot

		/** The suit a bot names: the one it holds most of. */
		function bestSuit(hand, r) {
			const n = Object.fromEntries(SUITS.map((x) => [x, 0]));
			for (const id of hand) if (!isWild(id)) n[DECK[id].s]++;
			const most = Math.max(...Object.values(n));
			const best = SUITS.filter((x) => n[x] === most);
			return best[r.int(best.length)];
		}
		/** The card a bot gives away with a GIFT: a number of the suit it holds least of (never a PRISM, if it can help it). */
		function giftOf(i, gift) {
			const rest = s.hands[i].filter((id) => id !== gift);
			if (!rest.length) return null;
			const count = (suit) => rest.filter((id) => DECK[id].s === suit).length;
			const score = (id) => (isWild(id) ? 100 : (isNumber(id) ? 0 : 10) + count(DECK[id].s));
			return rest.reduce((a, b) => (score(b) < score(a) ? b : a));
		}
		/** How good playing `id` is for seat `i`: higher is better. */
		function worth(i, id) {
			const c = DECK[id];
			const threat = s.hands[after(i)].length <= 2; // the next player is close to out
			const mine = s.hands[i].length;
			let v = isNumber(id) ? 1 + Number(c.f) / 10 : 2;
			if (isWild(id)) v = mine <= 2 ? 6 : -4; // keep a PRISM for the end
			if (c.f === "prism3") v += threat ? 9 : 1;
			if (c.f === "spark") v += threat ? 7 : 1;
			if (c.f === "gift") v += mine > 2 ? 3 : 1; // two cards gone in one turn
			if (c.f === "echo") v += s.hands[i].some((x) => x !== id && DECK[x].s === c.s) ? 3 : -1;
			if (c.s && c.s === s.suit) v += 0.5;
			if (c.f === "prism" && s.house.pass) v += s.hands[before(i)].length < mine - 1 ? 6 : -4;
			return v;
		}
		function botMove(i) {
			const r = rng(s.rng ^ (s.n * 2654435761));
			const opts = (id) => {
				const o = { play: id };
				if (isWild(id)) o.suit = bestSuit(s.hands[i].filter((x) => x !== id), r);
				if (DECK[id].f === "gift") {
					const g = giftOf(i, id);
					if (g != null) o.gift = g;
				}
				return o;
			};
			const best = (list) => list.reduce((a, b) => (worth(i, b) > worth(i, a) ? b : a));
			if (s.drawn !== null) {
				if (!plays(s.drawn)) return { pass: true };
				// Keep a drawn PRISM unless the end is near.
				if (DECK[s.drawn].f === "prism" && s.hands[i].length > 3) return { pass: true };
				return opts(s.drawn);
			}
			const can = s.hands[i].filter(plays);
			if (s.echo) return can.length ? opts(best(can)) : { pass: true };
			if (!can.length) return { draw: true };
			return opts(best(can));
		}

		/** One move by `by`: nothing when allowed, else the reason. */
		function move(action, by) {
			const a = action ?? {};
			const me = seatOf(by);
			if (s.phase === "setup") {
				if (a.house === undefined && !a.start) return "wait for the deal";
				if (!isHost(by)) return "the host sets the house rules";
				if (a.house !== undefined) {
					const why = houseProblem(a.house);
					if (why) return why;
					s.house = { ...s.house, ...a.house };
				}
				if (a.start) deal();
				return;
			}
			if (s.phase !== "play") return "the game is over";
			if (me < 0 || !active(me)) return "you are not playing";
			if (a.play !== undefined) {
				const id = a.play;
				if (!Number.isInteger(id) || !s.hands[me].includes(id)) return "that card is not in your hand";
				const onTurn = me === s.turn;
				if (onTurn) {
					if (s.drawn !== null && id !== s.drawn) return "play the card you drew, or pass";
					if (!plays(id)) return s.pending > 0 ? `answer with a draw card, or draw ${s.pending}` : s.echo ? `ECHO: a ${SUIT_NAMES[s.suit]} card or a PRISM, or pass` : "that card does not play";
				} else if (!snaps(id)) return "not your turn";
				if (isWild(id) && !SUITS.includes(a.suit)) return "pick a suit";
				let gift = null;
				if (DECK[id].f === "gift" && s.hands[me].length > 1) {
					gift = a.gift;
					if (!Number.isInteger(gift) || gift === id || !s.hands[me].includes(gift)) return "pick a card to give";
				}
				if (!onTurn) {
					s.drawn = null;
					s.echo = false;
				}
				play(me, id, { suit: a.suit, gift, snap: !onTurn });
				return;
			}
			if (me !== s.turn) return "not your turn";
			if (a.draw === true) {
				if (s.drawn !== null) return "play the card you drew, or pass";
				if (s.echo) return "ECHO: play a card of the same suit, or pass";
				drawFor(me);
				return;
			}
			if (a.pass === true) {
				if (s.drawn === null && !s.echo) return "draw first";
				s.drawn = null;
				s.echo = false;
				event({ kind: "pass", seat: me });
				s.turn = after(me);
				return;
			}
			return "unknown move";
		}

		return {
			init({ seats, seed, match, first }) {
				const ids = seats.map((p) => p.id);
				// Who deals (docs/sdk-v2.md "Who starts"): the platform's `first`;
				// from an older shell, the seat after the last match's opener, or a
				// draw from the seed for a run's first match.
				let opener = ids.indexOf(first);
				if (opener < 0 && s?.openerId != null) {
					const prev = ids.indexOf(s.openerId);
					opener = prev >= 0 ? (prev + 1) % ids.length : Math.max(0, s.seats.indexOf(s.openerId)) % ids.length;
				}
				const sd = Math.abs(Math.floor(Number(seed) || 0));
				if (opener < 0) opener = sd % Math.max(1, ids.length);
				// The setup only the first time (above): PLAY AGAIN deals straight
				// away with the rules picked for it at the end, else this game's;
				// one person with bots deals straight away with the rules last
				// played on the host's phone, or the defaults.
				const prev = s;
				const people = seats.filter((p) => !p.bot).length;
				let saved = null;
				try {
					saved = prev ? (prev.next ?? prev.house) : last();
				} catch {}
				const straight = prev ? (match ?? 0) > 0 : people === 1 && ids.length > 1;
				s = {
					match: (match ?? 0) + 1,
					phase: "setup",
					house: cleanHouse(saved),
					next: null, // the rules picked at the end for PLAY AGAIN (setNext)
					seats: ids,
					bots: seats.map((p) => !!p.bot),
					out: ids.map(() => false),
					hands: ids.map(() => []),
					draw: [],
					pile: [],
					suit: null,
					turn: opener,
					opener,
					openerId: ids[opener] ?? null,
					pending: 0,
					pendingKind: null,
					drawn: null,
					echo: false, // an ECHO was played: the same player again, in its suit
					winner: null,
					last: null,
					log: [],
					n: 0,
					played: 0,
					reshuffles: 0,
					rng: (sd ^ 0x9e3779b9) >>> 0,
				};
				if (straight) deal();
			},

			apply({ action, by }) {
				const why = move(action, by);
				// A bot still on turn after its own move (an ECHO, a drawn card that
				// plays) moves on here. The platform re-asks such a bot since
				// platform-fixes; this stays for shells cached before them.
				const me = seatOf(by);
				for (let k = 0; why == null && k < 4 && me >= 0 && s.bots[me] && s.phase === "play" && s.turn === me; k++) move(botMove(me), by);
				return why;
			},

			view({ seat }) {
				const you = seat == null ? -1 : seatOf(seat);
				const over = s.phase === "over";
				const st = over ? standings() : null;
				return {
					match: s.match,
					phase: s.phase,
					house: { ...s.house },
					seats: [...s.seats],
					bots: [...s.bots],
					out: [...s.out],
					you,
					turn: s.turn,
					opener: s.opener,
					top: s.pile.length ? top() : null,
					suit: s.suit,
					pending: s.pending,
					pendingKind: s.pendingKind,
					echo: s.echo,
					hand: you >= 0 ? [...s.hands[you]] : [],
					counts: s.hands.map((h) => h.length),
					drawCount: s.draw.length,
					drawn: you >= 0 && you === s.turn ? s.drawn : null,
					drawing: s.drawn !== null, // the player on turn has drawn a card that plays
					legal: legal(you),
					last: s.last && { ...s.last },
					log: s.log.map((e) => ({ ...e })),
					winner: s.winner,
					// At the end every hand is shown, and how many cards each held (none for a seat that left).
					hands: over ? s.hands.map((h) => [...h]) : null,
					left: st ? st.left.map((n, i) => (active(i) ? n : null)) : null,
				};
			},

			turn: () => (s.phase === "play" ? [s.seats[s.turn]] : []),

			bot: ({ seat }) => {
				const i = seatOf(seat);
				if (s.phase !== "play" || i !== s.turn) return null;
				return botMove(i);
			},

			result() {
				if (s.phase !== "over") return null;
				const { left, ranking } = standings();
				const on = HOUSE.filter((k) => s.house[k]).map((k) => HOUSE_NAMES[k]);
				return {
					kind: "ffa",
					ranking: ranking.map((slot) => slot.map((i) => s.seats[i])),
					// Cards left, for the placed only: a player who left has no score (not 0, the best).
					scores: Object.fromEntries(ranking.flat().map((i) => [s.seats[i], left[i]])),
					details: [
						{ label: "Cards played", value: s.played },
						{ label: "House rules", value: on.length ? on.join(", ").slice(0, 40) : "none" },
					],
				};
			},

			/** The host chose SKIP TURN for someone away: they draw what they owe (or one) and the turn moves on. */
			skip() {
				if (s.phase !== "play") return false;
				const i = s.turn;
				if (s.pending > 0) {
					drawFor(i);
					return true;
				}
				if (s.drawn === null && !s.echo) give(i, 1);
				s.drawn = null;
				s.echo = false;
				event({ kind: "pass", seat: i });
				s.turn = after(i);
				return true;
			},

			/**
			 * A player left for good: their cards go under the draw pile; one
			 * player left wins. If it was their turn, what they owed goes with
			 * them (review, 2026-11-24: the debt passed on to the next player).
			 */
			leave({ seat }) {
				const i = seatOf(seat);
				if (i < 0 || s.out[i]) return false;
				s.out[i] = true;
				if (s.phase !== "play") return true;
				s.draw.unshift(...s.hands[i]);
				s.hands[i] = [];
				if (activeCount() <= 1) {
					finish(s.seats.findIndex((_, j) => active(j)));
					return true;
				}
				if (s.turn === i) {
					s.drawn = null;
					s.echo = false;
					s.pending = 0;
					s.pendingKind = null;
					s.turn = after(i);
				}
				return true;
			},

			/** Not a rule: the next game's house rules, for the host's page to offer at the end ("Next game: … · CHANGE"). */
			nextGame: () => ({ house: { ...(s.next ?? s.house) } }),
			/**
			 * Not a rule: change the next game's house rules, once this one is
			 * over (the platform takes no moves after the end, so the host's page
			 * calls this on its own rules, the live ones). PLAY AGAIN deals with
			 * them. Nothing when taken, else the reason.
			 */
			setNext(patch) {
				if (s.phase !== "over") return "only once the game is over";
				const why = houseProblem(patch);
				if (why) return why;
				s.next = { ...(s.next ?? s.house), ...patch };
			},

			snapshot: () => JSON.parse(JSON.stringify({ s })),
			restore({ snapshot }) {
				s = JSON.parse(JSON.stringify(snapshot)).s;
			},
		};
	}

	globalThis.glowdownRules = { SUITS, SUIT_NAMES, NUMBERS, ACTIONS, FACE_NAMES, HAND, HOUSE, HOUSE_NAMES, DEFAULT_HOUSE, cleanHouse, DECK, isWild, isNumber, nameOf, drawOf, rng, shuffle, game };
})();
