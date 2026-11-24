// guess-what/guess-what.js — Guess What. An SDK v2 managed game.
//
// The rules are guess-what-rules.js `game()`: the platform runs them on the
// host and sends each phone its view — the picture to everyone but the
// guesser. This file is the screens: the setup, the picture and the clue box
// for clue-givers, the clues and the nine pictures for the guesser, the
// answer, and the one-phone game. It also keeps the round clock: the host's
// page acts `{ clock }` whenever the view says something is due (`msNext`),
// and every page counts the time left down from the view's duration.
//
// The pictures are emoji drawn by the phone's own emoji font; everything
// else is drawn from the theme. Players are told apart by their mark and
// name, never by colour alone.

const GP = guessWhatPictures;
const GR = guessWhatRules;
//
// The options (categories, seconds, turns) are asked only before the first
// game (Lokesh, 2026-11-23, as Ludo): PLAY AGAIN starts straight away with
// them; at the end the host's phone says "Next game: … · CHANGE"; and they are
// kept on the host's phone ("opts" in the game's storage), so a one-tap start
// with bots begins with them straight away.

// What this phone keeps (the game's storage): the options last played, and
// the pictures dealt. Read before the rules start, which may be at once.
let lastOpts = null;
const rules = GR.game({ isHost: (id) => id === arcade.party?.host, last: () => lastOpts });
arcade.init.then((m) => {
	const o = m?.storage?.opts;
	if (o && typeof o === "object") lastOpts = o;
	rules.useSeen(m?.storage?.seen);
});
arcade.managed(rules);

const style = document.createElement("style");
style.textContent = `
	.g-stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; gap: 8px;
		padding: calc(env(safe-area-inset-top) + 56px) max(10px, env(safe-area-inset-right))
			max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)); box-sizing: border-box; overflow: hidden; }
	.gw-emoji { font-family: "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", var(--font-body); line-height: 1; }
	.gw-status { font-family: var(--font-display); font-size: clamp(1rem, 3.8vw, 1.25rem); color: var(--accent); text-shadow: 0 0 8px var(--glow);
		text-align: center; line-height: 1.3; }
	.gw-status small { display: block; font-family: var(--font-body); font-size: 0.8rem; color: var(--ink-2); text-shadow: none; }
	.gw-clock { width: 100%; max-width: 520px; display: flex; align-items: center; gap: 8px; }
	.gw-clock .bar { flex: 1; height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; border: 1px solid var(--rule); }
	.gw-clock .bar i { display: block; height: 100%; background: var(--accent); box-shadow: 0 0 8px var(--glow); }
	.gw-clock.low .bar i { background: var(--danger); }
	.gw-clock b { font: 700 1rem var(--font-mono); color: var(--ink); min-width: 3ch; text-align: right; }
	.gw-scores { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 6px; max-width: 640px; }
	.gw-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--rule);
		background: var(--surface); font-size: 0.8rem; color: var(--ink); white-space: nowrap; }
	.gw-chip svg { width: 16px; height: 16px; flex: none; }
	.gw-chip .nm { max-width: 7em; overflow: hidden; text-overflow: ellipsis; }
	.gw-chip b { font-family: var(--font-mono); }
	.gw-chip.on { border: 2px solid var(--accent); padding: 1px 7px; }
	.gw-chip.on::after { content: "guessing"; font-size: 0.75rem; color: var(--accent); }
	.gw-main { flex: 1 1 auto; min-height: 0; width: 100%; max-width: 520px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
	.gw-pic { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 24px; border-radius: 18px; border: 2px solid var(--accent);
		background: var(--surface); box-shadow: 0 0 24px var(--glow); }
	.gw-pic .gw-emoji { font-size: var(--pic); }
	.gw-pic .nm { font: 700 1.1rem var(--font-display); color: var(--ink); text-transform: uppercase; letter-spacing: 0.06em; }
	.gw-strip { display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; }
	.gw-strip span { width: 32px; height: 32px; display: grid; place-items: center; font-size: 22px; border-radius: 6px; background: var(--surface-2); position: relative; }
	.gw-strip span.x { opacity: 0.3; }
	.gw-strip span.a { outline: 2px solid var(--accent); }
	.gw-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: min(100%, var(--grid)); }
	.gw-tile { aspect-ratio: 1; border-radius: 14px; border: 2px solid var(--rule); background: var(--surface); cursor: pointer; display: grid; place-items: center;
		font-size: var(--tile); padding: 0; position: relative; color: var(--ink); }
	.gw-tile:not(:disabled):hover, .gw-tile:focus-visible { border-color: var(--accent); outline: none; box-shadow: 0 0 12px var(--glow); }
	.gw-tile:disabled { cursor: default; }
	.gw-tile.x { opacity: 0.35; }
	.gw-tile.named { font: 600 0.85rem var(--font-body); padding: 4px; overflow-wrap: anywhere; }
	.gw-strip span.named { font: 600 12px var(--font-body); color: var(--ink); }
	.gw-pic .nm.big { font-size: 1.6rem; padding: 24px 8px; }
	.gw-tile.x::after { content: "✕"; position: absolute; inset: 0; display: grid; place-items: center; font: 700 calc(var(--tile) * 0.9) var(--font-display); color: var(--danger); }
	.gw-tile.a { border-color: var(--good); box-shadow: 0 0 0 3px var(--good); }
	.gw-clues { width: 100%; display: flex; flex-direction: column; gap: 4px; max-height: var(--cluesH); overflow: hidden; justify-content: flex-end; }
	.gw-clue { display: flex; align-items: center; gap: 6px; font-size: 0.95rem; color: var(--ink); background: var(--surface); border: 1px solid var(--rule);
		border-radius: 10px; padding: 4px 10px; animation: gw-in 0.25s ease-out; }
	.gw-clue svg { width: 16px; height: 16px; flex: none; }
	.gw-clue small { color: var(--ink-2); font-size: 0.8rem; }
	@keyframes gw-in { from { transform: translateY(6px); opacity: 0; } }
	@media (prefers-reduced-motion: reduce) { .gw-clue { animation: none; } }
	.gw-none { font-size: 0.85rem; color: var(--ink-2); text-align: center; }
	.gw-say { display: flex; gap: 6px; width: 100%; }
	.gw-say input { flex: 1; min-width: 0; min-height: 44px; box-sizing: border-box; border-radius: 10px; border: 2px solid var(--rule); background: var(--surface-2);
		color: var(--ink); font: 16px var(--font-body); padding: 0 12px; }
	.gw-say input:focus { outline: none; border-color: var(--accent); }
	.gw-btn { min-width: 80px; min-height: 44px; padding: 0 16px; border-radius: 10px; border: 2px solid var(--accent); background: var(--surface); color: var(--ink);
		font: 700 0.95rem var(--font-display); letter-spacing: 0.04em; cursor: pointer; }
	.gw-btn.go { background: var(--accent-2); border-color: var(--accent-2); color: var(--on-accent-2); }
	.gw-btn.big { min-height: 64px; font-size: 1.15rem; flex: 1; }
	.gw-btn:disabled { opacity: 0.5; cursor: default; }
	.gw-row { display: flex; gap: 10px; width: 100%; justify-content: center; }
	.gw-said { font-size: 0.85rem; color: var(--ink-2); text-align: center; min-height: 1.3em; }
	.gw-big { font: 700 1.4rem var(--font-display); color: var(--accent); text-align: center; }
	.gw-note { font-size: 0.9rem; color: var(--ink-2); text-align: center; max-width: 360px; line-height: 1.4; }
	.gw-gains { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; font-size: 0.85rem; color: var(--ink); }
	.gw-sheet { position: absolute; inset: 0; display: grid; place-items: center; background: var(--scrim); z-index: 5; padding: 64px 12px 12px; }
	.gw-panel { background: var(--surface); border: 2px solid var(--accent); border-radius: 14px; padding: 14px; width: min(100%, 380px); box-shadow: 0 0 24px var(--glow);
		display: flex; flex-direction: column; gap: 10px; box-sizing: border-box; max-height: 100%; overflow: auto; }
	.gw-panel h2 { margin: 0; font: 700 1.1rem var(--font-display); color: var(--accent); text-align: center; }
	.gw-panel p { margin: 0; font-size: 0.85rem; color: var(--ink-2); text-align: center; }
	.gw-panel h3 { margin: 0; font: 700 0.85rem var(--font-display); color: var(--ink-2); letter-spacing: 0.06em; }
	.gw-cats { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
	.gw-opt { min-height: 44px; border-radius: 10px; border: 2px solid var(--rule); background: var(--surface-2); color: var(--ink); font: 600 0.9rem var(--font-body);
		cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; }
	.gw-opt small { color: var(--ink-2); font-size: 0.8rem; }
	.gw-opt[aria-pressed="true"] { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
	.gw-opt[aria-pressed="true"] small { color: var(--on-accent); }
	.gw-opt:disabled { cursor: default; opacity: 0.85; }
	.gw-opts { display: flex; gap: 6px; }
	.gw-opts .gw-opt { flex: 1; font-family: var(--font-mono); }
	/* The end: what the next game will be, and CHANGE (the host's), at the top, clear of the shell's tucked end card. */
	.gw-next { position: absolute; left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right)); top: calc(env(safe-area-inset-top) + 56px);
		z-index: 4; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-radius: 12px; border: 2px solid var(--accent);
		background: var(--surface); box-shadow: 0 0 18px var(--glow); font-size: 0.85rem; color: var(--ink-2); max-width: 520px; margin: 0 auto; box-sizing: border-box; }
	.gw-next[hidden] { display: none; }
	.gw-next-line { display: flex; align-items: center; justify-content: space-between; gap: 6px 10px; flex-wrap: wrap; }
	.gw-next-line b { color: var(--ink); font-weight: 600; }
	.gw-next .gw-cats { grid-template-columns: 1fr 1fr 1fr; }
	.gw-next .gw-opt { font-size: 0.8rem; padding: 0 4px; }
`;
document.head.append(style);

const el = (tag, className, text) => {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text != null) node.textContent = text;
	return node;
};
const NS = "http://www.w3.org/2000/svg";
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
	const m = document.createElementNS(NS, "svg");
	m.setAttribute("viewBox", "0 0 16 16");
	m.setAttribute("aria-hidden", "true");
	m.innerHTML = `<circle cx="8" cy="8" r="7.5" fill="var(--p${(seat % 8) + 1})"/><g style="color: var(--bg)">${MARKS[seat % 8]}</g>`;
	m.dataset.mark = String(seat % 8);
	return m;
}

const stage = el("div", "g-stage");
const statusEl = el("div", "gw-status");
statusEl.setAttribute("role", "status");
const clockEl = el("div", "gw-clock");
const clockBar = el("span", "bar");
const clockFill = el("i");
clockBar.append(clockFill);
const clockNum = el("b");
clockEl.append(clockBar, clockNum);
const scoresEl = el("div", "gw-scores");
const main = el("div", "gw-main");
const said = el("div", "gw-said");
said.setAttribute("aria-live", "polite");
const nextEl = el("div", "gw-next");
nextEl.hidden = true;
nextEl.setAttribute("aria-label", "The next game");
stage.append(statusEl, clockEl, scoresEl, main, said, nextEl);
document.body.append(stage);
let sheet = null;

let view = null;
let endsAt = 0; // performance.now() at which the phase's time is up
let dueAt = 0; // Date.now() at which the host should look at the clock
let draft = ""; // what is typed in the clue box, kept across redraws
let mainKey = "";
const rebuilds = []; // screens built, for the tests

const amHost = () => arcade.party?.host === arcade.party?.self;
const nameOf = (i) => {
	if (view?.names?.[i]) return view.names[i];
	if (view && i === view.you && view.mode !== "one") return "You";
	const id = view?.seats[i];
	return arcade.party?.members?.find((p) => p.id === id)?.name || `Player ${i + 1}`;
};
const iGuess = () => !!view && view.you >= 0 && view.guesser === view.you;
const catName = (id) => GP.CATEGORIES.find((c) => c.id === id)?.name ?? "";

// ------------------------------------------------------------- the clock

function tickClock() {
	if (!view) return;
	const total = (view.phase === "guess" || view.phase === "talk" ? view.secs * 1000 : view.phase === "ready" ? GR.READY_MS : view.phase === "reveal" ? GR.REVEAL_MS : GR.TALLY_MS);
	const left = view.msLeft == null ? null : Math.max(0, endsAt - performance.now());
	const timed = view.phase === "guess" || view.phase === "talk";
	clockEl.style.visibility = timed && left != null ? "visible" : "hidden";
	if (left != null) {
		clockFill.style.width = `${Math.min(100, (left / total) * 100)}%`;
		const secs = Math.ceil(left / 1000);
		const txt = `${secs}s`;
		if (clockNum.textContent !== txt) clockNum.textContent = txt;
		clockEl.classList.toggle("low", secs <= 10);
		const count = view.phase === "ready" && view.mode === "phones" ? document.querySelector(".gw-count") : null;
		if (count && count.textContent !== String(secs)) count.textContent = String(secs);
	}
	// The clock moves on when something is due: the host's phone at once,
	// any other phone a moment later, so a host whose tab is hidden (its
	// timers held back, review 2026-11-24) does not stop the round. The rules
	// do whatever is due by the time it arrives, so a late tick catches up.
	if (dueAt && Date.now() >= dueAt + (amHost() ? 0 : CATCH_UP_MS)) {
		dueAt = Date.now() + 1000;
		arcade.act({ clock: view.clock });
	}
}
const CATCH_UP_MS = 1500;
setInterval(tickClock, 200);
document.addEventListener("visibilitychange", tickClock);

// ------------------------------------------------- pictures a phone cannot draw
//
// Every picture is Emoji 11 or older, which Android 9 draws; an older phone
// may draw some as empty boxes. Drawn once on a canvas: a colour emoji has
// coloured pixels, a missing one (an empty box, nothing) has none. A picture
// that does not draw is shown by its name.
const drawn = new Map();
function drawable(e) {
	if (drawn.has(e)) return drawn.get(e);
	let ok = true;
	try {
		const c = document.createElement("canvas");
		c.width = c.height = 32;
		const g = c.getContext("2d", { willReadFrequently: true });
		g.textAlign = "center";
		g.textBaseline = "middle";
		g.font = '26px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
		g.fillStyle = "rgb(0, 0, 0)"; // theme-exempt: a test drawing, never shown (a missing glyph draws in it; a colour emoji does not)
		g.fillText(e, 16, 17);
		const d = g.getImageData(0, 0, 32, 32).data;
		ok = false;
		for (let i = 0; i < d.length && !ok; i += 4) ok = d[i + 3] > 40 && (Math.abs(d[i] - d[i + 1]) > 24 || Math.abs(d[i + 1] - d[i + 2]) > 24 || Math.abs(d[i] - d[i + 2]) > 24);
	} catch {
		ok = true;
	}
	drawn.set(e, ok);
	return ok;
}

// ------------------------------------------------------------- the screens

function renderStatus() {
	const v = view;
	let a = "";
	let b = "";
	const round = v.total ? `Round ${Math.min(v.round + 1, v.total)} of ${v.total}` : "";
	if (v.phase === "setup") {
		a = "GUESS WHAT";
		b = amHost() ? "Pick, then start" : "The host is picking";
	} else if (v.phase === "over") {
		a = "GAME OVER";
		b = "";
	} else if (v.mode === "phones") {
		a = iGuess() ? "YOU GUESS" : `${nameOf(v.guesser).toUpperCase()} GUESSES`;
		b = `${round} · ${catName(v.category)}`;
	} else {
		a = `${nameOf(v.guesser).toUpperCase()} GUESSES`;
		b = round;
	}
	statusEl.replaceChildren(document.createTextNode(a), el("small", "", b));
}

function renderScores() {
	const v = view;
	scoresEl.replaceChildren(
		...v.players.map((i) => {
			const c = el("span", `gw-chip${i === v.guesser && v.phase !== "over" && v.phase !== "setup" ? " on" : ""}`);
			c.append(seatMark(i), el("span", "nm", nameOf(i)), el("b", "", String(v.scores[i] ?? 0)));
			return c;
		}),
	);
}

function clueRow(c) {
	const r = el("div", "gw-clue");
	r.append(seatMark(c.by), document.createTextNode(c.text), el("small", "", nameOf(c.by)));
	return r;
}
function cluesBox(limit) {
	const box = el("div", "gw-clues");
	box.dataset.limit = String(limit);
	fillClues(box);
	return box;
}
function fillClues(box) {
	const list = view.clues.slice(-Number(box.dataset.limit));
	const key = list.map((c) => c.n).join(",");
	if (box.dataset.key === key) return;
	box.dataset.key = key;
	box.replaceChildren(...(list.length ? list.map(clueRow) : [el("div", "gw-none", iGuess() ? "Listen for clues — or read them here as they come." : "No typed clues yet.")]));
}
/** What changes within a screen: the clues, and pictures struck out. */
function refreshLive() {
	const box = main.querySelector(".gw-clues");
	if (box) fillClues(box);
	main.querySelectorAll(".gw-tile").forEach((t, k) => {
		const out = view.struck.includes(k);
		t.classList.toggle("x", out);
		if (out) t.disabled = true;
	});
	main.querySelectorAll(".gw-strip.live span").forEach((s, k) => s.classList.toggle("x", view.struck.includes(k)));
}
function picture(p, size) {
	const box = el("div", "gw-pic");
	box.style.setProperty("--pic", `${size}px`);
	if (!drawable(p.e)) {
		box.append(el("span", "nm big", p.name));
		return box;
	}
	const e = el("span", "gw-emoji", p.e);
	e.setAttribute("role", "img");
	e.setAttribute("aria-label", p.name);
	box.append(e, el("span", "nm", p.name));
	return box;
}
function sayBox() {
	const form = el("form", "gw-say");
	const input = el("input");
	input.type = "text";
	input.maxLength = GR.CLUE_MAX;
	input.placeholder = "Type a clue (or say it)";
	input.autocomplete = "off";
	input.enterKeyHint = "send";
	input.value = draft;
	input.setAttribute("aria-label", "Your clue");
	input.addEventListener("input", () => (draft = input.value));
	const send = el("button", "gw-btn go", "SEND");
	send.type = "submit";
	form.append(input, send);
	form.addEventListener("submit", (e) => {
		e.preventDefault();
		const text = input.value.trim();
		if (!text) return;
		arcade.act({ clue: text });
		draft = "";
		input.value = "";
	});
	return form;
}
function grid(interactive) {
	const g = el("div", "gw-grid");
	view.choices.forEach((e, k) => {
		const named = !drawable(e);
		const t = el("button", `gw-tile gw-emoji${named ? " named" : ""}${view.struck.includes(k) ? " x" : ""}${view.result && view.result.answer === k ? " a" : ""}`, named ? view.choiceNames[k] : e);
		t.type = "button";
		t.dataset.pick = String(k);
		t.disabled = !interactive || view.struck.includes(k);
		t.setAttribute("aria-label", `Picture ${k + 1}${view.struck.includes(k) ? " (out)" : ""}`);
		t.addEventListener("click", () => arcade.act({ pick: k }));
		g.append(t);
	});
	return g;
}

/** Sizes from the room the main area has. */
function sizes() {
	const h = main.clientHeight || stage.clientHeight * 0.6;
	const w = main.clientWidth || stage.clientWidth - 20;
	stage.style.setProperty("--grid", `${Math.floor(Math.min(w, h * 0.62, 380))}px`);
	stage.style.setProperty("--tile", `${Math.floor(Math.min(w, h * 0.62, 380) / 3 * 0.5)}px`);
	stage.style.setProperty("--cluesH", `${Math.floor(h * 0.3)}px`);
	return { w, h };
}

function renderMain() {
	const v = view;
	const { h } = sizes();
	// Keep the clue box (and what is typed in it, and its focus) across views
	// that only add clues: rebuild only when the screen changes.
	const k = `${v.match}:${v.round}:${v.phase}:${v.mode}:${iGuess()}:${v.got.length}:${v.picture?.e ?? ""}`;
	if (k === mainKey) return refreshLive();
	const focused = document.activeElement?.tagName === "INPUT";
	mainKey = k;
	const parts = [];
	if (v.phase === "setup") {
		parts.push(el("div", "gw-note", "One player guesses a picture from the others' clues. Everyone takes a turn."));
	} else if (v.phase === "over") {
		parts.push(el("div", "gw-big", "THANKS FOR PLAYING"));
	} else if (v.mode === "phones") {
		if (v.phase === "ready") {
			const c = el("div", "gw-big");
			c.append(document.createTextNode(iGuess() ? "Get ready to guess…" : `Get ready… `), el("span", "gw-count", ""));
			parts.push(c);
			if (v.picture) parts.push(picture(v.picture, Math.min(110, h * 0.3)), el("div", "gw-note", `Think of clues — just not the name. ${nameOf(v.guesser)} picks from nine ${catName(v.category).toLowerCase()} pictures.`));
			else parts.push(el("div", "gw-note", "The others see a picture and give you clues. Tap the one you think it is."));
		} else if (v.phase === "guess" && iGuess()) {
			parts.push(cluesBox(4), grid(true));
		} else if (v.phase === "guess") {
			parts.push(picture(v.picture, Math.min(96, h * 0.22)));
			const strip = el("div", "gw-strip live");
			v.choices.forEach((e, k) => strip.append(drawable(e) ? el("span", `gw-emoji${v.struck.includes(k) ? " x" : ""}`, e) : el("span", `named${v.struck.includes(k) ? " x" : ""}`, v.choiceNames[k].slice(0, 3))));
			strip.setAttribute("aria-label", "The nine pictures the guesser sees");
			parts.push(strip, cluesBox(3));
			if (v.you >= 0 && v.players.includes(v.you)) parts.push(sayBox());
		} else if (v.phase === "reveal") {
			const r = v.result;
			parts.push(el("div", "gw-big", r.right ? "GOT IT!" : "TIME'S UP"), picture(r.picture, Math.min(110, h * 0.28)));
			const g = el("div", "gw-gains");
			for (const [i, n] of Object.entries(r.gained)) g.append(el("span", "", `${nameOf(Number(i))} +${n}`));
			if (!r.right) g.append(el("span", "", "Nobody scores"));
			parts.push(g);
		}
	} else {
		// One phone.
		if (v.phase === "ready") {
			parts.push(el("div", "gw-big", `${nameOf(v.guesser)}, look away!`));
			parts.push(el("div", "gw-note", `Everyone else takes the phone (or ${nameOf(v.guesser)} holds it to their forehead, screen out). Describe each picture without its name; tap GOT IT when they say it.`));
			const go = el("button", "gw-btn go big", "GO");
			go.type = "button";
			go.addEventListener("click", () => arcade.act({ go: true }));
			const row = el("div", "gw-row");
			row.append(go);
			parts.push(row);
		} else if (v.phase === "talk") {
			parts.push(picture(v.picture, Math.min(150, h * 0.36)), el("div", "gw-note", `Got so far: ${v.got.length}`));
			const row = el("div", "gw-row");
			const pass = el("button", "gw-btn big", "PASS");
			pass.type = "button";
			pass.addEventListener("click", () => arcade.act({ pass: true }));
			const got = el("button", "gw-btn go big", "GOT IT");
			got.type = "button";
			got.addEventListener("click", () => arcade.act({ got: true }));
			row.append(pass, got);
			parts.push(row);
		} else if (v.phase === "tally") {
			parts.push(el("div", "gw-big", `${nameOf(v.tally.guesser)} got ${v.tally.got.length}`));
			const strip = el("div", "gw-strip");
			for (const p of v.tally.got.slice(-18)) strip.append(drawable(p.e) ? el("span", "gw-emoji", p.e) : el("span", "named", p.name.slice(0, 3)));
			parts.push(strip);
			const next = el("button", "gw-btn go", "NEXT");
			next.type = "button";
			next.addEventListener("click", () => arcade.act({ next: true }));
			parts.push(next);
		}
	}
	main.replaceChildren(...parts);
	rebuilds.push(k);
	if (focused) main.querySelector("input")?.focus();
}

// ------------------------------------------------------------ the setup

function closeSheet() {
	sheet?.remove();
	sheet = null;
}
function renderSetup() {
	if (view.phase !== "setup") return closeSheet();
	const host = amHost();
	const o = view.opts;
	closeSheet();
	sheet = el("div", "gw-sheet");
	const panel = el("div", "gw-panel");
	const one = view.local.some(Boolean) && view.bots.filter((b) => !b).length === 1;
	panel.append(el("h2", "", "GUESS WHAT"), el("p", "", one ? "On this phone: the guesser looks away, the rest describe the pictures out loud." : "Everyone on their own phone: clue-givers see the picture, the guesser picks it from nine."));
	panel.append(el("h3", "", "PICTURES"));
	const cats = el("div", "gw-cats");
	for (const c of GP.CATEGORIES) {
		const on = o.cats.includes(c.id);
		const b = el("button", "gw-opt");
		b.type = "button";
		b.dataset.cat = c.id;
		b.setAttribute("aria-pressed", String(on));
		b.append(document.createTextNode(c.name), el("small", "", String(c.count)));
		b.disabled = !host || (on && o.cats.length === 1);
		b.addEventListener("click", () => arcade.act({ opts: { cats: on ? o.cats.filter((x) => x !== c.id) : [...o.cats, c.id] } }));
		cats.append(b);
	}
	panel.append(cats, el("h3", "", "SECONDS A TURN"));
	const secs = el("div", "gw-opts");
	for (const n of GR.SECS) {
		const b = el("button", "gw-opt", String(n));
		b.type = "button";
		b.dataset.secs = String(n);
		b.setAttribute("aria-pressed", String(o.secs === n));
		b.disabled = !host;
		b.addEventListener("click", () => arcade.act({ opts: { secs: n } }));
		secs.append(b);
	}
	panel.append(secs, el("h3", "", "TURNS EACH"));
	const turns = el("div", "gw-opts");
	for (const n of GR.TURNS) {
		const b = el("button", "gw-opt", String(n));
		b.type = "button";
		b.dataset.turns = String(n);
		b.setAttribute("aria-pressed", String(o.turns === n));
		b.disabled = !host;
		b.addEventListener("click", () => arcade.act({ opts: { turns: n } }));
		turns.append(b);
	}
	const go = el("button", "gw-btn go", host ? "START" : "WAITING FOR THE HOST");
	go.type = "button";
	go.disabled = !host;
	go.addEventListener("click", () => arcade.act({ start: true }));
	panel.append(turns, go);
	sheet.append(panel);
	stage.append(sheet);
}

// ------------------------------------------------------------ next game

let choosingNext = false;
/** The options in a few words: "Animals, Food · 45 s · 2 turns each". */
function optsWords(o) {
	const cats = o.cats.length === GP.CATEGORIES.length ? "every category" : o.cats.map(catName).join(", ");
	return `${cats} · ${o.secs} s · ${o.turns} turn${o.turns === 1 ? "" : "s"} each`;
}
/** The next game's options, as the host's own rules have them; null where there is none to change. */
function nextGame() {
	if (!view || view.phase !== "over" || !amHost()) return null;
	try {
		return rules.nextGame();
	} catch {
		return null;
	}
}
/** Kept on this phone: the options a one-tap start begins with next time. */
function keepOpts(o) {
	if (JSON.stringify(o) === JSON.stringify(lastOpts)) return;
	lastOpts = { ...o, cats: [...o.cats] };
	arcade.send("store.set", { key: "opts", value: lastOpts });
}
function pickNext(patch) {
	if (rules.setNext(patch) !== undefined) return;
	keepOpts(rules.nextGame().opts);
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
	const o = n.opts;
	const change = el("button", "gw-btn gw-next-change", choosingNext ? "DONE" : "CHANGE");
	change.type = "button";
	change.setAttribute("aria-label", choosingNext ? "Done choosing the next game's options" : "Change the next game's options");
	change.addEventListener("click", () => {
		choosingNext = !choosingNext;
		renderNext();
	});
	const what = el("span");
	what.append(document.createTextNode("Next game: "), el("b", "", optsWords(o)));
	const line = el("div", "gw-next-line");
	line.append(what, change);
	if (!choosingNext) return void nextEl.replaceChildren(line);
	const cats = el("div", "gw-cats");
	cats.setAttribute("role", "group");
	cats.setAttribute("aria-label", "Next game's pictures");
	for (const c of GP.CATEGORIES) {
		const on = o.cats.includes(c.id);
		const b = el("button", "gw-opt", c.name);
		b.type = "button";
		b.dataset.cat = c.id;
		b.setAttribute("aria-pressed", String(on));
		b.disabled = on && o.cats.length === 1;
		b.addEventListener("click", () => pickNext({ cats: on ? o.cats.filter((x) => x !== c.id) : [...o.cats, c.id] }));
		cats.append(b);
	}
	const row = (label, list, keyName, attr) => {
		const r = el("div", "gw-opts");
		r.setAttribute("role", "group");
		r.setAttribute("aria-label", label);
		for (const v of list) {
			const b = el("button", "gw-opt", attr === "secs" ? `${v} s` : `${v}×`);
			b.type = "button";
			b.dataset[attr] = String(v);
			b.setAttribute("aria-pressed", String(o[keyName] === v));
			b.setAttribute("aria-label", attr === "secs" ? `${v} seconds a turn` : `${v} turn${v === 1 ? "" : "s"} each`);
			b.addEventListener("click", () => pickNext({ [keyName]: v }));
			r.append(b);
		}
		return r;
	};
	nextEl.replaceChildren(line, cats, row("Next game's seconds a turn", GR.SECS, "secs", "secs"), row("Next game's turns each", GR.TURNS, "turns", "turns"));
}

function render() {
	if (!view) return;
	renderStatus();
	renderScores();
	renderMain();
	renderNext();
	tickClock();
}

let lastSeen = -1;
arcade.on("view", ({ state }) => {
	const before = view;
	view = state;
	endsAt = state.msLeft == null ? 0 : performance.now() + state.msLeft;
	dueAt = state.msNext == null ? 0 : Date.now() + state.msNext + 30;
	if (!before || before.phase !== state.phase || before.match !== state.match) mainKey = "";
	if (state.phase === "setup" || before?.phase !== state.phase) renderSetup();
	render();
	// The host keeps what it has dealt, so pictures do not repeat next time,
	// and the options played, for its next one-tap start.
	if (amHost() && state.phase !== "setup" && state.phase !== "over") keepOpts(state.opts);
	if (amHost()) {
		const keys = rules.seenKeys();
		if (keys.length !== lastSeen) {
			lastSeen = keys.length;
			arcade.send("store.set", { key: "seen", value: keys });
		}
	}
	arcade.idle?.();
});
arcade.on("rejected", (m) => {
	if (m.reason === "stale") return;
	said.textContent = m.reason;
	setTimeout(() => said.textContent === m.reason && (said.textContent = ""), 2500);
});
arcade.on("roster", () => view && (renderSetup(), (mainKey = ""), render()));
addEventListener("resize", () => {
	mainKey = "";
	render();
});

/** For the tests: the view, and whether this phone is guessing. */
arcade.debug = () => ({ ...(view ?? { seats: [], players: [], choices: [], clues: [] }), iGuess: iGuess(), host: amHost(), kept: lastOpts && { ...lastOpts }, rebuilds: rebuilds.length, lastBuilt: rebuilds.slice(-3) });
