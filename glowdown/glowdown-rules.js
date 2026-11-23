// glowdown/glowdown-rules.js — Glowdown's rules: the deck, the house rules,
// the plays, the bots.
//
// No document here and no platform: glowdown.js (the page) hands `game()` to
// the platform as SDK v2 managed rules (docs/sdk-v2.md in lokeshmohanty/games),
// and test-glowdown.mjs loads this file straight into Node.
//
// ## The game
//
// An original shedding game: be the first to play out every card. The deck is
// our own — four suits of light (Sun, Moon, Star, Bolt), each told apart by its
// shape as well as its colour; numbers 0–9 twice in every suit; three action
// cards twice in every suit (ZAP +2, BLOCK, BOUNCE); and eight PRISMs, four of
// them PRISM +4. 112 cards.
//
// A card plays on the pile when it matches the suit in play or the top card's
// face (a 7 on a 7, a BLOCK on a BLOCK), and a PRISM plays on anything and
// names the suit. Can't play? Draw one; if it plays you may play it, or pass.
//
// ## House rules (the host sets them before the first deal; all off by default)
//
//   stack      ZAP +2 on a ZAP +2, PRISM +4 on either: the draws add up and
//              the first player who cannot answer draws them all.
//   jumpIn     a card identical to the top card (same suit, same face) may be
//              played by anyone, out of turn; play goes on from them.
//   sevenZero  a 7 swaps your hand with a player you pick; a 0 passes every
//              hand on round the table, the way play is going.
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
// One deal: the first out wins, everyone else is placed by the points left in
// their hand (numbers at face value, action cards 20, PRISMs 50), fewest
// first. The dealer — the first to play — goes round the table between
// matches (docs/sdk-v2.md "Who starts").

(() => {
	const SUITS = ["sun", "moon", "star", "bolt"];
	const SUIT_NAMES = { sun: "Sun", moon: "Moon", star: "Star", bolt: "Bolt" };
	const ACTIONS = ["zap", "block", "bounce"];
	const FACE_NAMES = { zap: "ZAP +2", block: "BLOCK", bounce: "BOUNCE", prism: "PRISM", prism4: "PRISM +4" };
	const HAND = 7;
	const LOG = 12; // events kept for the pages
	const HOUSE = ["stack", "jumpIn", "sevenZero", "drawUntil"];
	const HOUSE_NAMES = { stack: "Stack draws", jumpIn: "Jump in", sevenZero: "7 swaps, 0 rotates", drawUntil: "Draw until you can play" };

	/** The deck: card id → { s: suit or null, f: face }. Faces are "0"…"9", the actions, "prism" and "prism4". */
	const DECK = [];
	for (const s of SUITS) {
		for (let k = 0; k < 2; k++) for (let n = 0; n <= 9; n++) DECK.push({ s, f: String(n) });
		for (const f of ACTIONS) for (let k = 0; k < 2; k++) DECK.push({ s, f });
	}
	for (let k = 0; k < 4; k++) DECK.push({ s: null, f: "prism" });
	for (let k = 0; k < 4; k++) DECK.push({ s: null, f: "prism4" });

	const isWild = (id) => DECK[id].s === null;
	const isNumber = (id) => /^\d$/.test(DECK[id].f);
	/** What a card left in hand costs at the end. */
	const pointsOf = (id) => (isWild(id) ? 50 : isNumber(id) ? Number(DECK[id].f) : 20);
	const nameOf = (id) => (isWild(id) ? FACE_NAMES[DECK[id].f] : `${SUIT_NAMES[DECK[id].s]} ${FACE_NAMES[DECK[id].f] ?? DECK[id].f}`);
	/** How many cards a draw card makes the next player take. */
	const drawOf = (id) => (DECK[id].f === "zap" ? 2 : DECK[id].f === "prism4" ? 4 : 0);

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
		/** The next seat still playing from `i`, the way play goes. */
		const after = (i, dir = s.dir) => {
			const n = s.seats.length;
			for (let k = 1; k <= n; k++) {
				const j = (((i + dir * k) % n) + n) % n;
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

		/** Whether `id` may go on the pile now, on a turn (not a jump-in). */
		function plays(id) {
			const c = DECK[id];
			if (s.pending > 0) return s.pendingKind === "zap" ? c.f === "zap" || c.f === "prism4" : c.f === "prism4";
			if (c.s === null) return true;
			const t = DECK[top()];
			return c.s === s.suit || c.f === t.f;
		}
		/** Whether `id` may jump in: identical to the top card, nothing owed. */
		function jumps(id) {
			if (!s.house.jumpIn || s.pending > 0 || isWild(id)) return false;
			const t = DECK[top()];
			return !isWild(top()) && DECK[id].s === t.s && DECK[id].f === t.f;
		}
		function legal(i) {
			if (s.phase !== "play" || i < 0 || !active(i)) return [];
			if (i !== s.turn) return s.hands[i].filter(jumps);
			if (s.drawn !== null) return s.hands[i].includes(s.drawn) && plays(s.drawn) ? [s.drawn] : [];
			return s.hands[i].filter(plays); // an identical card plays on a turn anyway (same face)
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
		}

		/** Play `id` from seat `i` (already checked): the card's effect, and whose turn it is next. */
		function play(i, id, { suit, target, jump }) {
			s.hands[i].splice(s.hands[i].indexOf(id), 1);
			s.pile.push(id);
			s.played++;
			s.drawn = null;
			const c = DECK[id];
			s.suit = c.s ?? suit;
			event({ kind: jump ? "jump" : "play", seat: i, card: id, suit: s.suit });
			if (!s.hands[i].length) return finish(i);
			if (s.house.sevenZero && c.f === "7") {
				[s.hands[i], s.hands[target]] = [s.hands[target], s.hands[i]];
				event({ kind: "swap", seat: i, target, card: id, suit: s.suit });
			} else if (s.house.sevenZero && c.f === "0") {
				// Every hand moves on one seat the way play goes.
				const order = [];
				for (let j = i, k = 0; k < s.seats.length; k++, j = after(j)) {
					if (order.includes(j)) break;
					order.push(j);
				}
				const before = order.map((j) => s.hands[j]);
				order.forEach((j, k) => (s.hands[order[(k + 1) % order.length]] = before[k]));
				event({ kind: "rotate", seat: i, card: id, suit: s.suit, dir: s.dir });
			}
			const draw = drawOf(id);
			if (draw && s.house.stack) {
				s.pending += draw;
				s.pendingKind = c.f === "prism4" || s.pendingKind === "prism4" ? "prism4" : "zap";
				s.turn = after(i);
			} else if (draw) {
				const next = after(i);
				const got = give(next, draw);
				event({ kind: "penalty", seat: next, count: got, by: i });
				s.turn = after(next);
			} else if (c.f === "block") {
				s.turn = after(after(i));
			} else if (c.f === "bounce") {
				s.dir = -s.dir;
				// With two playing, BOUNCE is a BLOCK: the same player goes again.
				s.turn = activeCount() === 2 ? i : after(i);
			} else s.turn = after(i);
		}

		/** Seat `i` draws on its turn: what is owed, or one (until one plays, with drawUntil). */
		function drawFor(i) {
			if (s.pending > 0) {
				const got = give(i, s.pending);
				event({ kind: "penalty", seat: i, count: got });
				s.pending = 0;
				s.pendingKind = null;
				s.turn = after(i);
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
			let k = deck.findIndex((id) => isNumber(id));
			const first = deck.splice(k, 1)[0];
			s.draw = deck;
			s.pile = [first];
			s.suit = DECK[first].s;
			s.rng = r.state();
			s.phase = "play";
			s.turn = active(s.opener) ? s.opener : after(s.opener);
			event({ kind: "deal", seat: s.opener, card: first });
		}

		/** Hand points, and the ranking: the winner, then fewest points left, then whoever left. */
		function standings() {
			const pts = s.hands.map((h) => h.reduce((a, id) => a + pointsOf(id), 0));
			const rest = s.seats.map((_, i) => i).filter((i) => i !== s.winner && active(i));
			const levels = [...new Set(rest.map((i) => pts[i]))].sort((a, b) => a - b);
			const gone = s.seats.map((_, i) => i).filter((i) => !active(i) && i !== s.winner);
			const ranking = [...(s.winner != null ? [[s.winner]] : []), ...levels.map((p) => rest.filter((i) => pts[i] === p)), ...(gone.length ? [gone] : [])];
			return { pts, ranking };
		}

		// ------------------------------------------------------------ the bot

		/** The suit a bot names: the one it holds most of. */
		function bestSuit(hand, r) {
			const n = Object.fromEntries(SUITS.map((x) => [x, 0]));
			for (const id of hand) if (!isWild(id)) n[DECK[id].s] += 1 + pointsOf(id) / 40;
			const most = Math.max(...Object.values(n));
			const best = SUITS.filter((x) => n[x] === most);
			return best[r.int(best.length)];
		}
		/** The seat with the fewest cards other than `i` (a 7's target). */
		function fewest(i) {
			let best = -1;
			s.seats.forEach((_, j) => {
				if (j !== i && active(j) && (best < 0 || s.hands[j].length < s.hands[best].length)) best = j;
			});
			return best;
		}
		/** How good playing `id` is for seat `i`: higher is better. */
		function worth(i, id) {
			const c = DECK[id];
			const next = after(i);
			const threat = s.hands[next].length <= 2; // the next player is close to out
			let v = pointsOf(id) / 10; // shed the heavy cards first…
			if (isWild(id)) v = s.hands[i].length <= 2 ? 6 : -4; // …but keep a PRISM for the end
			if (c.f === "prism4") v += threat ? 9 : 1;
			if (c.f === "zap" || c.f === "block") v += threat ? 8 : 1;
			if (c.f === "bounce") v += threat ? 5 : 0.5;
			if (c.s && c.s === s.suit) v += 0.5; // keep the suit we are in
			if (s.house.sevenZero && c.f === "7") {
				const t = fewest(i);
				v += t >= 0 && s.hands[t].length < s.hands[i].length - 1 ? 7 : -6;
			}
			if (s.house.sevenZero && c.f === "0") {
				const prev = after(i, -s.dir);
				v += s.hands[prev].length < s.hands[i].length - 1 ? 5 : -3;
			}
			return v;
		}
		function botMove(i) {
			const r = rng(s.rng ^ (s.n * 2654435761));
			const opts = (id) => {
				const o = { play: id };
				if (isWild(id)) o.suit = bestSuit(s.hands[i].filter((x) => x !== id), r);
				if (s.house.sevenZero && DECK[id].f === "7" && s.hands[i].length > 1) o.target = fewest(i);
				return o;
			};
			if (s.drawn !== null) {
				if (!plays(s.drawn)) return { pass: true };
				// Keep a drawn PRISM unless it would end the game soon.
				if (isWild(s.drawn) && s.hands[i].length > 3 && DECK[s.drawn].f === "prism") return { pass: true };
				return opts(s.drawn);
			}
			const can = s.hands[i].filter(plays);
			if (!can.length) return { draw: true };
			const best = can.reduce((a, b) => (worth(i, b) > worth(i, a) ? b : a));
			return opts(best);
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
				const jump = !onTurn;
				if (onTurn) {
					if (s.drawn !== null && id !== s.drawn) return "play the card you drew, or pass";
					if (!plays(id)) return s.pending > 0 ? `answer with a draw card, or draw ${s.pending}` : "that card does not play";
				} else if (!jumps(id)) return "not your turn";
				if (isWild(id) && !SUITS.includes(a.suit)) return "pick a suit";
				let target = null;
				if (s.house.sevenZero && DECK[id].f === "7" && s.hands[me].length > 1) {
					target = a.target;
					if (!Number.isInteger(target) || target === me || target < 0 || target >= s.seats.length || !active(target)) return "pick who to swap hands with";
				}
				if (jump) s.drawn = null;
				play(me, id, { suit: a.suit, target, jump });
				return;
			}
			if (me !== s.turn) return "not your turn";
			if (a.draw === true) {
				if (s.drawn !== null) return "play the card you drew, or pass";
				drawFor(me);
				return;
			}
			if (a.pass === true) {
				if (s.drawn === null) return "draw first";
				s.drawn = null;
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
					dir: 1,
					turn: opener,
					opener,
					openerId: ids[opener] ?? null,
					pending: 0,
					pendingKind: null,
					drawn: null,
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
				// A bot still on turn after its own move (it drew a card that
				// plays, or BOUNCEd with two playing) moves on here: the platform
				// asks a bot once per turn it sees begin, and would not ask again.
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
					dir: s.dir,
					top: s.pile.length ? top() : null,
					suit: s.suit,
					pending: s.pending,
					pendingKind: s.pendingKind,
					hand: you >= 0 ? [...s.hands[you]] : [],
					counts: s.hands.map((h) => h.length),
					drawCount: s.draw.length,
					drawn: you >= 0 && you === s.turn ? s.drawn : null,
					drawing: s.drawn !== null, // the player on turn has drawn a card that plays
					legal: legal(you),
					last: s.last && { ...s.last },
					log: s.log.map((e) => ({ ...e })),
					winner: s.winner,
					// At the end every hand is shown, with what it was worth.
					hands: over ? s.hands.map((h) => [...h]) : null,
					points: st ? st.pts : null,
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
				const { pts, ranking } = standings();
				const on = HOUSE.filter((k) => s.house[k]).map((k) => HOUSE_NAMES[k]);
				return {
					kind: "ffa",
					ranking: ranking.map((slot) => slot.map((i) => s.seats[i])),
					scores: Object.fromEntries(s.seats.map((id, i) => [id, pts[i]])),
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
				if (s.drawn === null) give(i, 1);
				s.drawn = null;
				event({ kind: "pass", seat: i });
				s.turn = after(i);
				return true;
			},

			/** A player left for good: their cards go under the draw pile; one player left wins. */
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

	globalThis.glowdownRules = { SUITS, SUIT_NAMES, ACTIONS, FACE_NAMES, HAND, HOUSE, HOUSE_NAMES, DEFAULT_HOUSE, cleanHouse, DECK, isWild, isNumber, pointsOf, nameOf, drawOf, rng, shuffle, game };
})();
