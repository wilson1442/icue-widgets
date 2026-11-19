/*
 * UniFi Stats widget for CORSAIR iCUE (XENEON EDGE).
 * Polls a UniFi OS console's Network API (X-API-KEY auth) and renders
 * internet status, WAN throughput, clients, and device health.
 */
(function () {
	"use strict";

	const IN_ICUE = typeof iCUE !== "undefined";
	const HISTORY_POINTS = 60;
	const REQUEST_TIMEOUT_MS = 8000;

	// ---------------------------------------------------------------------
	// Standalone shim: when opened in a normal browser (no iCUE), define the
	// settings globals from each meta tag's data-default, overridable via the
	// query string, e.g. index.html?unifiUrl=http://localhost:8443&apiKey=...
	// ---------------------------------------------------------------------
	if (!IN_ICUE) {
		window.tr = (s) => Promise.resolve(s);
		const params = new URLSearchParams(location.search);
		document.querySelectorAll('meta[name="x-icue-property"]').forEach((meta) => {
			const name = meta.getAttribute("content");
			let value;
			try {
				value = new Function("tr", "return (" + (meta.dataset.default || "undefined") + ");")((s) => s);
			} catch (e) {
				value = undefined;
			}
			if (params.has(name)) {
				const raw = params.get(name);
				if (typeof value === "number") value = Number(raw);
				else if (typeof value === "boolean") value = raw === "true";
				else value = raw;
			}
			window[name] = value;
		});
	}

	function readSettings() {
		/* global unifiUrl, apiKey, siteName, refreshSeconds, speedUnit, showGraph, textColor, accentColor, backgroundColor */
		return {
			url: normalizeUrl(typeof unifiUrl !== "undefined" ? unifiUrl : ""),
			key: typeof apiKey !== "undefined" ? String(apiKey || "").trim() : "",
			site: (typeof siteName !== "undefined" && String(siteName).trim()) || "default",
			refresh: Math.max(2, Number(typeof refreshSeconds !== "undefined" ? refreshSeconds : 5) || 5),
			unit: typeof speedUnit !== "undefined" ? speedUnit : "mbps",
			graph: typeof showGraph !== "undefined" ? !!showGraph : true,
			text: typeof textColor !== "undefined" ? textColor : "#E8EDF2",
			accent: typeof accentColor !== "undefined" ? accentColor : "#2D8CFF",
			bg: typeof backgroundColor !== "undefined" ? backgroundColor : "#000000",
		};
	}

	function normalizeUrl(u) {
		u = String(u || "").trim().replace(/\/+$/, "");
		if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
		return u;
	}

	// ---------------------------------------------------------------------
	// DOM helpers
	// ---------------------------------------------------------------------
	const $ = (id) => document.getElementById(id);
	const setText = (id, v) => {
		const el = $(id);
		if (el && el.textContent !== String(v)) el.textContent = v;
	};
	const T = {}; // translated runtime strings

	async function translateStatic() {
		const keys = ["Online", "Offline", "Degraded"];
		const nodes = Array.from(document.querySelectorAll("[data-tr]"));
		const all = keys.concat(nodes.map((n) => n.dataset.tr));
		const out = await Promise.all(all.map((k) => Promise.resolve(tr(k)).catch(() => k)));
		all.forEach((k, i) => (T[k] = out[i] || k));
		nodes.forEach((n) => (n.textContent = T[n.dataset.tr]));
	}

	function showBanner(kind, msg) {
		const b = $("banner");
		document.body.classList.toggle("has-banner", !!msg);
		if (!msg) {
			b.className = "hidden";
			return;
		}
		b.className = kind;
		b.textContent = msg;
	}

	// ---------------------------------------------------------------------
	// Formatting
	// ---------------------------------------------------------------------
	function formatSpeed(bytesPerSec, unit) {
		const b = Math.max(0, Number(bytesPerSec) || 0);
		if (unit === "mbs") {
			const mb = b / 1e6;
			if (mb >= 1000) return [(mb / 1000).toFixed(2), "GB/s"];
			return [mb >= 100 ? mb.toFixed(0) : mb.toFixed(mb >= 10 ? 1 : 2), "MB/s"];
		}
		const mbps = (b * 8) / 1e6;
		if (mbps >= 1000) return [(mbps / 1000).toFixed(2), "Gbps"];
		return [mbps >= 100 ? mbps.toFixed(0) : mbps.toFixed(mbps >= 10 ? 1 : 2), "Mbps"];
	}

	const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

	// ---------------------------------------------------------------------
	// Data: fetch + parse UniFi /stat/health
	// ---------------------------------------------------------------------
	class HttpError extends Error {
		constructor(status) {
			super("HTTP " + status);
			this.status = status;
		}
	}

	async function getJson(url, key) {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
		try {
			const res = await fetch(url, {
				method: "GET",
				headers: { "X-API-KEY": key, Accept: "application/json" },
				cache: "no-store",
				signal: ctrl.signal,
			});
			if (!res.ok) throw new HttpError(res.status);
			return await res.json();
		} finally {
			clearTimeout(timer);
		}
	}

	function parseHealth(json) {
		const subs = {};
		(json && Array.isArray(json.data) ? json.data : []).forEach((s) => (subs[s.subsystem] = s));
		const wan = subs.wan || {};
		const www = subs.www || {};
		const wlan = subs.wlan || {};
		const lan = subs.lan || {};
		const gw = wan["gw_system-stats"] || {};

		const devCount = (s, key) => {
			const total = num(s.num_adopted) !== null ? num(s.num_adopted) : num(s[key]) || 0;
			const online = Math.max(0, total - (num(s.num_disconnected) || 0) - (num(s.num_pending) || 0));
			return { online, total };
		};

		return {
			status: www.status || wan.status || "unknown",
			isp: wan.isp_name || wan.isp_organization || "",
			wanIp: wan.wan_ip || "",
			latency: num(www.latency),
			rx: num(wan["rx_bytes-r"]) || 0,
			tx: num(wan["tx_bytes-r"]) || 0,
			wifi: num(wlan.num_user) || 0,
			wired: num(lan.num_user) || 0,
			guests: (num(wlan.num_guest) || 0) + (num(lan.num_guest) || 0),
			aps: devCount(wlan, "num_ap"),
			switches: devCount(lan, "num_sw"),
			cpu: num(gw.cpu),
			mem: num(gw.mem),
		};
	}

	// Demo data so the widget looks alive in the iCUE preview or before setup.
	let demoT = 0;
	function demoData() {
		demoT += 1;
		const wave = (p, a) => Math.max(0, Math.sin(demoT / p) * a + a + Math.random() * a * 0.6);
		return {
			status: "ok",
			isp: "Example ISP",
			wanIp: "203.0.113.24",
			latency: 9 + Math.round(Math.random() * 4),
			rx: wave(5, 18e6),
			tx: wave(7, 3e6),
			wifi: 31,
			wired: 14,
			guests: 3,
			aps: { online: 4, total: 4 },
			switches: { online: 3, total: 3 },
			cpu: 12 + Math.random() * 10,
			mem: 46 + Math.random() * 3,
		};
	}

	// ---------------------------------------------------------------------
	// Rendering
	// ---------------------------------------------------------------------
	let history = [];
	let lastData = null;

	function render(d, cfg) {
		const statusClass = d.status === "ok" ? "ok" : d.status === "unknown" ? "" : d.status === "warning" ? "warn" : "bad";
		$("wan-dot").className = "dot " + statusClass;
		setText("wan-status", d.status === "ok" ? T.Online : d.status === "warning" ? T.Degraded : d.status === "unknown" ? "--" : T.Offline);
		setText("wan-isp", d.isp || "--");
		setText("wan-ip", d.wanIp || "--");
		setText("wan-latency", d.latency !== null ? d.latency + " ms" : "--");

		const [rxv, rxu] = formatSpeed(d.rx, cfg.unit);
		const [txv, txu] = formatSpeed(d.tx, cfg.unit);
		setText("rx", rxv);
		setText("rx-unit", rxu);
		setText("tx", txv);
		setText("tx-unit", txu);

		setText("clients-total", d.wifi + d.wired + d.guests);
		setText("clients-wifi", d.wifi);
		setText("clients-wired", d.wired);
		setText("clients-guest", d.guests);

		setText("dev-ap", d.aps.online + " / " + d.aps.total);
		setText("dev-sw", d.switches.online + " / " + d.switches.total);
		setMeter("gw-cpu", d.cpu);
		setMeter("gw-mem", d.mem);

		drawGraph();
	}

	function setMeter(id, pct) {
		const fill = $(id);
		if (pct === null || Number.isNaN(pct)) {
			fill.style.width = "0%";
			setText(id + "-v", "--");
			return;
		}
		const p = Math.min(100, Math.max(0, pct));
		fill.style.width = p + "%";
		fill.className = "fill" + (p >= 90 ? " bad" : p >= 75 ? " warn" : "");
		setText(id + "-v", p.toFixed(0) + "%");
	}

	function drawGraph() {
		const canvas = $("graph");
		if (!canvas || document.body.classList.contains("no-graph")) return;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		if (w < 4 || h < 4) return;
		const dpr = window.devicePixelRatio || 1;
		if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
		}
		const ctx = canvas.getContext("2d");
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);

		const css = getComputedStyle(document.documentElement);
		const accent = css.getPropertyValue("--accent").trim() || "#2D8CFF";
		const good = css.getPropertyValue("--good").trim() || "#3DDC84";
		const line = css.getPropertyValue("--line").trim() || "rgba(255,255,255,0.12)";

		// baseline
		ctx.strokeStyle = line;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, h - 0.5);
		ctx.lineTo(w, h - 0.5);
		ctx.stroke();

		if (history.length < 2) return;
		const max = Math.max(1, ...history.map((p) => Math.max(p.rx, p.tx))) * 1.15;
		const step = w / (HISTORY_POINTS - 1);
		const x0 = w - (history.length - 1) * step;

		const series = (key, color, fillAlpha) => {
			ctx.beginPath();
			history.forEach((p, i) => {
				const x = x0 + i * step;
				const y = h - (p[key] / max) * (h - 2);
				i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
			});
			ctx.strokeStyle = color;
			ctx.lineWidth = Math.max(1.5, h / 60);
			ctx.lineJoin = "round";
			ctx.stroke();
			ctx.lineTo(w, h);
			ctx.lineTo(x0, h);
			ctx.closePath();
			ctx.globalAlpha = fillAlpha;
			ctx.fillStyle = color;
			ctx.fill();
			ctx.globalAlpha = 1;
		};
		series("rx", accent, 0.18);
		series("tx", good, 0.12);
	}

	function applyStyle(cfg) {
		const root = document.documentElement.style;
		root.setProperty("--text", cfg.text);
		root.setProperty("--accent", cfg.accent);
		root.setProperty("--bg", cfg.bg);
		document.body.classList.toggle("no-graph", !cfg.graph);
	}

	// ---------------------------------------------------------------------
	// Polling loop
	// ---------------------------------------------------------------------
	let cfg = null;
	let connSig = "";
	let generation = 0;
	let timer = null;

	function describeError(err, c) {
		const host = c.url.replace(/^https?:\/\//i, "");
		if (err instanceof HttpError) {
			if (err.status === 401 || err.status === 403) return "API key rejected (" + err.status + ") - check the key in widget settings";
			if (err.status === 400 || err.status === 404) return "Site '" + c.site + "' not found on " + host;
			return "Console returned HTTP " + err.status;
		}
		if (err && err.name === "AbortError") return "Timed out reaching " + host;
		return "Can't reach " + host + " - check URL, allow the permission, or use the local proxy";
	}

	async function poll(g) {
		const c = cfg;
		try {
			let data;
			if (!c.key || !c.url) {
				if (history.length === 0) {
					for (let i = 0; i < HISTORY_POINTS - 1; i++) {
						const d = demoData();
						history.push({ rx: d.rx, tx: d.tx });
					}
				}
				data = demoData();
				showBanner("demo", "Demo data - set Console URL and API Key in widget settings");
			} else {
				const json = await getJson(c.url + "/proxy/network/api/s/" + encodeURIComponent(c.site) + "/stat/health", c.key);
				data = parseHealth(json);
				showBanner(null);
			}
			if (g !== generation) return;
			lastData = data;
			history.push({ rx: data.rx, tx: data.tx });
			if (history.length > HISTORY_POINTS) history.shift();
			$("app").classList.remove("stale");
			render(data, c);
		} catch (err) {
			if (g !== generation) return;
			console.error("UniFi Stats:", err);
			showBanner("error", describeError(err, c));
			$("app").classList.add("stale");
		}
	}

	async function loop(g) {
		await poll(g);
		if (g !== generation) return;
		timer = setTimeout(() => loop(g), cfg.refresh * 1000);
	}

	function restartPolling() {
		generation += 1;
		clearTimeout(timer);
		history = [];
		lastData = null;
		loop(generation);
	}

	function onSettingsChanged() {
		cfg = readSettings();
		applyStyle(cfg);
		const sig = [cfg.url, cfg.key, cfg.site].join("|");
		if (sig !== connSig) {
			connSig = sig;
			restartPolling();
		} else if (lastData) {
			render(lastData, cfg); // unit/colour change: re-render immediately
		}
	}

	let started = false;
	async function start() {
		if (started) return;
		started = true;
		await translateStatic();
		onSettingsChanged();
		new ResizeObserver(() => drawGraph()).observe($("graph"));
	}

	window.icueEvents = {
		onICUEInitialized: start,
		onDataUpdated: () => (started ? onSettingsChanged() : start()),
	};

	if (!IN_ICUE || (typeof iCUE_initialized !== "undefined" && iCUE_initialized)) {
		start();
	}
})();
