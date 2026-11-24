#!/usr/bin/env node
/**
 * test-guess-what.mjs — Guess What's pictures, rounds, clock, clues, picks,
 * scores, the one-phone game, no repeats, the bots, the first guesser going
 * round and a handover mid-round.
 *
 *   node guess-what/test-guess-what.mjs
 *
 * Plays the managed rules the platform runs on the host (SDK v2), with a
 * clock the test moves by hand.
 */
import { readFileSync } from "node:fs";

new Function(readFileSync(new URL("./guess-what-pictures.js", import.meta.url), "utf8"))();
new Function(readFileSync(new URL("./guess-what-rules.js", import.meta.url), "utf8"))();
const { ALL, CATEGORIES } = globalThis.guessWhatPictures;
const { READY_MS, REVEAL_MS, TALLY_MS, WRONG_MS, SCORE, clueProblem, game } = globalThis.guessWhatRules;

let failures = 0;
const check = (label, ok, detail = "") => {
	console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
	if (!ok) failures++;
};

let t = 1_000_000;
const now = () => t;
const people = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, bot: false }));
const clock = (g) => g.apply({ action: { clock: g.view({ seat: null }).clock }, by: "p0" });
const pass = (g, ms) => {
	t += ms;
	return clock(g);
};
/** The answer's place among the choices, from the host's own copy (snapshot). */
const answerOf = (g) => {
	const snap = g.snapshot();
	return snap.s.choices.indexOf(snap.s.item);
};

console.log("\nthe pictures");
check(`${ALL.length} pictures in ${CATEGORIES.length} categories, each 40 or more`, ALL.length >= 300 && CATEGORIES.every((c) => c.count >= 40), CATEGORIES.map((c) => `${c.id} ${c.count}`).join(", "));
check("no picture twice", new Set(ALL.map((p) => p.e)).size === ALL.length && new Set(ALL.map((p) => p.name.toLowerCase())).size === ALL.length);
const leaks = ALL.flatMap((p) => p.clues.filter((c) => clueProblem(c, p)).map((c) => `${p.e} ${c}`));
check("every picture has three bot clues, none giving it away", ALL.every((p) => p.clues.length === 3) && !leaks.length, leaks.join("; "));
const dog = ALL.find((p) => p.name === "dog");
check("a clue may not say the name or another name", clueProblem("a cute puppy", dog) === "that gives it away" && clueProblem("DOG house", dog) === "that gives it away");
check("…nor its plural", clueProblem("dogs bark", dog) === "that gives it away" && clueProblem("two puppies", dog) === "that gives it away");
const elephant = ALL.find((p) => p.name === "elephant");
check("…nor a long name spelt out with spaces or hyphens", clueProblem("e l e p h a n t", elephant) === "that gives it away" && clueProblem("ele-phant", elephant) === "that gives it away");
const of = (name) => ALL.find((p) => p.name === name);
// Review, 2026-11-24: whole words only, so innocent clues get through.
for (const [clue, name] of [
	["Robin Hood's hand weapon", "bow and arrow"],
	["rainbow shaped", "bow and arrow"],
	["nice and cold", "ice cream"],
	["bowl-eyed night bird", "owl"],
	["breakfast in Japan", "fried egg"],
	["a cartoon character", "cat"],
]) check(`an innocent clue gets through: "${clue}" (${name})`, clueProblem(clue, of(name)) === null, clueProblem(clue, of(name)));
check("…while the name inside a clue is still caught: 'ice-cream cone'", clueProblem("ice-cream cone", of("ice cream")) === "that gives it away");
check("joining words are not names: 'and' is not forbidden for bow and arrow", !of("bow and arrow").words.includes("and"));
// Review, 2026-11-24: emoji newer than Emoji 11 show as empty boxes on Android 9 and older.
const newer = (e) => {
	const cp = e.codePointAt(0);
	const ranges = [[0x1f6d5, 0x1f6d7], [0x1f6fa, 0x1f6fc], [0x1f7e0, 0x1f7f0], [0x1f90c, 0x1f90f], [0x1f93f, 0x1f93f], [0x1f971, 0x1f972], [0x1f977, 0x1f978], [0x1f97b, 0x1f97b], [0x1f9a3, 0x1f9a4], [0x1f9a5, 0x1f9af], [0x1f9ba, 0x1f9bf], [0x1f9c3, 0x1f9cb], [0x1f9cd, 0x1f9cf], [0x1fa70, 0x1faff]];
	return ranges.some(([a, b]) => cp >= a && cp <= b);
};
const late = ALL.filter((p) => newer(p.e)).map((p) => `${p.e} ${p.name}`);
check("no picture newer than Emoji 11 (Android 9 draws them all)", !late.length, late.join(", "));
check("…nor be an emoji, empty or long", clueProblem("🐶", dog) === "words only" && clueProblem("   ", dog) === "say something" && clueProblem("x".repeat(31), dog) === "at most 30 letters");
check("…but anything else goes", clueProblem("barks at the postman", dog) === null);

console.log("\nsetup");
{
	const g = game({ now, isHost: (id) => id === "p0" });
	g.init({ seats: people(3), seed: 1, match: 0, first: "p1" });
	let v = g.view({ seat: "p2" });
	check("it opens on setup: every category, 45 seconds, two turns each", v.phase === "setup" && v.opts.cats.length === CATEGORIES.length && v.opts.secs === 45 && v.opts.turns === 2);
	check("only the host picks", g.apply({ action: { opts: { secs: 30 } }, by: "p1" }) === "the host picks");
	check("not no category", g.apply({ action: { opts: { cats: [] } }, by: "p0" }) === "pick at least one category");
	check("no other time", g.apply({ action: { opts: { secs: 20 } }, by: "p0" }) === "no such time");
	g.apply({ action: { opts: { cats: ["animals"], secs: 30, turns: 1 } }, by: "p0" });
	v = g.view({ seat: "p2" });
	check("the host's picks show to everyone", JSON.stringify(v.opts.cats) === '["animals"]' && v.opts.secs === 30 && v.opts.turns === 1);
}

console.log("\na round on every phone");
{
	const g = game({ now });
	g.init({ seats: people(3), seed: 5, match: 0, first: "p1" });
	g.apply({ action: { opts: { secs: 30, turns: 1 } }, by: "p0" });
	g.apply({ action: { start: true }, by: "p0" });
	let v = g.view({ seat: "p1" });
	check("people on separate phones: every phone", v.mode === "phones" && v.total === 3);
	check("`first` guesses first", v.guesser === 1 && v.phase === "ready");
	check("the guesser does not see the picture…", v.picture === null && v.choices.length === 9);
	const w = g.view({ seat: "p0" });
	check("…the others do, and it is one of the nine", w.picture && w.choices.includes(w.picture.e));
	check("the nine are from one category", new Set(w.choices.map((e) => ALL.find((p) => p.e === e).cat)).size === 1);
	check("no bots: nobody is on turn", g.turn().length === 0);
	check("an early clock does nothing", pass(g, 100) == null && g.view({ seat: null }).phase === "ready");
	check("a stale clock is refused", g.apply({ action: { clock: "1:0:reveal" }, by: "p0" }) === "stale");
	pass(g, READY_MS);
	v = g.view({ seat: "p1" });
	check("then the clock runs", v.phase === "guess" && v.msLeft === 30_000);
	check("the guesser cannot clue", g.apply({ action: { clue: "hm" }, by: "p1" }) === "you are guessing");
	check("only the guesser picks", g.apply({ action: { pick: 0 }, by: "p0" }) === "the guesser picks");
	const item = ALL.find((p) => p.e === w.picture.e);
	check("a clue with the name is refused", g.apply({ action: { clue: item.name }, by: "p0" }) === "that gives it away");
	g.apply({ action: { clue: "zzz first" }, by: "p0" });
	check("too fast after your last clue is refused", g.apply({ action: { clue: "again" }, by: "p0" }) === "one clue at a time");
	g.apply({ action: { clue: "second clue" }, by: "p2" });
	v = g.view({ seat: "p1" });
	check("typed clues show on every phone, the guesser's too", v.clues.length === 2 && v.clues[1].by === 2 && v.clues[1].text === "second clue");
	const answer = answerOf(g);
	const wrong = answer === 0 ? 1 : 0;
	g.apply({ action: { pick: wrong }, by: "p1" });
	v = g.view({ seat: "p1" });
	check("a wrong pick strikes it out and costs five seconds", v.struck.includes(wrong) && v.msLeft === 30_000 - WRONG_MS && v.phase === "guess");
	check("a struck picture cannot be picked again", g.apply({ action: { pick: wrong }, by: "p1" }) === "that one is out");
	t += 3000;
	g.apply({ action: { pick: answer }, by: "p1" });
	v = g.view({ seat: "p1" });
	check("the right pick ends the round, and everyone sees the answer", v.phase === "reveal" && v.result.right && v.picture?.e === item.e && v.result.answer === answer);
	check("scores: guesser 3+1 (over half the time left), givers 1 each, the last clue 1 more", v.scores[1] === SCORE.guess + SCORE.fast && v.scores[0] === SCORE.giver && v.scores[2] === SCORE.giver + SCORE.best, JSON.stringify(v.scores));
	pass(g, REVEAL_MS);
	v = g.view({ seat: "p2" });
	check("next round, next guesser in the rotation", v.phase === "ready" && v.guesser === 2 && v.round === 1);
	pass(g, READY_MS);
	pass(g, 30_000);
	v = g.view({ seat: "p2" });
	check("time up: nobody scores, the answer is shown", v.phase === "reveal" && !v.result.right && v.picture && v.scores[2] === SCORE.giver + SCORE.best);
	pass(g, REVEAL_MS);
	check("the last guesser wraps round to the first player", g.view({ seat: null }).guesser === 0);
	pass(g, READY_MS);
	g.apply({ action: { pick: answerOf(g) }, by: "p0" });
	pass(g, REVEAL_MS);
	const r = g.result();
	check("after everyone has guessed (once each), the game ends with a ranking by points", g.view({ seat: null }).phase === "over" && r?.kind === "ffa" && r.ranking[0].length >= 1, JSON.stringify(r));
	check("…and each player's guessing, for the arcade's achievements (seatFacts): right, missed, fast", JSON.stringify(r?.seatFacts) === '{"p0":{"right":1,"missed":0,"fast":1},"p1":{"right":1,"missed":0,"fast":1},"p2":{"right":0,"missed":1,"fast":0}}', JSON.stringify(r?.seatFacts));
}

console.log("\nno repeats until the pool is spent");
{
	const g = game({ now, seen: [] });
	g.init({ seats: people(2), seed: 9, match: 0, first: "p0" });
	g.apply({ action: { opts: { cats: ["nature"], secs: 30, turns: 3 } }, by: "p0" });
	const shown = [];
	const n = CATEGORIES.find((c) => c.id === "nature").count;
	for (let m = 0; shown.length < n + 5 && m < 40; m++) {
		g.init({ seats: people(2), seed: 9 + m, match: m, first: "p0" });
		g.apply({ action: { start: true }, by: "p0" });
		while (g.view({ seat: null }).phase !== "over") {
			shown.push(g.view({ seat: "p1" }).picture?.e ?? g.view({ seat: "p0" }).picture?.e);
			pass(g, READY_MS);
			pass(g, 30_000);
			pass(g, REVEAL_MS);
		}
	}
	const first = shown.slice(0, n);
	check(`the first ${n} pictures are all different (the whole category)`, new Set(first).size === n);
	check("…then the pool starts again", shown.length > n && first.includes(shown[n]));
	const nature = ALL.filter((p) => p.cat === "nature");
	const h = game({ now, seen: nature.slice(1).map((p) => p.key) });
	h.init({ seats: people(2), seed: 3, match: 0, first: "p0" });
	h.apply({ action: { opts: { cats: ["nature"] } }, by: "p0" });
	h.apply({ action: { start: true }, by: "p0" });
	check("a device's seen list carries over (the page keeps it in storage): the one picture left is dealt", h.view({ seat: "p1" }).picture.e === nature[0].e && h.seenKeys().length === nature.length);
}

console.log("\nbots give clues and guess");
{
	// One person and bots start straight away, with the options last played (`last`).
	const g = game({ now, last: () => ({ secs: 60, turns: 1 }) });
	const seats = [{ id: "p0", bot: false }, { id: "bot_1", bot: true }, { id: "bot_2", bot: true }];
	g.init({ seats, seed: 21, match: 0, first: "p0" });
	pass(g, READY_MS);
	let v = g.view({ seat: "p0" });
	check("the host is told when to look next (a bot's clue is due)", v.msNext > 0 && v.msNext < 5000);
	for (let k = 0; k < 40 && g.view({ seat: null }).clues.length < 3; k++) pass(g, 1000);
	v = g.view({ seat: "p0" });
	check("bot clue-givers type the picture's own clues, both of them", v.clues.length === 3 && new Set(v.clues.map((c) => c.by)).size === 2 && v.clues.every((c) => ALL[g.snapshot().s.item].clues.includes(c.text)), JSON.stringify(v.clues));
	g.apply({ action: { pick: answerOf(g) }, by: "p0" });
	pass(g, REVEAL_MS);
	pass(g, READY_MS);
	v = g.view({ seat: null });
	check("a bot guesses in its turn", v.guesser === 1);
	for (let k = 0; k < 70 && g.view({ seat: null }).phase === "guess"; k++) pass(g, 1000);
	check("…and the round ends, right or by the clock", g.view({ seat: null }).phase === "reveal");
	let rights = 0;
	let games = 0;
	for (let seed = 1; seed <= 20; seed++) {
		const b = game({ now, last: () => ({ secs: 45, turns: 1 }) });
		b.init({ seats: [{ id: "p0", bot: false }, ...[1, 2, 3].map((i) => ({ id: `bot_${i}`, bot: true }))], seed, match: 0, first: "bot_1" });
		for (let k = 0; k < 2000 && b.view({ seat: null }).phase !== "over"; k++) {
			const w = b.view({ seat: null });
			if (w.phase === "guess" && w.guesser === 0) b.apply({ action: { pick: answerOf(b) }, by: "p0" });
			pass(b, 500);
		}
		if (b.result()) games++;
		rights += b.snapshot().s.rights;
	}
	check(`a person and three bots finish every game (20 of ${games})`, games === 20);
	check(`bots guess right most of the time (${rights} of 80 rounds)`, rights >= 50);
}

console.log("\none phone");
{
	const g = game({ now, last: () => ({ secs: 30, turns: 1 }) });
	const seats = [{ id: "p0", bot: false }, { id: "bot_1", bot: true, local: true }, { id: "bot_2", bot: true, local: true }, { id: "bot_3", bot: true }];
	g.init({ seats, seed: 4, match: 0, first: "bot_1" });
	let v = g.view({ seat: "p0" });
	check("one person and people on their phone: one phone, the bot sits out", v.mode === "one" && JSON.stringify(v.players) === "[0,1,2]" && v.total === 3);
	check("the first guesser is `first`; the phone waits for GO", v.guesser === 1 && v.phase === "ready" && v.picture === null && v.msNext === null);
	check("the clock does nothing while it waits", pass(g, 60_000) == null && g.view({ seat: null }).phase === "ready");
	g.apply({ action: { go: true }, by: "p0" });
	v = g.view({ seat: "p0" });
	check("GO: the picture shows, the clock runs", v.phase === "talk" && v.picture && v.msLeft === 30_000);
	const firstPic = v.picture.e;
	g.apply({ action: { got: true }, by: "p0" });
	g.apply({ action: { pass: true }, by: "p0" });
	g.apply({ action: { got: true }, by: "p0" });
	v = g.view({ seat: "p0" });
	check("GOT IT scores and moves on; PASS moves on", v.scores[1] === 2 && v.got.length === 2 && v.got[0].e === firstPic && v.picture.e !== firstPic);
	pass(g, 30_000);
	v = g.view({ seat: "p0" });
	check("time up: the tally", v.phase === "tally" && v.tally.got.length === 2);
	pass(g, TALLY_MS);
	v = g.view({ seat: "p0" });
	check("then the next player's turn", v.phase === "ready" && v.guesser === 2);
	g.apply({ action: { go: true }, by: "p0" });
	pass(g, 30_000);
	g.apply({ action: { next: true }, by: "p0" });
	g.apply({ action: { go: true }, by: "p0" });
	g.apply({ action: { got: true }, by: "p0" });
	pass(g, 30_000);
	pass(g, TALLY_MS);
	const r = g.result();
	check("one phone: GOT IT counts as a right guess for the player holding it", r.seatFacts?.bot_1?.right === 2, JSON.stringify(r.seatFacts));
	check("the end: ranked by pictures got, the people on the phone named", g.view({ seat: null }).phase === "over" && JSON.stringify(r.ranking[0]) === '["bot_1"]' && r.names.bot_1 === "Player 2" && r.names.bot_2 === "Player 3" && !("bot_3" in r.scores), JSON.stringify(r));
}

console.log("\nthe options: only the first time");
{
	// Lokesh, 2026-11-23 ("only the first time", as Ludo).
	const withBots = [{ id: "p0", bot: false }, { id: "bot_1", bot: true }, { id: "bot_2", bot: true }];
	const all = CATEGORIES.map((c) => c.id);
	let g = game({ now });
	g.init({ seats: withBots, seed: 1, match: 0, first: "p0" });
	let w = g.view({ seat: "p0" });
	check("one person and bots, nothing kept: straight into the first round, every category, 45 s, two turns", w.phase === "ready" && w.opts.cats.length === all.length && w.opts.secs === 45 && w.opts.turns === 2);
	g = game({ now, last: () => ({ cats: ["food", "play"], secs: 30, turns: 1 }) });
	g.init({ seats: withBots, seed: 1, match: 0 });
	w = g.view({ seat: "p0" });
	check("…with the options last played on this device", w.phase === "ready" && w.opts.cats.join() === "food,play" && w.opts.secs === 30 && w.opts.turns === 1 && w.total === 3);
	for (const [label, kept, want] of [
		["junk", "x", { cats: all.length, secs: 45, turns: 2 }],
		["unknown categories only", { cats: ["cars"], secs: 60 }, { cats: all.length, secs: 60, turns: 2 }],
		["some unknown categories", { cats: ["cars", "food"], turns: 3 }, { cats: 1, secs: 45, turns: 3 }],
		["times not offered", { secs: 20, turns: 9 }, { cats: all.length, secs: 45, turns: 2 }],
	]) {
		const k = game({ now, last: () => kept });
		k.init({ seats: withBots, seed: 1, match: 0 });
		const o = k.view({ seat: "p0" }).opts;
		check(`kept options that are ${label}: the defaults where they are wrong`, k.view({ seat: null }).phase === "ready" && o.cats.length === want.cats && o.secs === want.secs && o.turns === want.turns, JSON.stringify(o));
	}
	const broken = game({
		now,
		last: () => {
			throw new Error("gone");
		},
	});
	broken.init({ seats: withBots, seed: 1, match: 0 });
	check("kept options that cannot be read: the defaults", broken.view({ seat: null }).phase === "ready" && broken.view({ seat: null }).opts.secs === 45);
	const one = game({ now });
	one.init({ seats: [{ id: "p0", bot: false }, { id: "bot_1", bot: true, local: true }], seed: 1, match: 0 });
	check("one phone (a PERSON seat): straight to the first turn, waiting for GO", one.view({ seat: null }).mode === "one" && one.view({ seat: null }).phase === "ready");
	g = game({ now, last: () => ({ secs: 60 }) });
	g.init({ seats: people(3), seed: 1, match: 0, first: "p0" });
	check("people on their own phones, a first game: the options first, the last ones picked", g.view({ seat: null }).phase === "setup" && g.view({ seat: null }).opts.secs === 60);
	g.apply({ action: { opts: { turns: 1, secs: 30 } }, by: "p0" });
	g.apply({ action: { start: true }, by: "p0" });
	check("setNext is refused while playing", g.setNext({ secs: 60 }) === "only once the game is over");
	for (let k = 0; k < 40 && g.view({ seat: null }).phase !== "over"; k++) pass(g, 31_000);
	check("(the game is over)", g.view({ seat: null }).phase === "over");
	check("at the end, the next game is this one's options", g.nextGame().opts.secs === 30 && g.nextGame().opts.turns === 1);
	check("setNext refuses what is not offered", g.setNext({ secs: 20 }) === "no such time" && g.setNext({ turns: 0 }) === "no such number" && g.setNext({ cats: [] }) === "pick at least one category" && g.setNext({ cats: ["cars"] }) === "pick at least one category" && g.setNext({ colour: "red" }) === "no such option");
	check("setNext (CHANGE at the end) takes categories, seconds and turns", g.setNext({ cats: ["animals"], secs: 60 }) == null && g.nextGame().opts.cats.join() === "animals" && g.nextGame().opts.secs === 60 && g.nextGame().opts.turns === 1);
	g.init({ seats: people(3), seed: 2, match: 1, first: "p1" });
	w = g.view({ seat: "p0" });
	check("PLAY AGAIN: straight into the first round with the options picked at the end (people too)", w.phase === "ready" && w.opts.cats.join() === "animals" && w.opts.secs === 60 && w.opts.turns === 1 && w.guesser === 1 && w.category === "animals");
	const heir = game({ now });
	heir.restore({ snapshot: JSON.parse(JSON.stringify(g.snapshot())) });
	heir.init({ seats: people(3), seed: 3, match: 2, first: "p2" });
	check("an heir's PLAY AGAIN keeps them too", heir.view({ seat: null }).phase === "ready" && heir.view({ seat: null }).opts.cats.join() === "animals" && heir.view({ seat: null }).opts.secs === 60);
}

console.log("\nwho guesses first goes round");
{
	const g = game({ now });
	const firsts = [];
	for (const [m, first] of ["p1", "p2", "p0"].entries()) {
		g.init({ seats: people(3), seed: 2, match: m, first });
		g.apply({ action: { start: true }, by: "p0" });
		firsts.push(g.view({ seat: null }).guesser);
	}
	check("`first` guesses first each game", JSON.stringify(firsts) === "[1,2,0]");
	const o = game({ now });
	o.init({ seats: people(3), seed: 6, match: 0 });
	o.apply({ action: { start: true }, by: "p0" });
	const a = o.view({ seat: null }).guesser;
	o.init({ seats: people(3), seed: 6, match: 1 });
	o.apply({ action: { start: true }, by: "p0" });
	check("without `first` (an older shell): the next seat each PLAY AGAIN", o.view({ seat: null }).guesser === (a + 1) % 3);
}

console.log("\nhandover mid-round, and leaving");
{
	const g = game({ now });
	g.init({ seats: people(3), seed: 8, match: 0, first: "p0" });
	g.apply({ action: { opts: { secs: 45 } }, by: "p0" });
	g.apply({ action: { start: true }, by: "p0" });
	pass(g, READY_MS);
	g.apply({ action: { clue: "first one" }, by: "p1" });
	t += 10_000;
	const heir = game({ now }); // taken over at once
	heir.restore({ snapshot: JSON.parse(JSON.stringify(g.snapshot())) });
	const hv = heir.view({ seat: "p1" });
	const gv = g.view({ seat: "p1" });
	check("the heir carries on: picture, clues, scores and the time left", hv.picture.e === gv.picture.e && hv.clues.length === 1 && hv.msLeft === gv.msLeft && hv.phase === "guess");
	check("…and the seen list", heir.seenKeys().length === g.seenKeys().length);
	g.leave({ seat: "p0" });
	let v = g.view({ seat: "p1" });
	check("the guesser leaving ends the round", v.phase === "reveal" && !v.result.right);
	pass(g, REVEAL_MS);
	check("…and they are passed over", g.view({ seat: null }).guesser === 1);
	g.leave({ seat: "p2" });
	check("fewer than two left: the game ends", g.view({ seat: null }).phase === "over");
}

console.log("\nturns stay equal when someone leaves; an heir keeps the time that ran");
{
	// Review, 2026-11-24: after a leaver the rotation went on for the old count.
	const g = game({ now, last: () => ({ secs: 30, turns: 2 }) });
	g.init({ seats: people(3), seed: 4, match: 0, first: "p0" });
	g.apply({ action: { opts: { secs: 30, turns: 2 } }, by: "p0" });
	g.apply({ action: { start: true }, by: "p0" });
	const guessed = [];
	let left = false;
	for (let k = 0; k < 60 && g.view({ seat: null }).phase !== "over"; k++) {
		const w = g.view({ seat: null });
		if (w.phase === "ready" && guessed.at(-1)?.round !== w.round) guessed.push({ round: w.round, g: w.guesser });
		if (!left && w.round === 1 && w.phase === "ready") {
			left = true;
			g.leave({ seat: `p${w.guesser}` });
			continue;
		}
		pass(g, 31_000);
	}
	const count = (i) => guessed.filter((x) => x.g === i).length;
	const who = guessed[1].g;
	const stay = [0, 1, 2].filter((i) => i !== who);
	check("a player leaves on their turn: those left still guess the same number of times (two each)", g.view({ seat: null }).phase === "over" && stay.every((i) => count(i) === 2), JSON.stringify(guessed));
	check("…and the rounds counted down to it", g.view({ seat: null }).total === 5, String(g.view({ seat: null }).total));
	// Review, 2026-11-24: an heir restored a round with all its time back; then
	// (re-review) subtracting across two phones' clocks made it hang on their
	// skew. Now the host's clock moves at least every ~2 s (`msNext` capped), so
	// a copy — sent after every move — is never older than that, and an heir
	// takes the copy's time as it is, whatever its own clock says.
	const h = game({ now });
	h.init({ seats: people(3), seed: 5, match: 0, first: "p0" });
	h.apply({ action: { opts: { secs: 45 } }, by: "p0" });
	h.apply({ action: { start: true }, by: "p0" });
	const caps = [];
	// The host's page does what the view says: a clock move when `msNext` is up.
	for (let k = 0; k < 12; k++) {
		const w = h.view({ seat: null });
		caps.push([w.phase, w.msNext]);
		pass(h, w.msNext);
	}
	check("in the ready and guess phases the host is told to look at least every 2 s", caps.every(([ph, ms]) => (ph !== "ready" && ph !== "guess") || (ms != null && ms <= 2000)), JSON.stringify(caps));
	check("(…and the round is under way)", h.view({ seat: null }).phase === "guess");
	const snap = JSON.parse(JSON.stringify(h.snapshot())); // the last copy, taken at the last move
	check("the copy carries no clock reading of the host's", !("taken" in snap));
	const ran = 1_900; // the host goes before its next move
	const truth = h.view({ seat: null }).msLeft - ran;
	for (const skew of [0, 50_000, -3_000, -30_000, 3_600_000]) {
		const heir = game({ now: () => t + ran + skew });
		heir.restore({ snapshot: snap });
		const said = heir.view({ seat: null }).msLeft;
		check(`an heir whose clock is ${skew >= 0 ? "+" : ""}${skew / 1000} s off says ${said / 1000} s left: within 2 s of the truth (${truth / 1000} s)`, Math.abs(said - truth) <= 2000, String(said));
	}
	const one = game({ now, last: () => ({ secs: 30, turns: 1 }) });
	one.init({ seats: [{ id: "p0", bot: false }, { id: "bot_1", bot: true, local: true }], seed: 1, match: 0 });
	one.apply({ action: { go: true }, by: "p0" });
	check("one phone: the talk phase is looked at every 2 s too", one.view({ seat: null }).phase === "talk" && one.view({ seat: null }).msNext <= 2000, String(one.view({ seat: null }).msNext));
}

console.log(failures ? `\n${failures} failing` : "\nall passing");
process.exit(failures ? 1 : 0);
