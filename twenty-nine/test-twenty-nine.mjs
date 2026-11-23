#!/usr/bin/env node
/**
 * test-twenty-nine.mjs — 29's pack, bidding, hidden trump, tricks, pair rule,
 * scoring, the bots, the deal going round and a handover mid-hand.
 *
 *   node twenty-nine/test-twenty-nine.mjs
 *
 * Plays the managed rules the platform runs on the host (SDK v2). A position
 * is set up by editing a snapshot and restoring it, as an heir would.
 */
import { readFileSync } from "node:fs";

new Function(readFileSync(new URL("./twenty-nine-rules.js", import.meta.url), "utf8"))();
const { SUITS, RANKS, pointsOf, cardOf, trickWinner, game } = globalThis.twentyNineRules;

let failures = 0;
const check = (label, ok, detail = "") => {
	console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
	if (!ok) failures++;
};
const seatsOf = (bots = false) => [0, 1, 2, 3].map((i) => ({ id: `p${i}`, bot: bots && i > 0 }));
const C = (txt) => {
	const m = /^(10|[J9AKQ87])([shdc])$/.exec(txt);
	return cardOf({ s: "spades", h: "hearts", d: "diamonds", c: "clubs" }[m[2]], m[1]);
};
const v = (g, seat = "p0") => g.view({ seat });

/** A game dealt and edited by `edit(s)` (dealer 3, so seat 0 bids and leads first). */
function table(edit, house = {}, bots = false) {
	const g = game();
	g.init({ seats: seatsOf(bots), seed: 11, match: 0, first: "p0" });
	g.apply({ action: { house }, by: "p0" });
	g.apply({ action: { start: true }, by: "p0" });
	if (edit) {
		const snap = g.snapshot();
		edit(snap.s);
		g.restore({ snapshot: snap });
	}
	return g;
}
/** Straight to the play: hands (text), bidder, bid and trump suit, the trump card laid aside. */
function inPlay(s, hands, { bidder = 0, bid = 16, trump = "hearts", aside = null, turn = 0 } = {}) {
	s.hands = hands.map((h) => h.map(C));
	s.phase = "play";
	s.bidder = bidder;
	s.bid = bid;
	s.trump = trump;
	s.aside = aside ? C(aside) : null;
	s.revealed = false;
	s.turn = turn;
	s.trick = [];
	s.trickNo = 0;
	s.points = [0, 0];
	s.tricks = [0, 0];
}

console.log("\nthe pack");
check("32 cards ranked J 9 A 10 K Q 8 7", RANKS.join(" ") === "J 9 A 10 K Q 8 7" && SUITS.length === 4);
check("J 3, 9 2, A 1, 10 1, the rest 0: 28 in all", pointsOf(C("Js")) === 3 && pointsOf(C("9s")) === 2 && pointsOf(C("As")) === 1 && pointsOf(C("10s")) === 1 && pointsOf(C("Ks")) === 0 && Array.from({ length: 32 }, (_, i) => pointsOf(i)).reduce((a, b) => a + b) === 28);
check("a trick: the highest of the suit led", trickWinner([{ seat: 0, card: C("10s") }, { seat: 1, card: C("9s") }, { seat: 2, card: C("Jh") }, { seat: 3, card: C("As") }], null) === 1);
check("…or the highest trump", trickWinner([{ seat: 0, card: C("Js") }, { seat: 1, card: C("7h") }, { seat: 2, card: C("8h") }, { seat: 3, card: C("9s") }], "hearts") === 2);

console.log("\nsetup and bidding");
{
	const g = game({ isHost: (id) => id === "p0" });
	g.init({ seats: seatsOf(), seed: 4, match: 0, first: "p1" });
	check("it opens on setup: pair rule on, three hands to win", v(g).phase === "setup" && v(g).house.pair === true && v(g).house.goal === 3);
	check("only the host sets the rules", g.apply({ action: { house: { goal: 1 } }, by: "p2" }) === "the host sets the rules");
	check("a target that is not offered is refused", g.apply({ action: { house: { goal: 4 } }, by: "p0" }) === "no such rule");
	g.apply({ action: { house: { goal: 1, pair: false } }, by: "p0" });
	g.apply({ action: { start: true }, by: "p0" });
	let w = v(g, "p1");
	check("four cards each; `first` bids first (the dealer sits before them)", w.phase === "bid" && w.counts.every((n) => n === 4) && w.turn === 1 && w.dealer === 0);
	check("a bid under 16 is refused", g.apply({ action: { bid: 15 }, by: "p1" }) === "bid 16 to 28");
	check("out of turn is refused", g.apply({ action: { bid: 17 }, by: "p2" }) === "not your turn");
	g.apply({ action: { bid: 16 }, by: "p1" });
	check("a bid must beat the last", g.apply({ action: { bid: 16 }, by: "p2" }) === "bid 17 to 28" && g.apply({ action: { bid: 29 }, by: "p2" }) === "bid 17 to 28");
	g.apply({ action: { bid: 18 }, by: "p2" });
	g.apply({ action: { pass: true }, by: "p3" });
	g.apply({ action: { pass: true }, by: "p0" });
	w = v(g, "p1");
	check("passed players are out of the auction: back to the 16", w.turn === 1 && w.high === 18 && w.highBy === 2 && w.passed[3] && w.passed[0]);
	g.apply({ action: { pass: true }, by: "p1" });
	w = v(g, "p2");
	check("the last left wins the bid and picks the trump", w.phase === "trump" && w.bidder === 2 && w.bid === 18 && w.turn === 2);
	check("only the bidder picks", g.apply({ action: { trump: v(g, "p1").cards[0] }, by: "p1" }) === "the bidder is picking the trump");
	const pick = w.cards[0];
	g.apply({ action: { trump: pick }, by: "p2" });
	w = v(g, "p2");
	check("the trump card is laid aside; four more each", w.phase === "play" && w.aside === pick && w.cards.length === 7 && v(g, "p1").cards.length === 8 && w.counts[2] === 7);
	check("only the bidder knows the trump", w.trump === SUITS[pick >> 3] && v(g, "p1").trump === null && v(g, "p1").aside === -1);
	check("the player after the dealer leads", w.turn === 1);

	const f = game();
	f.init({ seats: seatsOf(), seed: 4, match: 0, first: "p0" });
	f.apply({ action: { start: true }, by: "p0" });
	for (const p of ["p0", "p1", "p2"]) f.apply({ action: { pass: true }, by: p });
	check("three passes: the fourth must bid 16", v(f, "p3").mustBid && f.apply({ action: { pass: true }, by: "p3" }) === "everyone else passed: bid at least 16");
	f.apply({ action: { bid: 16 }, by: "p3" });
	check("…and wins it at 16", v(f).phase === "trump" && v(f).bidder === 3 && v(f).bid === 16);
}

console.log("\nfollowing suit and the hidden trump");
{
	const hands = [
		["Ks", "8d", "7c", "Qc", "9c", "Ac", "10c", "Jc"],
		["As", "Jd", "9d", "Ad", "10d", "Kd", "Qd", "8c"],
		["7s", "7d", "7h", "8h", "9h", "Ah", "10h", "Kc"],
		["Js", "9s", "10s", "Qs", "8s", "Jh", "Qh", "Kh"],
	];
	const g = table((s) => inPlay(s, hands, { bidder: 3, bid: 18, trump: "hearts", aside: "Kh", turn: 0 }));
	// The aside card is out of the bidder's hand until shown.
	const snap = g.snapshot();
	snap.s.hands[3] = snap.s.hands[3].filter((c) => c !== C("Kh"));
	g.restore({ snapshot: snap });
	g.apply({ action: { play: C("Ks") }, by: "p0" });
	check("must follow suit when able", g.apply({ action: { play: C("Jd") }, by: "p1" }) === "follow suit" && JSON.stringify(v(g, "p1").legal) === JSON.stringify([C("As")]));
	check("the trump cannot be asked for by someone who can follow", g.apply({ action: { reveal: true }, by: "p1" }) === "you can follow suit");
	g.apply({ action: { play: C("As") }, by: "p1" });
	check("unable to follow: anything plays, and the trump may be asked for", v(g, "p2").legal.length === 1 && v(g, "p2").canReveal === false);
	g.apply({ action: { play: C("7s") }, by: "p2" });
	g.apply({ action: { play: C("Js") }, by: "p3" });
	let w = v(g);
	check("the J takes it: 4 points to seats 2 and 4", w.lastTrick.winner === 3 && w.points[1] === 4 && w.tricks[1] === 1 && w.turn === 3);
	g.apply({ action: { play: C("9s") }, by: "p3" });
	// Seat 0 has no spade: it plays a club, unshown trump stays hidden.
	check("can't follow: the trump may be asked for", v(g).canReveal === true);
	g.apply({ action: { play: C("7c") }, by: "p0" });
	g.apply({ action: { reveal: true }, by: "p1" });
	w = v(g, "p1");
	check("asking shows the trump to everyone; the card goes back to the bidder", w.revealed && w.trump === "hearts" && v(g, "p0").trump === "hearts" && w.counts[3] === 5 + 1 && v(g, "p3").aside === null);
	check("the asker has no trump: anything plays", w.mustTrump === -1 && w.legal.length === 7);
	g.apply({ action: { play: C("8c") }, by: "p1" });
	w = v(g, "p2");
	check("the next player, unable to follow, may trump now", w.legal.length === 7 && w.legal.includes(C("7h")));
	g.apply({ action: { play: C("7h") }, by: "p2" });
	g.apply({ action: { play: C("8s") }, by: "p3" });
	w = v(g);
	check("a trump shown takes the trick over the suit led", w.lastTrick.winner === 2 && w.turn === 2);
}

console.log("\nasking for the trump when you hold one; trumps before it is shown");
{
	const hands = [["Kd", "7c"], ["7d", "8c"], ["Jh", "Ac"], ["9d", "Qc"]];
	const g = table((s) => inPlay(s, hands, { bidder: 1, bid: 16, trump: "hearts", aside: null, turn: 0 }));
	g.apply({ action: { play: C("Kd") }, by: "p0" });
	g.apply({ action: { play: C("7d") }, by: "p1" });
	g.apply({ action: { reveal: true }, by: "p2" });
	check("the asker holds a trump: they must play one", v(g, "p2").mustTrump === 2 && JSON.stringify(v(g, "p2").legal) === JSON.stringify([C("Jh")]) && g.apply({ action: { play: C("Ac") }, by: "p2" }) === "you asked for the trump: play one");
	const h2 = [["Kd", "7c"], ["7d", "8c"], ["Jh", "Ac"], ["9d", "Qc"]];
	const u = table((s) => inPlay(s, h2, { bidder: 1, bid: 16, trump: "hearts", aside: null, turn: 0 }));
	u.apply({ action: { play: C("Kd") }, by: "p0" });
	u.apply({ action: { play: C("7d") }, by: "p1" });
	u.apply({ action: { play: C("Jh") }, by: "p2" });
	u.apply({ action: { play: C("9d") }, by: "p3" });
	check("a trump played before it is shown does not count", v(u).lastTrick.winner === 3);
}

console.log("\nthe bidder's last card is the one laid aside");
{
	const g = table((s) => {
		inPlay(s, [["Ks"], ["7s"], ["8s"], []], { bidder: 3, bid: 16, trump: "hearts", aside: "9h", turn: 0 });
		s.trickNo = 7;
	});
	g.apply({ action: { play: C("Ks") }, by: "p0" });
	g.apply({ action: { play: C("7s") }, by: "p1" });
	g.apply({ action: { play: C("8s") }, by: "p2" });
	check("it is the bidder's only play", JSON.stringify(v(g, "p3").legal) === JSON.stringify([C("9h")]));
	g.apply({ action: { play: C("9h") }, by: "p3" });
	const w = v(g);
	check("playing it shows the trump, and it counts in that trick", w.revealed && w.history[0]?.trump === "hearts" && w.tricks[1] === 1);
}

console.log("\nthe pair");
{
	const hands = [["Kh", "Qh", "7c"], ["8h", "8c"], ["7h", "9c"], ["Jh", "Jc"]];
	const mk = (pair, bidder) =>
		table(
			(s) => {
				inPlay(s, hands, { bidder, bid: 20, trump: "hearts", turn: 0 });
				s.revealed = true;
				s.tricks = [1, 0];
			},
			{ pair },
		);
	let g = mk(true, 2);
	check("K and Q of trump, trump shown, a trick won: the pair may be shown", v(g).canPair === true);
	g.apply({ action: { pair: true }, by: "p0" });
	check("shown by the bidding side: the bid drops by 4", v(g).bid === 16 && v(g).pair.from === 20);
	check("once a hand", g.apply({ action: { pair: true }, by: "p0" }) === "no pair to show now");
	g = mk(true, 1);
	g.apply({ action: { pair: true }, by: "p0" });
	check("shown against the bidders: the bid rises by 4", v(g).bid === 24);
	g = mk(false, 1);
	check("with the pair rule off, no pair", v(g).canPair === false && g.apply({ action: { pair: true }, by: "p0" }) === "no pair to show now");
	g = table((s) => {
		inPlay(s, hands, { bidder: 1, bid: 20, trump: "hearts", turn: 0 });
		s.revealed = false;
		s.tricks = [1, 0];
	});
	check("not before the trump is shown", v(g).canPair === false);
	g = table((s) => {
		inPlay(s, hands, { bidder: 1, bid: 26, trump: "hearts", turn: 0 });
		s.revealed = true;
		s.tricks = [0, 1];
	});
	check("not before your side has won a trick", v(g).canPair === false);
	g = table((s) => {
		inPlay(s, hands, { bidder: 1, bid: 26, trump: "hearts", turn: 0 });
		s.revealed = true;
		s.tricks = [1, 0];
	});
	g.apply({ action: { pair: true }, by: "p0" });
	check("never over 28", v(g).bid === 28);
}

console.log("\nscoring a hand and the game");
{
	const g = table((s) => {
		inPlay(s, [["Js"], ["7s"], ["9s"], ["As"]], { bidder: 0, bid: 16, trump: "hearts", turn: 0 });
		s.trickNo = 7;
		s.points = [10, 12];
	});
	for (const [p, c] of [["p0", "Js"], ["p1", "7s"], ["p2", "9s"], ["p3", "As"]]) g.apply({ action: { play: C(c) }, by: p });
	let w = v(g);
	check("16 made (10 + 6): the bidders score a game point", w.phase === "hand-over" && w.score[0] === 1 && w.outcome.made && w.outcome.points === 16);
	check("no moves but the next hand", g.apply({ action: { play: 0 }, by: "p1" }) === "the hand is over" && g.turn().length === 0);
	check("a stale next is refused", g.apply({ action: { next: w.hand - 1 }, by: "p1" }) === "stale");
	const dealer = w.dealer;
	g.apply({ action: { next: w.hand }, by: "p2" });
	w = v(g);
	check("the next hand: the deal moves on one seat", w.phase === "bid" && w.dealer === (dealer + 1) % 4 && w.turn === (dealer + 2) % 4 && w.hand === 2);
	const f = table((s) => {
		inPlay(s, [["Js"], ["7s"], ["9s"], ["As"]], { bidder: 0, bid: 20, trump: "hearts", turn: 0 });
		s.trickNo = 7;
		s.points = [10, 12];
		s.score = [0, 2];
	});
	for (const [p, c] of [["p0", "Js"], ["p1", "7s"], ["p2", "9s"], ["p3", "As"]]) f.apply({ action: { play: C(c) }, by: p });
	w = v(f);
	check("20 missed (16): the point goes to the other side, who reach 3 and win", w.phase === "over" && w.score[1] === 3 && !w.outcome.made);
	const r = f.result();
	check("the result: the two sides, the winners first", r?.kind === "teams" && JSON.stringify(r.ranking) === '[["p1","p3"],["p0","p2"]]' && r.scores.p1 === 3, JSON.stringify(r));
}

console.log("\nthe bots bid and play sensibly, and finish games");
{
	let finished = 0;
	let refused = 0;
	let bids = 0;
	let made = 0;
	let hands = 0;
	let reveals = 0;
	const games = 40;
	for (let seed = 1; seed <= games; seed++) {
		const g = game();
		g.init({ seats: seatsOf(true), seed: seed * 7919, match: 0 });
		g.apply({ action: { start: true, house: { pair: true } }, by: "p0" });
		for (let k = 0; k < 2000 && !g.result(); k++) {
			const w = g.view({ seat: null });
			if (w.phase === "hand-over") {
				hands++;
				if (w.outcome.made) made++;
				g.apply({ action: { next: w.hand }, by: "p0" });
				continue;
			}
			const [who] = g.turn();
			const a = g.bot({ seat: who });
			if (a?.reveal) reveals++;
			if (g.apply({ action: a, by: who }) != null) refused++;
		}
		if (g.result()) {
			finished++;
			const h = g.view({ seat: null }).history;
			bids += h.reduce((t, x) => t + x.bid, 0) / h.length;
		}
	}
	check(`${finished} of ${games} games finished`, finished === games);
	check("no bot move was refused", refused === 0, `${refused}`);
	check(`bids average between 16 and 22 (${(bids / finished).toFixed(1)})`, bids / finished >= 16 && bids / finished <= 22);
	check(`bidders make their bid at least 40% of the time (${made}/${hands})`, made / hands >= 0.4);
	check(`the trump gets asked for (${reveals} times)`, reveals > 0);
	// A strong four bids; a weak one passes.
	const strong = table((s) => {
		s.hands[0] = ["Jh", "9h", "Ah", "Js"].map(C);
	}, {}, true);
	const sb = strong.bot({ seat: "p0" });
	check("a strong hand (J 9 A of a suit and a J) bids", sb?.bid === 16, JSON.stringify(sb));
	const weak = table((s) => {
		s.hands[0] = ["7h", "8s", "Qd", "Kc"].map(C);
		s.high = 17;
		s.highBy = 3;
	}, {}, true);
	check("a weak hand passes over 17", weak.bot({ seat: "p0" })?.pass === true);
	const tr = table((s) => {
		s.phase = "trump";
		s.bidder = 0;
		s.turn = 0;
		s.hands[0] = ["Jh", "9h", "7h", "As"].map(C);
	});
	check("the bidder makes trump its long suit, laying aside its lowest card", tr.bot({ seat: "p0" })?.trump === C("7h"));
	// Partner winning on the last card: throw points.
	const pts = table((s) => {
		inPlay(s, [["Kd", "7c"], ["8d", "9c"], ["Jd", "Ac"], ["Ad", "Qd"]], { bidder: 0, bid: 16, trump: "hearts", turn: 3 });
		s.hands[0] = ["7c"].map(C);
		s.trick = [{ seat: 0, card: C("Kd") }, { seat: 1, card: C("Jd") }, { seat: 2, card: C("8d") }];
		s.hands[1] = ["9c"].map(C);
		s.hands[2] = ["Ac"].map(C);
	});
	check("last to play, partner winning: give them the points", pts.bot({ seat: "p3" })?.play === C("Ad"));
	const bidder = table((s) => {
		inPlay(s, [["Ks", "7c"], ["Js", "9c"], ["8s", "Ac"], ["Qh", "Kd"]], { bidder: 3, bid: 16, trump: "hearts", aside: "7h", turn: 3 });
		s.hands[3] = ["Qh", "Kd"].map(C);
		s.trick = [{ seat: 0, card: C("Js") }, { seat: 1, card: C("Ks") }, { seat: 2, card: C("8s") }];
		s.hands[0] = ["7c"].map(C);
		s.hands[1] = ["9c"].map(C);
		s.hands[2] = ["Ac"].map(C);
	});
	check("the bidder who can't follow a trick with points shows its trump", bidder.bot({ seat: "p3" })?.reveal === true);
}

console.log("\nbots left on turn by their own move, and seats that leave");
{
	const g = game();
	g.init({ seats: seatsOf(true), seed: 3, match: 0, first: "p1" });
	g.apply({ action: { start: true }, by: "p0" });
	// A bot that wins a trick leads the next at once (the platform asks a bot once per turn).
	const snap = g.snapshot();
	inPlay(snap.s, [["8c"], ["9c"], ["10c"], ["Jd", "Ac"]], { bidder: 0, bid: 16, trump: "hearts", turn: 3 });
	snap.s.trick = [{ seat: 0, card: C("Kd") }, { seat: 1, card: C("7d") }, { seat: 2, card: C("8d") }];
	g.restore({ snapshot: snap });
	g.apply({ action: g.bot({ seat: "p3" }), by: "p3" });
	let w = v(g);
	check("a bot that takes a trick with the last card has led the next at once", w.lastTrick?.winner === 3 && w.trick.length === 1 && w.trick[0].seat === 3 && w.turn === 0, JSON.stringify({ last: w.lastTrick, trick: w.trick, turn: w.turn }));
	const h = game();
	h.init({ seats: seatsOf(), seed: 8, match: 0, first: "p0" });
	h.apply({ action: { start: true }, by: "p0" });
	h.leave({ seat: "p1" });
	h.apply({ action: { bid: 16 }, by: "p0" });
	w = v(h);
	check("a seat that left plays itself: it bid or passed on its own", w.bids.length === 2 && w.bids[1].seat === 1 && w.turn === 2);
	check("SKIP TURN makes the move for them", h.skip({ seat: "p2" }) === true && v(h).bids.length >= 3);
}

console.log("\nwho deals goes round");
{
	const g = game();
	const seats = seatsOf();
	const starts = [];
	for (const [k, first] of ["p2", "p3", "p0"].entries()) {
		g.init({ seats, seed: 5, match: k, first });
		g.apply({ action: { start: true }, by: "p0" });
		starts.push(v(g).turn);
	}
	check("`first` bids first each game, the dealer before them", JSON.stringify(starts) === "[2,3,0]");
	const old = game();
	old.init({ seats, seed: 9, match: 0 });
	const d0 = v(old).dealer;
	old.init({ seats, seed: 9, match: 1 });
	const d1 = v(old).dealer;
	check("without `first` (an older shell): the next seat deals first each PLAY AGAIN", d1 === (d0 + 1) % 4, JSON.stringify([d0, d1]));
	g.init({ seats, seed: 5, match: 3, first: "p1" });
	g.apply({ action: { house: { goal: 6 } }, by: "p0" });
	g.init({ seats, seed: 5, match: 4, first: "p2" });
	check("PLAY AGAIN keeps the host's rules", v(g).house.goal === 6);
}

console.log("\nhandover mid-hand");
{
	const g = game();
	g.init({ seats: seatsOf(true), seed: 77, match: 0, first: "p2" });
	g.apply({ action: { start: true }, by: "p0" });
	for (let k = 0; k < 12; k++) {
		const [who] = g.turn();
		g.apply({ action: g.bot({ seat: who }), by: who });
	}
	const heir = game();
	heir.restore({ snapshot: JSON.parse(JSON.stringify(g.snapshot())) });
	check("the heir's views equal the host's, the hidden trump included", ["p0", "p1", "p2", "p3", null].every((seat) => JSON.stringify(heir.view({ seat })) === JSON.stringify(g.view({ seat }))) && heir.view({ seat: "p1" }).phase === "play");
	for (let k = 0; k < 2000 && !heir.result(); k++) {
		const w = heir.view({ seat: null });
		if (w.phase === "hand-over") {
			heir.apply({ action: { next: w.hand }, by: "p0" });
			continue;
		}
		const [who] = heir.turn();
		heir.apply({ action: heir.bot({ seat: who }), by: who });
	}
	check("…and plays the game on to its end", !!heir.result());
}

console.log(failures ? `\n${failures} failing` : "\nall passing");
process.exit(failures ? 1 : 0);
