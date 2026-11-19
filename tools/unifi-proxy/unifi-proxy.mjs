#!/usr/bin/env node
/*
 * Minimal local CORS proxy for the UniFi Stats iCUE widget.
 *
 * Use it only if the widget can't talk to the console directly (CORS or
 * self-signed certificate blocked inside iCUE). The widget then uses
 * http://localhost:8443 as its Console URL. The API key still travels in
 * the widget's X-API-KEY header; this proxy stores nothing.
 *
 *   node unifi-proxy.mjs --target https://192.168.0.1 [--port 8443]
 *
 * Safety: listens on 127.0.0.1 only, forwards GET requests only, and only
 * for /proxy/network/ paths. No dependencies.
 */
import http from "node:http";
import https from "node:https";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
	const i = args.indexOf("--" + name);
	return i >= 0 && args[i + 1] ? args[i + 1] : process.env["UNIFI_PROXY_" + name.toUpperCase()] || fallback;
};

const target = new URL(arg("target", "https://192.168.0.1"));
const port = Number(arg("port", "8443"));
const insecureAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true }); // UniFi consoles use self-signed certs

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "X-API-KEY, Accept, Content-Type",
	"Access-Control-Max-Age": "600",
};

const server = http.createServer((req, res) => {
	if (req.method === "OPTIONS") {
		res.writeHead(204, CORS);
		return res.end();
	}
	if (req.method !== "GET" || !req.url.startsWith("/proxy/network/")) {
		res.writeHead(403, { ...CORS, "Content-Type": "text/plain" });
		return res.end("Only GET /proxy/network/* is forwarded");
	}

	const upstream = (target.protocol === "https:" ? https : http).request(
		{
			protocol: target.protocol,
			hostname: target.hostname,
			port: target.port || (target.protocol === "https:" ? 443 : 80),
			path: req.url,
			method: "GET",
			agent: target.protocol === "https:" ? insecureAgent : undefined,
			headers: {
				Accept: "application/json",
				...(req.headers["x-api-key"] ? { "X-API-KEY": req.headers["x-api-key"] } : {}),
			},
			timeout: 8000,
		},
		(up) => {
			res.writeHead(up.statusCode || 502, {
				...CORS,
				"Content-Type": up.headers["content-type"] || "application/json",
				"Cache-Control": "no-store",
			});
			up.pipe(res);
		}
	);
	upstream.on("timeout", () => upstream.destroy(new Error("upstream timeout")));
	upstream.on("error", (err) => {
		if (!res.headersSent) res.writeHead(502, { ...CORS, "Content-Type": "text/plain" });
		res.end("Upstream error: " + err.message);
	});
	upstream.end();
	console.log(new Date().toISOString(), "GET", req.url.split("?")[0]);
});

server.listen(port, "127.0.0.1", () => {
	console.log(`UniFi proxy: http://localhost:${port}  ->  ${target.origin}`);
});
