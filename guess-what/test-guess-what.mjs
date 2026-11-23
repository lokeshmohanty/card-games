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
check("a clue may not say the name or another name", clueProblem("a cute puppy", dog) === "that gives it away" && clueProblem("DOG house", dog) === "that gives it away" && clueProblem("d o g", dog) === "that gives it away");
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
	const g = game({ now });
	const seats = [{ id: "p0", bot: false }, { id: "bot_1", bot: true }, { id: "bot_2", bot: true }];
	g.init({ seats, seed: 21, match: 0, first: "p0" });
	g.apply({ action: { opts: { secs: 60, turns: 1 } }, by: "p0" });
	g.apply({ action: { start: true }, by: "p0" });
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
		const b = game({ now });
		b.init({ seats: [{ id: "p0", bot: false }, ...[1, 2, 3].map((i) => ({ id: `bot_${i}`, bot: true }))], seed, match: 0, first: "bot_1" });
		b.apply({ action: { opts: { secs: 45, turns: 1 } }, by: "p0" });
		b.apply({ action: { start: true }, by: "p0" });
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
	const g = game({ now });
	const seats = [{ id: "p0", bot: false }, { id: "bot_1", bot: true, local: true }, { id: "bot_2", bot: true, local: true }, { id: "bot_3", bot: true }];
	g.init({ seats, seed: 4, match: 0, first: "bot_1" });
	g.apply({ action: { opts: { secs: 30, turns: 1 } }, by: "p0" });
	g.apply({ action: { start: true }, by: "p0" });
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
	check("the end: ranked by pictures got, the people on the phone named", g.view({ seat: null }).phase === "over" && JSON.stringify(r.ranking[0]) === '["bot_1"]' && r.names.bot_1 === "Player 2" && r.names.bot_2 === "Player 3" && !("bot_3" in r.scores), JSON.stringify(r));
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
	const heir = game({ now: () => t + 50_000 }); // a phone whose clock reads differently
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

console.log(failures ? `\n${failures} failing` : "\nall passing");
process.exit(failures ? 1 : 0);
