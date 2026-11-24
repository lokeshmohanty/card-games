// twenty-nine/twenty-nine.js — 29. An SDK v2 managed game.
//
// The rules are twenty-nine-rules.js `game()`: the platform runs them on the
// host, sends each phone its view (its own cards, the trump only to the
// bidder until it is shown), plays the bot seats, shows the turn-wait banner,
// reports the result, draws the end card with PLAY AGAIN and hands the game
// to the heir if the host leaves. This file is the table.
//
// ## The table
//
// You sit at the bottom, your partner at the top, the other side left and
// right, in the order play goes round. Each seat says its name, its mark, its
// side, how many cards it holds, and whether it dealt or bid. The trick is in
// the middle; a finished trick stays a moment, saying who took it. The bid,
// the trump (or that it is still hidden) and the score are above the table.
//
// The cards are drawn here in markup and SVG from the theme: the four suits'
// shapes, hearts and diamonds in the theme's first player colour, spades and
// clubs in ink, so a suit reads by its shape first.

//
// The rules (the pair, the hands to win) are asked only before the first
// game (Lokesh, 2026-11-23, as Ludo): PLAY AGAIN deals straight away with
// them; at the end the host's phone says "Next game: … · CHANGE"; and they are
// kept on the host's phone ("house" in the game's storage), so a one-tap
// start with bots deals with them straight away.

const TN = twentyNineRules;
// The host's last rules, from this phone's storage (cleaned by the rules).
let lastHouse = null;
arcade.init.then((m) => {
	const h = m?.storage?.house;
	if (h && typeof h === "object") lastHouse = h;
});
const rules = TN.game({ isHost: (id) => id === arcade.party?.host, last: () => lastHouse });
arcade.managed(rules);

const style = document.createElement("style");
style.textContent = `
	.g-stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;
		padding: calc(env(safe-area-inset-top) + 56px) max(8px, env(safe-area-inset-right))
			max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)); box-sizing: border-box; overflow: hidden; }
	.tn-status { font-family: var(--font-display); font-size: clamp(0.95rem, 3.6vw, 1.2rem); color: var(--accent); text-shadow: 0 0 8px var(--glow);
		text-align: center; line-height: 1.3; min-height: 1.4em; }
	.tn-status small { display: block; font-family: var(--font-body); font-size: 0.8rem; color: var(--ink-2); text-shadow: none; }
	.tn-board { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 12px; font-size: 0.8rem; color: var(--ink-2); max-width: 640px; }
	.tn-board b { color: var(--ink); font-family: var(--font-mono); }
	.tn-board .tr { display: inline-flex; align-items: center; gap: 3px; }
	.tn-board .tr svg { width: 15px; height: 15px; }
	.tn-mid { flex: 1 1 auto; min-height: 0; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
	.tn-table { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); grid-template-rows: auto auto auto; align-items: center;
		justify-items: center; gap: 4px; width: 100%; max-width: 520px; }
	.tn-seat { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 6px; border-radius: 10px; border: 1px solid var(--rule);
		background: var(--surface); font-size: 0.8rem; color: var(--ink-2); max-width: 100%; box-sizing: border-box; min-width: 0; }
	.tn-seat .nm { display: inline-flex; align-items: center; gap: 4px; color: var(--ink); font-weight: 600; max-width: 100%; }
	.tn-seat .nm span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 6.5em; }
	.tn-seat .nm svg { width: 16px; height: 16px; flex: none; }
	.tn-seat .tags { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
	.tn-seat .tag { font-family: var(--font-mono); font-size: 0.75rem; padding: 0 4px; border-radius: 4px; border: 1px solid var(--rule); color: var(--ink-2); }
	.tn-seat .tag.bid { border-color: var(--accent-2); color: var(--ink); }
	.tn-seat.on { border: 2px solid var(--accent); box-shadow: 0 0 10px var(--glow); padding: 3px 5px; }
	.tn-seat.on .nm::before { content: "▸"; color: var(--accent); }
	.tn-seat.gone { opacity: 0.6; }
	.tn-trick { position: relative; width: var(--tw); height: var(--th); }
	.tn-slot { position: absolute; width: var(--cw); height: var(--ch); }
	.tn-slot.s0 { left: calc(50% - var(--cw) / 2); bottom: 0; }
	.tn-slot.s2 { left: calc(50% - var(--cw) / 2); top: 0; }
	.tn-slot.s1 { left: 0; top: calc(50% - var(--ch) / 2); }
	.tn-slot.s3 { right: 0; top: calc(50% - var(--ch) / 2); }
	.tn-slot .tn-face { width: 100%; height: 100%; animation: tn-in 0.22s ease-out; }
	.tn-slot.win .tn-face { box-shadow: 0 0 0 3px var(--accent), 0 0 16px var(--glow); }
	@keyframes tn-in { from { transform: scale(1.15); opacity: 0.3; } }
	@media (prefers-reduced-motion: reduce) { .tn-slot .tn-face { animation: none; } }
	.tn-took { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 0.8rem; color: var(--ink); background: var(--surface);
		border: 1px solid var(--accent); border-radius: 8px; padding: 2px 6px; white-space: nowrap; z-index: 2; }
	.tn-aside { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--ink-2); }
	.tn-aside .mini { width: 18px; height: 26px; border-radius: 3px; border: 1px solid var(--accent-2); background: var(--surface-2); }
	.tn-said { font-size: 0.85rem; color: var(--ink-2); text-align: center; min-height: 1.3em; max-width: 520px; }
	.tn-bar { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; align-items: center; min-height: 44px; max-width: 520px; }
	.tn-btn { min-width: 64px; min-height: 44px; padding: 0 14px; border-radius: 10px; border: 2px solid var(--accent); background: var(--surface);
		color: var(--ink); font: 700 0.9rem var(--font-display); cursor: pointer; }
	.tn-btn.go { background: var(--accent-2); border-color: var(--accent-2); color: var(--on-accent-2); }
	.tn-btn:disabled { opacity: 0.5; cursor: default; }
	.tn-bids { display: grid; grid-template-columns: repeat(auto-fill, 44px); gap: 5px; justify-content: center; width: 100%; max-width: 360px; }
	.tn-bids .tn-btn { min-width: 44px; width: 44px; padding: 0; font-family: var(--font-mono); }
	.tn-hand { width: 100%; max-width: 640px; flex: none; display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 8px; }
	.tn-row { display: flex; justify-content: center; }
	.tn-card { position: relative; flex: none; padding: 0; border: 0; background: none; cursor: pointer; height: var(--hh); }
	.tn-card .tn-face { position: absolute; left: 0; top: 0; width: var(--hw); height: var(--hh); transition: transform 0.12s; }
	.tn-card.ok .tn-face { transform: translateY(-7px); box-shadow: 0 0 0 2px var(--accent), 0 0 14px var(--glow); }
	.tn-card:disabled { cursor: default; }
	.tn-card:disabled .tn-face { opacity: 0.72; }
	.tn-card:focus-visible { outline: none; }
	.tn-card:focus-visible .tn-face { outline: 3px solid var(--accent); outline-offset: 2px; }
	.tn-face { position: relative; box-sizing: border-box; border-radius: 8px; border: 1.5px solid var(--rule); background: var(--surface); color: var(--suit);
		box-shadow: 0 1px 3px var(--scrim); overflow: hidden; }
	.tn-face .ix { position: absolute; left: 4px; top: 3px; display: flex; flex-direction: column; align-items: center; line-height: 1; font: 700 15px var(--font-display); color: var(--suit); }
	.tn-face .ix svg { width: 13px; height: 13px; margin-top: 2px; }
	.tn-face .mid { position: absolute; inset: 30% 12% 10% 22%; display: grid; place-items: center; }
	.tn-face .mid svg { width: 80%; height: auto; max-height: 100%; }
	.tn-face .pts { position: absolute; right: 4px; bottom: 2px; font: 600 12px var(--font-mono); color: var(--ink-2); }
	.tn-face.laid { outline: 2px dashed var(--accent-2); outline-offset: -5px; }
	.tn-sheet { position: absolute; inset: 0; display: grid; place-items: center; background: var(--scrim); z-index: 5; padding: 64px 12px 12px; }
	.tn-panel { background: var(--surface); border: 2px solid var(--accent); border-radius: 14px; padding: 16px; width: min(100%, 360px); box-shadow: 0 0 24px var(--glow);
		display: flex; flex-direction: column; gap: 10px; box-sizing: border-box; max-height: 100%; overflow: auto; }
	.tn-panel h2 { margin: 0; font: 700 1.1rem var(--font-display); color: var(--accent); text-align: center; }
	.tn-panel p { margin: 0; font-size: 0.85rem; color: var(--ink-2); text-align: center; }
	.tn-opt { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 6px 10px; border-radius: 10px; border: 2px solid var(--rule);
		background: var(--surface-2); color: var(--ink); text-align: left; cursor: pointer; font: inherit; }
	.tn-opt .t { flex: 1; display: flex; flex-direction: column; gap: 2px; }
	.tn-opt .t b { font: 700 0.95rem var(--font-display); }
	.tn-opt .t small { font-size: 0.8rem; color: var(--ink-2); }
	.tn-opt .sw { flex: none; min-width: 3.2em; text-align: center; padding: 4px 6px; border-radius: 999px; border: 2px solid var(--ink-3); font: 700 0.8rem var(--font-mono); color: var(--ink-2); }
	.tn-opt[aria-pressed="true"] { border-color: var(--accent); }
	.tn-opt[aria-pressed="true"] .sw { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
	.tn-opt:disabled, .tn-goal:disabled { cursor: default; opacity: 0.85; }
	.tn-goals { display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap; font-size: 0.85rem; color: var(--ink); }
	.tn-goal { min-width: 52px; min-height: 44px; border-radius: 10px; border: 2px solid var(--rule); background: var(--surface-2); color: var(--ink);
		font: 700 1rem var(--font-mono); cursor: pointer; }
	.tn-goal[aria-pressed="true"] { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
	/* The end: what the next game will be, and CHANGE (the host's), at the top, clear of the shell's tucked end card. */
	.tn-next { position: absolute; left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right)); top: calc(env(safe-area-inset-top) + 56px);
		z-index: 4; display: flex; flex-direction: column; gap: 8px; padding: 8px 10px; border-radius: 12px; border: 2px solid var(--accent);
		background: var(--surface); box-shadow: 0 0 18px var(--glow); font-size: 0.85rem; color: var(--ink-2); max-width: 520px; margin: 0 auto; box-sizing: border-box; }
	.tn-next[hidden] { display: none; }
	.tn-next-line { display: flex; align-items: center; justify-content: space-between; gap: 6px 10px; flex-wrap: wrap; }
	.tn-next-line b { color: var(--ink); font-weight: 600; }
`;
document.head.append(style);

const el = (tag, className, text) => {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text != null) node.textContent = text;
	return node;
};
const NS = "http://www.w3.org/2000/svg";
function svg(inner, box = "0 0 24 24") {
	const node = document.createElementNS(NS, "svg");
	node.setAttribute("viewBox", box);
	node.setAttribute("aria-hidden", "true");
	node.innerHTML = inner;
	return node;
}
const SUIT_ART = {
	spades: '<path d="M12 2C9 6.5 3.5 9.5 3.5 14a4.3 4.3 0 0 0 7.3 3.1L9.5 22h5l-1.3-4.9A4.3 4.3 0 0 0 20.5 14C20.5 9.5 15 6.5 12 2z" fill="currentColor"/>',
	hearts: '<path d="M12 21.5S2.5 15 2.5 8.6A4.9 4.9 0 0 1 12 6.3a4.9 4.9 0 0 1 9.5 2.3C21.5 15 12 21.5 12 21.5z" fill="currentColor"/>',
	diamonds: '<path d="M12 1.5l8 10.5-8 10.5-8-10.5z" fill="currentColor"/>',
	clubs: '<circle cx="12" cy="7" r="4.3" fill="currentColor"/><circle cx="6.8" cy="13.3" r="4.3" fill="currentColor"/><circle cx="17.2" cy="13.3" r="4.3" fill="currentColor"/><path d="M10.8 13h2.4l1.3 9h-5z" fill="currentColor"/>',
};
const SUIT_VAR = { spades: "var(--ink)", hearts: "var(--p1)", diamonds: "var(--p1)", clubs: "var(--ink)" };

function face(id) {
	const suit = TN.suitOf(id);
	const f = el("div", "tn-face");
	f.style.setProperty("--suit", SUIT_VAR[suit]);
	const ix = el("span", "ix", TN.rankOf(id));
	ix.append(svg(SUIT_ART[suit]));
	const mid = el("div", "mid");
	mid.append(svg(SUIT_ART[suit]));
	f.append(mid, ix);
	const p = TN.pointsOf(id);
	if (p) f.append(el("span", "pts", `${p}pt`));
	f.setAttribute("aria-hidden", "true");
	return f;
}
const MARKS = [
	'<circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/>',
	'<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
	'<path d="M8 3.5l4.5 8h-9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
	'<path d="M8 3l5 5-5 5-5-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
];
// A seat's mark is its player's colour (the platform's seat colours: picked
// in the party, no two alike; seat order on an older shell), with its own
// shape inside, so seats never differ by colour alone. Suits keep theirs.
let seatCols = [];
const seatIdx = (seat) => seatCols[seat] ?? seat % 8;
function seatMark(seat) {
	const m = svg(`<circle cx="8" cy="8" r="7.5" fill="var(--p${seatIdx(seat) + 1})"/><g style="color: var(--bg)">${MARKS[seat % 4]}</g>`, "0 0 16 16");
	m.dataset.mark = String(seat);
	return m;
}

// ------------------------------------------------------------- the page

const stage = el("div", "g-stage");
const statusEl = el("div", "tn-status");
statusEl.setAttribute("role", "status");
const board = el("div", "tn-board");
const mid = el("div", "tn-mid");
const tableEl = el("div", "tn-table");
const trickEl = el("div", "tn-trick");
trickEl.setAttribute("aria-label", "The trick");
const said = el("div", "tn-said");
said.setAttribute("aria-live", "polite");
const bar = el("div", "tn-bar");
mid.append(tableEl, said, bar);
const handEl = el("div", "tn-hand");
handEl.setAttribute("aria-label", "Your cards");
const nextEl = el("div", "tn-next");
nextEl.hidden = true;
nextEl.setAttribute("aria-label", "The next game");
stage.append(statusEl, board, mid, handEl, nextEl);
document.body.append(stage);
let sheet = null;

let view = null;
let shownLog = 0;
let holdTrick = null; // the trick just taken, shown a moment
let holdTimer = 0;
let nextTimer = 0;
const HOLD_MS = 1500;
const NEXT_MS = 6000;

const amHost = () => arcade.party?.host === arcade.party?.self;
const me = () => (view && view.you >= 0 ? view.you : 0);
/** Where seat `i` sits on this phone: 0 bottom (you), 1 left, 2 top, 3 right. */
const place = (i) => (i - me() + 4) % 4;
const nameOf = (i) => {
	if (view && i === view.you) return "You";
	const id = view?.seats[i];
	return arcade.party?.members?.find((p) => p.id === id)?.name || `Player ${i + 1}`;
};
const sideName = (side) => (view && view.you >= 0 ? (side === TN.sideOf(view.you) ? "Your side" : "Their side") : side === 0 ? "Seats 1 & 3" : "Seats 2 & 4");
const myTurn = () => !!view && view.you >= 0 && view.turn === view.you && ["bid", "trump", "play"].includes(view.phase);

function tell(e) {
	const who = nameOf(e.seat);
	if (e.kind === "deal") return `Hand ${e.hand}: ${who} dealt.`;
	if (e.kind === "bid") return `${who} bid ${e.bid}.`;
	if (e.kind === "pass") return `${who} passed.`;
	if (e.kind === "won") return `${who} won the bid at ${e.bid}.`;
	if (e.kind === "trump") return `${who} laid the trump aside.`;
	if (e.kind === "reveal") return e.by === e.seat ? `${who} showed the trump: ${TN.SUIT_NAMES[e.suit]}.` : `${who} asked: the trump is ${TN.SUIT_NAMES[e.suit]}.`;
	if (e.kind === "pair") return `${who} showed the pair: the bid is now ${e.to}.`;
	if (e.kind === "play") return `${who} played ${TN.rankOf(e.card)} of ${TN.SUIT_NAMES[TN.suitOf(e.card)]}.`;
	if (e.kind === "trick") return `${who} took the trick${e.points ? ` (+${e.points})` : ""}.`;
	if (e.kind === "hand") return e.made ? `Bid made: ${e.points} of ${e.bid}.` : `Bid missed: ${e.points} of ${e.bid}.`;
	return "";
}

function renderStatus() {
	let main = "";
	let sub = "";
	const v = view;
	if (v.phase === "setup") {
		main = "29";
		sub = amHost() ? "Pick the rules, then deal" : "The host is picking the rules";
	} else if (v.phase === "bid") {
		main = myTurn() ? (v.mustBid ? "YOU MUST BID 16" : "YOUR BID") : `${nameOf(v.turn)} to bid`;
		sub = v.high ? `Highest: ${v.high} by ${nameOf(v.highBy)}` : "Bids from 16 to 28";
	} else if (v.phase === "trump") {
		main = myTurn() ? "PICK THE TRUMP" : `${nameOf(v.bidder)} picks the trump`;
		sub = myTurn() ? "Tap a card to lay it aside: its suit is trump" : "It stays hidden until someone asks";
	} else if (v.phase === "play") {
		if (myTurn()) main = v.mustTrump === v.you ? "PLAY A TRUMP" : "YOUR TURN";
		else main = `${nameOf(v.turn)} to play`;
		sub = `Trick ${Math.min(8, v.trickNo + 1)} of 8 · ${sideName(TN.sideOf(v.bidder))} need ${v.bid}`;
	} else if (v.phase === "hand-over" || v.phase === "over") {
		const o = v.outcome;
		main = v.phase === "over" ? (v.you >= 0 && TN.sideOf(v.you) === (v.score[0] > v.score[1] ? 0 : 1) ? "YOUR SIDE WINS!" : `${sideName(v.score[0] > v.score[1] ? 0 : 1).toUpperCase()} WIN`) : o.made ? "BID MADE" : "BID MISSED";
		sub = `${sideName(o.side)} took ${o.points} of ${o.bid}`;
	}
	statusEl.replaceChildren(document.createTextNode(main), el("small", "", sub));
}

function renderBoard() {
	const v = view;
	const parts = [];
	const score = el("span", "");
	const mine = v.you >= 0 ? TN.sideOf(v.you) : 0;
	score.append(document.createTextNode(`${sideName(mine)} `), el("b", "", String(v.score[mine])), document.createTextNode(` – `), el("b", "", String(v.score[1 - mine])), document.createTextNode(` ${sideName(1 - mine).toLowerCase()} · first to ${v.house.goal}`));
	parts.push(score);
	if (v.bidder >= 0 && v.phase !== "bid") {
		const t = el("span", "tr");
		t.append(document.createTextNode(`Bid ${v.bid} · Trump `));
		if (v.trump) {
			const g = svg(SUIT_ART[v.trump]);
			g.style.color = SUIT_VAR[v.trump];
			t.append(g, document.createTextNode(TN.SUIT_NAMES[v.trump] + (v.revealed ? "" : " (only you know)")));
		} else t.append(document.createTextNode("hidden"));
		parts.push(t);
	}
	if (v.phase === "play" || v.phase === "hand-over" || v.phase === "over") {
		const p = el("span", "");
		p.append(document.createTextNode("Points "), el("b", "", String(v.points[mine])), document.createTextNode(" – "), el("b", "", String(v.points[1 - mine])));
		parts.push(p);
	}
	board.replaceChildren(...parts);
}

function seatBox(i) {
	const v = view;
	const box = el("div", `tn-seat${v.turn === i && playing() ? " on" : ""}${v.gone[i] ? " gone" : ""}`);
	box.dataset.seat = String(i);
	const nm = el("div", "nm");
	nm.append(seatMark(i), el("span", "", nameOf(i)));
	const tags = el("div", "tags");
	if (i !== v.you) tags.append(el("span", "tag", `${v.counts[i]} cards`));
	if (v.dealer === i) tags.append(el("span", "tag", "dealer"));
	if (v.phase === "bid") {
		const said = [...v.bids].reverse().find((b) => b.seat === i);
		if (said) tags.append(el("span", `tag${said.bid ? " bid" : ""}`, said.bid ? `bid ${said.bid}` : "pass"));
	} else if (v.bidder === i) tags.append(el("span", "tag bid", `bid ${v.bid}`));
	if (v.bidder === i && v.aside != null) {
		const a = el("span", "tn-aside");
		a.append(el("span", "mini"), document.createTextNode("trump"));
		tags.append(a);
	}
	box.append(nm, tags);
	box.title = `${nameOf(i)} — ${sideName(TN.sideOf(i))}`;
	return box;
}
const playing = () => ["bid", "trump", "play"].includes(view.phase);

function renderTable() {
	const v = view;
	if (v.phase === "setup") {
		tableEl.replaceChildren();
		return;
	}
	const at = [0, 1, 2, 3].map((k) => (me() + k) % 4); // bottom, left, top, right
	const blank = () => el("div", "");
	trickEl.replaceChildren();
	const showing = holdTrick ?? { cards: v.trick, winner: null };
	for (const p of showing.cards) {
		const slot = el("div", `tn-slot s${place(p.seat)}${showing.winner === p.seat ? " win" : ""}`);
		slot.append(face(p.card));
		trickEl.append(slot);
	}
	if (holdTrick) trickEl.append(el("div", "tn-took", `${nameOf(holdTrick.winner)}${holdTrick.points ? ` +${holdTrick.points}` : ""}`));
	tableEl.replaceChildren(blank(), seatBox(at[2]), blank(), seatBox(at[1]), trickEl, seatBox(at[3]), blank(), seatBox(at[0]), blank());
}

function renderBar() {
	const v = view;
	bar.replaceChildren();
	bar.className = "tn-bar";
	if (v.phase === "bid" && myTurn()) {
		bar.className = "tn-bids";
		for (let n = v.minBid; n <= TN.MAX_BID; n++) {
			const b = el("button", "tn-btn", String(n));
			b.type = "button";
			b.dataset.bid = String(n);
			b.setAttribute("aria-label", `Bid ${n}`);
			b.addEventListener("click", () => arcade.act({ bid: n }));
			bar.append(b);
		}
		if (!v.mustBid) {
			const p = el("button", "tn-btn", "PASS");
			p.type = "button";
			p.style.width = "auto";
			p.style.gridColumn = "span 2";
			p.addEventListener("click", () => arcade.act({ pass: true }));
			bar.append(p);
		}
		return;
	}
	if (v.phase === "play" && myTurn()) {
		if (v.canReveal) {
			const b = el("button", "tn-btn go", "ASK FOR TRUMP");
			b.type = "button";
			b.addEventListener("click", () => arcade.act({ reveal: true }));
			bar.append(b);
		}
		if (v.canPair) {
			const b = el("button", "tn-btn go", "SHOW PAIR");
			b.type = "button";
			b.addEventListener("click", () => arcade.act({ pair: true }));
			bar.append(b);
		}
	}
	if (v.phase === "hand-over") {
		const b = el("button", "tn-btn go", "NEXT HAND");
		b.type = "button";
		b.addEventListener("click", () => arcade.act({ next: v.hand }));
		bar.append(b);
	}
}

const SUIT_ORDER = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
function renderHand() {
	const v = view;
	let ids = [...v.cards].sort((a, b) => SUIT_ORDER[TN.suitOf(a)] - SUIT_ORDER[TN.suitOf(b)] || TN.order(a) - TN.order(b));
	if (v.aside != null && v.aside >= 0) ids.push(v.aside);
	if (v.phase === "setup") ids = [];
	const picking = v.phase === "trump" && myTurn();
	const legal = new Set(picking ? v.cards : v.legal);
	const W = Math.min(handEl.clientWidth || stage.clientWidth - 16, 640);
	const GAP = 6;
	const STEP = 44;
	const flat = ids.length ? Math.floor((W - (ids.length - 1) * GAP) / ids.length) : 80;
	const cw = flat >= 60 ? Math.min(84, flat) : Math.max(56, Math.min(70, Math.floor(W / 5)));
	const perRow = Math.max(1, Math.floor((W - cw) / STEP) + 1);
	const rows = [];
	const per = Math.ceil(ids.length / Math.max(1, Math.ceil(ids.length / perRow)));
	for (let i = 0; i < ids.length; i += per) rows.push(ids.slice(i, i + per));
	const room = stage.clientHeight * 0.3 - 14 - (rows.length - 1) * 6;
	const ch = Math.round(Math.max(64, Math.min(cw * 1.42, rows.length ? room / rows.length : cw * 1.42)));
	handEl.style.setProperty("--hw", `${cw}px`);
	handEl.style.setProperty("--hh", `${ch}px`);
	handEl.replaceChildren(
		...rows.map((row) => {
			const r = el("div", "tn-row");
			const step = row.length > 1 ? Math.max(STEP, Math.min(cw + GAP, (W - cw) / (row.length - 1))) : cw;
			row.forEach((id, k) => {
				const laid = id === v.aside;
				const b = el("button", `tn-card${legal.has(id) ? " ok" : ""}`);
				b.type = "button";
				b.dataset.card = String(id);
				b.style.width = `${k === row.length - 1 ? cw : Math.min(step, cw)}px`;
				if (k < row.length - 1 && step > cw) b.style.marginRight = `${step - cw}px`;
				b.disabled = !legal.has(id);
				b.setAttribute("aria-label", `${TN.rankOf(id)} of ${TN.SUIT_NAMES[TN.suitOf(id)]}${laid ? " (laid aside: the trump)" : ""}`);
				const f = face(id);
				if (laid) f.classList.add("laid");
				b.append(f);
				b.addEventListener("click", () => arcade.act(picking ? { trump: id } : { play: id }));
				r.append(b);
			});
			return r;
		}),
	);
}

function sizes() {
	const w = Math.max(44, Math.min(64, Math.floor(stage.clientWidth / 7.5)));
	stage.style.setProperty("--cw", `${w}px`);
	stage.style.setProperty("--ch", `${Math.round(w * 1.42)}px`);
	stage.style.setProperty("--tw", `${Math.round(w * 2.9)}px`);
	stage.style.setProperty("--th", `${Math.round(w * 1.42 * 2.35)}px`);
}

// ------------------------------------------------------------ the setup

function closeSheet() {
	sheet?.remove();
	sheet = null;
}
function renderSetup() {
	if (view.phase !== "setup") return closeSheet();
	const host = amHost();
	closeSheet();
	sheet = el("div", "tn-sheet");
	const panel = el("div", "tn-panel");
	panel.append(el("h2", "", "29"), el("p", "", "Seats 1 and 3 play against seats 2 and 4. Bid 16 to 28 for your side; the bidder picks a hidden trump."));
	const pair = el("button", "tn-opt");
	pair.type = "button";
	pair.dataset.rule = "pair";
	pair.setAttribute("aria-pressed", String(view.house.pair));
	const t = el("span", "t");
	t.append(el("b", "", "The pair"), el("small", "", "K and Q of trump, shown once it is out: the bid moves by 4."));
	pair.append(t, el("span", "sw", view.house.pair ? "ON" : "OFF"));
	pair.disabled = !host;
	pair.addEventListener("click", () => arcade.act({ house: { pair: !view.house.pair } }));
	const goals = el("div", "tn-goals");
	goals.append(el("span", "", "Hands to win:"));
	for (const g of TN.GOALS) {
		const b = el("button", "tn-goal", String(g));
		b.type = "button";
		b.dataset.goal = String(g);
		b.setAttribute("aria-pressed", String(view.house.goal === g));
		b.disabled = !host;
		b.addEventListener("click", () => arcade.act({ house: { goal: g } }));
		goals.append(b);
	}
	const go = el("button", "tn-btn go", host ? "DEAL" : "WAITING FOR THE HOST");
	go.type = "button";
	go.disabled = !host;
	go.addEventListener("click", () => arcade.act({ start: true }));
	panel.append(pair, goals, go);
	sheet.append(panel);
	stage.append(sheet);
}

// ------------------------------------------------------------ next game

let choosingNext = false;
const houseWords = (h) => `first to ${h.goal} hand${h.goal === 1 ? "" : "s"}, pair rule ${h.pair ? "on" : "off"}`;
/** The next game's rules, as the host's own rules have them; null where there is none to change. */
function nextGame() {
	if (!view || view.phase !== "over" || !amHost()) return null;
	try {
		return rules.nextGame();
	} catch {
		return null;
	}
}
/** Kept on this phone: the rules a one-tap start deals with next time. */
function keepHouse(h) {
	if (JSON.stringify(h) === JSON.stringify(lastHouse)) return;
	lastHouse = { ...h };
	arcade.send("store.set", { key: "house", value: lastHouse });
}
function pickNext(patch) {
	if (rules.setNext(patch) !== undefined) return;
	keepHouse(rules.nextGame().house);
	renderNext();
}
let lastNext = "";
function renderNext() {
	const n = nextGame();
	if (!n) choosingNext = false;
	const key = JSON.stringify([n, choosingNext]);
	if (key === lastNext) return;
	lastNext = key;
	nextEl.hidden = !n;
	if (!n) return void nextEl.replaceChildren();
	const change = el("button", "tn-btn tn-next-change", choosingNext ? "DONE" : "CHANGE");
	change.type = "button";
	change.setAttribute("aria-label", choosingNext ? "Done choosing the next game's rules" : "Change the next game's rules");
	change.addEventListener("click", () => {
		choosingNext = !choosingNext;
		renderNext();
	});
	const what = el("span");
	what.append(document.createTextNode("Next game: "), el("b", "", houseWords(n.house)));
	const line = el("div", "tn-next-line");
	line.append(what, change);
	if (!choosingNext) return void nextEl.replaceChildren(line);
	const pair = el("button", "tn-opt");
	pair.type = "button";
	pair.dataset.rule = "pair";
	pair.setAttribute("aria-pressed", String(n.house.pair));
	const t = el("span", "t");
	t.append(el("b", "", "The pair"), el("small", "", "K and Q of trump move the bid by 4."));
	pair.append(t, el("span", "sw", n.house.pair ? "ON" : "OFF"));
	pair.addEventListener("click", () => pickNext({ pair: !n.house.pair }));
	const goals = el("div", "tn-goals");
	goals.setAttribute("role", "group");
	goals.setAttribute("aria-label", "Next game's hands to win");
	goals.append(el("span", "", "Hands to win:"));
	for (const g of TN.GOALS) {
		const b = el("button", "tn-goal", String(g));
		b.type = "button";
		b.dataset.goal = String(g);
		b.setAttribute("aria-pressed", String(n.house.goal === g));
		b.addEventListener("click", () => pickNext({ goal: g }));
		goals.append(b);
	}
	nextEl.replaceChildren(line, pair, goals);
}

function render() {
	if (!view) return;
	sizes();
	renderStatus();
	renderBoard();
	renderTable();
	renderBar();
	renderHand();
	renderNext();
}

arcade.on("view", ({ state }) => {
	const before = view;
	view = state;
	seatCols = arcade.seatColors?.(state.seats ?? []) ?? [];
	if (!before || before.match !== state.match) {
		shownLog = 0;
		holdTrick = null;
	}
	// A trick just taken stays on the table a moment, saying who took it.
	if (state.lastTrick && (!before?.lastTrick || before.lastTrick.n !== state.lastTrick.n || before.hand !== state.hand) && before && before.match === state.match && state.phase !== "setup") {
		holdTrick = state.lastTrick;
		clearTimeout(holdTimer);
		holdTimer = setTimeout(() => {
			holdTrick = null;
			render();
			arcade.idle?.();
		}, HOLD_MS);
	}
	if (state.phase === "bid" && before?.phase !== "bid") holdTrick = null;
	const fresh = state.log.filter((e) => e.n > shownLog);
	if (fresh.length) {
		said.textContent = fresh.slice(-2).map(tell).join(" ");
		shownLog = fresh.at(-1).n;
	}
	if (state.phase === "setup") said.textContent = "";
	// The host moves the table on to the next hand if nobody taps NEXT HAND.
	clearTimeout(nextTimer);
	if (state.phase === "hand-over" && amHost()) nextTimer = setTimeout(() => arcade.act({ next: state.hand }), NEXT_MS);
	// The rules played, kept on the host's phone for its next one-tap start.
	if (["bid", "trump", "play"].includes(state.phase) && amHost()) keepHouse(state.house);
	renderSetup();
	render();
	if (!holdTrick) arcade.idle?.();
});
arcade.on("rejected", (m) => {
	said.textContent = m.reason;
});
arcade.on("roster", () => view && (renderSetup(), render()));
addEventListener("resize", render);
new ResizeObserver(() => render()).observe(stage);

/** For the tests: the view, whether it is this phone's turn, and the trick held on the table. */
arcade.debug = () => ({ ...(view ?? { seats: [], cards: [], legal: [] }), colors: (view?.seats ?? []).map((_, i) => seatIdx(i)), myTurn: myTurn(), holding: !!holdTrick, host: amHost(), kept: lastHouse && { ...lastHouse } });
