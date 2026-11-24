// twenty-nine/twenty-nine-rules.js — 29's rules: the deal, the bidding, the
// hidden trump, the tricks, the pair, the score, and the bots.
//
// No document here and no platform: twenty-nine.js (the page) hands `game()`
// to the platform as SDK v2 managed rules (docs/sdk-v2.md in
// lokeshmohanty/games), and test-twenty-nine.mjs loads this file into Node.
//
// ## The game
//
// The traditional Indian trick-taking game. Four players, two partnerships
// sitting opposite: seats 1 and 3 against seats 2 and 4. 32 cards (7 up to A
// in four suits) rank J 9 A 10 K Q 8 7, high to low, and the J, 9, A and 10
// carry points: 3, 2, 1 and 1 — 28 in the pack.
//
// A hand: four cards each, an auction from the player after the dealer (bids
// 16 to 28; once you pass you are out of it; if the first three pass, the
// fourth must bid 16). The highest bidder picks the trump in secret by laying
// one of their cards aside face down. Four more cards each, then eight tricks,
// led first by the player after the dealer. Follow suit if you can. If you
// can't, you may ask for the trump to be shown: the bidder turns the card
// up, it goes back into their hand, and you must play a trump if you hold
// one. Until it is shown nobody's trump counts as a trump. A trick goes to
// the highest trump in it (the trump counts in the trick it is shown in), or
// else the highest card of the suit led.
//
// The bidding side needs at least its bid in card points; making it scores
// that side a game point, failing gives the point to the other side. First
// side to the game's target (the host picks 1, 3 or 6 hands; 3 to begin with)
// wins. The deal moves on one seat every hand, and the first dealer moves on
// every game (docs/sdk-v2.md "Who starts": `first` is the first to bid and
// lead, so the dealer sits just before them).
//
// The rules are asked only the first time (Lokesh, 2026-11-23, as Ludo):
// PLAY AGAIN deals straight away with the same rules, or the ones the host
// picked at the end ("Next game: … · CHANGE": `nextGame()` / `setNext()`); one
// person with three bots deals straight away with the rules last played on
// the host's phone (`last()`), or the defaults.
//
// The pair (a house rule, on unless the host turns it off): once the trump is
// shown, a player holding its K and Q whose side has won a trick may show the
// pair on their turn. Shown by the bidding side, the bid drops by 4 (not
// under 16); by the other side, it rises by 4 (not over 28). Once a hand.

(() => {
	const SUITS = ["spades", "hearts", "diamonds", "clubs"];
	const SUIT_NAMES = { spades: "Spades", hearts: "Hearts", diamonds: "Diamonds", clubs: "Clubs" };
	const SUIT_MARKS = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
	const RANKS = ["J", "9", "A", "10", "K", "Q", "8", "7"]; // high to low
	const POINTS = { J: 3, 9: 2, A: 1, 10: 1 };
	const MIN_BID = 16;
	const MAX_BID = 28;
	const PAIR = 4;
	const GOALS = [1, 3, 6];
	const LOG = 12;

	const suitOf = (id) => SUITS[id >> 3];
	const rankOf = (id) => RANKS[id & 7];
	/** 0 is the highest (a J). */
	const order = (id) => id & 7;
	const pointsOf = (id) => POINTS[rankOf(id)] ?? 0;
	const cardOf = (suit, rank) => SUITS.indexOf(suit) * 8 + RANKS.indexOf(rank);
	const nameOf = (id) => `${rankOf(id)}${SUIT_MARKS[suitOf(id)]}`;
	const sideOf = (seat) => seat % 2;

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

	/**
	 * Who wins `trick` ([{ seat, card }…], the first led): the highest trump
	 * when `trump` is a suit, else the highest card of the suit led.
	 */
	function trickWinner(trick, trump) {
		// The best so far is always of the suit led, or a trump.
		let best = trick[0];
		for (const p of trick.slice(1)) {
			const a = suitOf(p.card);
			const b = suitOf(best.card);
			if (trump && a === trump && b !== trump) best = p;
			else if (a === b && order(p.card) < order(best.card)) best = p;
		}
		return best.seat;
	}

	const DEFAULT_HOUSE = { pair: true, goal: 3 };
	/** The rules from anything (kept on a phone, carried over): the pair on or off, a target offered; the rest the defaults. */
	function cleanHouse(h) {
		const ok = h && typeof h === "object" && !Array.isArray(h);
		return { pair: ok && typeof h.pair === "boolean" ? h.pair : DEFAULT_HOUSE.pair, goal: ok && GOALS.includes(h.goal) ? h.goal : DEFAULT_HOUSE.goal };
	}
	/** Why `patch` is not a change of the rules; null when it is. */
	function houseProblem(patch) {
		if (!patch || typeof patch !== "object" || Array.isArray(patch)) return "no such rule";
		for (const [k, v] of Object.entries(patch)) if (!((k === "pair" && typeof v === "boolean") || (k === "goal" && GOALS.includes(v)))) return "no such rule";
		return null;
	}

	/**
	 * The managed rules (docs/sdk-v2.md, Layer 2). `isHost(id)`: whether that
	 * player may set the house rules and deal. `last()`: the rules last played
	 * on the host's phone, or null (the page keeps them in the game's storage).
	 */
	function game({ isHost = () => true, last = () => null } = {}) {
		let s = null;

		const seatOf = (id) => s.seats.indexOf(id);
		const next = (i) => (i + 1) % 4;

		function event(e) {
			s.n++;
			s.last = { n: s.n, ...e };
			s.log.push(s.last);
			if (s.log.length > LOG) s.log.splice(0, s.log.length - LOG);
		}

		function deal4(deck) {
			for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) s.hands[(s.dealer + 1 + i) % 4].push(deck.pop());
		}

		/** A new hand: shuffle, four each, the auction from the player after the dealer. */
		function newHand() {
			const r = rng(s.rng);
			const deck = Array.from({ length: 32 }, (_, i) => i);
			for (let i = deck.length - 1; i > 0; i--) {
				const j = r.int(i + 1);
				[deck[i], deck[j]] = [deck[j], deck[i]];
			}
			s.hands = [[], [], [], []];
			deal4(deck);
			s.stock = deck;
			s.rng = r.state();
			s.hand++;
			s.phase = "bid";
			s.turn = next(s.dealer);
			s.high = 0;
			s.highBy = -1;
			s.passed = [false, false, false, false];
			s.bids = [];
			s.bidder = -1;
			s.bid = 0;
			s.trump = null;
			s.aside = null;
			s.revealed = false;
			s.revealedBy = -1;
			s.mustTrump = -1;
			s.pair = null;
			s.trick = [];
			s.lastTrick = null;
			s.trickNo = 0;
			s.points = [0, 0];
			s.tricks = [0, 0];
			s.outcome = null;
			event({ kind: "deal", seat: s.dealer, hand: s.hand });
		}

		const hasSuit = (i, suit) => s.hands[i].some((c) => suitOf(c) === suit);
		const led = () => (s.trick.length ? suitOf(s.trick[0].card) : null);
		/** The cards seat `i` may play now. */
		function legal(i) {
			if (s.phase !== "play" || i !== s.turn) return [];
			const hand = s.hands[i];
			if (!hand.length) return i === s.bidder && s.aside !== null ? [s.aside] : [];
			if (s.mustTrump === i && s.revealed && hasSuit(i, s.trump)) return hand.filter((c) => suitOf(c) === s.trump);
			const l = led();
			if (l && hasSuit(i, l)) return hand.filter((c) => suitOf(c) === l);
			return [...hand];
		}
		const canReveal = (i) => s.phase === "play" && i === s.turn && !s.revealed && s.trick.length > 0 && !hasSuit(i, led()) && s.hands[i].length > 0;
		const canPair = (i) =>
			s.phase === "play" &&
			s.house.pair &&
			i === s.turn &&
			s.revealed &&
			!s.pair &&
			s.tricks[sideOf(i)] > 0 &&
			s.hands[i].includes(cardOf(s.trump, "K")) &&
			s.hands[i].includes(cardOf(s.trump, "Q"));

		function reveal(i) {
			s.revealed = true;
			s.revealedBy = i;
			if (s.aside !== null) {
				s.hands[s.bidder].push(s.aside);
				s.aside = null;
			}
			s.mustTrump = hasSuit(i, s.trump) ? i : -1;
			event({ kind: "reveal", seat: i, by: s.bidder, suit: s.trump });
		}

		function endTrick() {
			const trump = s.revealed ? s.trump : null;
			const w = trickWinner(s.trick, trump);
			const pts = s.trick.reduce((a, p) => a + pointsOf(p.card), 0);
			s.points[sideOf(w)] += pts;
			s.tricks[sideOf(w)]++;
			s.trickNo++;
			s.lastTrick = { cards: s.trick.map((p) => ({ ...p })), winner: w, points: pts, n: s.trickNo };
			s.trick = [];
			s.turn = w;
			event({ kind: "trick", seat: w, points: pts, trick: s.trickNo });
			if (s.trickNo === 8) endHand();
		}

		function endHand() {
			const side = sideOf(s.bidder);
			const made = s.points[side] >= s.bid;
			const to = made ? side : 1 - side;
			s.score[to]++;
			s.outcome = { side, bid: s.bid, points: s.points[side], made, to };
			s.history.push({ ...s.outcome, bidder: s.bidder, trump: s.trump });
			event({ kind: "hand", seat: s.bidder, made, points: s.points[side], bid: s.bid });
			s.phase = s.score[to] >= s.house.goal ? "over" : "hand-over";
			s.turn = -1;
		}

		/** One move by seat `me`: nothing when allowed, else the reason. */
		function move(a, me) {
			if (s.phase === "bid") {
				if (me !== s.turn) return "not your turn";
				if (a.pass === true) {
					const others = s.passed.filter(Boolean).length;
					if (others === 3 && s.high === 0) return `everyone else passed: bid at least ${MIN_BID}`;
					s.passed[me] = true;
					s.bids.push({ seat: me, bid: 0 });
					event({ kind: "pass", seat: me });
				} else if (a.bid !== undefined) {
					const n = a.bid;
					if (!Number.isInteger(n) || n < Math.max(MIN_BID, s.high + 1) || n > MAX_BID) return `bid ${Math.max(MIN_BID, s.high + 1)} to ${MAX_BID}`;
					s.high = n;
					s.highBy = me;
					s.bids.push({ seat: me, bid: n });
					event({ kind: "bid", seat: me, bid: n });
				} else return "bid or pass";
				const left = [0, 1, 2, 3].filter((i) => !s.passed[i]);
				if (left.length === 1 && s.high > 0) {
					s.bidder = s.highBy;
					s.bid = s.high;
					s.phase = "trump";
					s.turn = s.bidder;
					event({ kind: "won", seat: s.bidder, bid: s.bid });
					return;
				}
				let t = next(me);
				while (s.passed[t]) t = next(t);
				s.turn = t;
				return;
			}
			if (s.phase === "trump") {
				if (me !== s.bidder) return "the bidder is picking the trump";
				if (!Number.isInteger(a.trump) || !s.hands[me].includes(a.trump)) return "lay one of your cards aside for the trump";
				s.hands[me].splice(s.hands[me].indexOf(a.trump), 1);
				s.aside = a.trump;
				s.trump = suitOf(a.trump);
				deal4(s.stock);
				s.stock = [];
				s.phase = "play";
				s.turn = next(s.dealer);
				event({ kind: "trump", seat: me });
				return;
			}
			if (s.phase !== "play") return "not now";
			if (me !== s.turn) return "not your turn";
			if (a.reveal === true) {
				if (s.revealed) return "the trump is already shown";
				if (!canReveal(me)) return s.trick.length ? "you can follow suit" : "lead any card: the trump can be asked for only when you can't follow";
				reveal(me);
				return;
			}
			if (a.pair === true) {
				if (!canPair(me)) return "no pair to show now";
				const mine = sideOf(me) === sideOf(s.bidder);
				const was = s.bid;
				s.bid = mine ? Math.max(MIN_BID, s.bid - PAIR) : Math.min(MAX_BID, s.bid + PAIR);
				s.pair = { seat: me, from: was, to: s.bid };
				event({ kind: "pair", seat: me, from: was, to: s.bid });
				return;
			}
			if (a.play === undefined) return "play a card";
			const id = a.play;
			const ok = legal(me);
			if (!ok.includes(id)) {
				if (!s.hands[me].includes(id) && id !== s.aside) return "that card is not in your hand";
				if (s.mustTrump === me) return "you asked for the trump: play one";
				return "follow suit";
			}
			if (id === s.aside) {
				// The bidder's last card is the one laid aside: playing it shows the trump.
				s.aside = null;
				s.revealed = true;
				s.revealedBy = me;
				event({ kind: "reveal", seat: me, by: me, suit: s.trump });
			} else s.hands[me].splice(s.hands[me].indexOf(id), 1);
			s.trick.push({ seat: me, card: id });
			if (s.mustTrump === me) s.mustTrump = -1;
			event({ kind: "play", seat: me, card: id });
			if (s.trick.length === 4) endTrick();
			else s.turn = next(me);
		}

		// ------------------------------------------------------------ the bot

		/** What a bot would bid on its four cards: its estimate of what its side can make. */
		function estimate(hand) {
			const by = Object.fromEntries(SUITS.map((x) => [x, hand.filter((c) => suitOf(c) === x)]));
			const best = SUITS.reduce((a, b) => (by[b].length > by[a].length || (by[b].length === by[a].length && by[b].reduce((t, c) => t + pointsOf(c), 0) > by[a].reduce((t, c) => t + pointsOf(c), 0)) ? b : a));
			let v = 13;
			for (const c of hand) v += { J: 2.4, 9: 1.4, A: 0.8, 10: 0.6 }[rankOf(c)] ?? 0;
			v += Math.max(0, by[best].length - 1) * 1.3;
			if (by[best].some((c) => rankOf(c) === "J")) v += 1;
			return { bid: Math.min(24, Math.floor(v)), suit: best };
		}
		function botBid(i) {
			const forced = s.passed.filter(Boolean).length === 3 && s.high === 0;
			const want = Math.max(MIN_BID, s.high + 1);
			let { bid } = estimate(s.hands[i]);
			if (s.highBy >= 0 && sideOf(s.highBy) === sideOf(i)) bid -= 2; // do not outbid a partner lightly
			if (forced) return { bid: MIN_BID };
			return want <= bid ? { bid: want } : { pass: true };
		}
		function botTrump(i) {
			const { suit } = estimate(s.hands[i]);
			const mine = s.hands[i].filter((c) => suitOf(c) === suit);
			// Lay aside the weakest card of the suit: it comes back when shown.
			return { trump: mine.reduce((a, b) => (order(b) > order(a) ? b : a)) };
		}
		/** The trump as this seat knows it: the bidder always, everyone once shown. */
		const knownTrump = (i) => (s.revealed || i === s.bidder ? s.trump : null);
		function botPlay(i) {
			if (canPair(i)) return { pair: true };
			const ok = legal(i);
			const low = (list) => list.reduce((a, b) => (pointsOf(b) < pointsOf(a) || (pointsOf(b) === pointsOf(a) && order(b) > order(a)) ? b : a));
			const high = (list) => list.reduce((a, b) => (pointsOf(b) > pointsOf(a) || (pointsOf(b) === pointsOf(a) && order(b) < order(a)) ? b : a));
			const trump = knownTrump(i);
			if (!s.trick.length) {
				// Lead a J (it cannot be beaten in its suit); else a low card of a long side suit.
				const js = ok.filter((c) => rankOf(c) === "J" && suitOf(c) !== trump);
				if (js.length) return { play: js[0] };
				const side = ok.filter((c) => suitOf(c) !== trump);
				const pool = side.length ? side : ok;
				const lowNo = pool.filter((c) => !pointsOf(c));
				return { play: low(lowNo.length ? lowNo : pool) };
			}
			const counting = s.revealed ? s.trump : null;
			const now = trickWinner(s.trick, counting);
			const partner = sideOf(now) === sideOf(i);
			const last = s.trick.length === 3;
			const pts = s.trick.reduce((a, p) => a + pointsOf(p.card), 0);
			const beats = (c) => trickWinner([...s.trick, { seat: i, card: c }], counting) === i;
			const following = hasSuit(i, led());
			const partnerSafe = partner && (last || (s.trick.find((p) => p.seat === now) && rankOf(s.trick.find((p) => p.seat === now).card) === "J"));
			if (following) {
				if (partnerSafe) return { play: high(ok) };
				const win = ok.filter(beats);
				if (win.length && (pts > 0 || last || win.some((c) => rankOf(c) === "J"))) return { play: win.reduce((a, b) => (order(b) > order(a) ? b : a)) };
				return { play: low(ok) };
			}
			// Can't follow.
			if (partnerSafe) {
				const side = ok.filter((c) => suitOf(c) !== trump);
				return { play: high(side.length ? side : ok) };
			}
			if (!s.revealed && canReveal(i)) {
				const holds = i === s.bidder ? true : null; // the bidder knows; anyone else asks blind
				if ((holds && pts >= 1 && hasSuit(i, s.trump)) || (holds === null && pts >= 2 && !partner)) return { reveal: true };
			}
			if (s.revealed && !partner) {
				const win = ok.filter((c) => suitOf(c) === s.trump && beats(c));
				if (win.length && pts > 0) return { play: win.reduce((a, b) => (order(b) > order(a) ? b : a)) };
			}
			const side = ok.filter((c) => suitOf(c) !== trump);
			return { play: low(side.length ? side : ok) };
		}
		function botMove(i) {
			if (s.phase === "bid") return botBid(i);
			if (s.phase === "trump") return botTrump(i);
			if (s.phase === "play") return botPlay(i);
			return null;
		}

		/** Seats that left are played for, and a bot left on turn by its own move moves on (the platform asks once a turn). */
		function carryOn(mover) {
			for (let k = 0; k < 40 && ["bid", "trump", "play"].includes(s.phase); k++) {
				const t = s.turn;
				if (!(s.gone[t] || (t === mover && s.bots[t]))) break;
				const a = botMove(t);
				if (!a || move(a, t) != null) break;
			}
		}

		return {
			init({ seats, seed, match, first }) {
				const ids = seats.map((p) => p.id);
				// Who starts (docs/sdk-v2.md): `first` bids and leads first, so the
				// dealer sits before them; from an older shell, the deal moves on
				// one seat from the last match's first dealer.
				let opener = ids.indexOf(first);
				if (opener < 0 && s?.firstDealerId != null) {
					const prev = ids.indexOf(s.firstDealerId);
					opener = ((prev >= 0 ? prev : 0) + 2) % Math.max(1, ids.length);
				}
				const sd = Math.abs(Math.floor(Number(seed) || 0));
				if (opener < 0) opener = sd % Math.max(1, ids.length);
				const dealer = (opener + ids.length - 1) % Math.max(1, ids.length);
				// The rules only the first time (above): PLAY AGAIN deals straight
				// away with the rules picked at the end, else this game's; one
				// person with three bots with the rules last played on the host's
				// phone, or the defaults.
				const prev = s;
				const people = seats.filter((p) => !p.bot).length;
				let saved = null;
				try {
					saved = prev ? (prev.next ?? prev.house) : last();
				} catch {}
				const straight = ids.length === 4 && (prev ? (match ?? 0) > 0 : people === 1);
				s = {
					match: (match ?? 0) + 1,
					phase: "setup",
					house: cleanHouse(saved),
					next: null, // the rules picked at the end for PLAY AGAIN (setNext)
					seats: ids,
					bots: seats.map((p) => !!p.bot),
					gone: ids.map(() => false),
					dealer,
					firstDealerId: ids[dealer] ?? null,
					score: [0, 0],
					history: [],
					hand: 0,
					hands: [[], [], [], []],
					turn: -1,
					log: [],
					last: null,
					n: 0,
					rng: (sd ^ 0x29292929) >>> 0,
				};
				if (straight) {
					newHand();
					carryOn(-1);
				}
			},

			apply({ action, by }) {
				const a = action ?? {};
				const me = seatOf(by);
				if (s.phase === "setup") {
					if (a.house === undefined && !a.start) return "wait for the deal";
					if (!isHost(by)) return "the host sets the rules";
					if (a.house !== undefined) {
						const why = houseProblem(a.house);
						if (why) return why;
						s.house = { ...s.house, ...a.house };
					}
					if (a.start) {
						if (s.seats.length !== 4) return "29 needs four players";
						newHand();
						carryOn(-1);
					}
					return;
				}
				if (s.phase === "hand-over") {
					if (a.next === undefined) return "the hand is over";
					if (a.next !== s.hand) return "stale";
					s.dealer = next(s.dealer);
					newHand();
					carryOn(-1);
					return;
				}
				if (s.phase === "over") return "the game is over";
				if (me < 0) return "you are not playing";
				const why = move(a, me);
				if (why == null) carryOn(me);
				return why;
			},

			view({ seat }) {
				const you = seat == null ? -1 : seatOf(seat);
				const play = s.phase === "play";
				const open = s.phase === "hand-over" || s.phase === "over";
				return {
					match: s.match,
					phase: s.phase,
					house: { ...s.house },
					seats: [...s.seats],
					bots: [...s.bots],
					gone: [...s.gone],
					you,
					dealer: s.dealer,
					hand: s.hand,
					turn: s.turn,
					cards: you >= 0 ? [...s.hands[you]] : [],
					counts: s.hands.map((h) => h.length),
					high: s.high ?? 0,
					highBy: s.highBy ?? -1,
					passed: s.passed ? [...s.passed] : [false, false, false, false],
					bids: (s.bids ?? []).map((b) => ({ ...b })),
					bidder: s.bidder ?? -1,
					bid: s.bid ?? 0,
					// The trump: the bidder's own secret until it is shown.
					trump: s.revealed || open || (you >= 0 && you === s.bidder) ? (s.trump ?? null) : null,
					aside: s.aside != null ? (you === s.bidder ? s.aside : -1) : null,
					revealed: !!s.revealed,
					revealedBy: s.revealedBy ?? -1,
					mustTrump: s.mustTrump ?? -1,
					pair: s.pair ? { ...s.pair } : null,
					trick: (s.trick ?? []).map((p) => ({ ...p })),
					lastTrick: s.lastTrick ? { ...s.lastTrick, cards: s.lastTrick.cards.map((p) => ({ ...p })) } : null,
					trickNo: s.trickNo ?? 0,
					points: s.points ? [...s.points] : [0, 0],
					tricks: s.tricks ? [...s.tricks] : [0, 0],
					score: [...s.score],
					outcome: s.outcome ? { ...s.outcome } : null,
					history: s.history.map((h) => ({ ...h })),
					legal: play ? legal(you) : [],
					canReveal: play && you >= 0 && canReveal(you),
					canPair: play && you >= 0 && canPair(you),
					minBid: Math.max(MIN_BID, (s.high ?? 0) + 1),
					mustBid: s.phase === "bid" && s.passed.filter(Boolean).length === 3 && s.high === 0,
					log: s.log.map((e) => ({ ...e })),
				};
			},

			turn: () => (["bid", "trump", "play"].includes(s.phase) && s.turn >= 0 ? [s.seats[s.turn]] : []),

			bot: ({ seat }) => {
				const i = seatOf(seat);
				if (i < 0 || i !== s.turn) return null;
				return botMove(i);
			},

			result() {
				if (s.phase !== "over") return null;
				const w = s.score[0] > s.score[1] ? 0 : 1;
				const team = (side) => s.seats.filter((_, i) => sideOf(i) === side);
				return {
					kind: "teams",
					ranking: [team(w), team(1 - w)],
					scores: Object.fromEntries(s.seats.map((id, i) => [id, s.score[sideOf(i)]])),
					// What game.json's achievements read (the arcade's docs/platform.md):
					// each player's side's points and the other side's.
					seatFacts: Object.fromEntries(s.seats.map((id, i) => [id, { ours: s.score[sideOf(i)], theirs: s.score[1 - sideOf(i)] }])),
					details: [
						{ label: "Hands played", value: s.history.length },
						{ label: "Bids made", value: s.history.filter((h) => h.made).length },
						{ label: "Pair rule", value: s.house.pair ? "on" : "off" },
					],
				};
			},

			/** The host chose SKIP TURN for someone away: their move is made for them, as a bot would. */
			skip() {
				const t = s.turn;
				if (!["bid", "trump", "play"].includes(s.phase) || t < 0) return false;
				const a = botMove(t);
				if (!a || move(a, t) != null) return false;
				carryOn(-1);
				return true;
			},

			/** A player left for good: from now on their seat plays itself, as a bot. */
			leave({ seat }) {
				const i = seatOf(seat);
				if (i < 0 || s.gone[i]) return false;
				s.gone[i] = true;
				carryOn(-1);
				return true;
			},

			/** Not a rule: the next game's rules, for the host's page to offer at the end ("Next game: … · CHANGE"). */
			nextGame: () => ({ house: { ...(s.next ?? s.house) } }),
			/** Not a rule: change the next game's rules once this one is over (the host's page, on its own live rules). Nothing when taken, else the reason. */
			setNext(patch) {
				if (s.phase !== "over") return "only once the game is over";
				const why = houseProblem(patch);
				if (why) return why;
				s.next = { ...(s.next ?? s.house), ...patch };
			},

			snapshot: () => JSON.parse(JSON.stringify({ s })),
			restore({ snapshot }) {
				const copy = JSON.parse(JSON.stringify(snapshot));
				s = copy.s;
			},
		};
	}

	globalThis.twentyNineRules = { DEFAULT_HOUSE, cleanHouse, SUITS, SUIT_NAMES, SUIT_MARKS, RANKS, POINTS, MIN_BID, MAX_BID, PAIR, GOALS, suitOf, rankOf, order, pointsOf, cardOf, nameOf, sideOf, trickWinner, game };
})();
