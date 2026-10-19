// Smoke-test the hand-written client bundle outside the browser:
// 1. feed it to a fake __ModuleLoader__ (captures the factory)
// 2. run the factory with a fake require (real react, stubbed primitives)
// 3. render <UsageStatsPanel wide t> with react-dom/server
// 4. run apply(ctx) against a stub client context
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Clean clones resolve declared devDependencies locally. An explicit override
// remains useful for checking against the exact modules bundled with dsh.
const require = process.env.SMOKE_NODE_MODULES === void 0
	? createRequire(import.meta.url)
	: createRequire(join(process.env.SMOKE_NODE_MODULES, "_anchor.js"));
const react = require("react");
const jsxRuntime = require("react/jsx-runtime");
const { renderToStaticMarkup } = require("react-dom/server");
const TestRenderer = require("react-test-renderer");
const { act } = TestRenderer;

// Fake primitives: every named export is a no-op component (returns its props as children is not needed).
const Stub = () => null;
const PassThrough = ({ children }) => children;
/** Distinguishable icon stub, so a render can prove the harness glyph was used. */
const IconStub = () => react.createElement("span", { "data-icon-stub": "" });
// The real package exports a fixed surface, so an unknown name is `undefined`
// rather than a stub. Mirroring that is what catches a primitive the host
// renamed or dropped: 0.1.7 moved the icon size out of the export name
// (`IconCloseOutline16` → `IconCloseOutlineRegular`) and removed several glyphs.
const legacyIcons = {
	IconChevronLeftOutline14: IconStub,
	IconChevronRightOutline14: IconStub,
	IconCloseOutline16: IconStub,
	IconDataOutline16: IconStub,
	IconRefreshOutline14: IconStub
};
const currentIcons = {
	IconChevronLeftOutlineRegular: IconStub,
	IconChevronRightOutlineRegular: IconStub,
	IconCloseOutlineRegular: IconStub,
	IconDataOutlineRegular: IconStub,
	IconRefreshOutlineRegular: IconStub
};
const primitivesSurface = (icons) => new Proxy({ ...icons, Tooltip: PassThrough }, {
	get: (target, key) => (typeof key === "string" && key in target ? target[key] : undefined)
});
const primitives = primitivesSurface(legacyIcons);

let captured = null;
const storedValues = new Map();
const storedWrites = [];
const localStorage = {
	getItem: (key) => storedValues.get(key) ?? null,
	setItem: (key, value) => {
		storedValues.set(key, String(value));
		storedWrites.push([key, String(value)]);
	},
	removeItem: (key) => { storedValues.delete(key); }
};
globalThis.window = { __ModuleLoader__: { load: (entry) => { captured = entry; } }, localStorage };
globalThis.document = { querySelector: () => null, createElement: () => ({ dataset: {}, appendChild: () => {} }), head: { appendChild: () => {} } };

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "client.js"), "utf8");
// The provider-account surface is gone: the client must not read any account
// endpoint, because the server route surviving for API compatibility is not a
// reason for the browser to keep polling it.
for (const forbiddenEndpoint of ["/api/usage-stats/account", "/api/usage-stats/providers", "/api/usage-stats/integrations/orcarouter", "/api/usage-stats/subscriptions", "/api/usage-stats/balance"]) {
	if (source.includes(`fetchJson("${forbiddenEndpoint}`) || source.includes(`fetchJson(\`${forbiddenEndpoint}`)) {
		throw new Error(`client must not fetch the retired account endpoint: ${forbiddenEndpoint}`);
	}
}
if (!source.includes('fetchJson("/api/usage-stats/usage")')) throw new Error("client must read the usage endpoint");
if (/host\.style\.flexDirection\s*=\s*["']column["']/.test(source)) throw new Error("client must not change the shared footer host flex direction (#82)");
if (!/host\.style\.flexWrap\s*=\s*["']wrap["']/.test(source)) throw new Error("client must wrap row-oriented footer actions (#21/#82)");
if (!source.includes('document.addEventListener("pointerdown"')) throw new Error("open panel must listen for outside pointerdown");
if (!source.includes('event.key === "Escape"')) throw new Error("open panel must dismiss on Escape");
if (!source.includes("ref: panelRef")) throw new Error("portaled panel must expose a ref for outside-click detection");
// Badge layout regression: the collapsed badge keeps the 「用量」label and
// today's token count on the right. The account amount that used to sit between
// them is gone with the account UI, so its element must not come back.
if (!source.includes('translate("panel.badge")')) throw new Error("badge must keep the label text");
if (!source.includes('"panel.badge": "用量"')) throw new Error("the sidebar entry must be named 用量, not 用量/余额");
if (source.includes("用量/余额") || source.includes("Usage/Balance")) throw new Error("the retired balance naming must not survive anywhere in the panel");
if (!source.includes('badgeCount !== null && react_jsx_runtime.jsx("span", { className: S.badgeCount')) throw new Error("badge must keep the today token count on the right");
if (source.includes("badgeAmountText") || source.includes("S.badgeAmount")) throw new Error("the retired account amount must not render in the badge");
for (const forbidden of [
	"conversation.input",
	"CurrentSessionInline",
	"CurrentSessionPill",
	"data-current-session-inline",
	"data-current-session-pill",
	"usg_sessionInline",
	"usg_sessionPill",
	"usageStatsPanelOpeners",
	"subscribeUsageStatsPanel",
	"requestUsageStatsPanel",
	"modelDirectories",
	"loadSessionPillSnapshot",
	"sessionPillViewOf",
	"ProviderAccountCard",
	"ProviderPicker",
	"BalanceContent",
	"SubscriptionContent",
	"AccountHealth",
	"buildProviderChoices",
	"buildProviderPickerChoices",
	"providerChoiceLabel",
	"ORCAROUTER_ADD_SENTINEL",
	"accountRequestHeaders",
	"addOrcaRouterIntegration",
	"loadOrcaRouterIntegration",
	"badgeAccountValue",
	"badgeWarnOf",
	"buildSessionCostRows",
	"sessionCostMeta",
	"safeDiagnosticReason",
	"formatResetCountdown",
	"tariffWindowText",
	"usg_providerSelect",
	"usg_accountCard",
	"usg_sessionCost"
]) {
	if (source.includes(forbidden)) throw new Error(`removed account UI/dead code must be absent from the client bundle: ${forbidden}`);
}
const dayTokensRule = /\.usg_dayTokens\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!dayTokensRule.includes("min-width:84px")) throw new Error("Last 14 days token column must retain an 84px minimum width (#75)");
if (!dayTokensRule.includes("text-align:right")) throw new Error("Last 14 days token column must be right aligned (#75)");
if (!dayTokensRule.includes("flex:none") || !dayTokensRule.includes("font-variant-numeric:tabular-nums")) throw new Error("Last 14 days token alignment must preserve the existing flex and numeric typography");
if (/(?:^|;)width:84px(?:;|$)/.test(dayTokensRule)) throw new Error("Last 14 days token column must use min-width rather than a fixed width in narrow layouts");
const dayDateRule = /\.usg_dayDate\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!dayDateRule.includes("flex:0 1 104px") || !dayDateRule.includes("min-width:0") || !dayDateRule.includes("overflow:hidden")) throw new Error("the date column must shrink before the aligned token column can overflow a narrow panel");
// The sidebar action sits directly above the shell's Settings key and keeps that
// key's geometry: a 42px row with 10/8px side padding and the same `4px -2px`
// row margin, so the two buttons line up on both axes (#108). The collapsed
// action keeps the 36px rail circle.
const badgeRule = /\.usg_badge\{([^}]*)\}/.exec(source)?.[1] ?? "";
const layerRule = /\.usg_layer\{([^}]*)\}/.exec(source)?.[1] ?? "";
const railBadgeRule = /\.usg_layer\.usg_rail \.usg_badge\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!badgeRule.includes("height:42px") || !badgeRule.includes("padding:0 10px 0 8px")) throw new Error("the expanded sidebar action must match the Settings key geometry (42px, 10/8px padding)");
if (!layerRule.includes("width:calc(100% + 4px)") || !layerRule.includes("margin:4px -2px")) throw new Error("the sidebar action row must mirror the Settings row box (width calc(100% + 4px) with margin 4px -2px), never a one-sided top margin");
if (!badgeRule.includes("box-sizing:border-box")) throw new Error("the sidebar action must size its padding inside the row box, like the Settings key");
if (!railBadgeRule.includes("height:36px")) throw new Error("the collapsed sidebar action must match the Settings rail key (36px)");
// Keyboard focus must be visible on the action and on the panel's controls.
const focusRule = new RegExp("\\.usg_badge:focus-visible[^{]*\\{([^}]*)\\}").exec(source)?.[1] ?? "";
if (!focusRule.includes("2px solid var(--dsw-alias-brand-primary)")) throw new Error("the sidebar action needs the host brand focus outline");
// Hover uses the same translucent token as the Settings key; the opaque
// `-hover-solid` fill is the shell's surface variant, not a row hover.
const badgeHoverRule = /\.usg_badge:hover\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!badgeHoverRule.includes("background:var(--dsw-alias-interactive-bg-hover)")) throw new Error("the sidebar action hover must match the Settings key hover token");
// Panel surface: the official elevated-menu recipe. The blur token is absent
// before 0.1.7, where the declaration drops out and the opaque menu colour
// remains — that fallback is why no version check is needed.
const panelRule = /\.usg_panel\{([^}]*)\}/.exec(source)?.[1] ?? "";
const headerRule = /\.usg_header\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!panelRule.includes("background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base)))")) throw new Error("the panel must use the official menu surface colour");
if (!panelRule.includes("backdrop-filter:var(--dsw-menu-backdrop-filter)")) throw new Error("the panel must pair the translucent menu surface with the official backdrop blur");
if (!panelRule.includes("box-shadow:var(--dsw-elevation-prominent,var(--dsw-shadow-lv2))")) throw new Error("the panel must take the official prominent elevation with the legacy shadow as fallback");
if (panelRule.includes("border:1px solid")) throw new Error("the official menu surface draws its hairline through the elevation stroke, not a 1px border");
if (headerRule.includes("background:")) throw new Error("the panel header must stay transparent so the glass surface is continuous");
// The two month views: the calendar cell grid and the curve. The curve must be
// a real gradient area + stroke (not a bar chart), and the toggle must sit above
// the grid, which is what the user asked for.
const viewToggleRule = /\.usg_viewToggle\{([^}]*)\}/.exec(source)?.[1] ?? "";
const viewToggleButtonRule = /\.usg_viewToggleButton\{([^}]*)\}/.exec(source)?.[1] ?? "";
const viewToggleActiveRule = /\.usg_viewToggleButton\[data-active\]\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!viewToggleRule.includes("display:inline-flex")) throw new Error("the heat/curve switch must be a compact segmented control");
if (!viewToggleButtonRule.includes("cursor:pointer")) throw new Error("the view toggle buttons must look clickable");
if (viewToggleActiveRule === "") throw new Error("the active view must be visually distinguishable");
const curveSvgRule = /\.usg_curveSvg\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!curveSvgRule.includes("width:100%")) throw new Error("the curve must scale to the panel width");
const modelRankTokensRule = /\.usg_modelRankTokens\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!modelRankTokensRule.includes("min-width:64px") || !modelRankTokensRule.includes("text-align:right")) throw new Error("the today-by-model token column must stay right aligned and wide enough for an abbreviated value");
if (!modelRankTokensRule.includes("tabular-nums")) throw new Error("the today-by-model token column must use tabular numerals");
// A share bar must be a flexible TRACK plus a fixed-width FILL. A `width` on a
// `flex:1` item is silently ignored (flex-basis 0 wins), which renders every bar
// the same length: the regression this pair of rules prevents.
for (const [track, fill] of [["usg_dayBarTrack", "usg_dayBar"], ["usg_modelRankTrack", "usg_modelRankBar"]]) {
	const trackRule = new RegExp(`\\.${track}\\{([^}]*)\\}`).exec(source)?.[1] ?? "";
	const fillRule = new RegExp(`\\.${fill}\\{([^}]*)\\}`).exec(source)?.[1] ?? "";
	if (!trackRule.includes("flex:1")) throw new Error(`${track} must be the flexible element`);
	if (/(?:^|;)width:/.test(trackRule)) throw new Error(`${track} must not carry the share width`);
	if (fillRule.includes("flex:1")) throw new Error(`${fill} must not be flexible, or its width is ignored`);
	if (!fillRule.includes("height:6px")) throw new Error(`${fill} must keep the bar geometry`);
}
const curvePeakRule = /\.usg_curvePeak\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (curvePeakRule === "") throw new Error("the curve needs its peak caption");
for (const selector of [".usg_iconButton:focus-visible", ".usg_navButton:focus-visible", ".usg_cell:focus-visible", ".usg_day:focus-visible", ".usg_viewToggleButton:focus-visible"]) {
	if (!source.includes(selector)) throw new Error(`panel control ${selector} must join the focus outline rule`);
}
new Function(source)(); // executes the window.__ModuleLoader__.load call

if (captured === null) throw new Error("loader did not capture the bundle");
const packageName = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")).name;
if (captured.id !== packageName) throw new Error(`unexpected id ${captured.id}; expected package name ${packageName}`);
if (!source.includes(`tag.dataset.plugin = "${packageName}"`)) throw new Error(`style ownership id must match package name ${packageName}`);

const exports_ = captured.factory((spec) => {
	if (spec === "react") return react;
	if (spec === "react/jsx-runtime") return jsxRuntime;
	// react-dom/server cannot render portals; the panel portals to document.body
	// only for theme-token scoping, so the smoke harness inlines it instead.
	if (spec === "react-dom") return { createPortal: (node) => node };
	if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
	throw new Error(`unexpected require: ${spec}`);
});

if (typeof exports_.apply !== "function") throw new Error("missing apply export");

const { enableFooterActionWrapping } = exports_;
if (typeof enableFooterActionWrapping !== "function") throw new Error("footer action wrapping policy must be testable");
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (node) => node.computedStyle;
const fullWidthSibling = () => ({ style: { flex: "0 0 100%" } });
const rowHost = {
	style: { flexDirection: "", flexWrap: "" },
	computedStyle: { display: "flex", flexDirection: "row", flexWrap: "nowrap" },
	children: [fullWidthSibling(), fullWidthSibling()]
};
const restoreRowHost = enableFooterActionWrapping(rowHost);
assert.equal(rowHost.style.flexWrap, "wrap", "row + nowrap must wrap full-width footer actions onto separate lines");
assert.equal(rowHost.style.flexDirection, "", "the shared host row direction must remain untouched");
assert.deepEqual(rowHost.children.map((node) => node.style.flex), ["0 0 100%", "0 0 100%"], "sibling full-width flex semantics must remain untouched");
assert.equal(typeof restoreRowHost, "function");
restoreRowHost();
assert.equal(rowHost.style.flexWrap, "", "unmount cleanup must restore the previous inline flexWrap");

const wrappedHost = {
	style: { flexDirection: "", flexWrap: "wrap" },
	computedStyle: { display: "flex", flexDirection: "row", flexWrap: "wrap" }
};
assert.equal(enableFooterActionWrapping(wrappedHost), undefined, "an already wrapped host must not be modified");
assert.equal(wrappedHost.style.flexWrap, "wrap");

const columnHost = {
	style: { flexDirection: "column", flexWrap: "nowrap" },
	computedStyle: { display: "flex", flexDirection: "column", flexWrap: "nowrap" }
};
assert.equal(enableFooterActionWrapping(columnHost), undefined, "a column host must be left untouched");
assert.equal(columnHost.style.flexDirection, "column");
assert.equal(columnHost.style.flexWrap, "nowrap");
window.getComputedStyle = originalGetComputedStyle;
console.log("shared footer action row/wrap policy ok");

const { VIEW_STORAGE_KEY, readStoredView, writeStoredView } = exports_;
assert.equal(VIEW_STORAGE_KEY, "@uskyu/dsh-usage-stats:view:v1");
// The calendar is the default; a persisted curve survives a reload.
assert.equal(readStoredView(localStorage), "heat", "an empty storage must fall back to the calendar view");
writeStoredView("curve", localStorage);
assert.equal(readStoredView(localStorage), "curve", "the curve selection must persist");
writeStoredView("heat", localStorage);
assert.equal(readStoredView(localStorage), "heat");
// Anything else in the key is junk from an older format and must not be trusted.
storedValues.set(VIEW_STORAGE_KEY, "pie-chart");
assert.equal(readStoredView(localStorage), "heat", "an unknown stored view must fall back to the calendar");
assert.equal(storedValues.has(VIEW_STORAGE_KEY), false, "an unknown stored view must be cleared");
// An invalid write must clear rather than store a value the reader rejects.
writeStoredView("nonsense", localStorage);
assert.equal(storedValues.has(VIEW_STORAGE_KEY), false);
// Storage can be disabled or throw (Safari private mode, quota): never throw.
const deniedStorage = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }, removeItem: () => { throw new Error("denied"); } };
assert.equal(readStoredView(deniedStorage), "heat");
writeStoredView("curve", deniedStorage);
console.log("month view persistence policy ok");

const { shouldDismissPanel } = exports_;
const panelNode = { contains: (target) => target === "panel-child" };
const layerNode = { contains: (target) => target === "badge-child" };
if (shouldDismissPanel([panelNode], "panel-child", layerNode, panelNode)) throw new Error("panel click must stay open");
if (shouldDismissPanel([layerNode], "badge-child", layerNode, panelNode)) throw new Error("badge click must stay inside");
if (!shouldDismissPanel([], "page-content", layerNode, panelNode)) throw new Error("outside click must dismiss");
if (!shouldDismissPanel([], "page-content", null, null)) throw new Error("missing refs must fail safe as outside");
console.log("panel dismissal guards ok");

// Render the panel (closed state) to static markup. The dictionary is supplied
// here so the assertion sees the real shipped label, not a raw key.
const { UsageStatsPanel } = exports_;
const dictZh = { "panel.badge": "用量", "panel.title": "用量" };
const markup = renderToStaticMarkup(react.createElement(UsageStatsPanel, { wide: true, t: (key) => dictZh[key] ?? key }));
if (!markup.includes("用量")) throw new Error("badge label missing from markup");
if (markup.includes("余额")) throw new Error("the sidebar entry must not mention 余额 any more");
const railMarkup = renderToStaticMarkup(react.createElement(UsageStatsPanel, { wide: false, t: (key) => key }));
if (!railMarkup.includes("usg_rail") || !railMarkup.includes("data-usage-stats-badge")) throw new Error("collapsed rail must retain the sidebar Usage Stats action");
console.log("sidebar render ok, wide/rail markup:", markup.length, railMarkup.length);

// The same panel against the other supported primitive surfaces: the 0.1.7 icon
// spelling must resolve, and a host that exports no icon at all must still render
// through the inline fallback instead of throwing the sidebar action away.
const renderBadgeWith = (surface) => {
	const surfaceExports = captured.factory((spec) => {
		if (spec === "react") return react;
		if (spec === "react/jsx-runtime") return jsxRuntime;
		if (spec === "react-dom") return { createPortal: (node) => node };
		if (spec === "@deepseek-ai/dsh-client-ui-primitives") return surface;
		throw new Error(`unexpected require: ${spec}`);
	});
	return renderToStaticMarkup(react.createElement(surfaceExports.UsageStatsPanel, { wide: false, t: (key) => key }));
};
if (!markup.includes("data-icon-stub")) throw new Error("the legacy icon exports must be used when the host provides them");
const currentMarkup = renderBadgeWith(primitivesSurface(currentIcons));
if (!currentMarkup.includes("data-usage-stats-badge")) throw new Error("the panel must render against the 0.1.7 icon set");
if (!currentMarkup.includes("data-icon-stub")) throw new Error("the 0.1.7 icon exports must be used when the host provides them");
const bareMarkup = renderBadgeWith(primitivesSurface({}));
if (!bareMarkup.includes("data-usage-stats-badge")) throw new Error("the panel must render when the host exports no icon");
if (bareMarkup.includes("data-icon-stub") || !bareMarkup.includes("<svg")) throw new Error("a missing icon must fall back to the inline glyph");
console.log("icon surface compatibility ok (legacy, 0.1.7, none)");

// Apply against a stub client context.
const registrations = [];
const registeredEntries = [];
const ctx = {
	effect: () => {},
	locale: { register: (ns, dict) => { if (ns !== "usageStats") throw new Error(`unexpected ns ${ns}`); if (!dict.zh || !dict.en) throw new Error("missing dictionaries"); } },
	inject: () => { throw new Error("sidebar-only client must not request session-specific services"); },
	slots: {
		inject: (slot, fn) => { registrations.push([slot, fn]); return () => {}; },
		register: (options, component) => { registeredEntries.push({ options, component }); return () => {}; }
	}
};
exports_.apply(ctx);
if (registrations.length !== 1) throw new Error(`expected only the sidebar slot injection, got ${registrations.length}`);
const registrationBySlot = new Map(registrations);
if (!registrationBySlot.has("sidebar.footer.action")) throw new Error("sidebar footer slot registration missing");
for (const registerFn of registrationBySlot.values()) {
	const disposer = registerFn();
	if (typeof disposer !== "function") throw new Error("slot registration must return a disposer");
}
const sidebarEntry = registeredEntries.find((entry) => entry.options.name === "sidebar.footer.action");
if (sidebarEntry?.options.id !== "usage-stats" || typeof sidebarEntry.component !== "function") throw new Error("sidebar action must remain the sole client entry");
console.log("apply ok, sidebar-only slot:", [...registrationBySlot.keys()].join(", "));

// Render the month heatmap with synthetic per-day data (calendar grid + colors).
const { MonthHeatmap, DayDetail, buildMonthHeatmap } = exports_;
const dayMap = new Map();
const now = new Date();
for (let i = 0; i < 40; i += 1) {
	const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
	const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	dayMap.set(key, { tokens: 1000 + i * 137, cacheHitRate: i % 3 === 0 ? null : 90.5 });
}
const heat = buildMonthHeatmap(dayMap, now.getFullYear(), now.getMonth());
if (heat.weeks.length < 4 || heat.weeks.length > 6) throw new Error(`unexpected week count ${heat.weeks.length}`);
for (const week of heat.weeks) if (week.length !== 7) throw new Error("week must have 7 slots");
const heatMarkup = renderToStaticMarkup(react.createElement(MonthHeatmap, {
	heat,
	translate: (key) => key,
	selectedKey: null,
	onSelect: () => {}
}));
if (heatMarkup.length < 500) throw new Error("heatmap markup too small");
if (!heatMarkup.includes("tokens")) throw new Error("heatmap cells missing tooltips");
console.log("month heatmap render ok, markup length:", heatMarkup.length, "| weeks:", heat.weeks.length);

// Sqrt rgba scale: monotonic in tokens — more usage → deeper blue (higher alpha).
const { cellColor } = exports_;
const levelOf = (tokens, max) => {
	const style = cellColor(tokens, max);
	if (style.background === "var(--usg-cellEmpty)") return 0;
	return Number(style.background.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)[4]);
};
const levelMap = new Map();
const lkeys = [];
for (let i = 1; i <= 4; i += 1) {
	const d = new Date(now.getFullYear(), now.getMonth(), i);
	const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	levelMap.set(key, { tokens: [1000, 100000, 10000000, 40000000][i - 1], cacheHitRate: 90 });
	lkeys.push(key);
}
const levelHeat = buildMonthHeatmap(levelMap, now.getFullYear(), now.getMonth());
const levels = lkeys.map((key) => levelOf(levelHeat.weeks.flat().find((c) => c !== null && c.key === key).tokens, levelHeat.max));
if (levels[3] !== 1) throw new Error(`max day must be alpha 1 (deep blue), got ${levels[3]}`);
for (let i = 1; i < 4; i += 1) if (levels[i] < levels[i - 1]) throw new Error(`levels not monotonic: ${JSON.stringify(levels)}`);
if (levelOf(0, levelHeat.max) !== 0) throw new Error("zero tokens must be level 0");
if (!cellColor(1000, levelHeat.max).background.startsWith("rgba(")) throw new Error("background must be plain rgba (no color-mix)");
console.log("rgba sqrt scale monotonic ok:", JSON.stringify(levels.map((a) => a.toFixed(3))));

// Regression: the panel parses `YYYY-MM` (1-based) from viewMonth; emulate it
// and check the grid lands on the right month (August 2026 starts on Saturday).
const [panelYear, panelMonth] = "2026-08".split("-").map(Number);
const panelHeat = buildMonthHeatmap(levelMap, panelYear, panelMonth - 1);
const firstWeek = panelHeat.weeks[0];
if (firstWeek[5] === null || firstWeek[5].day !== 1) throw new Error(`August 2026 should start with day 1 at weekday index 5, got ${JSON.stringify(firstWeek)}`);
if (firstWeek[0] !== null || firstWeek[4] !== null) throw new Error("August 2026 must lead with 5 empty slots");
console.log("month off-by-one regression ok (Aug 2026 grid correct)");

// Render the day-detail view with per-model breakdown.
const dayDetail = renderToStaticMarkup(react.createElement(DayDetail, {
	day: {
		date: "2026-08-13",
		tokens: 34333358,
		inputTokens: 199382,
		outputTokens: 116824,
		cacheReadTokens: 34017152,
		cacheWriteTokens: 0,
		cacheHitRate: 99.4,
		models: [
			{ model: "deepseek-official/deepseek-v4-flash", tokens: 30000000, inputTokens: 100000, outputTokens: 50000, cacheReadTokens: 29000000, cacheWriteTokens: 0, cacheHitRate: 99.6 },
			{ model: "ark/deepseek-v4-flash", tokens: 4333358, inputTokens: 99382, outputTokens: 66824, cacheReadTokens: 5017152, cacheWriteTokens: 0, cacheHitRate: 98.1 }
		]
	},
	translate: (key) => key,
	onBack: () => {}
}));
if (!dayDetail.includes("deepseek-v4-flash")) throw new Error("day detail missing model rows");
if (!dayDetail.includes("deepseek-official · deepseek-v4-flash")) throw new Error("day detail must prefix the provider");
if (!dayDetail.includes("ark · deepseek-v4-flash")) throw new Error("same model from another provider must stay distinct");
if (dayDetail.length < 500) throw new Error("day detail markup too small");
console.log("day detail render ok (provider-prefixed models), markup length:", dayDetail.length);

// Today's per-model ranking replaces the old session-cost list.
const { buildTodayModelRows } = exports_;
const todayRows = buildTodayModelRows({
	tokens: 33818571,
	models: [
		{ model: "deepseek-official/deepseek-v4-flash", tokens: 30000000 },
		{ model: "ark/deepseek-v4-flash", tokens: 3000000 },
		{ model: "warmup/empty", tokens: 0 },
		{ model: "", tokens: 500 },
		{ model: "relay-a/glm-4.6", tokens: 818571 }
	]
});
assert.deepEqual(todayRows.rows.map((row) => row.model), ["deepseek-official/deepseek-v4-flash", "ark/deepseek-v4-flash", "relay-a/glm-4.6"], "only non-empty models render, largest first");
assert.equal(todayRows.total, 33818571, "the day total is the share denominator");
assert.equal(todayRows.top, 30000000);
for (const row of todayRows.rows) {
	if (row.share < 2 || row.share > 100) throw new Error(`share must stay a usable bar width, got ${row.share}`);
}
if (buildTodayModelRows({ tokens: 100, models: [] }).rows.length !== 0) throw new Error("an empty model list must produce no rows");
if (buildTodayModelRows(null).rows.length !== 0) throw new Error("a missing day must produce no rows");
const noTotal = buildTodayModelRows({ models: [{ model: "a/b", tokens: 10 }, { model: "c/d", tokens: 30 }] });
assert.equal(noTotal.total, 40, "a missing day total must fall back to the sum of the visible rows");
assert.equal(noTotal.rows[0].share, 75, "the top model keeps a proportional share when the total is derived");
const limited = buildTodayModelRows({ tokens: 100, models: [{ model: "a/b", tokens: 60 }, { model: "c/d", tokens: 30 }, { model: "e/f", tokens: 10 }] }, 2);
assert.equal(limited.rows.length, 2, "the ranking limit must be respected");
console.log("today-by-model ranking ok (ordering, zero/empty filtering, shares)");

// Number abbreviation: the whole point of the change is that a token column
// never shows a wall of digits.
const { fmt, fmtExact } = exports_;
assert.equal(fmt(0), "0");
assert.equal(fmt(999), "999");
assert.equal(fmt(1234), "1,234", "below 10,000 the exact grouped value stays readable");
assert.equal(fmt(9999), "9,999", "9,999 is still exact — the cutoff is 10,000");
assert.equal(fmt(10000), "10K");
assert.equal(fmt(33818571), "33.8M");
assert.equal(fmt(6246205945), "6.2B");
assert.equal(fmt(7160068552), "7.2B");
assert.equal(fmt(34655403), "34.7M");
assert.equal(fmt(999999999999), "1T", "the largest unit must roll over rather than print a fifth digit");
assert.equal(fmt(-33818571), "-33.8M", "a negative value keeps its sign");
assert.equal(fmt("nonsense"), "0", "a non-numeric input must not print NaN");
assert.equal(fmtExact(33818571), "33,818,571");
assert.equal(fmtExact(1234.6), "1,235");
for (const value of [10000, 999999, 1234567890, 6.2e12]) {
	if (fmt(value).length > 6) throw new Error(`abbreviated value grew past the budget: ${fmt(value)}`);
}
console.log("number abbreviation ok:", JSON.stringify([10000, 33818571, 6246205945].map((n) => fmt(n))));


// Race regression (P1): usage and account must each keep their OWN staleness
// counter, so an account request issued right after a usage request must NOT
// invalidate the in-flight usage response.
const { budgetWindowText, createLoader, fmtCurrency } = exports_;
if (typeof budgetWindowText !== "function") throw new Error("budget display helper missing");
const usageLoader = createLoader();
const accountLoader = createLoader();
const usageId = usageLoader.start();
const accountId = accountLoader.start();
if (!usageLoader.isCurrent(usageId)) throw new Error("race: account start invalidated the usage request");
if (!accountLoader.isCurrent(accountId)) throw new Error("account request must stay current");
usageLoader.start(); // a newer usage refresh supersedes the old one
if (usageLoader.isCurrent(usageId)) throw new Error("a newer usage start must supersede the previous usage request");
if (!accountLoader.isCurrent(accountId)) throw new Error("account must not be affected by usage refreshes");
console.log("loader race regression ok (independent usage/account counters)");

// Currency formatting must respect the reported currency, not hardcode ¥.
const cny = fmtCurrency("36.44", "CNY");
if (!cny.includes("36.44")) throw new Error(`unexpected CNY format: ${cny}`);
if (fmtCurrency(void 0, "CNY") !== "—") throw new Error("missing amount must render em dash");
if (fmtCurrency("9.9", "USD").includes("¥")) throw new Error("USD must not render as ¥");
console.log("currency formatting ok:", cny);

const budgetTranslate = (key, params) => {
	if (key === "budget.period.daily") return "Today";
	if (key === "budget.level.warning") return "Near";
	if (key === "budget.level.unknown") return "Unknown";
	if (key === "budget.summary") return `${params.period}: ${params.spent} / ${params.limit} · ${params.level}`;
	return key;
};
const warningBudget = budgetWindowText("daily", { limit: 10, currency: "USD", estimatedSpend: 8, costComplete: true, level: "warning" }, budgetTranslate);
if (!warningBudget.includes("8.00") || !warningBudget.includes("10.00") || !warningBudget.includes("Near")) throw new Error(`known budget state must be visible: ${warningBudget}`);
const unknownBudget = budgetWindowText("daily", { limit: 10, currency: "USD", estimatedSpend: null, costComplete: false, level: "unknown" }, budgetTranslate);
if (!unknownBudget.includes("—") || !unknownBudget.includes("Unknown")) throw new Error("incomplete budget cost must stay unknown");

// Collapsed-badge account value + warning policy (v0.2.0 unified account model).




// Mount the real sidebar action and drive the panel with an inert fetch double.
// The panel must read ONLY the usage endpoint: the retired account routes must
// not be called even though the server still exposes them.
const originalFetch = globalThis.fetch;
const requests = [];
document.addEventListener = () => {};
document.removeEventListener = () => {};
window.setInterval = () => 1;
window.clearInterval = () => {};
const responseFixture = (payload, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => payload });
const flushPanelEffects = async () => {
	for (let index = 0; index < 5; index += 1) await Promise.resolve();
};
const todayKeyOf = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const usageFixture = {
	ok: true,
	days: [
		{
			date: todayKeyOf(),
			tokens: 33818571,
			inputTokens: 1000,
			outputTokens: 2000,
			cacheReadTokens: 33815571,
			cacheWriteTokens: 0,
			cacheHitRate: 99.4,
			models: [
				{ model: "deepseek-official/deepseek-v4-flash", tokens: 30000000, inputTokens: 900, outputTokens: 1800, cacheReadTokens: 29997300, cacheWriteTokens: 0, cacheHitRate: 99.6 },
				{ model: "ark/deepseek-v4-flash", tokens: 3818571, inputTokens: 100, outputTokens: 200, cacheReadTokens: 3818271, cacheWriteTokens: 0, cacheHitRate: 98.1 }
			]
		}
	],
	total: { tokens: 6246205945 },
	budgets: {
		daily: { limit: 10, currency: "USD", estimatedSpend: 8, costComplete: true, level: "warning" },
		monthly: { limit: null, currency: "USD", estimatedSpend: 8, costComplete: true, level: "disabled" }
	}
};
globalThis.fetch = async (path, options = {}) => {
	requests.push({ path: String(path), method: options.method ?? "GET" });
	return responseFixture(usageFixture);
};

const panelTranslate = (key) => key;
let renderer;
await act(async () => {
	renderer = TestRenderer.create(react.createElement(UsageStatsPanel, { wide: true, t: panelTranslate }));
	await Promise.resolve();
});
await act(async () => {
	renderer.root.findByProps({ "data-usage-stats-badge": true }).props.onClick();
	await flushPanelEffects();
});
if (renderer.root.findAllByProps({ "data-usage-stats-panel": true }).length !== 1) throw new Error("sidebar badge click must open the usage panel");
assert.deepEqual([...new Set(requests.map((request) => request.path))], ["/api/usage-stats/usage"], "the panel must read only the usage endpoint");
assert.equal(renderer.root.findAllByType("select").length, 0, "the retired provider picker must not render");

// Abbreviated numbers, with the exact value still reachable from the tooltip.
const statValues = renderer.root.findAll((node) => node.props?.className === "usg_statValue");
assert.deepEqual(statValues.map((node) => node.props.children), ["33.8M", "33.8M", "6.2B"], "the three stat cards must abbreviate");
assert.deepEqual(statValues.map((node) => node.props.title), ["33,818,571", "33,818,571", "6,246,205,945"], "each stat card must keep the exact value in its tooltip");

// Today's per-model ranking replaced the session-cost list.
const rankRows = renderer.root.findAll((node) => typeof node.props?.["data-model-rank"] === "string");
assert.deepEqual(rankRows.map((node) => node.props["data-model-rank"]), ["deepseek-official/deepseek-v4-flash", "ark/deepseek-v4-flash"], "the ranking lists today's models, largest first");
const rankMarkup = renderToStaticMarkup(react.createElement(UsageStatsPanel, { wide: true, t: panelTranslate }));
if (rankMarkup.includes("sessionCost")) throw new Error("the session-cost section must be gone");
const rankTokens = rankRows.map((row) => row.findAll((node) => node.props?.className === "usg_modelRankTokens")[0].props.children);
assert.deepEqual(rankTokens, ["30M", "3.8M"], "each ranking row shows an abbreviated token count");
// The share must land on the inner fill, never on the flexible track.
const rankShares = rankRows.map((row) => row.findAll((node) => node.props?.className === "usg_modelRankBar")[0].props.style.width);
assert.deepEqual(rankShares, ["89%", "11%"], "each ranking row widths its own fill by share of today");
assert.equal(rankRows[0].findAll((node) => node.props?.className === "usg_modelRankTrack")[0].props["aria-hidden"], true, "the share bar is decorative and must stay out of the accessibility tree");
assert.equal(rankRows[0].findAll((node) => node.props?.className === "usg_modelRankTokens")[0].props.title, "30,000,000 tokens", "the ranking row keeps the exact count in its tooltip");

// The view toggle sits with the month header and switches the calendar for the
// smooth curve; the choice persists across a close/reopen.
const viewButtons = renderer.root.findAll((node) => typeof node.props?.["data-view"] === "string");
assert.deepEqual(viewButtons.map((node) => node.props["data-view"]), ["heat", "curve"], "the month header must offer exactly the calendar and the curve");
assert.equal(viewButtons[0].props["aria-pressed"], true, "the calendar is the default view");
assert.equal(renderer.root.findAll((node) => node.props?.className === "usg_heatRow").length > 0, true, "the calendar grid must render by default");
assert.equal(renderer.root.findAllByType("svg").some((node) => node.props?.className === "usg_curveSvg"), false, "the curve must stay hidden while the calendar is selected");
await act(async () => {
	viewButtons[1].props.onClick();
	await flushPanelEffects();
});
const svg = renderer.root.findAllByType("svg").find((node) => node.props?.className === "usg_curveSvg");
if (svg === undefined) throw new Error("selecting the curve must render the SVG chart");
assert.equal(renderer.root.findAll((node) => node.props?.className === "usg_heatRow").length, 0, "the calendar must be replaced, not stacked");
const curvePaths = svg.findAllByType("path").map((node) => node.props.d);
assert.equal(curvePaths.length, 2, "the curve needs an area fill and a stroked line");
for (const d of curvePaths) {
	if (typeof d !== "string" || !d.startsWith("M ")) throw new Error(`the curve must be a path, got ${d}`);
	// A Catmull-Rom-derived spline emits cubic segments; straight lines would mean
	// the smoothing silently fell back to a polyline.
	if (!d.includes(" C ")) throw new Error("the curve must be smoothed with cubic segments");
}
assert.equal(svg.findAllByType("rect").length >= 28, true, "every day of the month needs a hit target");
assert.equal(readStoredView(localStorage), "curve", "switching the view must persist the choice");
await act(async () => {
	renderer.root.findByProps({ "aria-label": "action.close" }).props.onClick();
	await Promise.resolve();
});
await act(async () => {
	renderer.root.findByProps({ "data-usage-stats-badge": true }).props.onClick();
	await flushPanelEffects();
});
assert.equal(readStoredView(localStorage), "curve", "reopening must keep the curve selection");
assert.equal(renderer.root.findAllByType("svg").some((node) => node.props?.className === "usg_curveSvg"), true, "the persisted curve must render on reopen");

// Clicking a curve point opens that day's detail, exactly like a heatmap cell.
const todayPoint = renderer.root.findAll((node) => node.props?.["data-curve-day"] === todayKeyOf());
assert.equal(todayPoint.length, 1, "today must have a curve hit target");
await act(async () => {
	todayPoint[0].props.onClick();
	await flushPanelEffects();
});
const detail = renderer.root.findAll((node) => node.props?.className === "usg_detailSummary");
assert.equal(detail.length, 1, "clicking a curve point must open the day detail");
if (!String(detail[0].props.children).includes("33.8M")) throw new Error("the day detail must abbreviate too");
await act(async () => {
	renderer.root.findByProps({ "aria-label": "usage.back" }).props.onClick();
	await Promise.resolve();
});

const exportLinks = renderer.root.findAll((node) => typeof node.props?.["data-export-format"] === "string");
assert.deepEqual(exportLinks.map((node) => node.props["data-export-format"]), ["daily-csv", "sessions-csv", "json"], "the panel must expose all three secret-free downloads without a new fetch loop");
for (const link of exportLinks) if (link.type !== "a" || typeof link.props.download !== "string" || link.props.className !== "usg_exportLink") throw new Error("exports must be styled browser downloads");
if (renderer.root.findAllByProps({ "data-budget-period": "daily" }).length !== 1
	|| renderer.root.findByProps({ "data-budget-period": "daily" }).props["data-budget-level"] !== "warning") {
	throw new Error("configured budget state must integrate into the existing usage panel");
}
await act(async () => {
	renderer.root.findByProps({ "aria-label": "action.close" }).props.onClick();
	await Promise.resolve();
});
if (renderer.root.findAllByProps({ "data-usage-stats-panel": true }).length !== 0) throw new Error("close action must dismiss the panel");
await act(async () => { renderer.unmount(); });

// An empty day list must still render the shell (and say so) instead of throwing.
globalThis.fetch = async () => responseFixture({ ok: true, days: [], total: { tokens: 0 } });
let emptyRenderer;
await act(async () => {
	emptyRenderer = TestRenderer.create(react.createElement(UsageStatsPanel, { wide: true, t: panelTranslate }));
	await Promise.resolve();
});
await act(async () => {
	emptyRenderer.root.findByProps({ "data-usage-stats-badge": true }).props.onClick();
	await flushPanelEffects();
});
assert.equal(emptyRenderer.root.findAll((node) => node.props?.["data-model-rank"]).length, 0, "an empty day must render no ranking rows");
if (emptyRenderer.root.findAllByProps({ "data-usage-stats-panel": true }).length !== 1) throw new Error("an empty usage response must still open the panel");
await act(async () => { emptyRenderer.unmount(); });
globalThis.fetch = originalFetch;

console.log("sidebar-only usage panel, view toggle, and today-by-model ranking ok");
console.log("SMOKE TEST PASSED");
