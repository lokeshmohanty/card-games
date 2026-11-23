// glowdown/glowdown.js — Glowdown. An SDK v2 managed game.
//
// The rules are glowdown-rules.js `game()`: the platform runs them on the
// host, sends each phone its view (its own hand only), plays the bot seats,
// shows the turn-wait banner, reports the result, draws the end card with
// PLAY AGAIN and hands the game to the heir if the host leaves. This file is
// the table: the house-rules screen, the piles, the other players and your
// hand.
//
// ## The cards
//
// Drawn here in markup and SVG from the theme, never a literal colour: each
// suit has its own shape (a sun's rays, a crescent moon, a star, a bolt) and
// its own player colour (--p2, --p3, --p5, --p1), so a suit reads without its
// colour. The other players carry a mark of their own as well (ring, cross…),
// beside their name.
//
// ## The hand on a phone
//
// The hand fans in rows: each card shows at least 44px of itself (its corner,
// with the face and the suit's shape), so every card stays a whole tap target
// at 354px wide; cards overlap only as much as the row needs, and a long
// hand takes another row rather than going narrower than that.
//
// ## The house rules, only the first time
//
// Lokesh, 2026-11-23 (as Ludo): the house-rules screen comes before the
// first game only. PLAY AGAIN deals straight away with the same rules; at the
// end the host's phone says "Next game: … · CHANGE", and CHANGE picks the
// rules for the next game (on the host's own rules, the live ones: the
// platform takes no moves after the end). The rules played are kept on the
// host's phone (the game's storage, "house"), so a one-tap start with bots
// deals with them straight away.

const GD = glowdownRules;
// The host's last house rules, from this phone's storage (the rules clean
// anything odd in it: a rule they do not know, a value not true or false).
let lastHouse = null;
arcade.init.then((m) => {
	const h = m?.storage?.house;
	if (h && typeof h === "object") lastHouse = h;
});
const rules = GD.game({ isHost: (id) => id === arcade.party?.host, last: () => lastHouse });
arcade.managed(rules);

const style = document.createElement("style");
style.textContent = `
	.g-stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; gap: 8px;
		padding: calc(env(safe-area-inset-top) + 56px) max(8px, env(safe-area-inset-right))
			max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)); box-sizing: border-box; overflow: hidden; }
	.gd-status { font-family: var(--font-display); font-size: clamp(0.95rem, 3.6vw, 1.2rem); color: var(--accent);
		text-shadow: 0 0 8px var(--glow); text-align: center; min-height: 1.4em; line-height: 1.3; }
	.gd-status small { display: block; font-family: var(--font-body); font-size: 0.8rem; color: var(--ink-2); text-shadow: none; }
	.gd-others { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 6px; max-width: 640px; }
	.gd-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--rule);
		background: var(--surface); font-size: 0.8rem; color: var(--ink-2); white-space: nowrap; }
	.gd-chip svg { width: 16px; height: 16px; flex: none; }
	.gd-chip .nm { max-width: 7.5em; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
	.gd-chip b { font-family: var(--font-mono); font-weight: 600; color: var(--ink); }
	.gd-chip.on { border: 2px solid var(--accent); box-shadow: 0 0 10px var(--glow); padding: 2px 7px; }
	.gd-chip.on::before { content: "▸"; color: var(--accent); font-size: 0.75rem; }
	.gd-chip.out { opacity: 0.55; text-decoration: line-through; }
	.gd-chip .few { color: var(--danger); font-weight: 700; }
	.gd-table { display: flex; align-items: center; justify-content: center; gap: 14px; flex: none; }
	.gd-pilebox { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 0.8rem; color: var(--ink-2); }
	.gd-draw { position: relative; width: var(--pw); height: var(--ph); padding: 0; border-radius: 10px; border: 2px solid var(--rule);
		background: var(--surface-2); color: var(--ink); cursor: pointer; font: 600 0.8rem var(--font-display); }
	.gd-draw .back { position: absolute; inset: 5px; border-radius: 7px; border: 1px dashed var(--ink-3); display: grid; place-items: center; }
	.gd-draw .back svg { width: 60%; height: auto; opacity: 0.55; }
	.gd-draw span.lbl { position: absolute; left: 0; right: 0; bottom: 6px; text-align: center; font-size: 0.8rem; }
	.gd-draw.mine { border-color: var(--accent); box-shadow: 0 0 14px var(--glow); }
	.gd-draw:disabled { cursor: default; opacity: 0.7; }
	.gd-top { width: var(--pw); height: var(--ph); position: relative; }
	.gd-top .gd-face { width: 100%; height: 100%; }
	.gd-top .gd-face.land { animation: gd-land 0.28s ease-out; }
	@keyframes gd-land { from { transform: translateY(-14px) rotate(-6deg) scale(1.08); opacity: 0.4; } }
	@media (prefers-reduced-motion: reduce) { .gd-top .gd-face.land { animation: none; } }
	.gd-info { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; font-size: 0.8rem; color: var(--ink-2); min-width: 76px; }
	.gd-suit { display: inline-flex; align-items: center; gap: 4px; color: var(--ink); font-weight: 600; }
	.gd-suit svg { width: 18px; height: 18px; }
	.gd-owed { color: var(--danger); font-weight: 700; font-family: var(--font-mono); font-size: 0.9rem; }
	.gd-bar { display: flex; gap: 8px; justify-content: center; min-height: 44px; align-items: center; flex: none; }
	.gd-btn { min-width: 96px; min-height: 44px; padding: 0 16px; border-radius: 10px; border: 2px solid var(--accent); background: var(--surface);
		color: var(--ink); font: 700 0.9rem var(--font-display); letter-spacing: 0.04em; cursor: pointer; }
	.gd-btn.go { background: var(--accent-2); border-color: var(--accent-2); color: var(--on-accent-2); }
	.gd-btn:disabled { opacity: 0.5; cursor: default; }
	.gd-said { font-size: 0.85rem; color: var(--ink-2); text-align: center; min-height: 1.3em; max-width: 520px; }
	.gd-mid { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; width: 100%; }
	.gd-hand { position: relative; width: 100%; max-width: 640px; flex: none; display: flex; flex-direction: column; justify-content: flex-end;
		align-items: center; gap: 6px; padding-top: 8px; }
	.gd-row { display: flex; justify-content: center; }
	.gd-card { position: relative; flex: none; padding: 0; border: 0; background: none; cursor: pointer; height: var(--ch); }
	.gd-card .gd-face { position: absolute; left: 0; top: 0; width: var(--cw); height: var(--ch); transition: transform 0.12s; }
	.gd-card.ok .gd-face { transform: translateY(-7px); box-shadow: 0 0 0 2px var(--accent), 0 0 14px var(--glow); }
	.gd-card:disabled { cursor: default; }
	.gd-card:disabled .gd-face { filter: saturate(0.6); opacity: 0.72; }
	.gd-card:focus-visible { outline: none; }
	.gd-card:focus-visible .gd-face { outline: 3px solid var(--accent); outline-offset: 2px; }
	.gd-face { box-sizing: border-box; border-radius: 9px; border: 2px solid var(--suit); background: var(--surface);
		box-shadow: 0 1px 3px var(--scrim); overflow: hidden; color: var(--suit); }
	.gd-face::after { content: ""; position: absolute; inset: 4px; border-radius: 6px; border: 1px solid var(--suit); opacity: 0.35; pointer-events: none; }
	.gd-face .ix { position: absolute; left: 5px; top: 3px; display: flex; flex-direction: column; align-items: center; line-height: 1;
		font: 700 15px var(--font-display); color: var(--ink); }
	.gd-face .ix svg { width: 14px; height: 14px; margin-top: 2px; color: var(--suit); }
	.gd-face .mid { position: absolute; inset: 22% 10% 10% 10%; display: grid; place-items: center; }
	.gd-face .mid svg { width: 78%; height: auto; max-height: 100%; }
	.gd-face .big { font: 700 clamp(14px, calc(var(--cw) * 0.38), 30px) var(--font-display); color: var(--ink); position: absolute; right: 6px; bottom: 4px; }
	.gd-face.wild { --suit: var(--accent-2); background: var(--surface-2); }
	.gd-face.wild .mid { inset: 24% 8% 14% 8%; grid-template: 1fr 1fr / 1fr 1fr; }
	.gd-face.wild .mid svg { width: 86%; }
	.gd-sheet { position: absolute; inset: 0; display: grid; place-items: center; background: var(--scrim); z-index: 5; padding: 64px 12px 12px; }
	.gd-panel { background: var(--surface); border: 2px solid var(--accent); border-radius: 14px; padding: 16px; width: min(100%, 360px);
		box-shadow: 0 0 24px var(--glow); display: flex; flex-direction: column; gap: 10px; max-height: 100%; overflow: auto; box-sizing: border-box; }
	.gd-panel h2 { margin: 0; font: 700 1.1rem var(--font-display); color: var(--accent); text-align: center; }
	.gd-panel p { margin: 0; font-size: 0.85rem; color: var(--ink-2); text-align: center; }
	.gd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	.gd-pick { min-height: 56px; border-radius: 10px; border: 2px solid var(--suit, var(--rule)); background: var(--surface-2); color: var(--ink);
		font: 700 0.95rem var(--font-display); display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
	.gd-pick svg { width: 26px; height: 26px; color: var(--suit, var(--ink)); }
	.gd-rule { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 6px 10px; border-radius: 10px;
		border: 2px solid var(--rule); background: var(--surface-2); color: var(--ink); text-align: left; cursor: pointer; font: inherit; }
	.gd-rule .t { flex: 1; display: flex; flex-direction: column; gap: 2px; }
	.gd-rule .t b { font: 700 0.95rem var(--font-display); }
	.gd-rule .t small { font-size: 0.8rem; color: var(--ink-2); }
	.gd-rule .sw { flex: none; min-width: 3.2em; text-align: center; padding: 4px 6px; border-radius: 999px; border: 2px solid var(--ink-3);
		font: 700 0.8rem var(--font-mono); color: var(--ink-2); }
	.gd-rule[aria-pressed="true"] { border-color: var(--accent); }
	.gd-rule[aria-pressed="true"] .sw { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
	.gd-rule:disabled { cursor: default; opacity: 0.85; }
	.gd-sumrow { display: flex; justify-content: space-between; gap: 8px; font-size: 0.85rem; color: var(--ink); }
	/* The end: what the next game will be, and CHANGE (the host's), at the top, clear of the shell's tucked end card. */
	.gd-next { position: absolute; left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right)); top: calc(env(safe-area-inset-top) + 56px);
		z-index: 4; display: flex; flex-direction: column; gap: 8px; padding: 8px 10px; border-radius: 12px; border: 2px solid var(--accent);
		background: var(--surface); box-shadow: 0 0 18px var(--glow); font-size: 0.85rem; color: var(--ink-2); max-width: 520px; margin: 0 auto; box-sizing: border-box; }
	.gd-next[hidden] { display: none; }
	.gd-next-line { display: flex; align-items: center; justify-content: space-between; gap: 6px 10px; flex-wrap: wrap; }
	.gd-next-line b { color: var(--ink); font-weight: 600; }
	.gd-next-rules { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
	.gd-next-rules button { min-height: 44px; border-radius: 10px; border: 2px solid var(--rule); background: var(--surface-2); color: var(--ink);
		font: 600 0.85rem var(--font-body); cursor: pointer; padding: 4px 8px; }
	.gd-next-rules button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
`;
document.head.append(style);

const el = (tag, className, text) => {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text != null) node.textContent = text;
	return node;
};
const NS = "http://www.w3.org/2000/svg";
/** An inline SVG from path markup (currentColor). */
function svg(inner, box = "0 0 24 24") {
	const node = document.createElementNS(NS, "svg");
	node.setAttribute("viewBox", box);
	node.setAttribute("aria-hidden", "true");
	node.innerHTML = inner;
	return node;
}

// ------------------------------------------------------------- the art

const SUIT_ART = {
	sun: '<circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g>',
	moon: '<path d="M15.5 2.5a9.5 9.5 0 1 0 6 16.8A8 8 0 0 1 15.5 2.5z" fill="currentColor"/>',
	star: '<path d="M12 1.8l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9l7.1-.6z" fill="currentColor"/>',
	bolt: '<path d="M14 1.5L4 13.5h6.5L8.5 22.5 20 9.5h-6.8z" fill="currentColor"/>',
};
const SUIT_VAR = { sun: "var(--p2)", moon: "var(--p3)", star: "var(--p5)", bolt: "var(--p1)" };
const ACTION_ART = {
	zap: '<path d="M10 1.5L2.5 12.5h5L6 22.5l8.5-12h-5z" fill="currentColor"/><path d="M19 4.5l-5.5 8h3.6l-1.1 7.5 6.2-9h-3.7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
	block: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M6 18L18 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
	bounce: '<path d="M5 9a7 7 0 0 1 12-3l2 2M19 15a7 7 0 0 1-12 3l-2-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M19.5 3.5v5h-5M4.5 20.5v-5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};
/** A card's short face, for its corner: "7", "+2", "⊘"… */
const CORNER = { zap: "+2", block: "⊘", bounce: "⇄", prism: "✦", prism4: "+4" };

/** A card face element for card `id` (or a face-down back when id is null). */
function face(id) {
	const c = GD.DECK[id];
	const f = el("div", `gd-face${c.s ? "" : " wild"}`);
	if (c.s) f.style.setProperty("--suit", SUIT_VAR[c.s]);
	const ix = el("span", "ix", CORNER[c.f] ?? c.f);
	if (c.s) ix.append(svg(SUIT_ART[c.s]));
	const mid = el("div", "mid");
	if (!c.s) {
		for (const s of GD.SUITS) {
			const g = svg(SUIT_ART[s]);
			g.style.color = SUIT_VAR[s];
			mid.append(g);
		}
	} else if (ACTION_ART[c.f]) mid.append(svg(ACTION_ART[c.f]));
	else mid.append(svg(SUIT_ART[c.s]));
	f.append(mid, ix);
	if (/^\d$/.test(c.f)) f.append(el("span", "big", c.f));
	if (c.f === "prism4" || c.f === "zap") f.append(el("span", "big", c.f === "zap" ? "+2" : "+4"));
	f.setAttribute("aria-hidden", "true");
	return f;
}

// Each other player carries a mark as well as a colour, beside their name.
const MARKS = [
	'<circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/>',
	'<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
	'<path d="M8 3.5l4.5 8h-9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
	'<path d="M8 3l5 5-5 5-5-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
	'<rect x="4" y="4" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.8"/>',
	'<path d="M8 3l1.5 3.3 3.5.3-2.7 2.3.8 3.5L8 10.6l-3.1 1.8.8-3.5L3 6.6l3.5-.3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
	'<path d="M8 3.5v9M3.5 8h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
	'<path d="M5.5 3.7h5l2.5 4.3-2.5 4.3h-5L3 8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
];
function seatMark(seat) {
	const m = svg(`<circle cx="8" cy="8" r="7.5" fill="var(--p${(seat % 8) + 1})"/><g style="color: var(--bg)">${MARKS[seat % 8]}</g>`, "0 0 16 16");
	m.dataset.mark = String(seat % 8);
	return m;
}

// ------------------------------------------------------------- the page

const stage = el("div", "g-stage");
const statusEl = el("div", "gd-status");
statusEl.setAttribute("role", "status");
const others = el("div", "gd-others");
const tableEl = el("div", "gd-table");
const drawBtn = el("button", "gd-draw");
drawBtn.type = "button";
const back = el("span", "back");
back.append(svg(SUIT_ART.star));
const drawLbl = el("span", "lbl");
drawBtn.append(back, drawLbl);
const drawBox = el("div", "gd-pilebox");
drawBox.append(drawBtn);
const topBox = el("div", "gd-top");
const info = el("div", "gd-info");
tableEl.append(drawBox, topBox, info);
const said = el("div", "gd-said");
said.setAttribute("aria-live", "polite");
const bar = el("div", "gd-bar");
const passBtn = el("button", "gd-btn", "PASS");
passBtn.type = "button";
bar.append(passBtn);
const handEl = el("div", "gd-hand");
handEl.setAttribute("aria-label", "Your hand");
const mid = el("div", "gd-mid");
mid.append(tableEl, said, bar);
const nextEl = el("div", "gd-next");
nextEl.hidden = true;
nextEl.setAttribute("aria-label", "The next game");
stage.append(statusEl, others, mid, handEl, nextEl);
document.body.append(stage);
let sheet = null;

let view = null;
let shownLog = 0; // the newest event told
let picking = null; // { id } while a PRISM waits for its suit, or a 7 for its target

const nameOf = (seat) => {
	if (view && seat === view.you) return "You";
	const id = view?.seats[seat];
	return arcade.party?.members?.find((p) => p.id === id)?.name || `Player ${seat + 1}`;
};
const myTurn = () => !!view && view.phase === "play" && view.you >= 0 && view.turn === view.you;
const amHost = () => arcade.party?.host === arcade.party?.self;
const SUIT_ORDER = { sun: 0, moon: 1, star: 2, bolt: 3 };
const FACE_ORDER = (f) => (/^\d$/.test(f) ? Number(f) : { zap: 10, block: 11, bounce: 12, prism: 13, prism4: 14 }[f]);
const sorted = (hand) =>
	[...hand].sort((a, b) => {
		const [x, y] = [GD.DECK[a], GD.DECK[b]];
		return (x.s ? SUIT_ORDER[x.s] : 9) - (y.s ? SUIT_ORDER[y.s] : 9) || FACE_ORDER(x.f) - FACE_ORDER(y.f) || a - b;
	});

/** An event in words. */
function tell(e) {
	const who = nameOf(e.seat);
	if (e.kind === "deal") return `${who} start${e.seat === view.you ? "" : "s"}. ${GD.nameOf(e.card)} is up.`;
	if (e.kind === "play" || e.kind === "jump") {
		const named = GD.isWild(e.card) ? ` — ${GD.SUIT_NAMES[e.suit]}` : "";
		return `${who}${e.kind === "jump" ? " jumped in with" : " played"} ${GD.nameOf(e.card)}${named}.`;
	}
	if (e.kind === "draw") return `${who} drew ${e.count === 1 ? "a card" : `${e.count} cards`}.`;
	if (e.kind === "penalty") return `${who} took ${e.count}.`;
	if (e.kind === "pass") return `${who} passed.`;
	if (e.kind === "swap") return `${who} swapped hands with ${nameOf(e.target)}.`;
	if (e.kind === "rotate") return "Every hand moved on one seat.";
	return "";
}

function renderStatus() {
	let main = "";
	let sub = "";
	if (view.phase === "setup") {
		main = "HOUSE RULES";
		sub = amHost() ? "Pick, then deal" : "The host is picking";
	} else if (view.phase === "over") {
		main = view.winner === view.you ? "YOU WIN!" : view.winner != null ? `${nameOf(view.winner).toUpperCase()} WINS` : "GAME OVER";
		sub = "Cards left count against you";
	} else if (myTurn()) {
		if (picking) main = picking.kind === "suit" ? "PICK A SUIT" : "SWAP WITH WHO?";
		else if (view.pending > 0) main = `ANSWER OR DRAW ${view.pending}`;
		else if (view.drawn != null) main = "PLAY IT OR PASS";
		else main = view.legal.length ? "YOUR TURN" : "YOUR TURN — DRAW";
		sub = `Then ${nameOf(nextSeat())}`;
	} else {
		main = `${nameOf(view.turn)} to play`;
		sub = view.house.jumpIn && view.legal.length ? "You can jump in!" : `Then ${nameOf(nextSeat())}`;
	}
	statusEl.replaceChildren(document.createTextNode(main), el("small", "", sub));
}
function nextSeat() {
	const n = view.seats.length;
	for (let k = 1; k <= n; k++) {
		const j = (((view.turn + view.dir * k) % n) + n) % n;
		if (!view.out[j]) return j;
	}
	return view.turn;
}

function renderOthers() {
	others.replaceChildren(
		...view.seats.map((_, seat) => {
			const chip = el("span", `gd-chip${seat === view.turn && view.phase === "play" ? " on" : ""}${view.out[seat] ? " out" : ""}`);
			chip.dataset.seat = String(seat);
			const n = view.counts[seat];
			chip.append(seatMark(seat), el("span", "nm", nameOf(seat)), el("b", n <= 1 && view.phase === "play" ? "few" : "", view.phase === "setup" ? "–" : String(n)));
			chip.title = `${nameOf(seat)}: ${n} card${n === 1 ? "" : "s"}`;
			return chip;
		}),
	);
}

let lastTop = null;
function renderTable() {
	const playing = view.phase !== "setup";
	tableEl.style.visibility = playing ? "visible" : "hidden";
	drawLbl.textContent = view.pending > 0 && myTurn() ? `TAKE ${view.pending}` : `DRAW · ${view.drawCount}`;
	const canDraw = myTurn() && view.drawn == null && !picking;
	drawBtn.disabled = !canDraw;
	drawBtn.classList.toggle("mine", canDraw && (!view.legal.length || view.pending > 0));
	drawBtn.setAttribute("aria-label", view.pending > 0 ? `Draw ${view.pending}` : `Draw a card (${view.drawCount} left)`);
	if (view.top !== lastTop) {
		topBox.replaceChildren();
		if (view.top != null) {
			const f = face(view.top);
			if (lastTop != null) f.classList.add("land");
			topBox.append(f);
			topBox.setAttribute("aria-label", `On the pile: ${GD.nameOf(view.top)}`);
		}
		lastTop = view.top;
	}
	info.replaceChildren();
	if (view.suit) {
		const s = el("span", "gd-suit");
		const g = svg(SUIT_ART[view.suit]);
		g.style.color = SUIT_VAR[view.suit];
		s.append(g, document.createTextNode(GD.SUIT_NAMES[view.suit]));
		info.append(s);
	}
	info.append(el("span", "", view.dir === 1 ? "↻ round" : "↺ back"));
	if (view.pending > 0) info.append(el("span", "gd-owed", `+${view.pending} owed`));
	passBtn.style.visibility = myTurn() && view.drawn != null && !picking ? "visible" : "hidden";
	passBtn.disabled = !(myTurn() && view.drawn != null && !picking);
}

/** The hand in rows, each card showing at least 44px of itself. */
function renderHand() {
	const ids = view.phase === "over" || view.phase === "play" ? sorted(view.hand) : [];
	const legal = new Set(picking ? [] : view.legal);
	const W = Math.min(handEl.clientWidth || stage.clientWidth - 16, 640);
	const GAP = 6;
	const STEP = 44;
	// Side by side when they fit at a good size; otherwise a fan.
	const flat = ids.length ? Math.floor((W - (ids.length - 1) * GAP) / ids.length) : 96;
	const cw = flat >= 64 ? Math.min(96, flat) : Math.max(56, Math.min(72, Math.floor(W / 5.2)));
	const perRow = Math.max(1, Math.floor((W - cw) / STEP) + 1);
	const rows = [];
	const per = Math.ceil(ids.length / Math.max(1, Math.ceil(ids.length / perRow))); // rows as even as they go
	for (let i = 0; i < ids.length; i += per) rows.push(ids.slice(i, i + per));
	// The rows share up to 42% of the stage; a card is never shorter than 64px.
	const room = stage.clientHeight * 0.42 - 14 - (rows.length - 1) * 6;
	const ch = Math.round(Math.max(64, Math.min(cw * 1.45, rows.length ? room / rows.length : cw * 1.45)));
	handEl.style.setProperty("--cw", `${cw}px`);
	handEl.style.setProperty("--ch", `${ch}px`);
	handEl.replaceChildren(
		...rows.map((row) => {
			const r = el("div", "gd-row");
			const step = row.length > 1 ? Math.max(STEP, Math.min(cw + GAP, (W - cw) / (row.length - 1))) : cw;
			row.forEach((id, k) => {
				const b = el("button", `gd-card${legal.has(id) ? " ok" : ""}`);
				b.type = "button";
				b.dataset.card = String(id);
				b.style.width = `${k === row.length - 1 ? cw : Math.min(step, cw)}px`;
				if (k < row.length - 1 && step > cw) b.style.marginRight = `${step - cw}px`;
				b.disabled = !legal.has(id) || view.phase !== "play";
				b.setAttribute("aria-label", GD.nameOf(id) + (legal.has(id) ? "" : " (does not play now)"));
				b.append(face(id));
				b.addEventListener("click", () => choose(id));
				r.append(b);
			});
			return r;
		}),
	);
}

function setPile() {
	const w = Math.max(60, Math.min(96, Math.floor(stage.clientWidth / 4.6)));
	stage.style.setProperty("--pw", `${w}px`);
	stage.style.setProperty("--ph", `${Math.round(w * 1.42)}px`);
}

// ----------------------------------------------------------- the sheets

function closeSheet() {
	sheet?.remove();
	sheet = null;
}
function openSheet(title, note, body) {
	closeSheet();
	sheet = el("div", "gd-sheet");
	const panel = el("div", "gd-panel");
	panel.append(el("h2", "", title));
	if (note) panel.append(el("p", "", note));
	panel.append(...body);
	sheet.append(panel);
	stage.append(sheet);
	return panel;
}

const HINTS = {
	stack: "Answer a ZAP +2 or PRISM +4 with another; the draws add up.",
	jumpIn: "Hold the exact card on top? Play it, even out of turn.",
	sevenZero: "A 7 swaps hands with someone; a 0 passes every hand on.",
	drawUntil: "Keep drawing until a card plays.",
};
function renderSetup() {
	if (view.phase !== "setup") {
		if (sheet?.dataset.kind === "setup") closeSheet();
		return;
	}
	const host = amHost();
	const rows = GD.HOUSE.map((k) => {
		const b = el("button", "gd-rule");
		b.type = "button";
		b.dataset.rule = k;
		b.setAttribute("aria-pressed", String(!!view.house[k]));
		const t = el("span", "t");
		t.append(el("b", "", GD.HOUSE_NAMES[k]), el("small", "", HINTS[k]));
		b.append(t, el("span", "sw", view.house[k] ? "ON" : "OFF"));
		b.disabled = !host;
		b.addEventListener("click", () => arcade.act({ house: { [k]: !view.house[k] } }));
		return b;
	});
	const go = el("button", "gd-btn go", host ? "DEAL" : "WAITING FOR THE HOST");
	go.type = "button";
	go.disabled = !host;
	go.addEventListener("click", () => arcade.act({ start: true }));
	const note = host ? "Switch on any you like. Everyone sees your choice." : "The host picks these before the deal.";
	const p = openSheet("HOUSE RULES", note, [...rows, go]);
	sheet.dataset.kind = "setup";
	p.dataset.kind = "setup";
}

function choose(id) {
	if (!view || view.phase !== "play") return;
	const c = GD.DECK[id];
	if (GD.isWild(id)) {
		picking = { kind: "suit", id };
		const picks = GD.SUITS.map((s) => {
			const b = el("button", "gd-pick");
			b.type = "button";
			b.dataset.suit = s;
			b.style.setProperty("--suit", SUIT_VAR[s]);
			b.append(svg(SUIT_ART[s]), document.createTextNode(GD.SUIT_NAMES[s]));
			b.addEventListener("click", () => send({ play: id, suit: s }));
			return b;
		});
		const grid = el("div", "gd-grid");
		grid.append(...picks);
		openSheet("PICK A SUIT", `${GD.nameOf(id)}: the next card must be this suit.`, [grid, cancelBtn()]);
		render();
		return;
	}
	if (view.house.sevenZero && c.f === "7" && view.hand.length > 1) {
		picking = { kind: "target", id };
		const picks = view.seats
			.map((_, seat) => seat)
			.filter((seat) => seat !== view.you && !view.out[seat])
			.map((seat) => {
				const b = el("button", "gd-pick");
				b.type = "button";
				b.dataset.target = String(seat);
				b.append(seatMark(seat), document.createTextNode(`${nameOf(seat)} · ${view.counts[seat]}`));
				b.addEventListener("click", () => send({ play: id, target: seat }));
				return b;
			});
		const grid = el("div", "gd-grid");
		grid.append(...picks);
		openSheet("SWAP HANDS WITH…", "Your hand for theirs (the number is how many cards they hold).", [grid, cancelBtn()]);
		render();
		return;
	}
	send({ play: id });
}
function cancelBtn() {
	const b = el("button", "gd-btn", "CANCEL");
	b.type = "button";
	b.addEventListener("click", () => {
		picking = null;
		closeSheet();
		render();
	});
	return b;
}
function send(action) {
	picking = null;
	closeSheet();
	arcade.act(action);
}

drawBtn.addEventListener("click", () => myTurn() && arcade.act({ draw: true }));
passBtn.addEventListener("click", () => myTurn() && arcade.act({ pass: true }));

// ------------------------------------------------------------ next game

let choosingNext = false;
/** The house rules in a few words: "Stack draws, Jump in", or "no house rules". */
const houseWords = (h) => GD.HOUSE.filter((k) => h[k]).map((k) => GD.HOUSE_NAMES[k]).join(", ") || "no house rules";
/** The next game's rules, as the host's own rules have them; null where there is none to change. */
function nextGame() {
	if (!view || view.phase !== "over" || !amHost()) return null;
	try {
		return rules.nextGame();
	} catch {
		return null;
	}
}
/** Kept on this phone: the house rules a one-tap start deals with next time. */
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
	const change = el("button", "gd-btn gd-next-change", choosingNext ? "DONE" : "CHANGE");
	change.type = "button";
	change.setAttribute("aria-label", choosingNext ? "Done choosing the next game's house rules" : "Change the next game's house rules");
	change.addEventListener("click", () => {
		choosingNext = !choosingNext;
		renderNext();
	});
	const what = el("span");
	what.append(document.createTextNode("Next game: "), el("b", "", houseWords(n.house)));
	const line = el("div", "gd-next-line");
	line.append(what, change);
	if (!choosingNext) return void nextEl.replaceChildren(line);
	const picks = el("div", "gd-next-rules");
	picks.setAttribute("role", "group");
	picks.setAttribute("aria-label", "Next game's house rules");
	for (const k of GD.HOUSE) {
		const b = el("button", "", GD.HOUSE_NAMES[k]);
		b.type = "button";
		b.dataset.rule = k;
		b.setAttribute("aria-pressed", String(!!n.house[k]));
		b.addEventListener("click", () => pickNext({ [k]: !n.house[k] }));
		picks.append(b);
	}
	nextEl.replaceChildren(line, picks);
}

function render() {
	if (!view) return;
	setPile();
	renderStatus();
	renderOthers();
	renderTable();
	renderHand();
	renderNext();
}

arcade.on("view", ({ state }) => {
	const before = view;
	view = state;
	if (!before || before.match !== state.match) {
		shownLog = 0;
		lastTop = null;
		picking = null;
		closeSheet();
	}
	// A pick waits on a card that may no longer play (a jump-in got there first).
	if (picking && !state.legal.includes(picking.id)) {
		picking = null;
		closeSheet();
	}
	const fresh = state.log.filter((e) => e.n > shownLog);
	if (fresh.length) {
		said.textContent = fresh.slice(-2).map(tell).join(" ");
		shownLog = fresh.at(-1).n;
	}
	if (state.phase === "setup") said.textContent = "First to play out every card wins.";
	if (state.phase === "over" && state.points) {
		const rows = state.seats.map((_, seat) => `${nameOf(seat)} ${state.points[seat]}`);
		said.textContent = `Points left: ${rows.join(" · ")}`;
	}
	// The house rules played, kept on the host's phone for its next one-tap start.
	if (state.phase === "play" && amHost()) keepHouse(state.house);
	renderSetup();
	render();
	arcade.idle?.();
});
arcade.on("rejected", (m) => {
	said.textContent = m.reason;
});
arcade.on("roster", () => {
	if (!view) return;
	renderSetup();
	render();
});
addEventListener("resize", render);
new ResizeObserver(() => render()).observe(stage);

/** For the tests: the view, whether it is this phone's turn, and any pick open. */
arcade.debug = () => ({ ...(view ?? { seats: [], hand: [], legal: [] }), myTurn: myTurn(), picking: picking && { ...picking }, host: amHost(), kept: lastHouse && { ...lastHouse } });
