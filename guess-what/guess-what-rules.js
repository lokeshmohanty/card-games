// guess-what/guess-what-rules.js — Guess What's rules: the rounds, the
// clock, the pictures, the clues, the guesses, the scores and the bots.
//
// No document here and no platform: guess-what.js (the page) hands `game()` to
// the platform as SDK v2 managed rules (docs/sdk-v2.md in lokeshmohanty/games),
// and test-guess-what.mjs loads this file (after guess-what-pictures.js) into
// Node.
//
// ## Every phone (the party game)
//
// Players take turns to guess. In a round one player is the guesser: every
// other phone shows the PICTURE, the guesser's shows nine pictures from the
// same category, one of them the answer. The others give clues — out loud,
// or typed into their phone (a typed clue may not use the picture's name;
// typed clues show on every phone, which is what makes the game work for a
// party that is not in one room). The guesser taps the picture they think it
// is before the clock runs out. A wrong tap strikes that picture out and
// costs five seconds.
//
//   Right: the guesser scores 3 (4 if more than half the time is left),
//   every clue-giver 1, and whoever typed the last clue before it 1 more.
//   Time up: nobody scores.
//
// Everyone guesses the same number of times (1, 2 or 3: the host picks), the
// first guesser going round between games (docs/sdk-v2.md "Who starts").
//
// Bots play both parts: as clue-givers they type the picture's own clues
// (guess-what-pictures.js) at a person's pace; as guesser they pick once a
// clue or two is in, more surely the more clues there are.
//
// ## One phone (people on the host's phone)
//
// When the table is one person and people sharing their phone (the quick
// table's PERSON seats, `local` in init), the game is played on that phone:
// the guesser looks away, the others see the picture and talk; GOT IT when
// the guesser says it, PASS to move on. As many pictures as you can get in
// the time; a point for each. Bot seats sit out.
//
// ## The clock
//
// Every phase has a deadline on the host's clock; each view says how long is
// left (a duration — two phones' clocks disagree) and when the host should
// next look (`msNext`). The host's page then acts `{ clock }`: the rules make
// the bots' moves that are due and end a phase whose time is up. A clock for
// a phase that has gone is refused, so nothing but time (or the answer) ends
// a phase.
//
// ## The options, only the first time
//
// Lokesh, 2026-11-23 (as Ludo): the host picks the categories, the seconds
// and the turns before the first game only. PLAY AGAIN starts straight away
// with the same options, or those picked at the end ("Next game: … ·
// CHANGE": `nextGame()` / `setNext()`); one person with bots, or with people
// on their phone, starts straight away with the options last played on the
// host's phone (`last()`), or the defaults.
//
// ## No repeats
//
// Pictures are dealt from the categories the host picks, never one already
// seen on this device until every picture in those categories has been: the
// page keeps the seen list in the game's storage (`seen` in, `seenKeys()`
// out), and a snapshot carries it to an heir.

(() => {
	const P = globalThis.guessWhatPictures;
	const SECS = [30, 45, 60];
	const TURNS = [1, 2, 3];
	const READY_MS = 4000;
	const REVEAL_MS = 4500;
	const TALLY_MS = 5000;
	const WRONG_MS = 5000;
	const TICK_MS = 2000; // the longest a running round goes without a clock move (so without a fresh copy for the heir)
	const CHOICES = 9;
	const CLUE_MAX = 30;
	const CLUE_GAP_MS = 1200;
	const CLUES_KEPT = 24;
	const SCORE = { guess: 3, fast: 1, giver: 1, best: 1 };

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

	/** Why a typed clue may not be given for picture `item`; null when it may. */
	function clueProblem(text, item) {
		if (typeof text !== "string") return "say something";
		const t = text.trim().replace(/\s+/g, " ");
		if (!t) return "say something";
		if (t.length > CLUE_MAX) return `at most ${CLUE_MAX} letters`;
		// Whole words only, with their plurals (review, 2026-11-24: "hand" is
		// not "and", "rainbow" not "bow"); a long name run together is caught
		// anywhere ("e l e p h a n t", "ele-phant").
		const tokens = t.toLowerCase().split(/[^a-z]+/).filter(Boolean);
		const forms = (w) => [w, `${w}s`, `${w}es`, ...(w.endsWith("y") ? [`${w.slice(0, -1)}ies`] : [])];
		for (const w of item.words) if (tokens.some((tok) => forms(w).includes(tok))) return "that gives it away";
		const squashed = tokens.join("");
		for (const w of item.squash ?? []) if (squashed.includes(w)) return "that gives it away";
		if ([...t].some((ch) => ch === item.e || /\p{Extended_Pictographic}/u.test(ch))) return "words only";
		return null;
	}

	const DEFAULT_OPTS = { cats: P.CATEGORIES.map((c) => c.id), secs: 45, turns: 2 };
	const isCat = (c) => P.CATEGORIES.some((x) => x.id === c);
	/** The options from anything (kept on a phone, carried over): what is offered, the rest the defaults. */
	function cleanOpts(o) {
		const ok = o && typeof o === "object" && !Array.isArray(o);
		const cats = ok && Array.isArray(o.cats) ? [...new Set(o.cats.filter(isCat))] : [];
		return { cats: cats.length ? cats : [...DEFAULT_OPTS.cats], secs: ok && SECS.includes(o.secs) ? o.secs : DEFAULT_OPTS.secs, turns: ok && TURNS.includes(o.turns) ? o.turns : DEFAULT_OPTS.turns };
	}
	/** Why `o` is not a change of the options; null when it is. */
	function optsProblem(o) {
		if (!o || typeof o !== "object" || Array.isArray(o)) return "no such option";
		for (const k of Object.keys(o)) if (!["cats", "secs", "turns"].includes(k)) return "no such option";
		if (o.cats !== undefined && (!Array.isArray(o.cats) || !o.cats.length || !o.cats.every(isCat))) return "pick at least one category";
		if (o.secs !== undefined && !SECS.includes(o.secs)) return "no such time";
		if (o.turns !== undefined && !TURNS.includes(o.turns)) return "no such number";
		return null;
	}
	const withOpts = (base, o) => ({ ...base, ...o, cats: [...new Set(o.cats ?? base.cats)] });

	/**
	 * The managed rules (docs/sdk-v2.md, Layer 2). `now()`: the host's clock
	 * (tests pass their own). `seen`: picture keys this device has dealt.
	 * `isHost(id)`: whether that player may pick the options and start.
	 * `last()`: the options last played on the host's phone, or null (the page
	 * keeps them in the game's storage).
	 */
	function game({ now = () => Date.now(), seen: seenIn = [], isHost = () => true, last = () => null } = {}) {
		let s = null;
		let seen = new Set(Array.isArray(seenIn) ? seenIn : []);

		const seatOf = (id) => s.seats.indexOf(id);
		const key = () => `${s.match}:${s.round}:${s.phase}`;
		const live = () => s.players.filter((i) => !s.gone[i]);

		/** A picture from the host's categories that this device has not seen (or, all seen, the pool afresh). */
		function draw(r) {
			const cats = new Set(s.opts.cats);
			let pool = P.ALL.map((p, i) => i).filter((i) => cats.has(P.ALL[i].cat) && !seen.has(P.ALL[i].key));
			if (!pool.length) {
				for (const p of P.ALL) if (cats.has(p.cat)) seen.delete(p.key);
				pool = P.ALL.map((p, i) => i).filter((i) => cats.has(P.ALL[i].cat));
			}
			const i = pool[r.int(pool.length)];
			seen.add(P.ALL[i].key);
			s.dealt++;
			return i;
		}
		function choicesFor(item, r) {
			const same = P.ALL.map((p, i) => i).filter((i) => i !== item && P.ALL[i].cat === P.ALL[item].cat);
			for (let i = same.length - 1; i > 0; i--) {
				const j = r.int(i + 1);
				[same[i], same[j]] = [same[j], same[i]];
			}
			const out = [item, ...same.slice(0, CHOICES - 1)];
			for (let i = out.length - 1; i > 0; i--) {
				const j = r.int(i + 1);
				[out[i], out[j]] = [out[j], out[i]];
			}
			return out;
		}

		function nextRound() {
			s.round++;
			s.result = null;
			s.clues = [];
			s.struck = [];
			s.plan = [];
			if (s.round >= s.total || live().length < (s.mode === "one" ? 1 : 2)) {
				s.phase = "over";
				s.deadline = 0;
				return;
			}
			// The guesser: this round's in the queue (a leaver's turns are taken out of it).
			s.guesser = s.queue[s.round];
			const r = rng(s.rng);
			if (s.mode === "phones") {
				s.item = draw(r);
				s.choices = choicesFor(s.item, r);
				s.phase = "ready";
				s.deadline = now() + READY_MS;
			} else {
				s.item = null;
				s.got = [];
				s.phase = "ready"; // waits for GO: the phone changes hands
				s.deadline = 0;
			}
			s.rng = r.state();
		}

		function beginGuess() {
			const r = rng(s.rng);
			s.phase = "guess";
			s.startAt = now();
			s.deadline = s.startAt + s.opts.secs * 1000;
			// The bots' moves this round, as times from its start.
			const givers = live().filter((i) => i !== s.guesser && s.bots[i] && !s.local[i]);
			const clues = [...P.ALL[s.item].clues];
			for (let i = clues.length - 1; i > 0; i--) {
				const j = r.int(i + 1);
				[clues[i], clues[j]] = [clues[j], clues[i]];
			}
			if (givers.length) {
				let t = 2500 + r.int(2000);
				clues.forEach((text, k) => {
					s.plan.push({ at: t, kind: "clue", by: givers[k % givers.length], text });
					t += 4500 + r.int(3000);
				});
			}
			if (s.bots[s.guesser] && !s.local[s.guesser]) s.plan.push({ at: 6000 + r.int(2500), kind: "pick" });
			s.plan.sort((a, b) => a.at - b.at);
			s.rng = r.state();
		}

		function addClue(by, text) {
			s.clueN++;
			s.clues.push({ n: s.clueN, by, text: text.trim().replace(/\s+/g, " ") });
			if (s.clues.length > CLUES_KEPT) s.clues.splice(0, s.clues.length - CLUES_KEPT);
			s.lastClue[by] = now();
		}

		/** A guesser's own tally, for the arcade's achievements: right, missed, fast (a fast one is right too). */
		function mark(i, how) {
			const m = { right: 0, missed: 0, fast: 0, ...(s.mine?.[i] ?? {}) };
			if (how === "missed") m.missed++;
			else m.right++;
			if (how === "fast") m.fast++;
			s.mine = { ...(s.mine ?? {}), [i]: m };
		}

		function reveal(right) {
			const left = Math.max(0, s.deadline - now());
			const givers = live().filter((i) => i !== s.guesser);
			const best = s.clues.length ? s.clues[s.clues.length - 1].by : null;
			const gained = {};
			if (right) {
				gained[s.guesser] = SCORE.guess + (left > (s.opts.secs * 1000) / 2 ? SCORE.fast : 0);
				for (const i of givers) gained[i] = (gained[i] ?? 0) + SCORE.giver;
				if (best != null && best !== s.guesser && !s.gone[best]) gained[best] = (gained[best] ?? 0) + SCORE.best;
			}
			for (const [i, n] of Object.entries(gained)) s.scores[i] = (s.scores[i] ?? 0) + n;
			mark(s.guesser, right ? (left > (s.opts.secs * 1000) / 2 ? "fast" : "right") : "missed");
			s.result = { right, item: s.item, guesser: s.guesser, secsLeft: Math.ceil(left / 1000), gained, best: right ? best : null };
			if (right) s.rights++;
			s.phase = "reveal";
			s.deadline = now() + REVEAL_MS;
		}

		function pick(i) {
			if (s.choices[i] === s.item) return reveal(true);
			s.struck.push(i);
			s.deadline -= WRONG_MS;
			if (s.deadline <= now()) reveal(false);
		}

		/** What is due on the clock: the bots' moves, a phase whose time is up. */
		function tick() {
			const t = now();
			if (s.phase === "ready" && s.mode === "phones" && t >= s.deadline) beginGuess();
			if (s.phase === "guess") {
				while (s.phase === "guess" && s.plan.length && s.startAt + s.plan[0].at <= t) {
					const e = s.plan.shift();
					if (e.kind === "clue" && !s.gone[e.by]) addClue(e.by, e.text);
					if (e.kind === "pick") {
						const r = rng(s.rng);
						const sure = s.clues.length ? Math.min(0.92, 0.3 + 0.22 * s.clues.length) : 0.12;
						const open = s.choices.map((_, k) => k).filter((k) => !s.struck.includes(k));
						const answer = s.choices.indexOf(s.item);
						const wrong = open.filter((k) => k !== answer);
						pick(r.next() < sure || !wrong.length ? answer : wrong[r.int(wrong.length)]);
						if (s.phase === "guess") s.plan.push({ at: t - s.startAt + 3500 + r.int(2500), kind: "pick" });
						s.plan.sort((a, b) => a.at - b.at);
						s.rng = r.state();
					}
				}
				if (s.phase === "guess" && t >= s.deadline) reveal(false);
			} else if (s.phase === "reveal" && t >= s.deadline) nextRound();
			else if (s.phase === "talk" && t >= s.deadline) {
				s.tally = { guesser: s.guesser, got: [...s.got] };
				s.phase = "tally";
				s.deadline = t + TALLY_MS;
			} else if (s.phase === "tally" && t >= s.deadline) nextRound();
		}

		function start() {
			const people = s.seats.map((_, i) => i).filter((i) => !s.bots[i]);
			const local = s.seats.map((_, i) => i).filter((i) => s.local[i]);
			s.mode = people.length === 1 && local.length ? "one" : "phones";
			s.players = s.mode === "one" ? [...people, ...local].sort((a, b) => a - b) : s.seats.map((_, i) => i);
			// The rotation starts with the opener (or the next player after them).
			const at = s.players.findIndex((i) => i >= s.opener);
			const k = at < 0 ? 0 : at;
			s.order = [...s.players.slice(k), ...s.players.slice(0, k)];
			// Every round's guesser, in turn: the rotation, as many times as turns each.
			s.queue = Array.from({ length: s.opts.turns }, () => s.order).flat();
			s.total = s.queue.length;
			s.scores = Object.fromEntries(s.players.map((i) => [i, 0]));
			s.mine = {};
			s.round = -1;
			nextRound();
		}

		const nameFor = (i) => `Player ${s.players.indexOf(i) + 1}`;

		return {
			init({ seats, seed, match, first }) {
				const ids = seats.map((p) => p.id);
				// Who guesses first (docs/sdk-v2.md "Who starts"): the platform's
				// `first`; from an older shell, the seat after the last opener, or a
				// draw from the seed.
				let opener = ids.indexOf(first);
				if (opener < 0 && s?.openerId != null) {
					const prev = ids.indexOf(s.openerId);
					opener = prev >= 0 ? (prev + 1) % ids.length : Math.max(0, s.seats.indexOf(s.openerId)) % ids.length;
				}
				const sd = Math.abs(Math.floor(Number(seed) || 0));
				if (opener < 0) opener = sd % Math.max(1, ids.length);
				// The options only the first time (above): PLAY AGAIN starts
				// straight away with those picked at the end, else this game's;
				// one person (with bots, or people on their phone) with the options
				// last played on the host's phone, or the defaults.
				const prev = s;
				const people = seats.filter((p) => !p.bot).length;
				let saved = null;
				try {
					saved = prev ? (prev.next ?? prev.opts) : last();
				} catch {}
				const straight = prev ? (match ?? 0) > 0 : people === 1 && ids.length > 1;
				s = {
					match: (match ?? 0) + 1,
					phase: "setup",
					opts: cleanOpts(saved),
					next: null, // the options picked at the end for PLAY AGAIN (setNext)
					seats: ids,
					bots: seats.map((p) => !!p.bot),
					local: seats.map((p) => !!p.local),
					gone: ids.map(() => false),
					opener,
					openerId: ids[opener] ?? null,
					mode: null,
					players: [],
					order: [],
					queue: [], // each round's guesser
					round: -1,
					total: 0,
					guesser: null,
					item: null,
					choices: [],
					struck: [],
					clues: [],
					clueN: s?.clueN ?? 0,
					lastClue: {},
					scores: {},
					deadline: 0,
					startAt: 0,
					plan: [],
					result: null,
					got: [],
					tally: null,
					dealt: 0,
					rights: 0,
					rng: (sd ^ 0x6e55e5) >>> 0,
				};
				if (straight) start();
			},

			apply({ action, by }) {
				const a = action ?? {};
				const me = seatOf(by);
				if ("clock" in a) {
					if (a.clock !== key()) return "stale";
					tick();
					return;
				}
				if (s.phase === "setup") {
					if (a.opts === undefined && !a.start) return "wait for the start";
					if (!isHost(by)) return "the host picks";
					if (a.opts !== undefined) {
						const why = optsProblem(a.opts);
						if (why) return why;
						s.opts = withOpts(s.opts, a.opts);
					}
					if (a.start) start();
					return;
				}
				if (me < 0 || s.gone[me]) return "you are not playing";
				if (s.mode === "phones") {
					if (a.clue !== undefined) {
						if (s.phase !== "guess" && s.phase !== "ready") return "not now";
						if (me === s.guesser) return "you are guessing";
						const why = clueProblem(a.clue, P.ALL[s.item]);
						if (why) return why;
						if (now() - (s.lastClue[me] ?? 0) < CLUE_GAP_MS) return "one clue at a time";
						addClue(me, a.clue);
						return;
					}
					if (a.pick !== undefined) {
						if (s.phase !== "guess") return "not now";
						if (me !== s.guesser) return "the guesser picks";
						if (!Number.isInteger(a.pick) || a.pick < 0 || a.pick >= s.choices.length) return "no such picture";
						if (s.struck.includes(a.pick)) return "that one is out";
						pick(a.pick);
						return;
					}
					return "unknown move";
				}
				// One phone: the person holding it runs the turns.
				if (s.bots[me] && !s.local[me]) return "you are not playing";
				if (a.go === true) {
					if (s.phase !== "ready") return "not now";
					const r = rng(s.rng);
					s.item = draw(r);
					s.rng = r.state();
					s.phase = "talk";
					s.startAt = now();
					s.deadline = s.startAt + s.opts.secs * 1000;
					return;
				}
				if (a.got === true || a.pass === true) {
					if (s.phase !== "talk") return "not now";
					if (a.got) {
						s.got.push(s.item);
						s.scores[s.guesser] = (s.scores[s.guesser] ?? 0) + 1;
						s.rights++;
						mark(s.guesser, "right");
					}
					const r = rng(s.rng);
					s.item = draw(r);
					s.rng = r.state();
					return;
				}
				if (a.next === true) {
					if (s.phase !== "tally") return "not now";
					nextRound();
					return;
				}
				return "unknown move";
			},

			view({ seat }) {
				const you = seat == null ? -1 : seatOf(seat);
				const t = now();
				const open = s.phase === "reveal" || s.phase === "over";
				const item = s.item != null ? P.ALL[s.item] : null;
				const pic = (p) => p && { e: p.e, name: p.name };
				let picture = null;
				if (s.mode === "phones" && item && (open || (you !== s.guesser && (s.phase === "ready" || s.phase === "guess")))) picture = pic(item);
				if (s.mode === "one" && item && s.phase === "talk") picture = pic(item);
				let msNext = null;
				if (s.deadline) msNext = s.deadline - t;
				if (s.phase === "guess" && s.plan.length) msNext = Math.min(msNext, s.startAt + s.plan[0].at - t);
				// While a round runs, a clock move at least every TICK_MS: each move
				// sends the heir a fresh copy, so an heir's time is never more than
				// that out (re-review, 2026-11-24), with no clocks compared across phones.
				if (msNext != null && (s.phase === "ready" || s.phase === "guess" || s.phase === "talk")) msNext = Math.min(msNext, TICK_MS);
				return {
					match: s.match,
					phase: s.phase,
					mode: s.mode,
					opts: { ...s.opts, cats: [...s.opts.cats] },
					seats: [...s.seats],
					bots: [...s.bots],
					local: [...s.local],
					gone: [...s.gone],
					you,
					players: [...s.players],
					round: s.round,
					total: s.total,
					guesser: s.guesser,
					clock: key(),
					msLeft: s.deadline ? Math.max(0, s.deadline - t) : null,
					msNext: msNext == null ? null : Math.max(0, msNext),
					secs: s.opts.secs,
					picture,
					category: item ? item.cat : null,
					choices: s.mode === "phones" ? s.choices.map((i) => P.ALL[i].e) : [],
					// Their names, for a phone that cannot draw a picture: it shows the name instead.
					choiceNames: s.mode === "phones" ? s.choices.map((i) => P.ALL[i].name) : [],
					struck: [...s.struck],
					clues: s.clues.map((c) => ({ ...c })),
					scores: { ...s.scores },
					result: s.result && { ...s.result, gained: { ...s.result.gained }, picture: pic(P.ALL[s.result.item]), answer: s.choices.indexOf(s.result.item) },
					got: s.mode === "one" ? s.got.map((i) => pic(P.ALL[i])) : [],
					tally: s.tally && { guesser: s.tally.guesser, got: s.tally.got.map((i) => pic(P.ALL[i])) },
					// People on the host's phone have no names of their own: "Player 2"…
					names: s.mode === "one" ? Object.fromEntries(s.players.filter((i) => s.local[i]).map((i) => [i, nameFor(i)])) : null,
				};
			},

			turn: () => [],
			bot: () => null,

			/** Places by points; with people on one phone, their seats named for the end card. */
			result() {
				if (s.phase !== "over") return null;
				const pts = (i) => s.scores[i] ?? 0;
				const ids = s.players.filter((i) => !s.gone[i] || pts(i) > 0);
				const levels = [...new Set(ids.map(pts))].sort((a, b) => b - a);
				const out = {
					kind: "ffa",
					ranking: levels.map((p) => ids.filter((i) => pts(i) === p).map((i) => s.seats[i])),
					scores: Object.fromEntries(ids.map((i) => [s.seats[i], pts(i)])),
					details: [
						{ label: "Pictures", value: s.dealt },
						{ label: s.mode === "one" ? "Got" : "Guessed right", value: s.rights },
					],
				};
				// What game.json's achievements and records read (the arcade's docs/platform.md).
				out.seatFacts = Object.fromEntries(ids.map((i) => [s.seats[i], { right: 0, missed: 0, fast: 0, ...(s.mine?.[i] ?? {}) }]));
				if (s.mode === "one") out.names = Object.fromEntries(s.players.filter((i) => s.local[i]).map((i) => [s.seats[i], nameFor(i)]));
				return out;
			},

			/** A player left: out of the rotation; a guesser gone ends the round. */
			leave({ seat }) {
				const i = seatOf(seat);
				if (i < 0 || s.gone[i]) return false;
				s.gone[i] = true;
				if (s.phase === "setup" || s.phase === "over") return true;
				// Their turns still to come go, so everyone left guesses as often (review, 2026-11-24).
				s.queue = s.queue.filter((g, k) => k <= s.round || g !== i);
				s.total = s.queue.length;
				if (i === s.guesser && (s.phase === "guess" || s.phase === "ready")) {
					if (s.mode === "phones" && s.phase === "guess") reveal(false);
					else nextRound();
				}
				if (s.mode === "phones" && live().length < 2) {
					s.phase = "over";
					s.deadline = 0;
				}
				return true;
			},

			/** Not a rule: the pictures this device has dealt, for the page to keep. */
			seenKeys: () => [...seen],
			/** Not a rule: add what this device's storage says it has dealt (it arrives after the rules are made). */
			useSeen(keys) {
				if (Array.isArray(keys)) for (const k of keys) if (typeof k === "string") seen.add(k);
			},

			/** Not a rule: the next game's options, for the host's page to offer at the end ("Next game: … · CHANGE"). */
			nextGame: () => {
				const o = s.next ?? s.opts;
				return { opts: { ...o, cats: [...o.cats] } };
			},
			/** Not a rule: change the next game's options once this one is over (the host's page, on its own live rules). Nothing when taken, else the reason. */
			setNext(o) {
				if (s.phase !== "over") return "only once the game is over";
				const why = optsProblem(o);
				if (why) return why;
				s.next = withOpts(s.next ?? s.opts, o);
			},

			// Clocks differ between phones: the heir gets the time left.
			snapshot: () => {
				const t = now();
				return JSON.parse(JSON.stringify({ s: { ...s, deadline: 0, startAt: 0 }, left: s.deadline ? s.deadline - t : null, since: s.startAt ? t - s.startAt : null, seen: [...seen] }));
			},
			restore({ snapshot }) {
				const c = JSON.parse(JSON.stringify(snapshot));
				const t = now();
				// The copy's time left, as it is: no clock of the host's is compared
				// with this phone's (they may disagree by seconds). The copy is at
				// most TICK_MS old while a round runs.
				s = { ...c.s, deadline: c.left == null ? 0 : t + c.left, startAt: c.since == null ? 0 : t - c.since };
				seen = new Set(c.seen ?? []);
			},
		};
	}

	globalThis.guessWhatRules = { DEFAULT_OPTS, cleanOpts, TICK_MS, SECS, TURNS, READY_MS, REVEAL_MS, TALLY_MS, WRONG_MS, CHOICES, CLUE_MAX, SCORE, clueProblem, game };
})();
