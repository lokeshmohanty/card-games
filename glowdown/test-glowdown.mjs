#!/usr/bin/env node
/**
 * test-glowdown.mjs — Glowdown's deck, plays, action cards, every house rule,
 * the settings only the first time, the bots, the dealer going round and a
 * handover mid-game.
 *
 *   node glowdown/test-glowdown.mjs
 *
 * Plays the managed rules the platform runs on the host (SDK v2). A position
 * is set up by editing a snapshot and restoring it, the way an heir would.
 */
import { readFileSync } from "node:fs";

new Function(readFileSync(new URL("./glowdown-rules.js", import.meta.url), "utf8"))();
const { DECK, SUITS, HOUSE, HAND, game } = globalThis.glowdownRules;

let failures = 0;
const check = (label, ok, detail = "") => {
	console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
	if (!ok) failures++;
};

/** The first card id with suit `s` and face `f` not in `not`. */
const card = (s, f, not = []) => DECK.findIndex((c, id) => c.s === s && c.f === f && !not.includes(id));
const PRISM = card(null, "prism");
const PRISM3 = card(null, "prism3");
const seatsOf = (n, bots = false) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, bot: bots && i > 0 }));

/** A game of `n` people with house rules `house`, dealt, then the state edited by `edit(s)`. */
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
	s.pending = 0;
	s.pendingKind = null;
	s.drawn = null;
	s.echo = false;
}
const v = (g, seat = "p0") => g.view({ seat });

console.log("\nthe deck: our own (redesigned 2026-11-24)");
check("60 cards: five suits of 11, five PRISMs", DECK.length === 60 && SUITS.length === 5 && SUITS.every((x) => DECK.filter((c) => c.s === x).length === 11) && DECK.filter((c) => c.s === null).length === 5);
check("the suits are Nova, Comet, Crystal, Orbit and Eclipse", SUITS.join() === "nova,comet,crystal,orbit,eclipse");
check("each suit: 1 to 8 once, and SPARK +1, ECHO and GIFT once", SUITS.every((x) => ["1", "2", "3", "4", "5", "6", "7", "8", "spark", "echo", "gift"].every((f) => DECK.filter((c) => c.s === x && c.f === f).length === 1)));
check("no 0, no 9, no skip, reverse, +2 or +4", !DECK.some((c) => ["0", "9", "zap", "block", "bounce", "prism4"].includes(c.f)));
check("three PRISM and two PRISM +3", DECK.filter((c) => c.f === "prism").length === 3 && DECK.filter((c) => c.f === "prism3").length === 2);
check("five cards each", HAND === 5);

console.log("\nsetup and the deal");
{
	const g = game({ isHost: (id) => id === "p0" });
	g.init({ seats: seatsOf(4), seed: 3, match: 0, first: "p2" });
	let w = v(g, "p1");
	check("friends at a first game: the setup, house rules all off", w.phase === "setup" && HOUSE.every((k) => w.house[k] === false) && HOUSE.join() === "stack,snap,pass,drawUntil");
	check("only the host sets the rules", g.apply({ action: { house: { stack: true } }, by: "p1" }) === "the host sets the house rules");
	check("a rule that does not exist is refused", g.apply({ action: { house: { cheat: true } }, by: "p0" }) === "no such rule");
	check("…and one from another game (jumpIn)", g.apply({ action: { house: { jumpIn: true } }, by: "p0" }) === "no such rule");
	check("nothing is played before the deal", g.apply({ action: { draw: true }, by: "p2" }) === "wait for the deal");
	g.apply({ action: { house: { stack: true, snap: true } }, by: "p0" });
	check("the host's choices show to everyone", v(g, "p3").house.stack && v(g, "p3").house.snap && !v(g, "p3").house.drawUntil);
	g.apply({ action: { start: true }, by: "p0" });
	w = v(g, "p1");
	check("START deals five each and turns up a number", w.phase === "play" && w.counts.every((n) => n === 5) && /^\d$/.test(DECK[w.top].f) && w.drawCount === 60 - 20 - 1);
	check("a phone sees its own hand only", w.hand.length === 5 && w.hands === null && v(g, null).hand.length === 0);
	check("`first` opens", w.turn === 2 && JSON.stringify(g.turn()) === '["p2"]');
	check("the suit in play is the top card's", w.suit === DECK[w.top].s);
}

console.log("\nlegal plays");
{
	const g = table(3, {}, (s) => deal(s, [[card("nova", "3"), card("comet", "5"), card("crystal", "8"), PRISM], [card("orbit", "1")], [card("orbit", "2")]], card("nova", "5")));
	const legal = new Set(v(g).legal);
	check("suit or face matches, and a PRISM, play", legal.has(card("nova", "3")) && legal.has(card("comet", "5")) && legal.has(PRISM));
	check("neither suit nor face: refused", !legal.has(card("crystal", "8")) && g.apply({ action: { play: card("crystal", "8") }, by: "p0" }) === "that card does not play");
	check("a card not in hand is refused", g.apply({ action: { play: card("orbit", "8") }, by: "p0" }) === "that card is not in your hand");
	check("out of turn is refused", g.apply({ action: { play: card("orbit", "1") }, by: "p1" }) === "not your turn");
	check("a PRISM must name a suit", g.apply({ action: { play: PRISM }, by: "p0" }) === "pick a suit");
	check("…one of the five", g.apply({ action: { play: PRISM, suit: "sun" }, by: "p0" }) === "pick a suit");
	g.apply({ action: { play: PRISM, suit: "eclipse" }, by: "p0" });
	check("…and the named suit is in play", v(g).suit === "eclipse" && v(g).turn === 1);
	const f = table(3, {}, (s) => deal(s, [[card("orbit", "gift"), card("nova", "1")], [card("comet", "1")], [card("crystal", "2")]], card("eclipse", "gift")));
	check("an action matches the same action of another suit (GIFT on GIFT)", v(f).legal.includes(card("orbit", "gift")));
}

console.log("\nSPARK +1, PRISM +3");
{
	let g = table(3, {}, (s) => deal(s, [[card("nova", "spark"), card("nova", "1")], [card("comet", "spark")], [card("comet", "2")]], card("nova", "5")));
	g.apply({ action: { play: card("nova", "spark") }, by: "p0" });
	let w = v(g);
	check("SPARK +1 (no stacking): the next player draws one and misses their turn", w.counts[1] === 2 && w.turn === 2 && w.pending === 0, JSON.stringify(w.counts));
	check("…and the log says so", w.log.at(-1).kind === "penalty" && w.log.at(-1).count === 1 && w.log.at(-2).kind === "play");
	g = table(3, {}, (s) => deal(s, [[PRISM3, card("nova", "1")], [card("comet", "spark")], [card("comet", "2")]], card("nova", "5")));
	g.apply({ action: { play: PRISM3, suit: "orbit" }, by: "p0" });
	w = v(g);
	check("PRISM +3: names the suit, the next draws three and misses their turn", w.suit === "orbit" && w.counts[1] === 4 && w.turn === 2);
}

console.log("\nECHO: again at once, in the same suit");
{
	let g = table(3, {}, (s) => deal(s, [[card("comet", "echo"), card("comet", "7"), card("nova", "2"), card("orbit", "3")], [card("orbit", "1")], [card("orbit", "2")]], card("comet", "4")));
	g.apply({ action: { play: card("comet", "echo") }, by: "p0" });
	let w = v(g);
	check("ECHO: the same player goes again", w.turn === 0 && w.echo === true);
	check("…only the same suit (or a PRISM) plays", JSON.stringify(w.legal) === JSON.stringify([card("comet", "7")]) && g.apply({ action: { play: card("nova", "2") }, by: "p0" }).startsWith("ECHO"));
	check("…no drawing during an ECHO", g.apply({ action: { draw: true }, by: "p0" }) === "ECHO: play a card of the same suit, or pass");
	g.apply({ action: { play: card("comet", "7") }, by: "p0" });
	check("…the follow-up played, the turn moves on", v(g).turn === 1 && !v(g).echo && v(g).counts[0] === 2);
	g = table(3, {}, (s) => deal(s, [[card("comet", "echo"), card("comet", "7"), card("nova", "2")], [card("orbit", "1")], [card("orbit", "2")]], card("comet", "4")));
	g.apply({ action: { play: card("comet", "echo") }, by: "p0" });
	check("…or PASS ends it", g.apply({ action: { pass: true }, by: "p0" }) == null && v(g).turn === 1 && !v(g).echo);
	g = table(3, {}, (s) => deal(s, [[card("comet", "echo"), card("nova", "2")], [card("orbit", "1")], [card("orbit", "2")]], card("comet", "4")));
	g.apply({ action: { play: card("comet", "echo") }, by: "p0" });
	check("…and with nothing to follow it, the turn moves on by itself", v(g).turn === 1 && !v(g).echo);
}

console.log("\nGIFT: hand a card to the next player");
{
	const g = table(3, {}, (s) => deal(s, [[card("orbit", "gift"), card("crystal", "8"), card("nova", "1")], [card("comet", "1")], [card("comet", "2")]], card("orbit", "3")));
	check("a GIFT needs a card to give", g.apply({ action: { play: card("orbit", "gift") }, by: "p0" }) === "pick a card to give");
	check("…not itself, not a card you do not hold", g.apply({ action: { play: card("orbit", "gift"), gift: card("orbit", "gift") }, by: "p0" }) === "pick a card to give" && g.apply({ action: { play: card("orbit", "gift"), gift: card("comet", "1") }, by: "p0" }) === "pick a card to give");
	g.apply({ action: { play: card("orbit", "gift"), gift: card("crystal", "8") }, by: "p0" });
	const w = v(g, "p1");
	check("the given card goes to the next player, whose turn it is", w.hand.includes(card("crystal", "8")) && v(g).counts[0] === 1 && w.turn === 1 && w.log.at(-1).kind === "gift");
	const last = table(3, {}, (s) => deal(s, [[card("orbit", "gift"), card("crystal", "8")], [card("comet", "1")], [card("comet", "2")]], card("orbit", "3")));
	last.apply({ action: { play: card("orbit", "gift"), gift: card("crystal", "8") }, by: "p0" });
	check("giving away your last card wins", v(last).phase === "over" && v(last).winner === 0);
	const alone = table(3, {}, (s) => deal(s, [[card("orbit", "gift")], [card("comet", "1")], [card("comet", "2")]], card("orbit", "3")));
	alone.apply({ action: { play: card("orbit", "gift") }, by: "p0" });
	check("a GIFT as your last card wins, nothing to give", v(alone).phase === "over" && v(alone).winner === 0);
}

console.log("\ndrawing");
{
	let g = table(3, {}, (s) => {
		deal(s, [[card("crystal", "8")], [card("orbit", "1")], [card("orbit", "2")]], card("nova", "5"));
		s.draw.push(card("eclipse", "7")); // the top of the draw pile: does not play
	});
	g.apply({ action: { draw: true }, by: "p0" });
	check("a draw that does not play: one card, and the turn passes", v(g).counts[0] === 2 && v(g).turn === 1);
	g = table(3, {}, (s) => {
		deal(s, [[card("crystal", "8")], [card("orbit", "1")], [card("orbit", "2")]], card("nova", "5"));
		s.draw.push(card("nova", "7"));
	});
	g.apply({ action: { draw: true }, by: "p0" });
	const w = v(g);
	check("a draw that plays: you may play it…", w.turn === 0 && w.drawn === card("nova", "7") && JSON.stringify(w.legal) === JSON.stringify([card("nova", "7")]));
	check("…only it", g.apply({ action: { play: card("crystal", "8") }, by: "p0" }) === "play the card you drew, or pass");
	check("…and not draw again", g.apply({ action: { draw: true }, by: "p0" }) === "play the card you drew, or pass");
	check("…or pass", g.apply({ action: { pass: true }, by: "p0" }) == null && v(g).turn === 1 && v(g).counts[0] === 2);
	check("passing without drawing is refused", g.apply({ action: { pass: true }, by: "p1" }) === "draw first");
}

console.log("\nhouse rule: stack sparks");
{
	const sp = (x) => card(x, "spark");
	const P3b = card(null, "prism3", [PRISM3]);
	const g = table(3, { stack: true }, (s) => deal(s, [[sp("nova"), card("nova", "1")], [sp("comet"), card("comet", "1")], [PRISM3, card("crystal", "2")]], card("nova", "5")));
	g.apply({ action: { play: sp("nova") }, by: "p0" });
	let w = v(g, "p1");
	check("a SPARK is owed, not drawn at once", w.pending === 1 && w.turn === 1 && w.counts[1] === 2);
	check("only a draw card answers it", JSON.stringify(w.legal) === JSON.stringify([sp("comet")]) && g.apply({ action: { play: card("comet", "1") }, by: "p1" }) === "answer with a draw card, or draw 1");
	g.apply({ action: { play: sp("comet") }, by: "p1" });
	check("SPARK on SPARK: two owed", v(g).pending === 2 && v(g).turn === 2);
	g.apply({ action: { play: PRISM3, suit: "comet" }, by: "p2" });
	w = v(g);
	check("PRISM +3 on a SPARK: five owed, only a PRISM +3 answers now", w.pending === 5 && w.pendingKind === "prism3" && w.turn === 0 && w.legal.length === 0);
	g.apply({ action: { draw: true }, by: "p0" });
	w = v(g);
	check("who cannot answer draws them all and misses the turn", w.counts[0] === 6 && w.pending === 0 && w.turn === 1, JSON.stringify(w.counts));
	const off = table(3, {}, (s) => deal(s, [[sp("nova"), card("nova", "1")], [sp("comet"), card("comet", "1")], [P3b, card("crystal", "2")]], card("nova", "5")));
	off.apply({ action: { play: sp("nova") }, by: "p0" });
	check("off: the SPARK is drawn at once, no answer", v(off).counts[1] === 3 && v(off).turn === 2);
}

console.log("\nhouse rule: snap");
{
	const mk = (on) => table(3, { snap: on }, (s) => deal(s, [[card("comet", "1"), card("comet", "2")], [card("orbit", "3"), card("orbit", "4")], [card("crystal", "5"), card("crystal", "7")]], card("nova", "5")));
	let g = mk(true);
	check("the same number in any suit snaps in out of turn", JSON.stringify(v(g, "p2").legal) === JSON.stringify([card("crystal", "5")]));
	check("another card of the suit in play does not", g.apply({ action: { play: card("crystal", "7") }, by: "p2" }) === "not your turn");
	g.apply({ action: { play: card("crystal", "5") }, by: "p2" });
	const w = v(g);
	check("snapping plays it, and play goes on from the snapper", w.top === card("crystal", "5") && w.turn === 0 && w.log.at(-1).kind === "snap" && w.counts[2] === 1);
	g = mk(false);
	check("off: out of turn is refused", g.apply({ action: { play: card("crystal", "5") }, by: "p2" }) === "not your turn" && v(g, "p2").legal.length === 0);
	g = table(3, { snap: true }, (s) => deal(s, [[card("comet", "1")], [card("orbit", "3")], [card("crystal", "gift"), card("crystal", "7")]], card("nova", "gift")));
	check("only numbers snap (not an action on the same action)", v(g, "p2").legal.length === 0);
}

console.log("\nhouse rule: prisms pass hands");
{
	let g = table(3, { pass: true }, (s) => deal(s, [[PRISM, card("nova", "1"), card("nova", "2")], [card("comet", "3")], [card("crystal", "2"), card("crystal", "3")]], card("orbit", "5")));
	g.apply({ action: { play: PRISM, suit: "comet" }, by: "p0" });
	check("a PRISM passes every hand on, the way play goes", JSON.stringify(v(g, "p1").hand) === JSON.stringify([card("nova", "1"), card("nova", "2")]) && JSON.stringify(v(g, "p2").hand) === JSON.stringify([card("comet", "3")]) && v(g, "p0").hand.length === 2 && v(g).log.at(-1).kind === "pass");
	g = table(3, { pass: true }, (s) => deal(s, [[PRISM3, card("nova", "1")], [card("comet", "3")], [card("crystal", "2")]], card("orbit", "5")));
	g.apply({ action: { play: PRISM3, suit: "comet" }, by: "p0" });
	check("…a PRISM +3 does not", JSON.stringify(v(g, "p0").hand) === JSON.stringify([card("nova", "1")]));
	g = table(3, {}, (s) => deal(s, [[PRISM, card("nova", "1")], [card("comet", "3")], [card("crystal", "2")]], card("orbit", "5")));
	g.apply({ action: { play: PRISM, suit: "comet" }, by: "p0" });
	check("off: a PRISM keeps the hands where they are", JSON.stringify(v(g, "p0").hand) === JSON.stringify([card("nova", "1")]));
}

console.log("\nhouse rule: draw until you can play");
{
	const g = table(3, { drawUntil: true }, (s) => {
		deal(s, [[card("crystal", "8")], [card("orbit", "1")], [card("orbit", "2")]], card("nova", "5"));
		s.draw.push(card("nova", "7"), card("eclipse", "3"), card("comet", "6")); // drawn from the end
	});
	g.apply({ action: { draw: true }, by: "p0" });
	const w = v(g);
	check("draws until a card plays, then may play it", w.counts[0] === 4 && w.drawn === card("nova", "7") && w.turn === 0 && w.log.at(-1).count === 3);
	g.apply({ action: { play: card("nova", "7") }, by: "p0" });
	check("…and plays it", v(g).top === card("nova", "7") && v(g).turn === 1);
}

console.log("\nthe end: placed by cards left");
{
	const g = table(4, {}, (s) => deal(s, [[card("nova", "1")], [card("comet", "3"), card("comet", "spark"), PRISM], [card("crystal", "2"), card("crystal", "3")], [card("orbit", "4"), card("orbit", "5")]], card("nova", "5")));
	g.apply({ action: { play: card("nova", "1") }, by: "p0" });
	const r = g.result();
	check("the first out wins; the rest by cards left, a tie together", r?.kind === "ffa" && JSON.stringify(r.ranking) === '[["p0"],["p2","p3"],["p1"]]' && r.scores.p1 === 3 && r.scores.p2 === 2 && r.scores.p0 === 0, JSON.stringify(r));
	check("the end shows every hand and how many each held", v(g, "p1").hands?.[1]?.length === 3 && JSON.stringify(v(g).left) === "[0,3,2,2]");
	check("nothing plays after the end", g.apply({ action: { draw: true }, by: "p1" }) === "the game is over" && g.turn().length === 0);
}

console.log("\nleaving and skipping");
{
	let g = table(3, {}, (s) => deal(s, [[card("nova", "1"), card("nova", "2")], [card("comet", "3")], [card("crystal", "2")]], card("nova", "5")));
	check("SKIP TURN: they draw one and the turn moves", g.skip({ seat: "p0" }) === true && v(g).counts[0] === 3 && v(g).turn === 1);
	g.leave({ seat: "p1" });
	check("a leaver's turn passes on, their cards back in the pile", v(g).turn === 2 && v(g).counts[1] === 0 && v(g).out[1]);
	g.leave({ seat: "p2" });
	const r = g.result();
	check("the last one playing wins; those who left are not placed (no score of 0, the best)", v(g).phase === "over" && v(g).winner === 0 && JSON.stringify(r.ranking) === '[["p0"]]' && !("p1" in r.scores) && !("p2" in r.scores), JSON.stringify(r));
	check("…and the end shows no count for them", JSON.stringify(v(g).left) === "[3,null,null]");
	// Review, 2026-11-24: a stacked draw passed on to the next player when the debtor left.
	g = table(3, { stack: true }, (s) => deal(s, [[card("nova", "spark"), card("nova", "1")], [card("comet", "3")], [card("crystal", "2"), card("crystal", "4")]], card("nova", "5")));
	g.apply({ action: { play: card("nova", "spark") }, by: "p0" });
	check("(p1 owes one)", v(g).turn === 1 && v(g).pending === 1);
	g.leave({ seat: "p1" });
	const w = v(g);
	check("the debtor leaving takes the debt with them: nothing owed by the next player", w.turn === 2 && w.pending === 0 && w.pendingKind === null && w.counts[2] === 2, JSON.stringify({ turn: w.turn, pending: w.pending }));
	g = table(3, {}, (s) => deal(s, [[card("comet", "echo"), card("comet", "7"), card("nova", "2")], [card("orbit", "1")], [card("orbit", "2")]], card("comet", "4")));
	g.apply({ action: { play: card("comet", "echo") }, by: "p0" });
	g.leave({ seat: "p0" });
	check("a leaver in the middle of an ECHO: the turn moves on, the ECHO ends", v(g, "p1").turn === 1 && !v(g, "p1").echo);
}

console.log("\nthe bots finish games, under every house rule");
{
	const combos = [{}, { stack: true }, { snap: true }, { pass: true }, { drawUntil: true }, { stack: true, snap: true, pass: true, drawUntil: true }];
	let finished = 0;
	let games = 0;
	let refused = 0;
	let longest = 0;
	const seen = new Set();
	for (const house of combos) {
		for (const n of [2, 3, 5, 8]) {
			for (let seed = 1; seed <= 8; seed++) {
				games++;
				// One person and bots: dealt at once, with the rules last played (`last`).
				const g = game({ last: () => house });
				g.init({ seats: seatsOf(n, true), seed: seed * 101 + n, match: 0 });
				if (JSON.stringify(g.view({ seat: null }).house) !== JSON.stringify({ ...globalThis.glowdownRules.DEFAULT_HOUSE, ...house })) refused++;
				let k = 0;
				for (; k < 3000 && !g.result(); k++) {
					const [who] = g.turn();
					// The person on seat 0 plays like a bot too.
					const a = g.bot({ seat: who });
					if (g.apply({ action: a, by: who }) != null) refused++;
					for (const e of g.view({ seat: null }).log) seen.add(e.kind);
				}
				longest = Math.max(longest, k);
				if (g.result()) finished++;
			}
		}
	}
	check(`${finished} of ${games} games finished (longest ${longest} moves)`, finished === games);
	check("no bot move was refused", refused === 0, `${refused} refused`);
	check(`the bots used every card and rule (${[...seen].sort().join(", ")})`, ["play", "draw", "penalty", "gift", "pass"].every((k) => seen.has(k)));
	const g = table(3, { stack: true }, (s) => {
		deal(s, [[card("nova", "1")], [card("comet", "spark"), card("comet", "1"), card("comet", "2")], [card("crystal", "2")]], card("nova", "spark"));
		s.turn = 1;
		s.pending = 1;
		s.pendingKind = "spark";
	});
	check("a bot answers a SPARK with its own", g.bot({ seat: "p1" })?.play === card("comet", "spark"));
	const h = table(3, {}, (s) => {
		deal(s, [[card("nova", "1")], [card("comet", "8"), card("comet", "spark"), card("comet", "1")], [card("crystal", "2")]], card("comet", "5"));
		s.turn = 1;
	});
	check("a bot sparks a neighbour with one card left", h.bot({ seat: "p1" })?.play === card("comet", "spark"));
	const w = table(3, {}, (s) => {
		deal(s, [[card("nova", "1")], [PRISM, card("eclipse", "1"), card("eclipse", "2"), card("crystal", "7")], [card("comet", "2"), card("comet", "3"), card("comet", "4")]], card("nova", "5"));
		s.turn = 1;
	});
	const pick = w.bot({ seat: "p1" });
	check("a bot with only a PRISM to play names the suit it holds most of", pick?.suit === "eclipse", JSON.stringify(pick));
	const gi = table(3, {}, (s) => {
		deal(s, [[card("nova", "1")], [card("orbit", "gift"), card("orbit", "6"), card("orbit", "7"), card("crystal", "3"), PRISM], [card("comet", "2"), card("comet", "3"), card("comet", "4")]], card("orbit", "5"));
		s.turn = 1;
	});
	const gp = gi.bot({ seat: "p1" });
	check("a bot plays a GIFT and gives away its loneliest number, never a PRISM", gp?.play === card("orbit", "gift") && gp.gift === card("crystal", "3"), JSON.stringify(gp));
}

console.log("\na bot still on turn after its own move moves on in the same apply");
{
	// Shells cached before platform-fixes ask a bot once per turn it sees
	// begin: a bot left on turn by its own move (an ECHO, a drawn card that
	// plays) would stall there.
	const botTable = (n, edit) => {
		const g = game();
		g.init({ seats: seatsOf(n, true), seed: 7, match: 0, first: "p1" });
		const snap = g.snapshot();
		edit(snap.s);
		g.restore({ snapshot: snap });
		return g;
	};
	let g = botTable(2, (s) => {
		deal(s, [[card("orbit", "1"), card("orbit", "2")], [card("nova", "echo"), card("nova", "1"), card("crystal", "3")]], card("nova", "5"));
		s.turn = 1;
	});
	g.apply({ action: { play: card("nova", "echo") }, by: "p1" });
	let w = v(g);
	check("a bot's ECHO, then its next card of the suit, then the person's turn", w.turn === 0 && w.counts[1] === 1 && w.log.filter((e) => e.seat === 1 && e.kind === "play").length === 2, JSON.stringify(w.log.slice(-3)));
	g = botTable(3, (s) => {
		deal(s, [[card("orbit", "1")], [card("crystal", "8"), card("crystal", "2")], [card("orbit", "2")]], card("nova", "5"));
		s.turn = 1;
		s.draw.push(card("nova", "8"));
	});
	g.apply({ action: g.bot({ seat: "p1" }), by: "p1" });
	w = v(g);
	check("a bot's drawn card that plays is played in the same move", w.top === card("nova", "8") && w.turn === 2 && w.drawn === null);
}

console.log("\nthe house rules: only the first time");
{
	// Lokesh, 2026-11-23 ("only the first time", as Ludo): the setup comes
	// before the first match; PLAY AGAIN keeps the rules; a one-tap start uses
	// the host device's last rules, or the defaults.
	const botsTable = (n) => seatsOf(n, true);
	let g = game();
	g.init({ seats: botsTable(4), seed: 1, match: 0, first: "p0" });
	let w = v(g);
	check("one person and bots, nothing kept: straight into the deal, rules all off", w.phase === "play" && HOUSE.every((k) => w.house[k] === false) && w.counts.every((n) => n === 5));
	g = game({ last: () => ({ stack: true, snap: false, pass: true, drawUntil: false }) });
	g.init({ seats: botsTable(3), seed: 1, match: 0, first: "p0" });
	w = v(g);
	check("…with the rules last played on this device", w.phase === "play" && w.house.stack && w.house.pass && !w.house.snap);
	for (const [label, kept] of [
		["junk", "not an object"],
		["an array", [true, true]],
		["wrong types", { stack: "yes", snap: 1, pass: null }],
		["an unknown rule (or the old deck's)", { jumpIn: true, sevenZero: true, drawUntil: true }],
	]) {
		const k = game({ last: () => kept });
		k.init({ seats: botsTable(3), seed: 1, match: 0 });
		const kv = v(k);
		check(`kept rules that are ${label}: the defaults where they are wrong, a deal anyway`, kv.phase === "play" && (label.startsWith("an unknown") ? kv.house.drawUntil && !("jumpIn" in kv.house) && !("sevenZero" in kv.house) : HOUSE.every((r) => kv.house[r] === false)), JSON.stringify(kv.house));
	}
	const broken = game({
		last: () => {
			throw new Error("storage gone");
		},
	});
	broken.init({ seats: botsTable(3), seed: 1, match: 0 });
	check("kept rules that cannot be read: the defaults", v(broken).phase === "play" && HOUSE.every((r) => v(broken).house[r] === false));
	g = game({ last: () => ({ stack: true }) });
	g.init({ seats: seatsOf(3), seed: 1, match: 0, first: "p0" });
	w = v(g);
	check("friends at the table (more than one person), a first game: the setup, the last rules picked", w.phase === "setup" && w.house.stack === true);
	g.apply({ action: { house: { snap: true } }, by: "p0" });
	g.apply({ action: { start: true }, by: "p0" });
	check("setNext is refused while playing", g.setNext({ stack: false }) === "only once the game is over");
	const snap = g.snapshot();
	deal(snap.s, [[card("nova", "1")], [card("comet", "3")], [card("crystal", "2")]], card("nova", "5"));
	g.restore({ snapshot: snap });
	g.apply({ action: { play: card("nova", "1") }, by: "p0" });
	check("(the game is over)", v(g).phase === "over");
	const next = g.nextGame();
	check("at the end, the next game is this one's rules", next.house.stack && next.house.snap && !next.house.pass, JSON.stringify(next));
	check("setNext refuses a rule that does not exist", g.setNext({ cheat: true }) === "no such rule");
	check("…and one that is not on or off", g.setNext({ stack: "maybe" }) === "no such rule");
	check("setNext (CHANGE at the end) takes a rule", g.setNext({ pass: true, stack: false }) == null && g.nextGame().house.pass && !g.nextGame().house.stack);
	g.init({ seats: seatsOf(3), seed: 2, match: 1, first: "p1" });
	w = v(g);
	check("PLAY AGAIN: straight into the deal, with the rules picked at the end (friends too)", w.phase === "play" && w.house.pass && w.house.snap && !w.house.stack && w.turn === 1);
	g.init({ seats: seatsOf(3), seed: 3, match: 2, first: "p2" });
	check("…and the next PLAY AGAIN keeps them", v(g).phase === "play" && v(g).house.pass && v(g).house.snap);
	const heir = game();
	heir.restore({ snapshot: JSON.parse(JSON.stringify(g.snapshot())) });
	heir.init({ seats: seatsOf(3), seed: 4, match: 3, first: "p0" });
	check("an heir's PLAY AGAIN keeps the rules too (they ride in the snapshot)", v(heir).phase === "play" && v(heir).house.pass && v(heir).house.snap);
	const fresh = game();
	fresh.init({ seats: seatsOf(3), seed: 1, match: 0 });
	fresh.init({ seats: seatsOf(3), seed: 1, match: 0 });
	check("a fresh mount of the same frame (match 0 again, CHANGE PLAYERS) with friends: the setup again", v(fresh).phase === "setup");
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
}

console.log("\nhandover mid-game");
{
	const g = game({ last: () => ({ stack: true, pass: true }) });
	g.init({ seats: seatsOf(4, true), seed: 42, match: 0, first: "p0" });
	for (let k = 0; k < 12 && !g.result(); k++) {
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
