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
	"usg_sessionCost",
	"buildTodayModelRows",
	"buildMonthCurve",
	"MonthCurve",
	"usg_modelRank",
	"usg_curveSvg",
	"usg_dayBar"
]) {
	if (source.includes(forbidden)) throw new Error(`removed account UI/dead code must be absent from the client bundle: ${forbidden}`);
}
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
// The two month views. The toggle shares the month row (so it costs no height),
// the trend is a real multi-series line chart, and the share is a donut.
const viewToggleRule = /\.usg_viewToggle\{([^}]*)\}/.exec(source)?.[1] ?? "";
const viewToggleButtonRule = /\.usg_viewToggleButton\{([^}]*)\}/.exec(source)?.[1] ?? "";
const viewToggleActiveRule = /\.usg_viewToggleButton\[data-active\]\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!viewToggleRule.includes("display:inline-flex")) throw new Error("the view switch must be a compact segmented control");
if (!viewToggleRule.includes("flex:none")) throw new Error("the view switch must not stretch the month row");
if (!viewToggleButtonRule.includes("cursor:pointer")) throw new Error("the view toggle buttons must look clickable");
if (viewToggleActiveRule === "") throw new Error("the active view must be visually distinguishable");
const trendSvgRule = /\.usg_trendSvg\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!trendSvgRule.includes("width:100%")) throw new Error("the trend plot must scale to the panel width");
// The hit layer overlays the static SVG, so it must not consume layout height.
const trendHitsRule = /\.usg_trendHits\{([^}]*)\}/.exec(source)?.[1] ?? "";
const trendHitRule = /\.usg_trendHit\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!trendHitsRule.includes("height:0")) throw new Error("the trend hit layer must be an overlay, not a second row");
if (!trendHitRule.includes("margin-top:-78px")) throw new Error("the trend hit targets must be pulled back over the plot");
const donutItemNameRule = /\.usg_donutItemName\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!donutItemNameRule.includes("text-overflow:ellipsis") || !donutItemNameRule.includes("flex:1")) throw new Error("the donut legend must truncate long model names instead of pushing the numbers out");
const donutMetaRule = /\.usg_donutItemMeta\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!donutMetaRule.includes("tabular-nums") || !donutMetaRule.includes("text-align:right")) throw new Error("the donut percentage column must stay aligned");
// The hover card must float over the plot without capturing the pointer.
const tooltipRule = /\.usg_trendTooltip\{([^}]*)\}/.exec(source)?.[1] ?? "";
if (!tooltipRule.includes("position:absolute") || !tooltipRule.includes("pointer-events:none")) throw new Error("the trend hover card must float over the plot and ignore the pointer");
for (const selector of [".usg_iconButton:focus-visible", ".usg_navButton:focus-visible", ".usg_cell:focus-visible", ".usg_trendHit:focus-visible", ".usg_viewToggleButton:focus-visible"]) {
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
// The trend is the default; a persisted calendar survives a reload.
assert.equal(readStoredView(localStorage), "curve", "an empty storage must fall back to the curve view");
writeStoredView("heat", localStorage);
assert.equal(readStoredView(localStorage), "heat", "the calendar selection must persist");
writeStoredView("curve", localStorage);
assert.equal(readStoredView(localStorage), "curve");
// Anything else in the key is junk from an older format and must not be trusted.
storedValues.set(VIEW_STORAGE_KEY, "pie-chart");
assert.equal(readStoredView(localStorage), "curve", "an unknown stored view must fall back to the curve");
assert.equal(storedValues.has(VIEW_STORAGE_KEY), false, "an unknown stored view must be cleared");
// An invalid write must clear rather than store a value the reader rejects.
writeStoredView("nonsense", localStorage);
assert.equal(storedValues.has(VIEW_STORAGE_KEY), false);
// Storage can be disabled or throw (Safari private mode, quota): never throw.
const deniedStorage = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }, removeItem: () => { throw new Error("denied"); } };
assert.equal(readStoredView(deniedStorage), "curve");
writeStoredView("heat", deniedStorage);
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

// The analysis window is a rolling range that ENDS TODAY, so the x axis never
// runs through days that have not happened yet.
const { buildDailyTrend, buildModelShare, donutSegments, smoothPath, recentDayKeys, axisLabelOf, RANGE_DAYS, DEFAULT_RANGE, RANGE_STORAGE_KEY, readStoredRange, writeStoredRange } = exports_;
const fixedNow = new Date(2026, 7, 4, 12, 0, 0);
const weekKeys = recentDayKeys(7, fixedNow);
assert.equal(weekKeys.length, 7, "a week window is seven samples");
assert.equal(weekKeys[6], "2026-08-04", "the window always ends today");
assert.equal(weekKeys[0], "2026-07-29", "and starts six days earlier, crossing the month boundary correctly");
assert.equal(recentDayKeys(30, fixedNow).at(-1), "2026-08-04", "the month window also ends today");
assert.equal(recentDayKeys(30, fixedNow).length, 30);
assert.equal(axisLabelOf("2026-08-04"), "8/4", "axis labels are compact M/D");
assert.equal(axisLabelOf("2026-01-09"), "1/9", "and drop the leading zero");

const trendDays = new Map();
const trendModels = [
	["deepseek-official/deepseek-v4-flash", [10, 40, 0, 25]],
	["ark/deepseek-v4-flash", [5, 8, 30, 0]],
	["opencode-go/deepseek-v4.1-flash", [1, 2, 3, 4]],
	["relay-a/glm-4.6", [0, 0, 2, 1]],
	["relay-b/qwen3", [0, 1, 0, 0]]
];
const trendKeys = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"];
trendKeys.forEach((key, index) => {
	trendDays.set(key, {
		date: key,
		tokens: trendModels.reduce((sum, [, values]) => sum + values[index], 0),
		models: trendModels.map(([model, values]) => ({ model, tokens: values[index] }))
	});
});

// A window with no usage still spans its full length.
const emptyTrend = buildDailyTrend(new Map(), weekKeys);
assert.equal(emptyTrend.days.length, 7, "an empty window still spans the whole range");
assert.equal(emptyTrend.series.length, 0, "a window with no usage has no series");
assert.equal(emptyTrend.max, 0);
assert.equal(emptyTrend.days.at(-1).key, "2026-08-04", "the last sample is always the last day in the window");

const trend = buildDailyTrend(trendDays, trendKeys, { labelOf: (key) => `L:${key}` });
assert.equal(trend.days.length, 4, "one sample per day in the window");
assert.equal(trend.series.length, 5, "four named series plus the aggregate bucket");
assert.deepEqual(trend.series.slice(0, 4).map((s) => s.key), [
	"deepseek-official/deepseek-v4-flash",
	"ark/deepseek-v4-flash",
	"opencode-go/deepseek-v4.1-flash",
	"relay-a/glm-4.6"
], "series must be ranked by the window total, so colours stay stable across renders");
assert.equal(trend.series[4].aggregate, true, "the fifth model folds into the aggregate bucket");
assert.equal(trend.series[4].count, 1);
assert.equal(trend.series[0].label, "L:deepseek-official/deepseek-v4-flash", "series labels come from the injected labeller");
assert.equal(trend.days[0].total, 16, "each sample carries the day total");
assert.equal(trend.days[0].label, "8/1", "each sample carries its axis label");
assert.deepEqual(trend.days[1].values.map((v) => v.value), [40, 8, 2, 0, 1], "each sample breaks down per series, including the aggregate");
assert.equal(trend.max, 40, "the scale is the largest single series value, not the daily total");
for (const day of trend.days) {
	if (day.x < 0 || day.x > trend.width) throw new Error(`sample x escaped the plot: ${day.x}`);
	for (const point of day.points) {
		if (point.y < 0 || point.y > trend.height) throw new Error(`sample y escaped the plot: ${point.y}`);
	}
}
assert.equal(trend.days[0].points[3].y, trend.baseline, "a zero-value series sits exactly on the baseline");
assert.equal(trend.days[1].points[0].y, trend.height - 14 - (trend.plotHeight), "the peak reaches the top of the plot box");
for (const model of trend.series) {
	if (typeof model.path !== "string" || !model.path.startsWith("M ")) throw new Error(`series ${model.key} needs a path`);
	if (!model.path.includes(" C ")) throw new Error("series must be smoothed, not a polyline");
}
assert.equal(trend.gridLines.length, 4, "four dashed gridlines above the baseline");
for (const line of trend.gridLines) {
	if (line.y < 0 || line.y > trend.baseline) throw new Error("gridlines must stay inside the plot box");
}
if (trend.ticks.length > 5) throw new Error(`date ticks must stay sparse, got ${trend.ticks.length}`);
assert.equal(trend.ticks[0].key, trendKeys[0], "the first tick is the window's first day");
assert.equal(trend.ticks.at(-1).key, trendKeys.at(-1), "the last tick is the window's last day, i.e. today");
// A single-day window must not divide by zero.
const oneDay = buildDailyTrend(trendDays, ["2026-08-02"]);
assert.equal(oneDay.days.length, 1);
assert.equal(oneDay.days[0].x, 0);
if (smoothPath([]) !== "" || smoothPath([{ x: 1, y: 2 }]) !== "M 1 2") throw new Error("the spline helper must be defensive about short inputs");
console.log("daily trend series ok:", trend.series.length, "series,", trend.days.length, "days,", trend.ticks.length, "ticks");

// The model share behind the donut covers the SAME window.
const share = buildModelShare(trendDays, trendKeys);
assert.equal(share.total, 132, "the share denominator is the sum of every model-day bucket");
assert.deepEqual(share.items.map((item) => item.key), [
	"deepseek-official/deepseek-v4-flash",
	"ark/deepseek-v4-flash",
	"opencode-go/deepseek-v4.1-flash",
	"relay-a/glm-4.6",
	"relay-b/qwen3"
], "a five-model window needs no aggregate bucket");
assert.equal(share.items[0].tokens, 75);
assert.equal(share.items[0].percent, 57);
assert.equal(share.items.reduce((sum, item) => sum + item.tokens, 0), share.total, "the slices must add up to the total");
const cappedShare = buildModelShare(trendDays, trendKeys, { limit: 3 });
assert.equal(cappedShare.items.length, 4, "the capped ranking keeps its aggregate bucket");
assert.equal(cappedShare.items[3].aggregate, true);
assert.equal(cappedShare.items[3].count, 2);
assert.equal(cappedShare.items.reduce((sum, item) => sum + item.tokens, 0), cappedShare.total, "aggregating must not lose tokens");
assert.equal(buildModelShare(new Map(), weekKeys).items.length, 0, "an empty window produces no slices");
assert.equal(buildModelShare(new Map(), weekKeys).total, 0);

// Donut geometry: dash segments must tile the circumference exactly once. The
// legend percentages are independently rounded, so the arcs must NOT use them.
const segments = donutSegments(share.items, 52, share.total);
const circumference = Number((2 * Math.PI * 52).toFixed(2));
assert.equal(segments[0].offset, 0, "the first slice starts at the top of the ring");
assert.equal(segments[0].circumference, circumference);
let consumed = 0;
for (const [index, segment] of segments.entries()) {
	if (Math.abs(segment.offset - -consumed) > 0.01) throw new Error(`slice ${index} must start where slice ${index - 1} ended`);
	consumed += segment.length;
}
if (Math.abs(consumed - circumference) > 0.01) throw new Error(`donut slices must tile the ring, consumed ${consumed} of ${circumference}`);
assert.equal(segments[0].length, Number((share.items[0].tokens / share.total * circumference).toFixed(2)), "arc length must come from the exact token fraction");
const roundedSum = share.items.reduce((sum, item) => sum + item.percent, 0);
if (roundedSum === 100) throw new Error("this fixture is only meaningful while the rounded percentages overshoot 100");
if (Math.abs(consumed - circumference) > 0.01) throw new Error("a legend whose percentages overshoot must still close the ring");
console.log("model share donut ok:", share.items.length, "slices, total", share.total, "| rounded % sum", roundedSum);

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

// The header row carries a range switch and a view switch, in that order, so
// neither costs a row of its own. The month arrows only page the calendar, so
// they are absent in the trend view. The trend is the default.
const rangeButtons = renderer.root.findAll((node) => typeof node.props?.["data-range"] === "string");
assert.deepEqual(rangeButtons.map((node) => node.props["data-range"]), ["week", "month"], "the range switch offers a week first, then a month");
assert.equal(rangeButtons[0].props["aria-pressed"], true, "the 7-day window is the default");
const viewButtons = renderer.root.findAll((node) => typeof node.props?.["data-view"] === "string");
assert.deepEqual(viewButtons.map((node) => node.props["data-view"]), ["curve", "heat"], "the view switch offers the curve first, then the calendar");
assert.equal(viewButtons[0].props["aria-pressed"], true, "the trend is the default view");
const monthHeader = renderer.root.findByProps({ className: "usg_heatHeader" });
const monthNavNode = monthHeader.findByProps({ className: "usg_monthNav" });
const groups = monthNavNode.props.children.filter((child) => child !== null && child !== undefined && child !== false);
assert.equal(groups[0].props["aria-label"], "usage.rangeToggle", "the range group must be the first control on the month row");
assert.equal(groups[1].props["aria-label"], "usage.viewToggle", "the view group must sit immediately right of the range group");
assert.equal(groups.length, 2, "the trend view must not render the calendar's month arrows");
assert.equal(renderer.root.findAll((node) => node.props?.className === "usg_heatRow").length, 0, "the calendar stays hidden while the trend is selected");

// The trend: one smoothed path per series, a legend, gridlines and a date axis.
const trendSvg = renderer.root.findAllByType("svg").find((node) => node.props?.className === "usg_trendSvg");
if (trendSvg === undefined) throw new Error("the default view must render the trend plot");
const seriesPaths = trendSvg.findAll((node) => typeof node.props?.["data-trend-series"] === "string");
assert.deepEqual(seriesPaths.map((node) => node.props["data-trend-series"]), ["deepseek-official/deepseek-v4-flash", "ark/deepseek-v4-flash"], "one path per model series");
for (const path of seriesPaths) {
	if (typeof path.props.d !== "string" || !path.props.d.includes(" C ")) throw new Error("each trend series must be a smoothed spline, not a polyline");
	if (typeof path.props.stroke !== "string" || !path.props.stroke.startsWith("#")) throw new Error("each series needs its own colour");
}
if (new Set(seriesPaths.map((node) => node.props.stroke)).size !== seriesPaths.length) throw new Error("two series must not share a colour");
assert.equal(trendSvg.findAllByType("line").filter((node) => node.props.strokeDasharray === "3 4").length, 4, "the plot needs four dashed gridlines");
const legendDots = renderer.root.findAll((node) => node.props?.className === "usg_trendLegendDot");
assert.equal(legendDots.length, 2, "the legend lists every series");
const legendItems = renderer.root.findAll((node) => typeof node.props?.["data-series"] === "string");
assert.deepEqual(legendItems.map((node) => node.props["data-series"]), ["deepseek-official/deepseek-v4-flash", "ark/deepseek-v4-flash"]);
const axisTicks = renderer.root.findAll((node) => node.props?.className === "usg_trendAxisTick");
if (axisTicks.length < 2 || axisTicks.length > 7) throw new Error(`the date axis needs a sparse tick set, got ${axisTicks.length}`);
for (const tick of axisTicks) {
	if (typeof tick.props.style.left !== "string" || !tick.props.style.left.endsWith("%")) throw new Error("axis ticks must be positioned by percentage");
}
// The window is 7 days by default and ends TODAY: the last hit target is today,
// which is the user's complaint about the axis running past the data.
const dayHits = renderer.root.findAll((node) => typeof node.props?.["data-trend-day"] === "string");
assert.equal(dayHits.length, 7, "the default 7-day window renders seven hover targets");
assert.equal(dayHits.at(-1).props["data-trend-day"], todayKeyOf(), "the window's last sample must be today");
assert.equal(axisTicks.at(-1).props.children, `${new Date().getMonth() + 1}/${new Date().getDate()}`, "the axis must end on today's date");

// Hovering a day shows the per-model breakdown card; leaving hides it.
assert.equal(renderer.root.findAll((node) => node.props?.className === "usg_trendTooltip").length, 0, "the hover card is not rendered before hover");
await act(async () => {
	dayHits[dayHits.length - 1].props.onMouseEnter();
	await Promise.resolve();
});
const tooltip = renderer.root.findByProps({ className: "usg_trendTooltip" });
assert.equal(tooltip.props.role, "status", "the hover card must announce its content");
const tooltipRows = tooltip.findAll((node) => node.props?.className === "usg_trendTooltipRow");
assert.equal(tooltipRows.length, 2, "the hover card lists every non-zero series for that day");
const tooltipTitle = tooltip.findByProps({ className: "usg_trendTooltipTitle" });
assert.equal(tooltipTitle.props.children, "usage.tooltipTitle", "the title is the localized date+total string");
await act(async () => {
	trendSvg.props.onMouseLeave();
	await Promise.resolve();
});
assert.equal(renderer.root.findAll((node) => node.props?.className === "usg_trendTooltip").length, 0, "leaving the plot must hide the hover card");

// The model-share donut sits where the 14-day list used to, with a hover card
// and a two-way highlight against its legend.
const donutSlices = renderer.root.findAll((node) => typeof node.props?.["data-donut-slice"] === "string");
assert.deepEqual(donutSlices.map((node) => node.props["data-donut-slice"]), ["deepseek-official/deepseek-v4-flash", "ark/deepseek-v4-flash"], "the ring has one slice per model");
const donutItems = renderer.root.findAll((node) => typeof node.props?.["data-donut-item"] === "string");
assert.deepEqual(donutItems.map((node) => node.props["data-donut-item"]), ["deepseek-official/deepseek-v4-flash", "ark/deepseek-v4-flash"], "the legend mirrors the ring");
assert.equal(renderer.root.findAll((node) => node.props?.["data-donut-tooltip"]).length, 0, "no slice card before hover");
await act(async () => {
	donutSlices[0].props.onMouseEnter();
	await Promise.resolve();
});
const donutTooltip = renderer.root.findByProps({ "data-donut-tooltip": "deepseek-official/deepseek-v4-flash" });
const tooltipName = donutTooltip.findByProps({ className: "usg_donutTooltipName" });
assert.equal(tooltipName.props.children, "deepseek-official · deepseek-v4-flash", "the card names the hovered model");
const tooltipValue = donutTooltip.findByProps({ className: "usg_donutTooltipFigures" });
assert.equal(tooltipValue.props.children[0].props.children, "30M", "the card shows the hovered slice's consumption");
assert.equal(tooltipValue.props.children[1].props.children, "89%", "and its share");
// Slice hover must highlight the matching legend row...
assert.equal(renderer.root.findByProps({ "data-donut-item": "deepseek-official/deepseek-v4-flash" }).props["data-active"], "true", "hovering a slice must highlight its legend row");
assert.equal(renderer.root.findByProps({ "data-donut-item": "ark/deepseek-v4-flash" }).props["data-active"], void 0, "and only that row");
// ...and the slice itself must thicken.
assert.equal(renderer.root.findByProps({ "data-donut-slice": "deepseek-official/deepseek-v4-flash" }).props["data-active"], "true", "the hovered slice must be visually distinct");
// Legend hover must drive the slice the other way round.
await act(async () => {
	renderer.root.findByProps({ "data-donut-item": "ark/deepseek-v4-flash" }).props.onMouseEnter();
	await Promise.resolve();
});
assert.equal(renderer.root.findByProps({ "data-donut-slice": "ark/deepseek-v4-flash" }).props["data-active"], "true", "hovering a legend row must highlight its slice");
assert.equal(renderer.root.findByProps({ "data-donut-slice": "deepseek-official/deepseek-v4-flash" }).props["data-active"], void 0, "and clear the previous one");
await act(async () => {
	renderer.root.findByProps({ "data-donut-item": "ark/deepseek-v4-flash" }).props.onMouseLeave();
	await Promise.resolve();
});
assert.equal(renderer.root.findAll((node) => node.props?.["data-donut-tooltip"]).length, 0, "leaving the legend must hide the card");
const donutTotal = renderer.root.findByProps({ className: "usg_donutTotal" });
assert.equal(donutTotal.props.children, "33.8M", "the ring centre shows the abbreviated window total");
const donutValues = donutItems.map((item) => item.findAll((node) => node.props?.className === "usg_donutItemValue")[0].props.children);
assert.deepEqual(donutValues, ["30M", "3.8M"], "each legend row shows its token count");
const donutMeta = donutItems.map((item) => item.findAll((node) => node.props?.className === "usg_donutItemMeta")[0].props.children);
assert.deepEqual(donutMeta, ["89%", "11%"], "each legend row shows its share");
assert.equal(renderer.root.findAll((node) => node.props?.["data-model-rank"]).length, 0, "the retired today-by-model list must be gone");

// The retired 14-day list must not come back.
assert.equal(renderer.root.findAll((node) => node.props?.className === "usg_day").length, 0, "the 14-day list is gone");

// Switching the range re-windows both charts; the month arrows appear with the
// calendar view only.
await act(async () => {
	rangeButtons[1].props.onClick();
	await flushPanelEffects();
});
assert.equal(renderer.root.findAll((node) => node.props?.["data-trend-day"]).length, 30, "the month range renders a 30-day window");
assert.equal(renderer.root.findAll((node) => node.props?.["data-trend-day"]).at(-1).props["data-trend-day"], todayKeyOf(), "and it still ends today");
assert.equal(readStoredRange(localStorage), "month", "the range choice must persist");
await act(async () => {
	rangeButtons[0].props.onClick();
	await flushPanelEffects();
});
assert.equal(renderer.root.findAll((node) => node.props?.["data-trend-day"]).length, 7, "switching back restores the 7-day window");
assert.equal(readStoredRange(localStorage), "week");

// Month navigation belongs to the calendar.
await act(async () => {
	renderer.root.findAll((node) => node.props?.["data-view"] === "heat")[0].props.onClick();
	await flushPanelEffects();
});
assert.equal(renderer.root.findAll((node) => node.props?.className === "usg_heatRow").length > 0, true, "selecting the calendar renders the grid");
assert.equal(renderer.root.findAll((node) => node.props?.className === "usg_trendSvg").length, 0, "the trend is replaced, not stacked");
assert.equal(renderer.root.findAll((node) => node.props?.["aria-label"] === "action.prevMonth").length, 1, "the calendar view restores the month arrows");
assert.equal(readStoredView(localStorage), "heat", "switching the view must persist the choice");
await act(async () => {
	renderer.root.findAll((node) => node.props?.["data-view"] === "curve")[0].props.onClick();
	await flushPanelEffects();
});
assert.equal(readStoredView(localStorage), "curve", "switching back must persist too");
assert.equal(renderer.root.findAll((node) => node.props?.["aria-label"] === "action.prevMonth").length, 0, "the trend view hides the month arrows again");


// Clicking a trend point opens that day's detail, exactly like a heatmap cell.
const refreshedHits = renderer.root.findAll((node) => typeof node.props?.["data-trend-day"] === "string");
await act(async () => {
	refreshedHits.find((node) => node.props["data-trend-day"] === todayKeyOf()).props.onClick();
	await flushPanelEffects();
});
const detail = renderer.root.findAll((node) => node.props?.className === "usg_detailSummary");
assert.equal(detail.length, 1, "clicking a trend point must open the day detail");
if (!String(detail[0].props.children).includes("33.8M")) throw new Error("the day detail must abbreviate too");
await act(async () => {
	renderer.root.findByProps({ "aria-label": "usage.back" }).props.onClick();
	await Promise.resolve();
});

// Closing and reopening restores the persisted view.
await act(async () => {
	renderer.root.findByProps({ "aria-label": "action.close" }).props.onClick();
	await Promise.resolve();
});
await act(async () => {
	renderer.root.findByProps({ "data-usage-stats-badge": true }).props.onClick();
	await flushPanelEffects();
});
assert.equal(renderer.root.findAll((node) => node.props?.className === "usg_trendSvg").length, 1, "reopening must restore the persisted trend view");

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

// An empty month must still render the shell, with empty-state copy instead of a
// broken ring or an axis with no samples.
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
if (emptyRenderer.root.findAllByProps({ "data-usage-stats-panel": true }).length !== 1) throw new Error("an empty usage response must still open the panel");
assert.equal(emptyRenderer.root.findAll((node) => node.props?.["data-donut-slice"]).length, 0, "an empty month must not draw donut slices");
assert.equal(emptyRenderer.root.findAll((node) => node.props?.["className"] === "usg_donutEmpty").length >= 1, true, "an empty month must explain itself");
assert.equal(emptyRenderer.root.findAll((node) => node.props?.["className"] === "usg_trendEmpty").length, 1, "an empty trend must explain itself");
await act(async () => { emptyRenderer.unmount(); });
globalThis.fetch = originalFetch;

console.log("sidebar-only usage panel, shared-row view toggle, trend chart and donut ok");
console.log("SMOKE TEST PASSED");
