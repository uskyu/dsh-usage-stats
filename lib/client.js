/**
 * dsh-usage-stats — browser half.
 *
 * Hand-written `__ModuleLoader__` bundle (no build step): a sidebar footer
 * action that opens a floating panel with a Codex-style blue daily token-usage
 * heatmap (switchable to a smooth daily curve), a "today by model" ranking,
 * per-day provider/model breakdowns, and cache hit rates. Data comes from the
 * server half's loopback-only usage endpoint via same-origin fetch.
 *
 * Token counts render through `fmt`, which keeps anything below 10,000 exact
 * and abbreviates larger values as K/M/B; the exact value stays available as a
 * `title` tooltip on the same element.
 */
window.__ModuleLoader__.load({
	id: "@uskyu/dsh-usage-stats",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		//#region icon resolution
		/**
		 * The harness icon set moved the rendered size out of the export name
		 * (`IconCloseOutline16` → `IconCloseOutlineRegular`, size as a prop) and
		 * dropped several glyphs, so a hard reference to one spelling turns a host
		 * upgrade into a render-time throw and the panel disappears. Each glyph is
		 * resolved by every known spelling, with an inline path as the last resort.
		 */
		const fallbackIcon = (path) => function FallbackIcon(props) {
			const size = props !== null && props !== void 0 && typeof props.size === "number" ? props.size : 16;
			return react.createElement("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true"
			}, react.createElement("path", { d: path }));
		};

		/** First exported spelling of one glyph, or the inline fallback. */
		const resolveIcon = (names, path) => {
			for (const name of names) {
				if (typeof primitives[name] === "function") return primitives[name];
			}
			return fallbackIcon(path);
		};

		const IconData = resolveIcon(["IconDataOutline16", "IconDataOutlineRegular"], "M2.5 13.5h11M4.5 13.5V8.5m4 5V4.5m4 9v-3");
		const IconRefresh = resolveIcon(["IconRefreshOutline14", "IconRefreshOutlineRegular"], "M13 8a5 5 0 1 1-1.6-3.7M13 2.5V5h-2.6");
		const IconClose = resolveIcon(["IconCloseOutline16", "IconCloseOutlineRegular"], "M4 4l8 8M12 4l-8 8");
		const IconChevronLeft = resolveIcon(["IconChevronLeftOutline14", "IconChevronLeftOutlineRegular"], "M9.5 3.5 5.5 8l4 4.5");
		const IconChevronRight = resolveIcon(["IconChevronRightOutline14", "IconChevronRightOutlineRegular"], "M6.5 3.5 10.5 8l-4 4.5");
		const Tooltip = typeof primitives.Tooltip === "function"
			? primitives.Tooltip
			: function FallbackTooltip(props) {
				return react.createElement(react.Fragment, null, props !== null && props !== void 0 ? props.children ?? null : null);
			};
		//#endregion

		//#region css
		const css = [
			".usg_layer{flex:none;align-items:center;width:calc(100% + 4px);height:42px;margin:4px -2px;display:flex;position:relative}",
			".usg_footerButtons{align-items:center;width:100%;display:flex}",
			".usg_badge{box-sizing:border-box;width:100%;height:42px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:12px;align-items:center;gap:8px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}",
			".usg_badge:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_badge[data-active]{background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_badgeLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}",
			".usg_badgeCount{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;margin-left:auto;font-size:12px;line-height:16px}",
			".usg_layer.usg_rail{width:36px;height:36px;margin:0}",
			".usg_layer.usg_rail .usg_badge{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;padding:0}",
			".usg_layer.usg_rail .usg_footerButtons{flex-direction:column;gap:2px}",
			".usg_badge:focus-visible,.usg_iconButton:focus-visible,.usg_retry:focus-visible,.usg_exportLink:focus-visible,.usg_navButton:focus-visible,.usg_todayButton:focus-visible,.usg_back:focus-visible,.usg_viewToggleButton:focus-visible,.usg_trendHit:focus-visible,.usg_cell:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
			// Panel surface: the official elevated-menu skin (menu colour, r12,
			// prominent elevation) that the built-in stat dialogs and menus use.
			// 0.1.7 made --dsw-specific-menu translucent (dark 0.5 / light 0.58) and
			// pairs it with `backdrop-filter: var(--dsw-menu-backdrop-filter)`
			// (blur(40px) saturate(150%)). Earlier builds define no blur token — the
			// declaration then fails at computed-value time and backdrop-filter stays
			// `none` — and keep an opaque menu colour, so the official colour shows
			// through with no version check.
			".usg_panel{z-index:100;box-sizing:border-box;border:0;background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base)));backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent,var(--dsw-shadow-lv2));width:440px;max-width:calc(100vw - 24px);max-height:74vh;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);--usg-blue:#1f6feb;--usg-cellEmpty:rgba(128,128,128,0.16);border-radius:12px;flex-direction:column;display:flex;position:fixed;bottom:128px;left:12px;overflow:hidden}",
			// The header paints no surface of its own: an opaque band would cover the
			// glass the panel surface just established.
			".usg_header{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;justify-content:space-between;align-items:center;min-height:44px;padding:10px 12px;display:flex}",
			".usg_headerLeft{align-items:center;gap:8px;display:flex}",
			".usg_title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px}",
			".usg_headerActions{align-items:center;gap:2px;display:flex}",
			".usg_iconButton{cursor:pointer;width:26px;height:26px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex}",
			".usg_iconButton:hover{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_body{flex:1;min-height:0;padding:4px 14px 14px;overflow-y:auto}",
			".usg_section{margin-top:12px}",
			".usg_sectionTitle{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;margin:0 0 6px}",
			".usg_note{color:var(--dsw-alias-label-tertiary);margin:4px 0;font-size:12px;line-height:18px}",
			".usg_error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-radius:8px;justify-content:space-between;align-items:flex-start;gap:8px;margin:4px 0;padding:7px 8px;font-size:12px;line-height:18px;display:flex}",
			".usg_retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0}",
			".usg_exportLinks{display:flex;flex-wrap:wrap;gap:6px}",
			".usg_exportLink{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-fill-l1,transparent);border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:4px 7px;font-size:11px;line-height:16px;text-decoration:none}",
			".usg_exportLink:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_statsRow{display:flex;gap:8px}",
			".usg_stat{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;flex:1;flex-direction:column;gap:1px;padding:8px 10px;display:flex}",
			".usg_statValue{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:22px;font-variant-numeric:tabular-nums;white-space:nowrap}",
			".usg_statLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
			".usg_hitCaption{color:var(--dsw-alias-label-tertiary);margin-top:6px;font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			".usg_hitCaption b{color:var(--dsw-alias-label-secondary);font-weight:600}",
			".usg_heat{overflow-x:auto}",
			".usg_heatHeader{justify-content:space-between;align-items:center;margin-bottom:6px;display:flex}",
			".usg_heatHeader .usg_sectionTitle{flex:none;margin:0}",
			".usg_monthNav{align-items:center;gap:2px;display:flex}",
			".usg_navButton{cursor:pointer;width:24px;height:24px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex}",
			".usg_navButton:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_navButton:disabled{color:var(--dsw-alias-label-caption);cursor:default}",
			".usg_monthTitle{color:var(--dsw-alias-label-primary);min-width:88px;font-size:12px;font-weight:500;line-height:24px;text-align:center;font-variant-numeric:tabular-nums}",
			".usg_todayButton{cursor:pointer;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;padding:0 6px;font-size:11px;line-height:24px}",
			".usg_todayButton:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_monthGrid{flex-direction:column;gap:4px;width:100%;display:flex}",
			".usg_weekHeader{color:var(--dsw-alias-label-tertiary);grid-template-columns:repeat(7,1fr);gap:4px;display:grid}",
			".usg_weekLabel{font-size:10px;line-height:16px;text-align:center}",
			".usg_heatRow{grid-template-columns:repeat(7,1fr);gap:4px;display:grid}",
			".usg_cell{aspect-ratio:1/1;min-width:0;width:100%;border-radius:8px;background:var(--usg-cellEmpty);border:0;padding:0;cursor:pointer;justify-content:center;align-items:center;font-family:inherit;display:flex}",
			".usg_cell:hover{box-shadow:0 0 0 1px var(--dsw-alias-label-secondary)}",
			".usg_cellToday{box-shadow:0 0 0 1px var(--usg-blue)}",
			".usg_cellToday:hover{box-shadow:0 0 0 1px var(--usg-blue)}",
			".usg_cellSelected{box-shadow:0 0 0 2px var(--dsw-alias-label-primary)}",
			".usg_cellSelected:hover{box-shadow:0 0 0 2px var(--dsw-alias-label-primary)}",
			".usg_cellDay{font-size:12px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;pointer-events:none}",
			".usg_emptyCell{aspect-ratio:1/1;min-width:0;width:100%}",
			".usg_legend{align-items:center;gap:4px;margin-top:6px;font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);display:flex}",
			".usg_legendSwatch{width:10px;height:10px;border-radius:2px;background:var(--dsw-alias-fill-l2)}",
			".usg_days{flex-direction:column;display:flex}",
			// Heatmap ⇄ curve toggle. It lives on the month header row, to the left
			// of the month switcher, so it costs no vertical space of its own.
			".usg_viewToggle{align-items:center;background:var(--dsw-alias-fill-l2,transparent);border-radius:7px;gap:1px;padding:1px;margin-right:2px;display:inline-flex;flex:none}",
			".usg_viewToggleButton{cursor:pointer;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;padding:2px 8px;font:inherit;font-size:11px;line-height:16px}",
			".usg_viewToggleButton:hover{color:var(--dsw-alias-label-primary)}",
			".usg_viewToggleButton[data-active]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base)));font-weight:500}",
			// Daily trend: one smooth coloured line per model over the month, with
			// a legend above and dashed gridlines behind. The plot is a fixed
			// viewBox stretched to the panel width, so no measurement is needed.
			".usg_trend{position:relative;padding:2px 0 0}",
			".usg_trendLegend{flex-wrap:wrap;gap:4px 12px;margin-bottom:4px;display:flex}",
			".usg_trendLegendItem{align-items:center;gap:5px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;display:inline-flex}",
			".usg_trendLegendDot{border-radius:50%;width:8px;height:8px;flex:none}",
			".usg_trendSvg{display:block;width:100%;height:auto;overflow:visible}",
			// The hit layer overlays the plot: the SVG is inert, these buttons own
			// hover and click. Negative margins pull them up over the SVG without
			// needing absolute coordinates.
			".usg_trendHits{height:0;display:flex;position:relative;z-index:1}",
			".usg_trendHit{cursor:pointer;background:0 0;border:none;padding:0;height:78px;margin-top:-78px;flex:none}",
			".usg_trendEmpty{color:var(--dsw-alias-label-tertiary);margin:4px 0;font-size:12px;line-height:18px}",
			".usg_trendAxisRow{margin-top:4px;height:14px;position:relative}",
			".usg_trendAxisTick{color:var(--dsw-alias-label-caption);white-space:nowrap;font-size:9px;line-height:14px;font-variant-numeric:tabular-nums;position:absolute;transform:translateX(-50%)}",
			// Hover card: absolutely positioned over the plot, so the SVG keeps a
			// single coordinate system and the card can use normal text layout.
			".usg_trendTooltip{color:var(--dsw-alias-label-primary);background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base)));border:1px solid var(--dsw-alias-border-l2);border-radius:8px;box-shadow:var(--dsw-elevation-prominent,var(--dsw-shadow-lv2));top:18px;padding:7px 9px;font-size:11px;line-height:16px;display:flex;flex-direction:column;gap:3px;position:absolute;pointer-events:none;min-width:132px;z-index:1}",
			".usg_trendTooltipTitle{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
			".usg_trendTooltipRow{align-items:center;gap:6px;display:flex}",
			".usg_trendTooltipRow b{color:var(--dsw-alias-label-primary);margin-left:auto;font-weight:600;font-variant-numeric:tabular-nums}",
			".usg_trendTooltipDot{border-radius:50%;width:7px;height:7px;flex:none}",
			// Model-share donut: the ring is an SVG of stroked arcs, the legend is a
			// normal list so the percentages stay selectable text.
			".usg_donut{flex-direction:column;gap:10px;display:flex}",
			".usg_donutRow{align-items:center;gap:14px;display:flex}",
			// The ring and its hover card share a positioning context.
			".usg_donutChart{width:128px;height:128px;flex:none;position:relative}",
			".usg_donutSvg{width:128px;height:128px;display:block}",
			".usg_donutSvg circle[data-donut-slice]{cursor:pointer;transition:stroke-width .12s ease}",
			// Hover card for a slice. It replaces the centre total while hovering:
			// the ring box is only 128px wide and the panel clips its content, so a
			// card hanging off the ring would be cut on the left. Two compact lines
			// keep it inside the ring, and the highlighted legend row beside it
			// carries the full model name.
			".usg_donutTooltip{color:var(--dsw-alias-label-primary);background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base)));border:1px solid var(--dsw-alias-border-l2);border-radius:8px;box-shadow:var(--dsw-elevation-prominent,var(--dsw-shadow-lv2));top:50%;left:50%;padding:4px 6px;font-size:10px;line-height:14px;flex-direction:column;align-items:center;gap:1px;display:flex;position:absolute;transform:translate(-50%,-50%);max-width:124px;text-align:center;pointer-events:none;z-index:1}",
			".usg_donutTooltipHead{align-items:center;gap:4px;max-width:100%;display:flex}",
			".usg_donutTooltipDot{border-radius:50%;width:6px;height:6px;flex:none}",
			".usg_donutTooltipName{color:var(--dsw-alias-label-secondary);min-width:0;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}",
			".usg_donutTooltipFigures{color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;display:flex;gap:4px}",
			".usg_donutTooltipShare{color:var(--dsw-alias-label-tertiary);font-weight:400}",
			".usg_donutTotal{fill:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}",
			".usg_donutTotalCaption{fill:var(--dsw-alias-label-tertiary);font-size:8px}",
			".usg_donutList{min-width:0;flex:1;flex-direction:column;display:flex}",
			".usg_donutItem{align-items:center;gap:7px;border-bottom:1px solid var(--dsw-alias-border-l1);border-radius:5px;padding:5px 4px;display:flex;transition:background .12s ease}",
			".usg_donutItem:last-child{border-bottom:0}",
			".usg_donutItem[data-active]{background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_donutItemDot{border-radius:50%;width:8px;height:8px;flex:none}",
			".usg_donutItemName{color:var(--dsw-alias-label-secondary);min-width:0;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px;line-height:18px;overflow:hidden}",
			".usg_donutItemValue{color:var(--dsw-alias-label-primary);flex:none;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".usg_donutItemMeta{color:var(--dsw-alias-label-caption);flex:none;width:38px;text-align:right;font-size:11px;line-height:18px;font-variant-numeric:tabular-nums}",
			".usg_donutEmpty{color:var(--dsw-alias-label-tertiary);margin:4px 0;font-size:12px;line-height:18px}",
			".usg_detailHeader{align-items:center;gap:8px;display:flex}",
			".usg_back{cursor:pointer;width:26px;height:26px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex;flex:none}",
			".usg_back:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_detailDate{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px}",
			".usg_detailHit{color:var(--dsw-alias-label-tertiary);margin-left:auto;font-size:11px;line-height:20px;font-variant-numeric:tabular-nums}",
			".usg_detailSummary{color:var(--dsw-alias-label-secondary);margin:6px 0 8px;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".usg_modelRow{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;margin-bottom:8px;padding:8px 10px;display:flex;flex-direction:column;gap:4px}",
			".usg_modelRow:last-child{margin-bottom:0}",
			".usg_modelHead{align-items:center;gap:8px;display:flex}",
			".usg_modelName{color:var(--dsw-alias-label-primary);min-width:0;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px;font-weight:500;line-height:18px;overflow:hidden}",
			".usg_modelTokens{color:var(--dsw-alias-label-primary);flex:none;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".usg_modelHit{color:var(--dsw-alias-label-tertiary);flex:none;width:56px;font-size:11px;line-height:18px;font-variant-numeric:tabular-nums;text-align:right}",
			".usg_modelBarTrack{background:var(--dsw-alias-fill-l2);border-radius:2px;height:5px;overflow:hidden}",
			".usg_modelBar{background:var(--usg-blue);border-radius:2px;height:5px}",
			".usg_modelMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			".usg_footerNote{color:var(--dsw-alias-label-caption);margin-top:10px;font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}"
		].join("");
		const tagId = "dsh-usage-stats/UsageStats.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@uskyu/dsh-usage-stats";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		const S = {
			layer: "usg_layer",
			rail: "usg_rail",
			footerButtons: "usg_footerButtons",
			badge: "usg_badge",
			badgeLabel: "usg_badgeLabel",
			badgeCount: "usg_badgeCount",
			panel: "usg_panel",
			header: "usg_header",
			headerLeft: "usg_headerLeft",
			title: "usg_title",
			headerActions: "usg_headerActions",
			iconButton: "usg_iconButton",
			body: "usg_body",
			section: "usg_section",
			sectionTitle: "usg_sectionTitle",
			note: "usg_note",
			error: "usg_error",
			retry: "usg_retry",
			exportLinks: "usg_exportLinks",
			exportLink: "usg_exportLink",
			statsRow: "usg_statsRow",
			stat: "usg_stat",
			statValue: "usg_statValue",
			statLabel: "usg_statLabel",
			hitCaption: "usg_hitCaption",
			heat: "usg_heat",
			heatHeader: "usg_heatHeader",
			monthNav: "usg_monthNav",
			navButton: "usg_navButton",
			monthTitle: "usg_monthTitle",
			todayButton: "usg_todayButton",
			monthGrid: "usg_monthGrid",
			weekHeader: "usg_weekHeader",
			weekLabel: "usg_weekLabel",
			heatRow: "usg_heatRow",
			cell: "usg_cell",
			cellSelected: "usg_cellSelected",
			cellToday: "usg_cellToday",
			cellDay: "usg_cellDay",
			emptyCell: "usg_emptyCell",
			legend: "usg_legend",
			legendSwatch: "usg_legendSwatch",
			days: "usg_days",
			viewToggle: "usg_viewToggle",
			viewToggleButton: "usg_viewToggleButton",
			trend: "usg_trend",
			trendLegend: "usg_trendLegend",
			trendLegendItem: "usg_trendLegendItem",
			trendLegendDot: "usg_trendLegendDot",
			trendSvg: "usg_trendSvg",
			trendHits: "usg_trendHits",
			trendHit: "usg_trendHit",
			trendEmpty: "usg_trendEmpty",
			trendAxisRow: "usg_trendAxisRow",
			trendAxisTick: "usg_trendAxisTick",
			trendTooltip: "usg_trendTooltip",
			trendTooltipTitle: "usg_trendTooltipTitle",
			trendTooltipRow: "usg_trendTooltipRow",
			trendTooltipDot: "usg_trendTooltipDot",
			donut: "usg_donut",
			donutRow: "usg_donutRow",
			donutChart: "usg_donutChart",
			donutSvg: "usg_donutSvg",
			donutTooltip: "usg_donutTooltip",
			donutTooltipHead: "usg_donutTooltipHead",
			donutTooltipDot: "usg_donutTooltipDot",
			donutTooltipName: "usg_donutTooltipName",
			donutTooltipFigures: "usg_donutTooltipFigures",
			donutTooltipShare: "usg_donutTooltipShare",
			donutTotal: "usg_donutTotal",
			donutTotalCaption: "usg_donutTotalCaption",
			donutList: "usg_donutList",
			donutItem: "usg_donutItem",
			donutItemDot: "usg_donutItemDot",
			donutItemName: "usg_donutItemName",
			donutItemValue: "usg_donutItemValue",
			donutItemMeta: "usg_donutItemMeta",
			donutEmpty: "usg_donutEmpty",
			detailHeader: "usg_detailHeader",
			back: "usg_back",
			detailDate: "usg_detailDate",
			detailHit: "usg_detailHit",
			detailSummary: "usg_detailSummary",
			modelRow: "usg_modelRow",
			modelHead: "usg_modelHead",
			modelName: "usg_modelName",
			modelTokens: "usg_modelTokens",
			modelHit: "usg_modelHit",
			modelBarTrack: "usg_modelBarTrack",
			modelBar: "usg_modelBar",
			modelMeta: "usg_modelMeta",
			footerNote: "usg_footerNote"
		};
		//#endregion

		//#region helpers
		/** Local `YYYY-MM-DD` for a Date. */
		function dayKeyOf(date) {
			const month = String(date.getMonth() + 1).padStart(2, "0");
			const day = String(date.getDate()).padStart(2, "0");
			return `${date.getFullYear()}-${month}-${day}`;
		}

		/** Today's local `YYYY-MM-DD`. */
		function todayKey() {
			return dayKeyOf(new Date());
		}

		/** Current month key `YYYY-MM`. */
		function currentMonthKey() {
			const now = new Date();
			return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
		}

		/** Shift a `YYYY-MM` key by a signed month delta. */
		function shiftMonth(key, delta) {
			const [year, month] = key.split("-").map(Number);
			const date = new Date(year, month - 1 + delta, 1);
			return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
		}

		/** Localized `YYYY-MM` → e.g. "2026年8月" / "Aug 2026". */
		function monthLabelOf(key, translate) {
			const [year, month] = key.split("-").map(Number);
			return translate("month.year", { year, month: monthName(month - 1, translate) });
		}

		/**
		 * Token-count display. Anything below 10,000 renders verbatim with
		 * thousands separators; at 10,000 and above it abbreviates to at most four
		 * significant characters plus a K/M/B suffix, so the column never grows to
		 * a wall of digits:
		 *   1234      → "1,234"
		 *   33818571  → "33.8M"
		 *   6246205945 → "6.2B"
		 *   999999999999 → "1T"
		 * The exact value stays available through `fmtExact` as a `title` tooltip.
		 */
		function fmt(n) {
			const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
			const negative = value < 0;
			const abs = Math.abs(value);
			const sign = negative ? "-" : "";
			if (abs < 10000) return `${sign}${String(Math.round(abs)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
			const units = [
				[1e12, "T"],
				[1e9, "B"],
				[1e6, "M"],
				[1e3, "K"]
			];
			const found = units.findIndex(([size]) => abs >= size);
			let index = found < 0 ? units.length - 1 : found;
			// One decimal below 100 (33.8M), none above (338M) — never more than
			// four digits plus the suffix.
			const scaledText = (size) => {
				const scaled = abs / size;
				return scaled >= 100 ? String(Math.round(scaled)) : trimZero(scaled.toFixed(1));
			};
			let text = scaledText(units[index][0]);
			// Rounding can push a value onto the next unit's boundary
			// (999,999,999,999 → "1000B"); promote instead of printing five digits.
			if (Number(text) >= 1000 && index > 0) {
				index -= 1;
				text = scaledText(units[index][0]);
			}
			return `${sign}${text}${units[index][1]}`;
		}

		/** Drop a pointless trailing ".0" ("1.0K" → "1K"). */
		function trimZero(text) {
			return text.endsWith(".0") ? text.slice(0, -2) : text;
		}

		/** Exact grouped form for tooltips and CSV-adjacent surfaces: 33818571 → "33,818,571". */
		function fmtExact(n) {
			const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
			return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		}

		/** Compact form for the collapsed sidebar badge: 1234 → "1.2K". */
		function fmtCompact(n) {
			return fmt(n);
		}

		/** Hit-rate display: null/undefined → "—". */
		function fmtHit(hitRate) {
			return hitRate === null || hitRate === void 0 ? "—" : `${hitRate}%`;
		}

		/** Currency-aware amount: `¥ 36.44` / `$ 12.00` (Intl, fallback keeps the raw value). */
		function fmtCurrency(amount, currency) {
			if (amount === void 0 || amount === null) return "—";
			const numeric = Number(amount);
			if (!Number.isFinite(numeric)) return "—";
			try {
				return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "CNY" }).format(numeric);
			} catch {
				return `${currency ?? "CNY"} ${amount}`;
			}
		}

		function budgetWindowText(period, window, translate) {
			if (window === null || typeof window !== "object" || window.limit === null || window.limit === void 0) return null;
			const spent = window.costComplete === true ? fmtCurrency(window.estimatedSpend, window.currency) : "—";
			const limit = fmtCurrency(window.limit, window.currency);
			const level = ["normal", "warning", "critical"].includes(window.level)
				? translate(`budget.level.${window.level}`)
				: translate("budget.level.unknown");
			return translate("budget.summary", {
				period: translate(`budget.period.${period}`),
				spent,
				limit,
				level
			});
		}

		/**
		 * Per-request staleness guard: each `start()` bumps a private counter and
		 * only the most recent start may `isCurrent()`. Usage and balance each
		 * hold their OWN loader, so the two never invalidate each other (the
		 * shared-counter race that dropped the first usage response).
		 */
		function createLoader() {
			let current = 0;
			return {
				start: () => ++current,
				isCurrent: (id) => id === current
			};
		}


		/** True when a pointer event happened outside both the portaled panel and its sidebar badge. */
		function shouldDismissPanel(path, target, layer, panel) {
			const eventPath = Array.isArray(path) ? path : [];
			const inside = (root) => root !== null && root !== void 0 && (
				eventPath.includes(root)
				|| (target !== null && target !== void 0 && typeof root.contains === "function" && root.contains(target))
			);
			return !inside(layer) && !inside(panel);
		}

		/** Locale-safe template interpolation: `t("key", {a})` replaces `{a}`. */
		function interpolate(template, params) {
			if (params === void 0) return template;
			return template.replace(/\{(\w+)\}/g, (match, key) => (Object.hasOwn(params, key) ? String(params[key]) : match));
		}

		async function fetchJson(path, options = {}) {
			const response = await fetch(path, {
				...options,
				headers: { accept: "application/json", ...options.headers }
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const payload = await response.json();
			if (payload === null || typeof payload !== "object") throw new Error("unexpected response");
			return payload;
		}

		function enableFooterActionWrapping(host) {
			const hostStyle = window.getComputedStyle(host);
			if (!hostStyle.display.includes("flex")
				|| hostStyle.flexDirection.startsWith("column")
				|| hostStyle.flexWrap !== "nowrap") return void 0;
			const previous = host.style.flexWrap;
			host.style.flexWrap = "wrap";
			return () => {
				host.style.flexWrap = previous;
			};
		}

		/**
		 * Build one month's calendar heatmap: weeks as rows (Mon-first), only
		 * the month's own days, padded with null placeholders. Cell tokens come
		 * from the day map; `max` is the month's largest daily total, used for
		 * the absolute log-scale color mapping.
		 * @param dayMap - date key → day entry map.
		 * @param year - calendar year.
		 * @param month - zero-based month.
		 * @returns `{ weeks, max }`.
		 */
		function buildMonthHeatmap(dayMap, year, month) {
			const first = new Date(year, month, 1);
			const daysInMonth = new Date(year, month + 1, 0).getDate();
			const lead = (first.getDay() + 6) % 7; // Monday = 0
			const weeks = [];
			let max = 0;
			for (let w = 0; w * 7 < lead + daysInMonth; w += 1) {
				const week = [];
				for (let d = 0; d < 7; d += 1) {
					const dayNum = w * 7 + d - lead + 1;
					if (dayNum < 1 || dayNum > daysInMonth) {
						week.push(null);
						continue;
					}
					const date = new Date(year, month, dayNum);
					const key = dayKeyOf(date);
					const entry = dayMap.get(key);
					const tokens = entry?.tokens ?? 0;
					week.push({ key, day: dayNum, tokens, hitRate: entry?.cacheHitRate ?? null });
					if (tokens > max) max = tokens;
				}
				weeks.push(week);
			}
			return { weeks, max };
		}

		/**
		 * Codex-style blue cell color: continuous square-root mapping against
		 * the month's max (more tokens → strictly deeper blue, no banding),
		 * rendered as a plain rgba overlay of #1f6feb so it works in every
		 * browser/theme without color-mix support. Zero is the neutral gray
		 * "empty" cell. Returns the cell's background and text color.
		 */
		const BLUE_RGB = [31, 111, 235];
		function cellColor(tokens, max) {
			if (tokens <= 0) {
				return {
					background: "var(--usg-cellEmpty)",
					color: "var(--dsw-alias-label-secondary)"
				};
			}
			const ratio = max > 0 ? Math.sqrt(tokens / max) : 1;
			const alpha = Math.min(1, 0.22 + 0.78 * ratio);
			return {
				background: `rgba(${BLUE_RGB[0]}, ${BLUE_RGB[1]}, ${BLUE_RGB[2]}, ${alpha.toFixed(3)})`,
				color: alpha >= 0.6 ? "rgba(255,255,255,0.95)" : "var(--dsw-alias-label-primary)"
			};
		}

		// Curve geometry in SVG user units. The viewBox is fixed and the SVG is
		// stretched to the panel width, so no measurement or resize observer is
		// needed; `vector-effect` keeps the stroke 1:1 on screen.
		const CURVE_WIDTH = 320;
		const CURVE_HEIGHT = 96;
		const CURVE_PAD_TOP = 8;
		const CURVE_PAD_BOTTOM = 14;

		/**
		 * Catmull-Rom → cubic Bézier. `tension` 0 is a straight polyline, 0.5 is
		 * the classic cardinal spline, and larger values push the control points
		 * further out so a direction change (a valley between two peaks, an
		 * ending spike) reads as a wide U instead of a sharp V. 1 is the sweet
		 * spot here: rounder joins without the overshoot turning into a visible
		 * ripple on a spike.
		 *
		 * Control points stay clamped to the plot box, so a steep pair can never
		 * push the stroke above the top padding or below the baseline.
		 */
		const CURVE_TENSION = 1;

		function smoothPath(points, tension = CURVE_TENSION) {
			if (!Array.isArray(points) || points.length === 0) return "";
			if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
			const clampY = (y) => Math.max(CURVE_PAD_TOP, Math.min(CURVE_HEIGHT - CURVE_PAD_BOTTOM, y));
			let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
			for (let i = 0; i < points.length - 1; i += 1) {
				const p0 = points[i - 1] ?? points[i];
				const p1 = points[i];
				const p2 = points[i + 1];
				const p3 = points[i + 2] ?? p2;
				const c1x = p1.x + (p2.x - p0.x) * tension / 3;
				const c1y = clampY(p1.y + (p2.y - p0.y) * tension / 3);
				const c2x = p2.x - (p3.x - p1.x) * tension / 3;
				const c2y = clampY(p2.y - (p3.y - p1.y) * tension / 3);
				path += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
			}
			return path;
		}

		/**
		 * A fixed, colour-blind-reasonable categorical palette. Series keep their
		 * colour by rank within a month, and the aggregate bucket is always grey so
		 * it reads as "everything else" rather than another model.
		 */
		const SERIES_COLORS = ["#1f6feb", "#12a150", "#8b5cf6", "#e8590c", "#0891b2", "#d6336c"];
		const OTHER_COLOR = "#9aa0a6";

		/**
		 * Every day key in a rolling window that ENDS TODAY, oldest first. Both
		 * analysis windows are anchored to today rather than to a calendar month,
		 * so the chart's right edge is always "today" and never a run of empty
		 * days that have not happened yet.
		 * @param count - window length in days (7 for a week, 30 for a month).
		 * @param now - reference date, injectable for tests.
		 */
		function recentDayKeys(count, now = new Date()) {
			const length = Number.isInteger(count) && count > 0 ? count : 7;
			const keys = [];
			for (let back = length - 1; back >= 0; back -= 1) {
				const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
				keys.push(dayKeyOf(date));
			}
			return keys;
		}

		/** `YYYY-MM-DD` → compact axis label `M/D`. */
		function axisLabelOf(key) {
			const [, month, day] = String(key).split("-");
			return `${Number(month)}/${Number(day)}`;
		}

		/**
		 * Daily trend over a rolling window, one series per model plus an aggregate
		 * bucket for the long tail. Every day in the window is a sample, so the
		 * horizontal axis stays a real time axis and a day with no usage is a zero
		 * point on the baseline rather than a gap.
		 *
		 * Series are ranked by the window's own total, so the legend and colours
		 * stay stable for a given window.
		 * @param dayMap - date key → day entry map.
		 * @param keys - the window's day keys, oldest first.
		 * @param options - `limit` (individual series before aggregating) and `labelOf`.
		 * @returns `{ days, series, max, width, height, gridLines, ticks }`.
		 */
		function buildDailyTrend(dayMap, keys, options = {}) {
			const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 4;
			const labelOf = typeof options.labelOf === "function" ? options.labelOf : (key) => key;
			const windowKeys = Array.isArray(keys) ? keys.filter((key) => typeof key === "string" && key !== "") : [];
			const entries = [];
			const windowTotals = new Map();
			for (const key of windowKeys) {
				const entry = dayMap.get(key);
				const byModel = new Map();
				let total = 0;
				for (const model of Array.isArray(entry?.models) ? entry.models : []) {
					if (model === null || typeof model !== "object" || typeof model.model !== "string" || model.model === "") continue;
					const tokens = typeof model.tokens === "number" && Number.isFinite(model.tokens) && model.tokens > 0 ? model.tokens : 0;
					byModel.set(model.model, (byModel.get(model.model) ?? 0) + tokens);
					windowTotals.set(model.model, (windowTotals.get(model.model) ?? 0) + tokens);
					total += tokens;
				}
				entries.push({ key, total, byModel });
			}
			const ranked = [...windowTotals.entries()].filter(([, tokens]) => tokens > 0).sort((a, b) => b[1] - a[1]);
			const named = ranked.slice(0, limit).map(([model, total], index) => ({
				key: model,
				label: labelOf(model),
				color: SERIES_COLORS[index % SERIES_COLORS.length],
				total,
				aggregate: false
			}));
			const tail = ranked.slice(limit);
			const series = tail.length === 0 ? named : [...named, {
				key: "__other__",
				label: null,
				color: OTHER_COLOR,
				total: tail.reduce((sum, [, tokens]) => sum + tokens, 0),
				aggregate: true,
				count: tail.length
			}];
			// Aggregate value of one bucket on one day, recomputed in a few places.
			const valueOf = (entry, model) => (model.aggregate
				? tail.reduce((sum, [name]) => sum + (entry.byModel.get(name) ?? 0), 0)
				: entry.byModel.get(model.key) ?? 0);
			// Scale on the largest single series value, not the daily total: with
			// four models on screen a total-scaled axis would compress every line
			// into the bottom quarter.
			let max = 0;
			for (const entry of entries) {
				for (const model of series) {
					const value = valueOf(entry, model);
					if (value > max) max = value;
				}
			}
			const plotHeight = CURVE_HEIGHT - CURVE_PAD_TOP - CURVE_PAD_BOTTOM;
			const baseline = CURVE_HEIGHT - CURVE_PAD_BOTTOM;
			const step = entries.length > 1 ? CURVE_WIDTH / (entries.length - 1) : 0;
			const scaleY = (value) => Number((baseline - (max > 0 ? value / max : 0) * plotHeight).toFixed(2));
			const days = entries.map((entry, index) => {
				const x = Number((index * step).toFixed(2));
				const values = series.map((model) => ({
					key: model.key,
					color: model.color,
					label: model.label,
					aggregate: model.aggregate,
					value: valueOf(entry, model)
				}));
				return {
					key: entry.key,
					label: axisLabelOf(entry.key),
					total: entry.total,
					values,
					x,
					points: values.map((value) => ({ x, y: scaleY(value.value) }))
				};
			});
			for (const model of series) {
				model.path = smoothPath(days.map((day) => day.points[series.indexOf(model)]));
			}
			// Four dashed gridlines above the baseline.
			const gridLines = [0.25, 0.5, 0.75, 1].map((ratio) => ({
				value: max * ratio,
				y: Number((baseline - ratio * plotHeight).toFixed(2))
			}));
			// At most six date ticks, always including the first and the LAST day in
			// the window, so the axis visibly ends on today.
			const tickEvery = Math.max(1, Math.ceil(days.length / 6));
			const ticks = days.filter((day, index) => index === 0 || index === days.length - 1 || index % tickEvery === 0);
			return {
				days,
				series,
				max,
				width: CURVE_WIDTH,
				height: CURVE_HEIGHT,
				baseline,
				gridLines,
				ticks,
				plotHeight
			};
		}

		/**
		 * Model share for the donut over the same rolling window as the trend, so
		 * the ring and the lines always describe the same period. A window with no
		 * usage returns an empty list rather than a ring of NaN arcs.
		 * @param dayMap - date key → day entry map.
		 * @param keys - the window's day keys, oldest first.
		 * @param options - `limit` (individual slices before aggregating) and `labelOf`.
		 * @returns `{ items, total }` where each item has `percent` 0..100.
		 */
		function buildModelShare(dayMap, keys, options = {}) {
			const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 5;
			const labelOf = typeof options.labelOf === "function" ? options.labelOf : (key) => key;
			const windowKeys = Array.isArray(keys) ? keys.filter((key) => typeof key === "string" && key !== "") : [];
			const totals = new Map();
			let total = 0;
			for (const key of windowKeys) {
				const entry = dayMap.get(key);
				for (const model of Array.isArray(entry?.models) ? entry.models : []) {
					if (model === null || typeof model !== "object" || typeof model.model !== "string" || model.model === "") continue;
					const tokens = typeof model.tokens === "number" && Number.isFinite(model.tokens) && model.tokens > 0 ? model.tokens : 0;
					if (tokens === 0) continue;
					totals.set(model.model, (totals.get(model.model) ?? 0) + tokens);
					total += tokens;
				}
			}
			if (total <= 0) return { items: [], total: 0 };
			const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
			const named = ranked.slice(0, limit).map(([model, tokens], index) => ({
				key: model,
				label: labelOf(model),
				color: SERIES_COLORS[index % SERIES_COLORS.length],
				tokens,
				percent: Math.round(tokens / total * 100)
			}));
			const tail = ranked.slice(limit);
			const items = tail.length === 0 ? named : [...named, {
				key: "__other__",
				label: null,
				color: OTHER_COLOR,
				tokens: tail.reduce((sum, [, tokens]) => sum + tokens, 0),
				percent: Math.round(tail.reduce((sum, [, tokens]) => sum + tokens, 0) / total * 100),
				aggregate: true,
				count: tail.length
			}];
			return { items, total };
		}

		/**
		 * Donut arcs as `stroke-dasharray` segments on one circle.
		 *
		 * Arc length comes from the EXACT token fraction, never from the rounded
		 * percentage shown in the legend: independent rounding makes the displayed
		 * percentages sum past 100 (57+33+8+2+1), which would overlap the ring and
		 * leave a seam. The final slice is sized to close the circumference exactly
		 * so accumulated float error cannot open a gap either.
		 */
		function donutSegments(items, radius, total) {
			const circumference = Number((2 * Math.PI * radius).toFixed(2));
			let offset = 0;
			return items.map((item, index) => {
				const exact = total > 0 && typeof item.tokens === "number" && Number.isFinite(item.tokens)
					? item.tokens / total
					: item.percent / 100;
				const length = index === items.length - 1
					? Math.max(0, circumference - offset)
					: exact * circumference;
				const segment = {
					...item,
					length: Number(length.toFixed(2)),
					offset: Number((-offset).toFixed(2)),
					circumference
				};
				offset += length;
				return segment;
			});
		}

		/**
		 * Month-view preference ("heat" calendar vs "curve" trend) persisted in the
		 * browser's namespaced localStorage. The curve is the default; storage may
		 * be disabled or quota limited, so both helpers fail closed and never throw
		 * into render.
		 */
		const VIEW_STORAGE_KEY = "@uskyu/dsh-usage-stats:view:v1";
		const DEFAULT_VIEW = "curve";
		const RANGE_STORAGE_KEY = "@uskyu/dsh-usage-stats:range:v1";
		const DEFAULT_RANGE = "week";
		/** Rolling window length in days for each analysis range. */
		const RANGE_DAYS = Object.freeze({ week: 7, month: 30 });

		function browserStorage() {
			try {
				return typeof window === "object" ? window.localStorage ?? null : null;
			} catch {
				return null;
			}
		}

		function readStoredView(storage = browserStorage()) {
			try {
				const stored = storage?.getItem?.(VIEW_STORAGE_KEY) ?? null;
				if (stored === "heat" || stored === "curve") return stored;
				if (stored !== null) storage?.removeItem?.(VIEW_STORAGE_KEY);
				return DEFAULT_VIEW;
			} catch {
				return DEFAULT_VIEW;
			}
		}

		function writeStoredView(view, storage = browserStorage()) {
			try {
				if (view !== "heat" && view !== "curve") storage?.removeItem?.(VIEW_STORAGE_KEY);
				else storage?.setItem?.(VIEW_STORAGE_KEY, view);
			} catch {
				// Storage unavailable: the choice still applies for this mount.
			}
		}

		function readStoredRange(storage = browserStorage()) {
			try {
				const stored = storage?.getItem?.(RANGE_STORAGE_KEY) ?? null;
				if (stored === "week" || stored === "month") return stored;
				if (stored !== null) storage?.removeItem?.(RANGE_STORAGE_KEY);
				return DEFAULT_RANGE;
			} catch {
				return DEFAULT_RANGE;
			}
		}

		function writeStoredRange(range, storage = browserStorage()) {
			try {
				if (range !== "week" && range !== "month") storage?.removeItem?.(RANGE_STORAGE_KEY);
				else storage?.setItem?.(RANGE_STORAGE_KEY, range);
			} catch {
				// Storage unavailable: the choice still applies for this mount.
			}
		}
		//#endregion

		//#region UsageStatsPanel
		/**
		 * Sidebar footer action: badge + floating usage panel.
		 * @param props - `wide` from the sidebar shell, `t` bound by the slot runtime.
		 */
		function UsageStatsPanel({ wide, t }) {
			const translate = (key, params) => interpolate(t !== void 0 ? t(key) : key, params);
			const [open, setOpen] = react.useState(false);
			const [usage, setUsage] = react.useState(null);
			const [usageError, setUsageError] = react.useState(null);
			const [selectedDay, setSelectedDay] = react.useState(null);
			const [viewMonth, setViewMonth] = react.useState(() => currentMonthKey());
			const [view, setView] = react.useState(() => readStoredView());
			const [range, setRange] = react.useState(() => readStoredRange());
			const [refreshedAt, setRefreshedAt] = react.useState(null);
			const mountedRef = react.useRef(true);
			const usageLoaderRef = react.useRef(null);
			const layerRef = react.useRef(null);
			const panelRef = react.useRef(null);
			if (usageLoaderRef.current === null) usageLoaderRef.current = createLoader();
			const closePanel = react.useCallback(() => {
				writeStoredView(view);
				writeStoredRange(range);
				setOpen(false);
			}, [view, range]);
			const selectView = react.useCallback((next) => {
				if (next !== "heat" && next !== "curve") return;
				setView(next);
				writeStoredView(next);
			}, []);
			const selectRange = react.useCallback((next) => {
				if (next !== "week" && next !== "month") return;
				setRange(next);
				writeStoredRange(next);
			}, []);
			const loadUsage = react.useCallback(() => {
				const seq = usageLoaderRef.current.start();
				setUsageError(null);
				fetchJson("/api/usage-stats/usage").then((payload) => {
					if (!mountedRef.current || !usageLoaderRef.current.isCurrent(seq)) return;
					if (payload.ok !== true) {
						setUsageError(payload.message ?? "usage aggregation failed");
						return;
					}
					setUsage(payload);
					setRefreshedAt(Date.now());
				}).catch((error) => {
					if (!mountedRef.current || !usageLoaderRef.current.isCurrent(seq)) return;
					setUsageError(error instanceof Error ? error.message : String(error));
				});
			}, []);

			react.useEffect(() => {
				mountedRef.current = true;
				return () => {
					mountedRef.current = false;
				};
			}, []);

			// The shared footer-actions host lays full-width registrations out in a
			// row. Let those actions wrap onto separate lines for #21 without
			// changing the row main axis used by sibling plugins (#82). Walking up
			// avoids depending on the host's hashed CSS-module class. Existing
			// column/wrap layouts are left untouched, and our inline wrap override
			// is restored on unmount.
			react.useEffect(() => {
				let host = layerRef.current?.parentElement ?? null;
				for (let depth = 0; host !== null && depth < 3; depth += 1) {
					if (window.getComputedStyle(host).display.includes("flex")) break;
					host = host.parentElement;
				}
				if (host === null) return void 0;
				return enableFooterActionWrapping(host);
			}, []);


			// Utility-popover dismissal: the panel is portaled to document.body, so
			// use capture-phase pointerdown + composedPath rather than DOM ancestry.
			react.useEffect(() => {
				if (!open) return void 0;
				const onPointerDown = (event) => {
					const path = typeof event.composedPath === "function" ? event.composedPath() : [];
					if (shouldDismissPanel(path, event.target, layerRef.current, panelRef.current)) setOpen(false);
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				document.addEventListener("keydown", onKeyDown, true);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
					document.removeEventListener("keydown", onKeyDown, true);
				};
			}, [open]);

			react.useEffect(() => {
				if (!open) return;
				loadUsage();
				const usageTimer = window.setInterval(loadUsage, 60000);
				return () => {
					window.clearInterval(usageTimer);
				};
			}, [open, loadUsage]);

			const dayMap = react.useMemo(() => {
				const map = new Map();
				if (usage !== null && Array.isArray(usage.days)) {
					for (const day of usage.days) map.set(day.date, day);
				}
				return map;
			}, [usage]);

			// Drop a stale selection when refreshed data no longer has that day.
			react.useEffect(() => {
				if (selectedDay !== null && !dayMap.has(selectedDay)) setSelectedDay(null);
			}, [dayMap, selectedDay]);

			// Never browse past the current month.
			react.useEffect(() => {
				const current = currentMonthKey();
				if (viewMonth > current) setViewMonth(current);
			}, [viewMonth]);

			const heat = react.useMemo(() => {
				// viewMonth is `YYYY-MM` with a 1-based month; the builder wants 0-based.
				const [year, monthOneBased] = viewMonth.split("-").map(Number);
				return buildMonthHeatmap(dayMap, year, monthOneBased - 1);
			}, [dayMap, viewMonth]);

			// Both analysis charts share ONE rolling window that ends today, so the
			// x axis never runs through days that have not happened yet, and the
			// ring always describes the same period as the lines.
			const todayStamp = todayKey();
			const windowKeys = react.useMemo(
				() => recentDayKeys(RANGE_DAYS[range]),
				[range, todayStamp]
			);
			const trend = react.useMemo(
				() => buildDailyTrend(dayMap, windowKeys, { labelOf: (key) => modelLabelOf(key, translate) }),
				[dayMap, windowKeys, translate]
			);
			const modelShare = react.useMemo(
				() => buildModelShare(dayMap, windowKeys, { labelOf: (key) => modelLabelOf(key, translate) }),
				[dayMap, windowKeys, translate]
			);

			const stats = react.useMemo(() => {
				if (usage === null || !Array.isArray(usage.days)) return null;
				const today = todayKey();
				const month = today.slice(0, 7);
				let todayEntry = null;
				let dayTokens = 0;
				let monthTokens = 0;
				let total = usage.total?.tokens ?? 0;
				for (const day of usage.days) {
					if (day.date === today) {
						dayTokens = day.tokens ?? 0;
						todayEntry = day;
					}
					if (day.date.startsWith(month)) monthTokens += day.tokens ?? 0;
				}
				return { dayTokens, monthTokens, total, todayHit: todayEntry?.cacheHitRate ?? null };
			}, [usage]);

			const selectedEntry = selectedDay !== null ? dayMap.get(selectedDay) ?? null : null;
			const badgeCount = stats !== null ? fmtCompact(stats.dayTokens) : null;
			const budgetRows = usage?.budgets === null || usage?.budgets === void 0 ? [] : [
				["daily", usage.budgets.daily],
				["monthly", usage.budgets.monthly]
			].map(([period, window]) => ({ period, window, text: budgetWindowText(period, window, translate) })).filter((entry) => entry.text !== null);

			// Badge layout: the 「用量」label with today's token count on the
			// right. The account value the middle slot used to carry is gone with
			// the provider-account UI, so the badge is label + today only.
			const badgeLabel = translate("panel.badge");

			const retry = () => {
				loadUsage();
			};

			const updatedLabel = refreshedAt === null ? "" : translate("panel.updatedAt", {
				time: new Date(refreshedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
			});

			return react_jsx_runtime.jsxs("div", {
				ref: layerRef,
				className: wide ? S.layer : `${S.layer} ${S.rail}`,
				children: [
					// Portal the panel to document.body: sidebar-scoped theme tokens
					// (e.g. glass skins that set light label colors for a dark sidebar)
					// would otherwise leak into the panel and clash with its
					// overlay surface from the global scope (#17).
					open && react_dom.createPortal(react_jsx_runtime.jsxs("section", {
						ref: panelRef,
						className: S.panel,
						"data-usage-stats-panel": true,
						"aria-label": translate("panel.title"),
						children: [
							react_jsx_runtime.jsxs("header", {
								className: S.header,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.headerLeft,
										children: [
											react_jsx_runtime.jsx(IconData, { size: 16 }),
											react_jsx_runtime.jsx("span", { className: S.title, children: translate("panel.title") })
										]
									}),
									react_jsx_runtime.jsxs("div", {
										className: S.headerActions,
										children: [
											react_jsx_runtime.jsx(Tooltip, {
												label: translate("action.refresh"),
												side: "bottom",
												delayMs: 500,
												children: react_jsx_runtime.jsx("button", {
													type: "button",
													className: S.iconButton,
													"aria-label": translate("action.refresh"),
													onClick: retry,
													children: react_jsx_runtime.jsx(IconRefresh, { size: 14 })
												})
											}),
											react_jsx_runtime.jsx(Tooltip, {
												label: translate("action.close"),
												side: "bottom",
												delayMs: 500,
												children: react_jsx_runtime.jsx("button", {
													type: "button",
													className: S.iconButton,
													"aria-label": translate("action.close"),
													onClick: closePanel,
													children: react_jsx_runtime.jsx(IconClose, { size: 14 })
												})
											})
										]
									})
								]
							}),
							react_jsx_runtime.jsxs("div", {
								className: S.body,
								children: [
									selectedEntry !== null ? react_jsx_runtime.jsx(DayDetail, {
										day: selectedEntry,
										translate,
										onBack: () => setSelectedDay(null)
									}) : react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
										children: [
											react_jsx_runtime.jsx("section", {
												className: S.section,
												children: react_jsx_runtime.jsx("h3", { className: S.sectionTitle, children: translate("usage.title") })
											}),
											stats === null && usageError === null ? react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.loading") }) : null,
											usageError !== null ? react_jsx_runtime.jsxs("div", {
												className: S.error,
												children: [
													react_jsx_runtime.jsx("span", { children: translate("usage.error", { message: usageError }) }),
													react_jsx_runtime.jsx("button", {
														type: "button",
														className: S.retry,
														onClick: loadUsage,
														children: translate("action.retry")
													})
												]
											}) : null,
											stats !== null && react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
												children: [
													react_jsx_runtime.jsxs("div", {
														className: S.statsRow,
														children: [
													react_jsx_runtime.jsxs("div", { className: S.stat, children: [react_jsx_runtime.jsx("span", { className: S.statValue, title: fmtExact(stats.dayTokens), children: fmt(stats.dayTokens) }), react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.today") })] }),
													react_jsx_runtime.jsxs("div", { className: S.stat, children: [react_jsx_runtime.jsx("span", { className: S.statValue, title: fmtExact(stats.monthTokens), children: fmt(stats.monthTokens) }), react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.month") })] }),
													react_jsx_runtime.jsxs("div", { className: S.stat, children: [react_jsx_runtime.jsx("span", { className: S.statValue, title: fmtExact(stats.total), children: fmt(stats.total) }), react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.total") })] })
														]
													}),
													react_jsx_runtime.jsx("p", {
														className: S.hitCaption,
														children: react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
															children: [
																translate("usage.hit.today"),
																": ",
																react_jsx_runtime.jsx("b", { children: fmtHit(stats.todayHit) })
														]
													})
												}),
												...budgetRows.map((entry) => react_jsx_runtime.jsx("p", {
													className: S.hitCaption,
													"data-budget-period": entry.period,
													"data-budget-level": entry.window.level,
													children: entry.text
												}, entry.period))
											]
											}),
											usage !== null && usageError === null && react_jsx_runtime.jsxs("section", {
												className: S.section,
												children: [
													react_jsx_runtime.jsxs("div", {
														className: S.heatHeader,
														children: [
															react_jsx_runtime.jsx("h3", { className: S.sectionTitle, children: view === "curve" ? translate("usage.trend") : translate("usage.heatmap") }),
															react_jsx_runtime.jsxs("div", {
																className: S.monthNav,
																children: [
																	// Range switch, then the view switch, both on the month
																	// row so neither costs a row of its own. The range drives
																	// the trend and the ring; the arrows only page the calendar,
																	// so they appear with the calendar view.
																	react_jsx_runtime.jsxs("div", {
																		className: S.viewToggle,
																		role: "group",
																		"aria-label": translate("usage.rangeToggle"),
																		children: [
																			react_jsx_runtime.jsx("button", {
																				type: "button",
																				className: S.viewToggleButton,
																				"data-range": "week",
																				"data-active": range === "week" ? "true" : void 0,
																				"aria-pressed": range === "week",
																				onClick: () => selectRange("week"),
																				children: translate("usage.rangeWeek")
																			}),
																			react_jsx_runtime.jsx("button", {
																				type: "button",
																				className: S.viewToggleButton,
																				"data-range": "month",
																				"data-active": range === "month" ? "true" : void 0,
																				"aria-pressed": range === "month",
																				onClick: () => selectRange("month"),
																				children: translate("usage.rangeMonth")
																			})
																		]
																	}),
																	react_jsx_runtime.jsxs("div", {
																		className: S.viewToggle,
																		role: "group",
																		"aria-label": translate("usage.viewToggle"),
																		children: [
																			react_jsx_runtime.jsx("button", {
																				type: "button",
																				className: S.viewToggleButton,
																				"data-view": "curve",
																				"data-active": view === "curve" ? "true" : void 0,
																				"aria-pressed": view === "curve",
																				onClick: () => selectView("curve"),
																				children: translate("usage.viewCurve")
																			}),
																			react_jsx_runtime.jsx("button", {
																				type: "button",
																				className: S.viewToggleButton,
																				"data-view": "heat",
																				"data-active": view === "heat" ? "true" : void 0,
																				"aria-pressed": view === "heat",
																				onClick: () => selectView("heat"),
																				children: translate("usage.viewHeat")
																			})
																		]
																	}),
																	view === "heat" && react_jsx_runtime.jsx("button", {
																		type: "button",
																		className: S.navButton,
																		"aria-label": translate("action.prevMonth"),
																		onClick: () => setViewMonth((month) => shiftMonth(month, -1)),
																		children: react_jsx_runtime.jsx(IconChevronLeft, { size: 12 })
																	}),
																	view === "heat" && react_jsx_runtime.jsx("span", { className: S.monthTitle, children: monthLabelOf(viewMonth, translate) }),
																	view === "heat" && react_jsx_runtime.jsx("button", {
																		type: "button",
																		className: S.navButton,
																		"aria-label": translate("action.nextMonth"),
																		disabled: viewMonth >= currentMonthKey(),
																		onClick: () => setViewMonth((month) => shiftMonth(month, 1)),
																		children: react_jsx_runtime.jsx(IconChevronRight, { size: 12 })
																	}),
																	view === "heat" && viewMonth !== currentMonthKey() && react_jsx_runtime.jsx("button", {
																		type: "button",
																		className: S.todayButton,
																		onClick: () => setViewMonth(currentMonthKey()),
																		children: translate("action.today")
																	})
																]
															})
														]
													}),
													view === "curve" ? react_jsx_runtime.jsx(MonthTrend, {
														trend,
														translate,
														selectedKey: selectedDay,
														onSelect: setSelectedDay
													}) : react_jsx_runtime.jsx(MonthHeatmap, {
														heat,
														translate,
														selectedKey: selectedDay,
														onSelect: setSelectedDay
													})
												]
											}),
											usage !== null && usageError === null && react_jsx_runtime.jsxs("section", {
												className: S.section,
												children: [
													react_jsx_runtime.jsx("h3", { className: S.sectionTitle, children: translate("usage.modelShare") }),
													react_jsx_runtime.jsx(ModelDonut, { share: modelShare, translate })
												]
											}),
										react_jsx_runtime.jsxs("section", {
											className: S.section,
											children: [
												react_jsx_runtime.jsx("h3", { className: S.sectionTitle, children: translate("export.title") }),
												react_jsx_runtime.jsxs("div", {
													className: S.exportLinks,
													children: [
														react_jsx_runtime.jsx("a", { className: S.exportLink, href: "/api/usage-stats/export/daily.csv", download: "dsh-usage-daily.csv", "data-export-format": "daily-csv", children: translate("export.dailyCsv") }),
														react_jsx_runtime.jsx("a", { className: S.exportLink, href: "/api/usage-stats/export/sessions.csv", download: "dsh-usage-sessions.csv", "data-export-format": "sessions-csv", children: translate("export.sessionsCsv") }),
														react_jsx_runtime.jsx("a", { className: S.exportLink, href: "/api/usage-stats/export.json", download: "dsh-usage-stats.json", "data-export-format": "json", children: translate("export.json") })
													]
												})
											]
										}),
										updatedLabel !== "" && react_jsx_runtime.jsx("p", { className: S.footerNote, children: updatedLabel })
										]
									})
								]
							})
						]
					}), document.body),
					react_jsx_runtime.jsx("div", {
						className: S.footerButtons,
						children: react_jsx_runtime.jsxs("button", {
							type: "button",
							className: S.badge,
							"data-usage-stats-badge": true,
							"aria-label": translate("panel.badge"),
							"aria-expanded": open,
							onClick: () => setOpen((value) => !value),
							children: [
								react_jsx_runtime.jsx(IconData, { size: wide ? 16 : 18 }),
								wide && react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
									children: [
										react_jsx_runtime.jsx("span", { className: S.badgeLabel, children: badgeLabel }),
										badgeCount !== null && react_jsx_runtime.jsx("span", { className: S.badgeCount, children: badgeCount })
									]
								})
							]
						})
					})
				]
			});
		}

		/**
		 * One day's per-model breakdown. `day` is the wire day entry carrying
		 * `tokens`, `cacheHitRate`, and `models` (descending by tokens).
		 */
		function DayDetail({ day, translate, onBack }) {
			const models = Array.isArray(day.models) ? day.models : [];
			const totalTokens = day.tokens ?? 0;
			return react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.detailHeader,
						children: [
							react_jsx_runtime.jsx("button", {
								type: "button",
								className: S.back,
								"aria-label": translate("usage.back"),
								onClick: onBack,
								children: react_jsx_runtime.jsx(IconChevronLeft, { size: 14 })
							}),
							react_jsx_runtime.jsx("span", { className: S.detailDate, children: dayLabel(day.date, translate) }),
							react_jsx_runtime.jsx("span", { className: S.detailHit, children: `${translate("usage.hitRate")} ${fmtHit(day.cacheHitRate)}` })
						]
					}),
					react_jsx_runtime.jsx("p", {
						className: S.detailSummary,
						children: `${translate("usage.total")} ${fmt(totalTokens)} · ${translate("usage.input")} ${fmt(day.inputTokens ?? 0)} · ${translate("usage.output")} ${fmt(day.outputTokens ?? 0)} · ${translate("usage.cacheRead")} ${fmt(day.cacheReadTokens ?? 0)}`
					}),
					react_jsx_runtime.jsx("div", {
						className: S.days,
						children: models.length === 0 ? react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.noModels") }) : models.map((model) => {
							const share = totalTokens > 0 ? Math.max(3, Math.round(100 * (model.tokens ?? 0) / totalTokens)) : 0;
							return react_jsx_runtime.jsxs("div", {
								className: S.modelRow,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.modelHead,
										children: [
											react_jsx_runtime.jsx("span", { className: S.modelName, title: model.model, children: modelLabelOf(model.model, translate) }),
											react_jsx_runtime.jsx("span", { className: S.modelTokens, children: fmt(model.tokens ?? 0) }),
											react_jsx_runtime.jsx("span", { className: S.modelHit, children: fmtHit(model.cacheHitRate) })
										]
									}),
									react_jsx_runtime.jsx("div", {
										className: S.modelBarTrack,
										children: react_jsx_runtime.jsx("div", { className: S.modelBar, style: { width: `${share}%` } })
									}),
									react_jsx_runtime.jsx("div", {
										className: S.modelMeta,
										children: `${translate("usage.input")} ${fmt(model.inputTokens ?? 0)} · ${translate("usage.output")} ${fmt(model.outputTokens ?? 0)} · ${translate("usage.cacheRead")} ${fmt(model.cacheReadTokens ?? 0)}`
									})
								]
							}, model.model);
						})
					})
				]
			});
		}

		/**
		 * Codex-style blue calendar heatmap for one month: weekday header row,
		 * weeks as rows (Mon-first), padded with placeholders. Cells are buttons
		 * that select a day.
		 */
		function MonthHeatmap({ heat, translate, selectedKey, onSelect }) {
			const select = typeof onSelect === "function" ? onSelect : () => {};
			const weekdayLabels = [
				translate("weekday.mon"),
				translate("weekday.tue"),
				translate("weekday.wed"),
				translate("weekday.thu"),
				translate("weekday.fri"),
				translate("weekday.sat"),
				translate("weekday.sun")
			];
			return react_jsx_runtime.jsxs("div", {
				className: S.heat,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.monthGrid,
						children: [
							react_jsx_runtime.jsx("div", {
								className: S.weekHeader,
								children: weekdayLabels.map((label) => react_jsx_runtime.jsx("span", { className: S.weekLabel, children: label }, label))
							}),
							heat.weeks.map((week, weekIndex) => react_jsx_runtime.jsx("div", {
								className: S.heatRow,
								children: week.map((cell, dayIndex) => {
									if (cell === null) return react_jsx_runtime.jsx("span", { className: S.emptyCell, "aria-hidden": true }, `${weekIndex}-${dayIndex}`);
									const style = cellColor(cell.tokens, heat.max);
									const hit = cell.hitRate === null || cell.hitRate === void 0 ? "" : ` · ${translate("usage.hitRate")} ${cell.hitRate}%`;
									const isToday = cell.key === todayKey();
									return react_jsx_runtime.jsx("button", {
										type: "button",
										className: `${S.cell}${isToday ? ` ${S.cellToday}` : ""}${selectedKey === cell.key ? ` ${S.cellSelected}` : ""}`,
										style: { background: style.background, color: style.color },
										title: `${cell.key} · ${fmtExact(cell.tokens)} tokens${hit}`,
										"aria-label": `${cell.key} · ${fmt(cell.tokens)} tokens`,
										onClick: () => select(cell.key),
										children: react_jsx_runtime.jsx("span", { className: S.cellDay, children: cell.day })
									}, cell.key);
								})
							}, weekIndex))
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.legend,
						children: [
							react_jsx_runtime.jsx("span", { children: translate("usage.legendLess") }),
							[0.22, 0.42, 0.6, 0.8, 1].map((alpha, index) => react_jsx_runtime.jsx("span", {
								className: S.legendSwatch,
								style: { background: `rgba(${BLUE_RGB[0]}, ${BLUE_RGB[1]}, ${BLUE_RGB[2]}, ${alpha})` }
							}, index)),
							react_jsx_runtime.jsx("span", { children: translate("usage.legendMore") })
						]
					})
				]
			});
		}

		/**
		 * Daily trend across the selected month: one smooth line per model, a
		 * legend, dashed gridlines and a hover card that breaks the hovered day
		 * down per model. The plot is a fixed viewBox stretched to the panel width,
		 * so nothing needs measuring; pointer positions are converted from the
		 * element's own bounding box.
		 *
		 * Hover and selection stay separate: hovering shows the card, clicking (or
		 * Enter/Space) opens that day's detail, mirroring the heatmap contract.
		 */
		function MonthTrend({ trend, translate, selectedKey, onSelect }) {
			const select = typeof onSelect === "function" ? onSelect : () => {};
			const [hovered, setHovered] = react.useState(null);
			const days = Array.isArray(trend?.days) ? trend.days : [];
			const series = Array.isArray(trend?.series) ? trend.series : [];
			const width = trend?.width ?? CURVE_WIDTH;
			const height = trend?.height ?? CURVE_HEIGHT;
			const baseline = trend?.baseline ?? height - CURVE_PAD_BOTTOM;
			if (days.length === 0 || series.length === 0) {
				return react_jsx_runtime.jsx("p", { className: S.trendEmpty, children: translate("usage.trendEmpty") });
			}
			// Pointer x → day index. Uses the live bounding box so the mapping stays
			// correct after the SVG is stretched to the panel width.
			const hoverAt = (event) => {
				const box = event.currentTarget.getBoundingClientRect?.();
				if (box === undefined || box === null || box.width <= 0) return;
				const ratio = (event.clientX - box.left) / box.width;
				setHovered(Math.max(0, Math.min(days.length - 1, Math.floor(ratio * days.length))));
			};
			const hoveredDay = hovered === null ? null : days[hovered] ?? null;
			const activeDay = hoveredDay ?? (selectedKey === null ? null : days.find((day) => day.key === selectedKey) ?? null);
			return react_jsx_runtime.jsxs("div", {
				className: S.trend,
				children: [
					react_jsx_runtime.jsx("div", {
						className: S.trendLegend,
						children: series.map((model) => react_jsx_runtime.jsxs("span", {
							className: S.trendLegendItem,
							"data-series": model.key,
							children: [
								react_jsx_runtime.jsx("span", { className: S.trendLegendDot, style: { background: model.color }, "aria-hidden": true }),
								react_jsx_runtime.jsx("span", { children: model.aggregate ? translate("usage.otherModels", { count: model.count }) : model.label })
							]
						}, model.key))
					}),
					react_jsx_runtime.jsxs("svg", {
						className: S.trendSvg,
						viewBox: `0 0 ${width} ${height}`,
						preserveAspectRatio: "none",
						role: "img",
						"aria-label": translate("usage.trend"),
						onMouseMove: hoverAt,
						onMouseLeave: () => setHovered(null),
						children: [
							// Gridlines sit under the series so a light line never hides
							// behind a coloured one.
							(trend?.gridLines ?? []).map((line) => react_jsx_runtime.jsx("line", {
								x1: 0,
								y1: line.y,
								x2: width,
								y2: line.y,
								stroke: "var(--dsw-alias-border-l1)",
								strokeWidth: 1,
								strokeDasharray: "3 4",
								vectorEffect: "non-scaling-stroke"
							}, `grid-${line.y}`)),
							react_jsx_runtime.jsx("line", {
								x1: 0,
								y1: baseline,
								x2: width,
								y2: baseline,
								stroke: "var(--dsw-alias-border-l2)",
								strokeWidth: 1,
								vectorEffect: "non-scaling-stroke"
							}),
							activeDay === null ? null : react_jsx_runtime.jsx("line", {
								x1: activeDay.x,
								y1: CURVE_PAD_TOP,
								x2: activeDay.x,
								y2: baseline,
								stroke: "var(--dsw-alias-label-caption)",
								strokeWidth: 1,
								vectorEffect: "non-scaling-stroke"
							}),
							series.map((model) => react_jsx_runtime.jsx("path", {
								d: model.path,
								fill: "none",
								stroke: model.color,
								strokeWidth: 2,
								strokeLinecap: "round",
								strokeLinejoin: "round",
								"data-trend-series": model.key,
								vectorEffect: "non-scaling-stroke"
							}, model.key)),
							activeDay === null ? null : activeDay.values.map((value, valueIndex) => (
								value.value > 0 ? react_jsx_runtime.jsx("circle", {
									cx: activeDay.x,
									cy: activeDay.points[valueIndex].y,
									r: 2.5,
									fill: value.color,
									stroke: "var(--dsw-alias-bg-base)",
									strokeWidth: 1,
									vectorEffect: "non-scaling-stroke"
								}, `dot-${value.key}`) : null
							))
						]
					}),
					// Date axis under the plot: the tick labels are absolutely placed at
					// their sample's x position, so they stay aligned with the lines
					// after the SVG stretches to the panel width.
					react_jsx_runtime.jsx("div", {
						className: S.trendAxisRow,
						children: (trend?.ticks ?? []).map((tick) => react_jsx_runtime.jsx("span", {
							className: S.trendAxisTick,
							style: { left: `${(tick.x / width * 100).toFixed(2)}%` },
							children: tick.label
						}, `tick-${tick.key}`))
					}),
					// Invisible per-day hit targets: hover shows the card, click opens
					// the day. They are the only interactive elements in the plot.
					react_jsx_runtime.jsx("div", {
						className: S.trendHits,
						children: days.map((day, index) => react_jsx_runtime.jsx("button", {
							type: "button",
							className: S.trendHit,
							style: { width: `${100 / days.length}%` },
							"data-trend-day": day.key,
							"aria-label": `${day.key} · ${fmt(day.total)} tokens`,
							title: `${day.key} · ${fmtExact(day.total)} tokens`,
							onMouseEnter: () => setHovered(index),
							onFocus: () => setHovered(index),
							onClick: () => select(day.key)
						}, day.key))
					}),
					hoveredDay === null ? null : react_jsx_runtime.jsxs("div", {
						className: S.trendTooltip,
						role: "status",
						style: hoveredDay.x > width / 2 ? { right: "8px" } : { left: `${Math.round(hoveredDay.x / width * 100)}%` },
						children: [
							react_jsx_runtime.jsx("span", {
								className: S.trendTooltipTitle,
								children: translate("usage.tooltipTitle", { date: dayLabel(hoveredDay.key, translate), total: fmt(hoveredDay.total) })
							}),
							...hoveredDay.values.filter((value) => value.value > 0).map((value) => react_jsx_runtime.jsxs("span", {
								className: S.trendTooltipRow,
								children: [
									react_jsx_runtime.jsx("span", { className: S.trendTooltipDot, style: { background: value.color }, "aria-hidden": true }),
									react_jsx_runtime.jsx("span", { children: value.aggregate ? translate("usage.otherModels", { count: value.count ?? 0 }) : value.label }),
									react_jsx_runtime.jsx("b", { title: fmtExact(value.value), children: fmt(value.value) })
								]
							}, `tip-${value.key}`))
						]
					})
				]
			});
		}

		/**
		 * Model share for the window: a donut with the period total in the middle
		 * and the same ranking as a list beside it. The ring is one stroked circle
		 * per slice, each offset by the running length.
		 *
		 * Hovering is bidirectional: pointing at a slice highlights its legend row
		 * and shows a card with the model and its consumption, and pointing at a
		 * row highlights the matching slice. Without the linkage the ring is
		 * unreadable when two slices share a similar colour family.
		 */
		function ModelDonut({ share, translate }) {
			const [hovered, setHovered] = react.useState(null);
			const items = Array.isArray(share?.items) ? share.items : [];
			const total = share?.total ?? 0;
			if (items.length === 0 || total <= 0) {
				return react_jsx_runtime.jsx("p", { className: S.donutEmpty, children: translate("usage.modelShareEmpty") });
			}
			const radius = 52;
			const thickness = 16;
			const center = 64;
			const segments = donutSegments(items, radius, total);
			const labelOf = (segment) => (segment.aggregate
				? translate("usage.otherModels", { count: segment.count ?? 0 })
				: segment.label);
			const hoveredSegment = hovered === null ? null : segments.find((segment) => segment.key === hovered) ?? null;
			return react_jsx_runtime.jsxs("div", {
				className: S.donut,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.donutRow,
						children: [
							react_jsx_runtime.jsxs("div", {
								className: S.donutChart,
								children: [
									react_jsx_runtime.jsxs("svg", {
										className: S.donutSvg,
										viewBox: "0 0 128 128",
										role: "img",
										"aria-label": translate("usage.modelShare"),
										onMouseLeave: () => setHovered(null),
										children: [
											react_jsx_runtime.jsx("circle", {
												cx: center,
												cy: center,
												r: radius,
												fill: "none",
												stroke: "var(--dsw-alias-fill-l2)",
												strokeWidth: thickness
											}),
											segments.map((segment) => react_jsx_runtime.jsx("circle", {
												cx: center,
												cy: center,
												r: radius,
												fill: "none",
												stroke: segment.color,
												strokeWidth: hovered === segment.key ? thickness + 5 : thickness,
												strokeDasharray: `${segment.length} ${Math.max(0, segment.circumference - segment.length)}`,
												strokeDashoffset: segment.offset,
												transform: `rotate(-90 ${center} ${center})`,
												"data-donut-slice": segment.key,
												"data-active": hovered === segment.key ? "true" : void 0,
												onMouseEnter: () => setHovered(segment.key),
												onFocus: () => setHovered(segment.key)
											}, segment.key)),
											react_jsx_runtime.jsx("text", {
												className: S.donutTotal,
												x: center,
												y: center - 2,
												textAnchor: "middle",
												children: fmt(total)
											}),
											react_jsx_runtime.jsx("text", {
												className: S.donutTotalCaption,
												x: center,
												y: center + 10,
												textAnchor: "middle",
												children: translate("usage.donutCenter")
											})
										]
									}),
									// Floating card for the hovered slice: a compact two-line
									// block over the ring centre, which it temporarily replaces.
									hoveredSegment === null ? null : react_jsx_runtime.jsxs("div", {
										className: S.donutTooltip,
										role: "status",
										"data-donut-tooltip": hoveredSegment.key,
										children: [
											react_jsx_runtime.jsxs("span", {
												className: S.donutTooltipHead,
												children: [
													react_jsx_runtime.jsx("span", {
														className: S.donutTooltipDot,
														style: { background: hoveredSegment.color },
														"aria-hidden": true
													}),
													react_jsx_runtime.jsx("span", {
														className: S.donutTooltipName,
														title: labelOf(hoveredSegment),
														children: labelOf(hoveredSegment)
													})
												]
											}),
											react_jsx_runtime.jsxs("span", {
												className: S.donutTooltipFigures,
												children: [
													react_jsx_runtime.jsx("span", {
														title: fmtExact(hoveredSegment.tokens),
														children: fmt(hoveredSegment.tokens)
													}),
													react_jsx_runtime.jsx("span", { className: S.donutTooltipShare, children: `${hoveredSegment.percent}%` })
												]
											})
										]
									})
								]
							}),
							react_jsx_runtime.jsx("div", {
								className: S.donutList,
								children: segments.map((segment) => react_jsx_runtime.jsxs("div", {
									className: S.donutItem,
									"data-donut-item": segment.key,
									"data-active": hovered === segment.key ? "true" : void 0,
									onMouseEnter: () => setHovered(segment.key),
									onMouseLeave: () => setHovered(null),
									children: [
										react_jsx_runtime.jsx("span", { className: S.donutItemDot, style: { background: segment.color }, "aria-hidden": true }),
										react_jsx_runtime.jsx("span", {
											className: S.donutItemName,
											title: labelOf(segment),
											children: labelOf(segment)
										}),
										react_jsx_runtime.jsx("span", { className: S.donutItemMeta, children: `${segment.percent}%` }),
										react_jsx_runtime.jsx("span", { className: S.donutItemValue, title: fmtExact(segment.tokens), children: fmt(segment.tokens) })
									]
								}, segment.key))
							})
						]
					})
				]
			});
		}

/** `YYYY-MM-DD` → `MM-DD 周X` display label. */
		function dayLabel(key, translate) {
			const [, month, day] = key.split("-");
			const date = new Date(Number(key.slice(0, 4)), Number(month) - 1, Number(day));
			const weekdays = [translate("weekday.sun"), translate("weekday.mon"), translate("weekday.tue"), translate("weekday.wed"), translate("weekday.thu"), translate("weekday.fri"), translate("weekday.sat")];
			return `${month}-${day} ${weekdays[date.getDay()]}`;
		}

		function monthName(month, translate) {
			const names = translate("month.names").split(",");
			return names[month] ?? String(month + 1);
		}

		/**
		 * Display label for a `provider/model` attribution key (the same model
		 * served by different providers must stay distinguishable).
		 */
		function modelLabelOf(key, translate) {
			if (typeof key !== "string") return "";
			const slash = key.indexOf("/");
			if (slash === -1) return key;
			const provider = key.slice(0, slash);
			const model = key.slice(slash + 1);
			const providerLabel = provider === "unknown" ? translate("usage.unknownModel") : provider;
			const modelLabel = model === "unknown" || model === "" ? translate("usage.unknownModel") : model;
			return `${providerLabel} · ${modelLabel}`;
		}
		//#endregion

		//#region locales
		/** `usageStats` namespace dictionaries (the zh key set is the source of truth). */
		const NS = "usageStats";
		const zh = {
			"panel.title": "用量",
			"panel.badge": "用量",
			"usage.title": "Token 用量",
			"usage.today": "今日",
			"usage.month": "本月",
			"usage.total": "累计",
			"usage.loading": "正在统计用量…",
			"usage.error": "用量统计失败：{message}",
			"usage.heatmap": "当月每日用量",
			"usage.trend": "每日 Token 趋势图",
			"usage.trendEmpty": "这段时间还没有用量记录。",
			"usage.tooltipTitle": "{date} · {total} tokens",
			"usage.otherModels": "其他模型（{count}）",
			"usage.modelShare": "模型用量",
			"usage.modelShareEmpty": "这段时间还没有分模型数据。",
			"usage.modelShareTooltip": "{model} · {tokens} tokens",
			"usage.donutCenter": "tokens",
			"usage.viewToggle": "用量视图",
			"usage.rangeToggle": "时间范围",
			"usage.rangeWeek": "近 7 天",
			"usage.rangeMonth": "近 1 个月",
			"usage.viewHeat": "日历",
			"usage.viewCurve": "曲线",
			"usage.legendLess": "少",
			"usage.legendMore": "多",
			"usage.back": "返回",
			"usage.hitRate": "缓存命中",
			"usage.hit.today": "今日缓存命中率",
			"usage.input": "输入",
			"usage.output": "输出",
			"usage.cacheRead": "缓存读",
			"usage.unknownModel": "未知模型",
			"usage.noModels": "这一天没有分模型数据。",
			"export.title": "安全导出",
			"export.dailyCsv": "每日 CSV",
			"export.sessionsCsv": "会话 CSV",
			"export.json": "完整 JSON",
			"budget.period.daily": "今日估算",
			"budget.period.monthly": "本月估算",
			"budget.level.normal": "正常",
			"budget.level.warning": "接近预算",
			"budget.level.critical": "已超预算",
			"budget.level.unknown": "费用不完整",
			"budget.summary": "{period}：{spent} / {limit} · {level}",
			"month.year": "{year}年{month}",
			"action.refresh": "刷新",
			"action.retry": "重试",
			"action.close": "关闭",
			"action.prevMonth": "上个月",
			"action.nextMonth": "下个月",
			"action.today": "回到今天",
			"panel.updatedAt": "更新于 {time}",
			"weekday.mon": "一",
			"weekday.tue": "二",
			"weekday.wed": "三",
			"weekday.thu": "四",
			"weekday.fri": "五",
			"weekday.sat": "六",
			"weekday.sun": "日",
			"month.names": "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月"
		};
		const en = {
			"panel.title": "Usage",
			"panel.badge": "Usage",
			"usage.title": "Token usage",
			"usage.today": "Today",
			"usage.month": "This month",
			"usage.total": "All time",
			"usage.loading": "Aggregating usage…",
			"usage.error": "Usage aggregation failed: {message}",
			"usage.heatmap": "Daily usage this month",
			"usage.trend": "Daily token trend",
			"usage.trendEmpty": "No usage recorded in this range yet.",
			"usage.tooltipTitle": "{date} · {total} tokens",
			"usage.otherModels": "Other models ({count})",
			"usage.modelShare": "Model usage",
			"usage.modelShareEmpty": "No per-model data in this range.",
			"usage.modelShareTooltip": "{model} · {tokens} tokens",
			"usage.donutCenter": "tokens",
			"usage.viewToggle": "Usage view",
			"usage.rangeToggle": "Time range",
			"usage.rangeWeek": "7 days",
			"usage.rangeMonth": "1 month",
			"usage.viewHeat": "Calendar",
			"usage.viewCurve": "Curve",
			"usage.legendLess": "Less",
			"usage.legendMore": "More",
			"usage.back": "Back",
			"usage.hitRate": "Cache hit",
			"usage.hit.today": "Today's cache hit rate",
			"usage.input": "Input",
			"usage.output": "Output",
			"usage.cacheRead": "Cache read",
			"usage.unknownModel": "Unknown model",
			"usage.noModels": "No per-model data for this day.",
			"export.title": "Secret-free export",
			"export.dailyCsv": "Daily CSV",
			"export.sessionsCsv": "Sessions CSV",
			"export.json": "Full JSON",
			"budget.period.daily": "Today estimated",
			"budget.period.monthly": "This month estimated",
			"budget.level.normal": "Normal",
			"budget.level.warning": "Near budget",
			"budget.level.critical": "Over budget",
			"budget.level.unknown": "Incomplete cost",
			"budget.summary": "{period}: {spent} / {limit} · {level}",
			"month.year": "{month} {year}",
			"action.refresh": "Refresh",
			"action.retry": "Retry",
			"action.close": "Close",
			"action.prevMonth": "Previous month",
			"action.nextMonth": "Next month",
			"action.today": "Today",
			"panel.updatedAt": "Updated at {time}",
			"weekday.mon": "M",
			"weekday.tue": "T",
			"weekday.wed": "W",
			"weekday.thu": "T",
			"weekday.fri": "F",
			"weekday.sat": "S",
			"weekday.sun": "S",
			"month.names": "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec"
		};
		//#endregion

		//#region plugin body
		/** Services required by the client plugin body. */
		const inject = ["slots", "locale"];

		/**
		 * Client plugin body: register dictionaries and the sidebar usage panel.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "usage-stats: dictionaries");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "usage-stats",
				locale: NS,
				order: 10
			}, UsageStatsPanel));
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		exports.UsageStatsPanel = UsageStatsPanel;
		exports.DayDetail = DayDetail;
		exports.MonthHeatmap = MonthHeatmap;
		exports.MonthTrend = MonthTrend;
		exports.ModelDonut = ModelDonut;
		exports.buildMonthHeatmap = buildMonthHeatmap;
		exports.buildDailyTrend = buildDailyTrend;
		exports.buildModelShare = buildModelShare;
		exports.recentDayKeys = recentDayKeys;
		exports.axisLabelOf = axisLabelOf;
		exports.donutSegments = donutSegments;
		exports.smoothPath = smoothPath;
		exports.cellColor = cellColor;
		exports.createLoader = createLoader;
		exports.modelLabelOf = modelLabelOf;
		exports.fmt = fmt;
		exports.fmtExact = fmtExact;
		exports.fmtCurrency = fmtCurrency;
		exports.budgetWindowText = budgetWindowText;
		exports.shouldDismissPanel = shouldDismissPanel;
		exports.enableFooterActionWrapping = enableFooterActionWrapping;
		exports.VIEW_STORAGE_KEY = VIEW_STORAGE_KEY;
		exports.readStoredView = readStoredView;
		exports.writeStoredView = writeStoredView;
		exports.RANGE_STORAGE_KEY = RANGE_STORAGE_KEY;
		exports.DEFAULT_RANGE = DEFAULT_RANGE;
		exports.RANGE_DAYS = RANGE_DAYS;
		exports.readStoredRange = readStoredRange;
		exports.writeStoredRange = writeStoredRange;
		return module.exports;
	}
});
