#!/usr/bin/env node
/**
 * test-glowdown.mjs — Glowdown's deck, plays, action cards, every house rule,
 * the bots, the dealer going round and a handover mid-game.
 *
 *   node glowdown/test-glowdown.mjs
 *
 * Plays the managed rules the platform runs on the host (SDK v2). A position
 * is set up by editing a snapshot and restoring it, the way an heir would.
 */
import { readFileSync } from "node:fs";

new Function(readFileSync(new URL("./glowdown-rules.js", import.meta.url), "utf8"))();
const { DECK, SUITS, HOUSE, pointsOf, game } = globalThis.glowdownRules;

let failures = 0;
const check = (label, ok, detail = "") => {
	console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
	if (!ok) failures++;
};

/** The first card id with suit `s` and face `f` not in `not`. */
const card = (s, f, not = []) => DECK.findIndex((c, id) => c.s === s && c.f === f && !not.includes(id));
const seatsOf = (n, bots = false) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, bot: bots && i > 0 }));

/** A game of `n` seats with house rules `house`, dealt, then the state edited by `edit(s)`. */
function table(n, house = {}, edit = null, opts = {}) {
	const g = game(opts);
	g.init({ seats: seatsOf(n), seed: 7, match: 0, first: "p0" });
	g.apply({ action: { house }, by: "p0" });
	g.apply({ action: { start: true }, by: "p0" });
	if (edit) {
		const snap = g.snapshot();
		edit(snap.s);
		g.restore({ snapshot: snap });
	}
	return g;
}
/** Set hands and the top card exactly; everything else goes to the draw pile. */
function deal(s, hands, topCard, suit = DECK[topCard].s) {
	const used = new Set([...hands.flat(), topCard]);
	s.hands = hands.map((h) => [...h]);
	s.pile = [topCard];
	s.suit = suit;
	s.draw = DECK.map((_, id) => id).filter((id) => !used.has(id));
	s.turn = 0;
	s.dir = 1;
	s.pending = 0;
	s.pendingKind = null;
	s.drawn = null;
}
const v = (g, seat = "p0") => g.view({ seat });

console.log("\nthe deck");
check("112 cards: four suits of 26 and eight PRISMs", DECK.length === 112 && SUITS.every((x) => DECK.filter((c) => c.s === x).length === 26) && DECK.filter((c) => c.s === null).length === 8);
check("each suit: 0–9 twice, ZAP, BLOCK and BOUNCE twice", SUITS.every((x) => ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "zap", "block", "bounce"].every((f) => DECK.filter((c) => c.s === x && c.f === f).length === 2)));
check("four PRISM and four PRISM +4", DECK.filter((c) => c.f === "prism").length === 4 && DECK.filter((c) => c.f === "prism4").length === 4);
check("points: numbers at face, actions 20, PRISMs 50", pointsOf(card("sun", "7")) === 7 && pointsOf(card("moon", "zap")) === 20 && pointsOf(DECK.findIndex((c) => c.f === "prism4")) === 50);

console.log("\nsetup and the deal");
{
	const g = game({ isHost: (id) => id === "p0" });
	g.init({ seats: seatsOf(4), seed: 3, match: 0, first: "p2" });
	let w = v(g, "p1");
	check("it opens on setup, house rules all off", w.phase === "setup" && HOUSE.every((k) => w.house[k] === false));
	check("only the host sets the rules", g.apply({ action: { house: { stack: true } }, by: "p1" }) === "the host sets the house rules");
	check("a rule that does not exist is refused", g.apply({ action: { house: { cheat: true } }, by: "p0" }) === "no such rule");
	check("nothing is played before the deal", g.apply({ action: { draw: true }, by: "p2" }) === "wait for the deal");
	g.apply({ action: { house: { stack: true, jumpIn: true } }, by: "p0" });
	check("the host's choices show to everyone", v(g, "p3").house.stack && v(g, "p3").house.jumpIn && !v(g, "p3").house.drawUntil);
	g.apply({ action: { start: true }, by: "p0" });
	w = v(g, "p1");
	check("START deals seven each and turns up a number", w.phase === "play" && w.counts.every((n) => n === 7) && /^\d$/.test(DECK[w.top].f) && w.drawCount === 112 - 28 - 1);
	check("a phone sees its own hand only", w.hand.length === 7 && w.hands === null && v(g, null).hand.length === 0);
	check("`first` opens", w.turn === 2 && JSON.stringify(g.turn()) === '["p2"]');
	check("the suit in play is the top card's", w.suit === DECK[w.top].s);
}

console.log("\nlegal plays");
{
	const g = table(3, {}, (s) => deal(s, [[card("sun", "3"), card("moon", "5"), card("star", "9"), DECK.findIndex((c) => c.f === "prism")], [card("bolt", "1")], [card("bolt", "2")]], card("sun", "5")));
	const w = v(g);
	const legal = new Set(w.legal);
	check("suit or face matches, and a PRISM, play", legal.has(card("sun", "3")) && legal.has(card("moon", "5")) && legal.has(DECK.findIndex((c) => c.f === "prism")));
	check("neither suit nor face: refused", !legal.has(card("star", "9")) && g.apply({ action: { play: card("star", "9") }, by: "p0" }) === "that card does not play");
	check("a card not in hand is refused", g.apply({ action: { play: card("bolt", "8") }, by: "p0" }) === "that card is not in your hand");
	check("out of turn is refused", g.apply({ action: { play: card("bolt", "1") }, by: "p1" }) === "not your turn");
	check("a PRISM must name a suit", g.apply({ action: { play: DECK.findIndex((c) => c.f === "prism") }, by: "p0" }) === "pick a suit");
	g.apply({ action: { play: DECK.findIndex((c) => c.f === "prism"), suit: "star" }, by: "p0" });
	check("…and the named suit is in play", v(g).suit === "star" && v(g).turn === 1);
}

console.log("\naction cards");
{
	let g = table(4, {}, (s) => deal(s, [[card("sun", "block"), card("sun", "1")], [card("moon", "1")], [card("moon", "2")], [card("moon", "3")]], card("sun", "5")));
	g.apply({ action: { play: card("sun", "block") }, by: "p0" });
	check("BLOCK: the next player misses their turn", v(g).turn === 2);

	g = table(4, {}, (s) => deal(s, [[card("sun", "bounce"), card("sun", "1")], [card("moon", "1")], [card("moon", "2")], [card("moon", "3")]], card("sun", "5")));
	g.apply({ action: { play: card("sun", "bounce") }, by: "p0" });
	check("BOUNCE: play turns round", v(g).turn === 3 && v(g).dir === -1);

	g = table(2, {}, (s) => deal(s, [[card("sun", "bounce"), card("sun", "1")], [card("moon", "1")]], card("sun", "5")));
	g.apply({ action: { play: card("sun", "bounce") }, by: "p0" });
	check("BOUNCE with two playing: the same player goes again", v(g).turn === 0);

	g = table(3, {}, (s) => deal(s, [[card("sun", "zap"), card("sun", "1")], [card("moon", "zap")], [card("moon", "2")]], card("sun", "5")));
	g.apply({ action: { play: card("sun", "zap") }, by: "p0" });
	let w = v(g);
	check("ZAP +2 (no stacking): the next player draws two and misses their turn", w.counts[1] === 3 && w.turn === 2 && w.pending === 0, JSON.stringify(w.counts));
	check("…and the log says so", w.log.at(-1).kind === "penalty" && w.log.at(-1).count === 2 && w.log.at(-2).kind === "play");

	g = table(3, {}, (s) => deal(s, [[DECK.findIndex((c) => c.f === "prism4"), card("sun", "1")], [card("moon", "zap")], [card("moon", "2")]], card("sun", "5")));
	g.apply({ action: { play: DECK.findIndex((c) => c.f === "prism4"), suit: "bolt" }, by: "p0" });
	w = v(g);
	check("PRISM +4: names the suit, the next draws four and misses their turn", w.suit === "bolt" && w.counts[1] === 5 && w.turn === 2);
}

console.log("\ndrawing");
{
	let g = table(3, {}, (s) => {
		deal(s, [[card("star", "9")], [card("moon", "1")], [card("moon", "2")]], card("sun", "5"));
		s.draw.push(card("bolt", "8")); // the top of the draw pile: does not play
	});
	g.apply({ action: { draw: true }, by: "p0" });
	check("a draw that does not play: one card, and the turn passes", v(g).counts[0] === 2 && v(g).turn === 1);
	g = table(3, {}, (s) => {
		deal(s, [[card("star", "9")], [card("moon", "1")], [card("moon", "2")]], card("sun", "5"));
		s.draw.push(card("sun", "8"));
	});
	g.apply({ action: { draw: true }, by: "p0" });
	let w = v(g);
	check("a draw that plays: you may play it…", w.turn === 0 && w.drawn === card("sun", "8") && JSON.stringify(w.legal) === JSON.stringify([card("sun", "8")]));
	check("…only it", g.apply({ action: { play: card("star", "9") }, by: "p0" }) === "play the card you drew, or pass");
	check("…and not draw again", g.apply({ action: { draw: true }, by: "p0" }) === "play the card you drew, or pass");
	check("…or pass", g.apply({ action: { pass: true }, by: "p0" }) == null && v(g).turn === 1 && v(g).counts[0] === 2);
	check("passing without drawing is refused", g.apply({ action: { pass: true }, by: "p1" }) === "draw first");
}

console.log("\nhouse rule: stack draws");
{
	const zap = (s, not) => card(s, "zap", not);
	const p4 = DECK.findIndex((c) => c.f === "prism4");
	const p4b = DECK.findIndex((c, id) => c.f === "prism4" && id !== p4);
	const g = table(3, { stack: true }, (s) => deal(s, [[zap("sun"), card("sun", "1")], [zap("moon"), card("moon", "1")], [p4, card("star", "2")]], card("sun", "5")));
	g.apply({ action: { play: zap("sun") }, by: "p0" });
	let w = v(g, "p1");
	check("a ZAP is owed, not drawn at once", w.pending === 2 && w.turn === 1 && w.counts[1] === 2);
	check("only a draw card answers it", JSON.stringify(w.legal) === JSON.stringify([zap("moon")]) && g.apply({ action: { play: card("moon", "1") }, by: "p1" }) === "answer with a draw card, or draw 2");
	g.apply({ action: { play: zap("moon") }, by: "p1" });
	check("ZAP on ZAP: four owed", v(g).pending === 4 && v(g).turn === 2);
	g.apply({ action: { play: p4, suit: "moon" }, by: "p2" });
	w = v(g);
	check("PRISM +4 on a ZAP: eight owed, only a PRISM +4 answers now", w.pending === 8 && w.pendingKind === "prism4" && w.turn === 0 && w.legal.length === 0);
	g.apply({ action: { draw: true }, by: "p0" });
	w = v(g);
	check("who cannot answer draws them all and misses the turn", w.counts[0] === 9 && w.pending === 0 && w.turn === 1, JSON.stringify(w.counts));
	const off = table(3, {}, (s) => deal(s, [[zap("sun"), card("sun", "1")], [zap("moon"), card("moon", "1")], [p4b, card("star", "2")]], card("sun", "5")));
	off.apply({ action: { play: zap("sun") }, by: "p0" });
	check("off: the ZAP is drawn at once, no answer", v(off).counts[1] === 4 && v(off).turn === 2);
}

console.log("\nhouse rule: jump in");
{
	const s5 = card("sun", "5");
	const s5b = card("sun", "5", [s5]);
	const mk = (on) => table(3, { jumpIn: on }, (s) => deal(s, [[card("moon", "1"), card("moon", "2")], [card("moon", "3"), card("moon", "4")], [s5b, card("star", "2")]], s5));
	let g = mk(true);
	check("an identical card is legal out of turn", JSON.stringify(v(g, "p2").legal) === JSON.stringify([s5b]));
	check("a matching but not identical card is not", g.apply({ action: { play: card("star", "2") }, by: "p2" }) === "not your turn");
	g.apply({ action: { play: s5b }, by: "p2" });
	let w = v(g);
	check("jumping in plays it, and play goes on from the jumper", w.top === s5b && w.turn === 0 && w.log.at(-1).kind === "jump" && w.counts[2] === 1);
	g = mk(false);
	check("off: out of turn is refused", g.apply({ action: { play: s5b }, by: "p2" }) === "not your turn" && v(g, "p2").legal.length === 0);
	g = table(3, { jumpIn: true }, (s) => deal(s, [[card("sun", "1")], [card("moon", "3")], [card("sun", "block", [card("sun", "block")]), card("star", "2")]], card("sun", "block")));
	g.apply({ action: { play: card("sun", "block", [card("sun", "block")]) }, by: "p2" });
	check("a jumped-in BLOCK blocks the player after the jumper", v(g).turn === 1);
}

console.log("\nhouse rule: 7 swaps, 0 rotates");
{
	let g = table(3, { sevenZero: true }, (s) => deal(s, [[card("sun", "7"), card("sun", "1"), card("sun", "2")], [card("moon", "3")], [card("star", "2"), card("star", "3")]], card("sun", "5")));
	check("a 7 needs someone to swap with", g.apply({ action: { play: card("sun", "7") }, by: "p0" }) === "pick who to swap hands with");
	check("…not yourself", g.apply({ action: { play: card("sun", "7"), target: 0 }, by: "p0" }) === "pick who to swap hands with");
	g.apply({ action: { play: card("sun", "7"), target: 1 }, by: "p0" });
	let w = v(g);
	check("a 7 swaps hands", JSON.stringify(w.hand) === JSON.stringify([card("moon", "3")]) && w.counts[1] === 2 && w.log.at(-1).kind === "swap");
	g = table(3, { sevenZero: true }, (s) => deal(s, [[card("sun", "0"), card("sun", "1")], [card("moon", "3")], [card("star", "2"), card("star", "3")]], card("sun", "5")));
	g.apply({ action: { play: card("sun", "0") }, by: "p0" });
	w = v(g, "p1");
	check("a 0 passes every hand on, the way play goes", JSON.stringify(w.hand) === JSON.stringify([card("sun", "1")]) && JSON.stringify(v(g, "p2").hand) === JSON.stringify([card("moon", "3")]) && v(g, "p0").hand.length === 2);
	g = table(3, { sevenZero: true }, (s) => deal(s, [[card("sun", "7")], [card("moon", "3")], [card("star", "2")]], card("sun", "5")));
	g.apply({ action: { play: card("sun", "7") }, by: "p0" });
	check("a 7 as your last card wins: no swap", v(g).phase === "over" && v(g).winner === 0);
	g = table(3, {}, (s) => deal(s, [[card("sun", "7"), card("sun", "1")], [card("moon", "3")], [card("star", "2")]], card("sun", "5")));
	g.apply({ action: { play: card("sun", "7") }, by: "p0" });
	check("off: a 7 is just a 7", v(g).counts[0] === 1 && v(g).counts[1] === 1);
}

console.log("\nhouse rule: draw until you can play");
{
	const g = table(3, { drawUntil: true }, (s) => {
		deal(s, [[card("star", "9")], [card("moon", "1")], [card("moon", "2")]], card("sun", "5"));
		s.draw.push(card("sun", "8"), card("bolt", "3"), card("moon", "6")); // drawn from the end
	});
	g.apply({ action: { draw: true }, by: "p0" });
	const w = v(g);
	check("draws until a card plays, then may play it", w.counts[0] === 4 && w.drawn === card("sun", "8") && w.turn === 0 && w.log.at(-1).count === 3);
	g.apply({ action: { play: card("sun", "8") }, by: "p0" });
	check("…and plays it", v(g).top === card("sun", "8") && v(g).turn === 1);
}

console.log("\nthe end");
{
	const g = table(3, {}, (s) => deal(s, [[card("sun", "1")], [card("moon", "3"), card("moon", "zap")], [card("star", "2"), DECK.findIndex((c) => c.f === "prism")]], card("sun", "5")));
	g.apply({ action: { play: card("sun", "1") }, by: "p0" });
	const r = g.result();
	check("the first out wins; the rest by points left (23 beats 52)", r?.kind === "ffa" && JSON.stringify(r.ranking) === '[["p0"],["p1"],["p2"]]' && r.scores.p1 === 23 && r.scores.p2 === 52, JSON.stringify(r));
	check("the end shows every hand", v(g, "p1").hands?.[2]?.length === 2);
	check("nothing plays after the end", g.apply({ action: { draw: true }, by: "p1" }) === "the game is over" && g.turn().length === 0);
}

console.log("\nleaving and skipping");
{
	let g = table(3, {}, (s) => deal(s, [[card("sun", "1"), card("sun", "2")], [card("moon", "3")], [card("star", "2")]], card("sun", "5")));
	check("SKIP TURN: they draw one and the turn moves", g.skip({ seat: "p0" }) === true && v(g).counts[0] === 3 && v(g).turn === 1);
	g.leave({ seat: "p1" });
	check("a leaver's turn passes on, their cards back in the pile", v(g).turn === 2 && v(g).counts[1] === 0 && v(g).out[1]);
	g.leave({ seat: "p2" });
	check("the last one playing wins", v(g).phase === "over" && v(g).winner === 0 && JSON.stringify(g.result().ranking) === '[["p0"],["p1","p2"]]');
}

console.log("\nthe bots finish games, under every house rule");
{
	const combos = [{}, { stack: true }, { jumpIn: true }, { sevenZero: true }, { drawUntil: true }, { stack: true, jumpIn: true, sevenZero: true, drawUntil: true }];
	let finished = 0;
	let games = 0;
	let refused = 0;
	let longest = 0;
	for (const house of combos) {
		for (const n of [2, 3, 5, 8]) {
			for (let seed = 1; seed <= 6; seed++) {
				games++;
				const g = game();
				g.init({ seats: seatsOf(n, true), seed: seed * 101 + n, match: 0 });
				g.apply({ action: { house }, by: "p0" });
				g.apply({ action: { start: true }, by: "p0" });
				let k = 0;
				for (; k < 3000 && !g.result(); k++) {
					const [who] = g.turn();
					// The person on seat 0 plays like a bot too.
					const a = g.bot({ seat: who });
					if (g.apply({ action: a, by: who }) != null) refused++;
				}
				longest = Math.max(longest, k);
				if (g.result()) finished++;
			}
		}
	}
	check(`${finished} of ${games} games finished (longest ${longest} moves)`, finished === games);
	check("no bot move was refused", refused === 0, `${refused} refused`);
	// A bot answers a stack and attacks a nearly-out neighbour.
	const g = table(3, { stack: true }, (s) => {
		deal(s, [[card("sun", "1")], [card("moon", "zap"), card("moon", "1"), card("moon", "2")], [card("star", "2")]], card("sun", "zap"));
		s.turn = 1;
		s.pending = 2;
		s.pendingKind = "zap";
	});
	check("a bot answers a ZAP with its own", g.bot({ seat: "p1" })?.play === card("moon", "zap"));
	const h = table(3, {}, (s) => {
		deal(s, [[card("sun", "1")], [card("moon", "8"), card("moon", "block"), card("moon", "1")], [card("star", "2")]], card("moon", "5"));
		s.turn = 1;
		s.hands[2] = [card("star", "2")];
	});
	check("a bot blocks a neighbour with one card left", h.bot({ seat: "p1" })?.play === card("moon", "block"));
	const w = table(3, {}, (s) => {
		deal(s, [[card("sun", "1")], [DECK.findIndex((c) => c.f === "prism"), card("bolt", "1"), card("bolt", "2"), card("moon", "9")], [card("star", "2"), card("star", "3"), card("star", "4")]], card("sun", "5"));
		s.turn = 1;
	});
	const pick = w.bot({ seat: "p1" });
	check("a bot with only a PRISM to play names the suit it holds most of", pick?.suit === "bolt", JSON.stringify(pick));
}

console.log("\na bot still on turn after its own move moves on in the same apply");
{
	// The platform asks a bot once per turn it sees begin: a bot left on turn
	// by its own move (a drawn card that plays, BOUNCE with two) would stall.
	const botTable = (n, edit) => {
		const g = game();
		g.init({ seats: seatsOf(n, true), seed: 7, match: 0, first: "p1" });
		g.apply({ action: { start: true }, by: "p0" });
		const snap = g.snapshot();
		edit(snap.s);
		g.restore({ snapshot: snap });
		return g;
	};
	let g = botTable(2, (s) => {
		deal(s, [[card("moon", "1"), card("moon", "2")], [card("sun", "bounce"), card("sun", "1"), card("star", "3")]], card("sun", "5"));
		s.turn = 1;
	});
	g.apply({ action: { play: card("sun", "bounce") }, by: "p1" });
	let w = v(g);
	check("two playing: a bot's BOUNCE, then its next card, then the person's turn", w.turn === 0 && w.counts[1] === 1 && w.log.filter((e) => e.seat === 1 && e.kind === "play").length === 2, JSON.stringify(w.log.slice(-3)));
	g = botTable(3, (s) => {
		deal(s, [[card("moon", "1")], [card("star", "9"), card("star", "2")], [card("moon", "2")]], card("sun", "5"));
		s.turn = 1;
		s.draw.push(card("sun", "8"));
	});
	g.apply({ action: g.bot({ seat: "p1" }), by: "p1" });
	w = v(g);
	check("a bot's drawn card that plays is played in the same move", w.top === card("sun", "8") && w.turn === 2 && w.drawn === null);
}

console.log("\nwho deals goes round");
{
	const g = game();
	const seats = seatsOf(4);
	g.init({ seats, seed: 5, match: 0, first: "p1" });
	const opened = [v(g).turn];
	for (const first of ["p2", "p3"]) {
		g.init({ seats, seed: 5, match: opened.length, first });
		opened.push(v(g).turn);
	}
	check("`first` from the platform opens each match", JSON.stringify(opened) === "[1,2,3]");
	const old = game();
	old.init({ seats, seed: 9, match: 0 });
	const a = v(old).opener;
	old.init({ seats, seed: 9, match: 1 });
	const b = v(old).opener;
	old.init({ seats, seed: 9, match: 2 });
	check("without `first` (an older shell): the next seat each PLAY AGAIN", b === (a + 1) % 4 && v(old).opener === (a + 2) % 4, JSON.stringify([a, b, v(old).opener]));
	g.apply({ action: { house: { jumpIn: true } }, by: "p0" });
	g.init({ seats, seed: 5, match: 3, first: "p0" });
	check("PLAY AGAIN keeps the house rules the host chose", v(g).house.jumpIn === true);
}

console.log("\nhandover mid-game");
{
	const g = game();
	g.init({ seats: seatsOf(4, true), seed: 42, match: 0, first: "p0" });
	g.apply({ action: { house: { stack: true, sevenZero: true } }, by: "p0" });
	g.apply({ action: { start: true }, by: "p0" });
	for (let k = 0; k < 15 && !g.result(); k++) {
		const [who] = g.turn();
		g.apply({ action: g.bot({ seat: who }), by: who });
	}
	const snap = JSON.parse(JSON.stringify(g.snapshot()));
	const heir = game();
	heir.restore({ snapshot: snap });
	check("the heir's views equal the host's, hands and all", ["p0", "p1", "p2", "p3", null].every((seat) => JSON.stringify(heir.view({ seat })) === JSON.stringify(g.view({ seat }))));
	let k = 0;
	for (; k < 3000 && !heir.result(); k++) {
		const [who] = heir.turn();
		heir.apply({ action: heir.bot({ seat: who }), by: who });
	}
	check("…and plays the game on to its end", !!heir.result() && heir.view({ seat: null }).house.stack);
	heir.init({ seats: seatsOf(4, true), seed: 43, match: 1 });
	check("the heir's PLAY AGAIN deals on from the next seat", heir.view({ seat: null }).opener === 1);
}

console.log(failures ? `\n${failures} failing` : "\nall passing");
process.exit(failures ? 1 : 0);
