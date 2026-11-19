# Handoff: UniFi widgets for the XENEON EDGE

_Last updated: 2026-11-18_

This file records where the UniFi widget work stands, which decisions are still open, and what to do next. Read [CLAUDE.md](../CLAUDE.md) first: it covers the iCUE widget platform, the hard rules that break import, and the repo conventions.

---

## 1. Current state

### `widgets/unifi-stats` (`com.wilson1442.unifistats`)
- **Version 1.0.0 is built** at `dist/unifi-stats-1.0.0.icuewidget`. It passes `icuewidget-cli validate`.
- **Tested only in a browser** with demo data and the 401 error path. It has **not yet been loaded in iCUE or used with a real API key**. This is the most important open item.
- It reads `GET /proxy/network/api/s/<site>/stat/health` from the console with an `X-API-KEY` header. It shows four cards: Internet (status, ISP, WAN IP, latency), Throughput (down/up plus a 60-point graph), Clients (total, Wi-Fi, wired, guests), and Devices (APs, switches, gateway CPU and RAM).
- With no API key set, it shows demo data and an amber banner.
- **Layout:** one row of four cards on a wide tile (2560×720), a 2×2 grid at 1260×720, and a single column on a tall tile (720×1600).
- **Settings:** Console URL (default `https://192.168.0.1`), API Key, Site (`default`), Refresh (5 s), Speed Unit, Throughput Graph, and the Text, Accent and Background colors.
- **Manifest permissions:** `url` for `192.168.0.1:443`, `self_signed_certificate` for `192.168.0.1`, and `url` for `localhost:8443` (the proxy).

### `tools/unifi-proxy/unifi-proxy.mjs`
A fallback for when iCUE blocks direct calls to the console. The console sends no CORS headers and uses a self-signed certificate (`CN=unifi.local`).
- **Run:** `node tools/unifi-proxy/unifi-proxy.mjs --target https://192.168.0.1`
- **Behavior:** listens on `127.0.0.1:8443`, forwards only `GET /proxy/network/*`, adds CORS headers, and ignores the certificate.
- **Use it:** set the widget's Console URL to `http://localhost:8443`.

### Network
- `192.168.0.1` is the main UniFi console and LAN gateway, a UDM Pro Max.
- `192.168.1.1` is a second UniFi console.

---

## 2. Open decisions

### 2a. Screenshots inside the widget folder
The user asked for the renders to be saved to `widgets/unifi-stats/images/`. Three PNGs are there now:
- `unifi-2560x720.png`
- `unifi-1260x720.png`
- `unifi-720x1600.png`

**Problem:** `icuewidget-cli package` (v0.5.2) bundles the whole folder and cannot exclude files, so the next build would ship about 320 KB of unused images. The current `dist/` build predates the folder and is clean.

| Option | Description |
|---|---|
| 1 (recommended) | Move the PNGs to a top-level `screenshots/unifi-stats/` and add that folder to the CLAUDE.md layout. |
| 2 | Keep them in `images/`, accept the larger package, and update the CLAUDE.md housekeeping rule to allow it. |
| 3 | Keep them in `images/`, and package from a temporary copy that leaves `images/` out. Document that build step. |

**Waiting on the user.**

### 2b. Layout polish for `unifi-stats` (from the renders)
1. **Wide and 2×2 layouts:** the Clients and Devices cards have a large empty gap between the heading and the rows under it. Group the content together.
2. **Wide layout:** the headline numbers ("Online", "48") are too large compared with the rest of the card.
3. **Tall layout:** the demo banner text is cut off ("…in widget…"). It should wrap or be shortened.

Offered to the user; **not yet approved**.

---

## 3. Load and test `unifi-stats` in iCUE (next step)

1. **Create an API key.** In the UniFi Network app, go to **Settings → Control Plane → Integrations** and create a key. The menu location can differ between UniFi versions.
2. **Import the widget.** In iCUE, open **Widgets → +** and choose `S:\Claude-Code\i-cue\dist\unifi-stats-1.0.0.icuewidget`. Approve any prompts for network access or the self-signed certificate.
3. **Configure it.** Place the widget on an Edge tile, then set the Console URL to `https://192.168.0.1`, paste the API key, and leave Site as `default`.
4. **Interpret the result:**

| Result | Meaning and action |
|---|---|
| Real data appears | It works. Update the widgets table in CLAUDE.md. |
| Error, or still showing demo data | iCUE is probably blocking the request (certificate or CORS). Run the proxy and set the Console URL to `http://localhost:8443`. If that fixes it, consider starting the proxy automatically with Windows. |
| 401 | The key is wrong or lacks access to the Network app. |

This result decides the connection approach for **every** later UniFi widget, including Protect. Settle it before building anything new.

---

## 4. Proposed: UniFi Protect camera widget

The user wants to see their cameras on the Edge. Nothing is built yet.

### API
Use the official Protect Integration API under `/proxy/protect/integration/v1/...` with an `X-API-KEY` header:
- camera list (name, online state, recording state)
- per-camera **snapshot** (JPEG)
- event subscription (motion, smart detections, doorbell ring)
- turning on an **RTSPS** stream per camera

Avoid the unofficial `/proxy/protect/api/...` API, which needs a cookie session login.

### Video approaches

| Approach | Experience | Requirements |
|---|---|---|
| **A. Snapshot grid** (recommended first) | Each camera's image refreshes every 1–2 s. Close to live, low CPU and network use. | Widget plus API key only. Proxy fallback if needed. |
| **B. Live video** | Smooth live video. | A relay such as **go2rtc** (on this PC or the homelab) converts RTSPS to WebRTC, MSE or MJPEG for the widget. |

Build A first. B can reuse the same layout later.

### Planned features
- An auto-fitting camera grid that adapts to wide, tall and square tiles.
- **Tap** a camera to fill the tile with it, and tap again to return to the grid. Set `interactive: true` in the manifest.
- Each camera's border highlights on motion or person detection.
- A **doorbell ring** brings the doorbell camera up full size automatically.
- An "Offline" placeholder for unreachable cameras.

### Unknowns to verify
- Does one UniFi OS API key work for both the Network and Protect integration APIs? It should on recent versions, but this is unconfirmed.
- The same certificate and CORS issue as `unifi-stats`. The proxy would need to allow `/proxy/protect/integration/*`, and possibly WebSocket pass-through for events.
- **Approach B only:** iCUE's QtWebEngine may not support H.264. Its media selector accepts `.mp4`, which suggests it does, but this is untested. go2rtc's MJPEG output avoids the question.

### Questions waiting on the user
1. Which console runs Protect: `192.168.0.1` (the UDM Pro Max) or `192.168.1.1`?
2. Roughly how many cameras are there, and is there a doorbell?
3. Start with snapshots (A), or go straight to live video with go2rtc (B)?

---

## 5. Other UniFi widget ideas (backlog)

All of these use the same console and API key. Plan each as its own small widget, sharing a copied-in connection helper module.

| Widget | Data source |
|---|---|
| **Top Clients** (bandwidth leaders, live rates) | `stat/sta` |
| **Switch Ports** (link, speed, PoE watts, traffic per port) | `stat/device` |
| **Access Points** (clients, channel, utilization, uptime per AP) | `stat/device` |
| **Guest Wi-Fi QR** (tap to show a join QR code) | `rest/wlanconf` |
| **Traffic History** (24 h or 30 d bars) | `stat/report/hourly.site`, `daily.site` |
| **Top Apps** | `stat/sitedpi` (needs traffic identification enabled) |
| **Speed Test** (history, optional run button) | `stat/report/archive.speedtest` |
| **Events / Alerts** feed | `stat/event`, `stat/alarm` |
| **Updates and Uptime** | `stat/device`, `stat/sysinfo` |
| **VPN users** | `vpn` subsystem in `stat/health` |

- **Suggested first picks:** Top Clients, Switch Ports, Guest Wi-Fi QR.
- **Possible touch actions:** restart an AP, block or unblock a client, toggle guest Wi-Fi. Each needs a confirmation step and an API key with write access.

---

## 6. Next steps, in order

1. Load `unifi-stats` in iCUE with a real key and record the result (section 3).
2. Resolve the screenshot location (2a).
3. Apply the layout polish if approved (2b), bump to 1.0.1, repackage, and replace the old build in `dist/`.
4. Get answers to the Protect questions (section 4) and build the snapshot grid.
5. Pick backlog widgets from section 5.
