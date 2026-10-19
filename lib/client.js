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
			".usg_badge:focus-visible,.usg_iconButton:focus-visible,.usg_retry:focus-visible,.usg_exportLink:focus-visible,.usg_navButton:focus-visible,.usg_todayButton:focus-visible,.usg_back:focus-visible,.usg_viewToggleButton:focus-visible,.usg_cell:focus-visible,.usg_day:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
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
			".usg_day{width:100%;min-height:30px;align-items:center;gap:8px;border:0;background:0 0;border-bottom:1px solid var(--dsw-alias-border-l1);padding:5px 0;font:inherit;text-align:left;cursor:pointer;display:flex}",
			".usg_day:last-child{border-bottom:0}",
			".usg_day:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_dayDate{color:var(--dsw-alias-label-secondary);flex:0 1 104px;min-width:0;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;overflow:hidden}",
			".usg_dayTokens{color:var(--dsw-alias-label-primary);flex:none;min-width:84px;text-align:right;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".usg_dayHit{color:var(--dsw-alias-label-tertiary);flex:none;width:52px;font-size:11px;line-height:18px;font-variant-numeric:tabular-nums;text-align:right}",
			// A proportional bar needs a flexible TRACK plus a fixed-width FILL.
			// Setting `width` directly on a `flex:1` item does nothing: flex-basis
			// is 0, so the main size comes from flex growth and every bar in the
			// list ends up the same length regardless of its share.
			".usg_dayBarTrack{background:var(--dsw-alias-fill-l2);border-radius:2px;height:6px;flex:1;min-width:4px;overflow:hidden}",
			".usg_dayBar{background:var(--usg-blue);border-radius:2px;height:6px;opacity:.65}",
			// Today's per-model ranking replaces the old session-cost list: one row
			// per model with a proportional bar and the exact token count on the
			// right. The bar is decorative, so it stays out of the accessibility tree.
			".usg_modelRank{flex-direction:column;display:flex}",
			".usg_modelRankRow{min-height:30px;align-items:center;gap:8px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:5px 0;display:flex}",
			".usg_modelRankRow:last-child{border-bottom:0}",
			".usg_modelRankName{color:var(--dsw-alias-label-secondary);flex:0 1 auto;min-width:0;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;overflow:hidden}",
			".usg_modelRankTrack{background:var(--dsw-alias-fill-l2);border-radius:2px;height:6px;flex:1;min-width:4px;overflow:hidden}",
			".usg_modelRankBar{background:var(--usg-blue);border-radius:2px;height:6px;opacity:.65}",
			".usg_modelRankTokens{color:var(--dsw-alias-label-primary);flex:none;min-width:64px;text-align:right;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".usg_modelRankEmpty{color:var(--dsw-alias-label-tertiary);margin:4px 0;font-size:12px;line-height:18px}",
			// Heatmap ⇄ curve toggle: two small segmented buttons above the calendar.
			".usg_viewToggle{align-items:center;background:var(--dsw-alias-fill-l2,transparent);border-radius:7px;gap:1px;padding:1px;display:inline-flex}",
			".usg_viewToggleButton{cursor:pointer;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;padding:2px 8px;font:inherit;font-size:11px;line-height:16px}",
			".usg_viewToggleButton:hover{color:var(--dsw-alias-label-primary)}",
			".usg_viewToggleButton[data-active]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base)));font-weight:500}",
			// The monthly curve: an inline SVG sized to the panel width. The area
			// fill is a vertical gradient of the same blue used by the heatmap, so
			// the two views read as one series in two projections.
			".usg_curve{padding:2px 0 0}",
			".usg_curveSvg{display:block;width:100%;height:auto;overflow:visible}",
			".usg_curvePeak{color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
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
			day: "usg_day",
			dayDate: "usg_dayDate",
			dayTokens: "usg_dayTokens",
			dayHit: "usg_dayHit",
			dayBar: "usg_dayBar",
			dayBarTrack: "usg_dayBarTrack",
			modelRank: "usg_modelRank",
			modelRankRow: "usg_modelRankRow",
			modelRankName: "usg_modelRankName",
			modelRankTrack: "usg_modelRankTrack",
			modelRankBar: "usg_modelRankBar",
			modelRankTokens: "usg_modelRankTokens",
			modelRankEmpty: "usg_modelRankEmpty",
			viewToggle: "usg_viewToggle",
			viewToggleButton: "usg_viewToggleButton",
			curve: "usg_curve",
			curveSvg: "usg_curveSvg",
			curvePeak: "usg_curvePeak",
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
		 * Today's per-model ranking, built from today's day entry on the usage
		 * wire (`models` is already sorted descending by tokens server-side; this
		 * re-sorts defensively and drops zero-token rows). Each row carries the
		 * exact token count plus the share of today's total that the bar width
		 * uses, so the bar means "share of today", not "share of the top model".
		 * @param day - today's wire day entry, or null/undefined when absent.
		 * @param limit - maximum rows to render.
		 * @returns `{ rows, total, top }`.
		 */
		function buildTodayModelRows(day, limit = 5) {
			const empty = { rows: [], total: 0, top: 0 };
			if (day === null || day === void 0 || typeof day !== "object") return empty;
			if (!Array.isArray(day.models) || !Number.isInteger(limit) || limit <= 0) return empty;
			const rows = day.models
				.filter((model) => model !== null && typeof model === "object"
					&& typeof model.model === "string" && model.model !== ""
					&& typeof model.tokens === "number" && Number.isFinite(model.tokens) && model.tokens > 0)
				.sort((a, b) => b.tokens - a.tokens)
				.slice(0, limit);
			const total = typeof day.tokens === "number" && Number.isFinite(day.tokens) && day.tokens > 0
				? day.tokens
				: rows.reduce((sum, model) => sum + model.tokens, 0);
			const top = rows.length > 0 ? rows[0].tokens : 0;
			const withShare = rows.map((model) => ({
				...model,
				share: total > 0 ? Math.max(2, Math.round(100 * model.tokens / total)) : 0
			}));
			return { rows: withShare, total, top };
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
		 * Catmull-Rom → cubic Bézier: a smooth path through every sample without
		 * the overshoot of a naive quadratic join. `tension` 0 gives straight
		 * segments; the default 0.5 is the classic cardinal spline. Control points
		 * are clamped to the plot box so the curve never dips below the baseline
		 * or above the top padding on a spiky series.
		 */
		function smoothPath(points, tension = 0.5) {
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
		 * One month's daily-token curve for the same series the calendar heatmap
		 * draws. Every day of the month is a sample (zero-token days sit on the
		 * baseline), so the horizontal axis stays a real time axis instead of
		 * collapsing the gaps. Returns the line/area path strings, the sample
		 * points for hit-testing, and the month's peak.
		 * @param dayMap - date key → day entry map.
		 * @param year - calendar year.
		 * @param month - zero-based month.
		 */
		function buildMonthCurve(dayMap, year, month) {
			const daysInMonth = new Date(year, month + 1, 0).getDate();
			const samples = [];
			let max = 0;
			for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
				const key = dayKeyOf(new Date(year, month, dayNum));
				const entry = dayMap.get(key);
				const tokens = entry?.tokens ?? 0;
				samples.push({ key, day: dayNum, tokens, hitRate: entry?.cacheHitRate ?? null });
				if (tokens > max) max = tokens;
			}
			const plotHeight = CURVE_HEIGHT - CURVE_PAD_TOP - CURVE_PAD_BOTTOM;
			const step = samples.length > 1 ? CURVE_WIDTH / (samples.length - 1) : 0;
			// The curve uses a square-root scale, matching the heatmap's colour
			// mapping: a single huge day would otherwise flatten every other day
			// into an unreadable line along the baseline.
			const points = samples.map((sample, index) => ({
				...sample,
				x: Number((index * step).toFixed(2)),
				y: Number((CURVE_HEIGHT - CURVE_PAD_BOTTOM - (max > 0 ? Math.sqrt(sample.tokens / max) : 0) * plotHeight).toFixed(2))
			}));
			const line = smoothPath(points);
			const baseline = (CURVE_HEIGHT - CURVE_PAD_BOTTOM).toFixed(2);
			const area = line === "" ? "" : `${line} L ${CURVE_WIDTH} ${baseline} L 0 ${baseline} Z`;
			return { samples, points, line, area, max, width: CURVE_WIDTH, height: CURVE_HEIGHT };
		}

		/**
		 * Month-view preference ("heat" calendar vs "curve" line) persisted in the
		 * browser's namespaced localStorage. Storage may be disabled or quota
		 * limited, so both helpers fail closed to the calendar view and never
		 * throw into render.
		 */
		const VIEW_STORAGE_KEY = "@uskyu/dsh-usage-stats:view:v1";

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
				return "heat";
			} catch {
				return "heat";
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
			const [refreshedAt, setRefreshedAt] = react.useState(null);
			const mountedRef = react.useRef(true);
			const usageLoaderRef = react.useRef(null);
			const layerRef = react.useRef(null);
			const panelRef = react.useRef(null);
			if (usageLoaderRef.current === null) usageLoaderRef.current = createLoader();
			const closePanel = react.useCallback(() => {
				writeStoredView(view);
				setOpen(false);
			}, [view]);
			const selectView = react.useCallback((next) => {
				if (next !== "heat" && next !== "curve") return;
				setView(next);
				writeStoredView(next);
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

			const curve = react.useMemo(() => {
				const [year, monthOneBased] = viewMonth.split("-").map(Number);
				return buildMonthCurve(dayMap, year, monthOneBased - 1);
			}, [dayMap, viewMonth]);

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
				return { dayTokens, monthTokens, total, todayHit: todayEntry?.cacheHitRate ?? null, todayEntry };
			}, [usage]);

			const recent = react.useMemo(() => {
				// Last 14 CALENDAR days (not "last 14 recorded days"): days without
				// usage inside the window are omitted from the list.
				if (usage === null || !Array.isArray(usage.days)) return [];
				const cutoff = new Date();
				cutoff.setDate(cutoff.getDate() - 13);
				const cutoffKey = dayKeyOf(cutoff);
				return usage.days.filter((day) => day.date >= cutoffKey && day.date <= todayKey()).reverse();
			}, [usage]);
			const todayModels = react.useMemo(() => buildTodayModelRows(stats?.todayEntry ?? null), [stats]);

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
															react_jsx_runtime.jsx("h3", { className: S.sectionTitle, children: view === "curve" ? translate("usage.curve") : translate("usage.heatmap") }),
															react_jsx_runtime.jsxs("div", {
																className: S.monthNav,
																children: [
																	react_jsx_runtime.jsx("button", {
																		type: "button",
																		className: S.navButton,
																		"aria-label": translate("action.prevMonth"),
																		onClick: () => setViewMonth((month) => shiftMonth(month, -1)),
																		children: react_jsx_runtime.jsx(IconChevronLeft, { size: 12 })
																	}),
																	react_jsx_runtime.jsx("span", { className: S.monthTitle, children: monthLabelOf(viewMonth, translate) }),
																	react_jsx_runtime.jsx("button", {
																		type: "button",
																		className: S.navButton,
																		"aria-label": translate("action.nextMonth"),
																		disabled: viewMonth >= currentMonthKey(),
																		onClick: () => setViewMonth((month) => shiftMonth(month, 1)),
																		children: react_jsx_runtime.jsx(IconChevronRight, { size: 12 })
																	}),
																	viewMonth !== currentMonthKey() && react_jsx_runtime.jsx("button", {
																		type: "button",
																		className: S.todayButton,
																		onClick: () => setViewMonth(currentMonthKey()),
																		children: translate("action.today")
																	})
																]
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
																"data-view": "heat",
																"data-active": view === "heat" ? "true" : void 0,
																"aria-pressed": view === "heat",
																onClick: () => selectView("heat"),
																children: translate("usage.viewHeat")
															}),
															react_jsx_runtime.jsx("button", {
																type: "button",
																className: S.viewToggleButton,
																"data-view": "curve",
																"data-active": view === "curve" ? "true" : void 0,
																"aria-pressed": view === "curve",
																onClick: () => selectView("curve"),
																children: translate("usage.viewCurve")
															})
														]
													}),
													view === "curve" ? react_jsx_runtime.jsx(MonthCurve, {
														curve,
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
										recent.length > 0 && react_jsx_runtime.jsxs("section", {
												className: S.section,
												children: [
													react_jsx_runtime.jsx("h3", { className: S.sectionTitle, children: translate("usage.recent") }),
													react_jsx_runtime.jsx("div", {
														className: S.days,
														children: recent.map((day) => {
															const maxRecent = Math.max(...recent.map((d) => d.tokens ?? 0), 1);
															return react_jsx_runtime.jsxs("button", {
																type: "button",
																className: S.day,
																onClick: () => setSelectedDay(day.date),
																children: [
																	react_jsx_runtime.jsx("span", { className: S.dayDate, children: dayLabel(day.date, translate) }),
																	react_jsx_runtime.jsx("span", { className: S.dayTokens, title: fmtExact(day.tokens ?? 0), children: fmt(day.tokens ?? 0) }),
																	react_jsx_runtime.jsx("span", { className: S.dayHit, children: fmtHit(day.cacheHitRate) }),
																	react_jsx_runtime.jsx("div", {
																		className: S.dayBarTrack,
																		"aria-hidden": true,
																		children: react_jsx_runtime.jsx("div", {
																			className: S.dayBar,
																			style: { width: `${Math.max(4, Math.round(100 * (day.tokens ?? 0) / maxRecent))}%` }
																		})
																	})
																]
															}, day.date);
														})
													})
												]
										}),
										stats !== null && react_jsx_runtime.jsxs("section", {
											className: S.section,
											children: [
												react_jsx_runtime.jsx("h3", { className: S.sectionTitle, children: translate("todayModels.title") }),
												todayModels.rows.length === 0
													? react_jsx_runtime.jsx("p", { className: S.modelRankEmpty, children: translate("todayModels.empty") })
													: react_jsx_runtime.jsx("div", {
														className: S.modelRank,
														children: todayModels.rows.map((model) => react_jsx_runtime.jsxs("div", {
															className: S.modelRankRow,
															"data-model-rank": model.model,
															children: [
																react_jsx_runtime.jsx("span", {
																	className: S.modelRankName,
																	title: modelLabelOf(model.model, translate),
																	children: modelLabelOf(model.model, translate)
																}),
																react_jsx_runtime.jsx("div", {
																	className: S.modelRankTrack,
																	"aria-hidden": true,
																	children: react_jsx_runtime.jsx("div", {
																		className: S.modelRankBar,
																		style: { width: `${model.share}%` }
																	})
																}),
																react_jsx_runtime.jsx("span", {
																	className: S.modelRankTokens,
																	title: `${fmtExact(model.tokens)} tokens`,
																	children: fmt(model.tokens)
																})
															]
														}, model.model))
													})
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
		 * The same month's daily usage drawn as a smooth curve instead of a
		 * calendar. Each day is an invisible hit target so clicking a point still
		 * opens that day's per-model detail, matching the heatmap's contract.
		 */
		function MonthCurve({ curve, translate, selectedKey, onSelect }) {
			const select = typeof onSelect === "function" ? onSelect : () => {};
			const gradientId = "usg_curveFill";
			const points = Array.isArray(curve?.points) ? curve.points : [];
			return react_jsx_runtime.jsxs("div", {
				className: S.curve,
				children: [
					react_jsx_runtime.jsxs("svg", {
						className: S.curveSvg,
						viewBox: `0 0 ${curve?.width ?? CURVE_WIDTH} ${curve?.height ?? CURVE_HEIGHT}`,
						preserveAspectRatio: "none",
						role: "img",
						"aria-label": translate("usage.curve"),
						children: [
							react_jsx_runtime.jsxs("defs", {
								children: [
									react_jsx_runtime.jsxs("linearGradient", {
										id: gradientId,
										x1: "0",
										y1: "0",
										x2: "0",
										y2: "1",
										children: [
											react_jsx_runtime.jsx("stop", { offset: "0%", stopColor: `rgba(${BLUE_RGB[0]}, ${BLUE_RGB[1]}, ${BLUE_RGB[2]}, 0.35)` }),
											react_jsx_runtime.jsx("stop", { offset: "100%", stopColor: `rgba(${BLUE_RGB[0]}, ${BLUE_RGB[1]}, ${BLUE_RGB[2]}, 0.02)` })
										]
									})
								]
							}),
							// Baseline: gives the eye a zero reference even in a month
							// where every other day is empty.
							react_jsx_runtime.jsx("line", {
								x1: 0,
								y1: (curve?.height ?? CURVE_HEIGHT) - CURVE_PAD_BOTTOM,
								x2: curve?.width ?? CURVE_WIDTH,
								y2: (curve?.height ?? CURVE_HEIGHT) - CURVE_PAD_BOTTOM,
								stroke: "var(--dsw-alias-border-l2)",
								strokeWidth: 1,
								vectorEffect: "non-scaling-stroke"
							}),
							curve?.area ? react_jsx_runtime.jsx("path", { d: curve.area, fill: `url(#${gradientId})`, stroke: "none" }) : null,
							curve?.line ? react_jsx_runtime.jsx("path", {
								d: curve.line,
								fill: "none",
								stroke: `rgba(${BLUE_RGB[0]}, ${BLUE_RGB[1]}, ${BLUE_RGB[2]}, 0.95)`,
								strokeWidth: 2,
								strokeLinecap: "round",
								strokeLinejoin: "round",
								vectorEffect: "non-scaling-stroke"
							}) : null,
							points.map((point) => {
								const isSelected = selectedKey === point.key;
								const hit = point.hitRate === null || point.hitRate === void 0 ? "" : ` · ${translate("usage.hitRate")} ${point.hitRate}%`;
								return react_jsx_runtime.jsxs("g", {
									children: [
										// A visible dot only for the selected / non-empty peaks would
										// still be noisy at 31 samples, so the marker is drawn on
										// hover and for the current selection.
										isSelected ? react_jsx_runtime.jsx("circle", {
											cx: point.x,
											cy: point.y,
											r: 3,
											fill: "var(--dsw-alias-label-primary)",
											stroke: "var(--dsw-alias-bg-base)",
											strokeWidth: 1.5,
											vectorEffect: "non-scaling-stroke"
										}) : null,
										react_jsx_runtime.jsx("rect", {
											x: point.x - ((curve?.width ?? CURVE_WIDTH) / Math.max(1, points.length)) / 2,
											y: 0,
											width: (curve?.width ?? CURVE_WIDTH) / Math.max(1, points.length),
											height: curve?.height ?? CURVE_HEIGHT,
											fill: "transparent",
											"data-curve-day": point.key,
											role: "button",
											tabIndex: 0,
											"aria-label": `${point.key} · ${fmt(point.tokens)} tokens`,
											onClick: () => select(point.key),
											onKeyDown: (event) => {
												if (event.key === "Enter" || event.key === " ") select(point.key);
											},
											children: react_jsx_runtime.jsx("title", { children: `${point.key} · ${fmtExact(point.tokens)} tokens${hit}` })
										})
									]
								}, point.key);
							})
						]
					}),
					react_jsx_runtime.jsx("p", {
						className: S.curvePeak,
						children: translate("usage.curvePeak", { value: fmt(curve?.max ?? 0) })
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
			"usage.curve": "当月用量曲线",
			"usage.curvePeak": "本月峰值 {value}",
			"usage.viewToggle": "用量视图",
			"usage.viewHeat": "日历",
			"usage.viewCurve": "曲线",
			"usage.recent": "最近 14 天",
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
			"todayModels.title": "今日模型消耗",
			"todayModels.empty": "今天还没有用量记录。",
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
			"usage.curve": "Daily usage curve",
			"usage.curvePeak": "Month peak {value}",
			"usage.viewToggle": "Usage view",
			"usage.viewHeat": "Calendar",
			"usage.viewCurve": "Curve",
			"usage.recent": "Last 14 days",
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
			"todayModels.title": "Today by model",
			"todayModels.empty": "No usage recorded today yet.",
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
		exports.MonthCurve = MonthCurve;
		exports.buildMonthHeatmap = buildMonthHeatmap;
		exports.buildMonthCurve = buildMonthCurve;
		exports.smoothPath = smoothPath;
		exports.cellColor = cellColor;
		exports.createLoader = createLoader;
		exports.buildTodayModelRows = buildTodayModelRows;
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
		return module.exports;
	}
});
