# iCUE Widgets Workspace

This repo holds custom **CORSAIR iCUE widgets**: HTML/CSS/JS mini-apps shown on Corsair LCD devices (XENEON EDGE, VANGUARD keyboard LCDs, iCUE LINK pump LCDs). Each widget is packaged as a `.icuewidget` file and imported into iCUE.

- Official docs: https://docs.elgato.com/icue/widgets/ (spec at `/icue/widgets/specification`, references under `/icue/widgets/references/...`)
- CLI: `icuewidget-cli` on npm (v0.5.2 at time of writing)
- **Ground truth:** the built-in Corsair widgets installed locally are the best reference. They are more complete than the docs:
  `C:\Program Files\Corsair\Corsair iCUE5 Software\widgets\com\corsair\` (weather, sensor, sensorlist, fps, mediasession, streamdeck, calendar, clocks, etc.)
  When a doc detail is unclear, read the matching built-in widget before guessing.

## Target device: CORSAIR XENEON EDGE

Unless told otherwise, **every widget targets only the XENEON EDGE** (`"type": "dashboard_lcd"`).
- 14.5" **touchscreen** LCD, 2560×720 (32:9). It can be mounted landscape or portrait (720×2560).
- A widget occupies a tile/slot on the Edge, not necessarily the full screen. The tile can be resized, so **layouts must adapt to any size and aspect ratio** (wide, tall, or near-square). Use `vmin`/`%`, flex/grid, and container-aware sizing. Never hardcode 2560×720.
- It is touch-capable, so set `"interactive": true` when the widget has buttons, taps, or swipes. Size touch targets generously (at least about 10vmin).
- Use the exact control names `textColor`, `accentColor`, and `backgroundColor` in a group to get the Edge's "Custom Style" toggle and device-default theming.
- Supporting `keyboard_lcd` or `pump_lcd` is opt-in per widget. Add them only when asked.

## Environment

- Windows 11, iCUE 5.54.46 installed, Node v22, npm 10
- Widget runtime: Widget API 1.9.0, QtWebEngine 6.9.3 = **Chromium 130**. Modern JS/CSS is fine: ES modules, top-level `await` in `<script type="module">`, CSS variables, flex/grid, `vmin`. No build step needed.

## Repo layout (convention for this workspace)

```
i-cue/
  CLAUDE.md
  widgets/
    <widget-name>/          # one folder per widget = the widget root that gets packaged
      manifest.json
      index.html
      translation.json
      resources/icon.svg
      styles/  scripts/  modules/
      common/               # copied from the iCUE install ONLY if the widget needs it (see below)
  dist/                     # built .icuewidget packages (output, not source)
  tools/
    <tool-name>/            # dev/runtime helpers that are NOT packaged (e.g. unifi-proxy)
  docs/                     # handoff docs and plans (e.g. handoff-unifi.md); read these when resuming work
```

- Folder names are kebab-case. Widget IDs use reverse-DNS: `com.wilson1442.<widgetname>`. Allowed characters are lowercase a-z, 0-9, `-`, and `.`.
- Every widget is self-contained. Don't reference files outside its own folder in a packaged widget.

### Housekeeping rules (keep the repo organized)

- **Nothing else at the repo root.** Only `CLAUDE.md`, `widgets/`, `dist/`, `tools/`, `docs/` (plus `.gitignore`/`README.md` if added).
- **No scratch files in the repo.** Test screenshots, test harness pages, temp JSON, and downloaded references go in the session scratchpad, never in `widgets/` or the root. Anything inside `widgets/<name>/` gets packaged, so keep it to shipping files only.
- **`dist/` naming:** `<widget-folder>-<version>.icuewidget`. Keep only the **latest** build per widget and delete older versions when you repackage.
- **`tools/<name>/`:** one folder per helper, kebab-case, with a usage comment at the top of the main file. Name the widget it serves in the "Widgets in this repo" notes.
- **Copied `common/` helpers:** copy only the files a widget actually loads, and keep the iCUE install's subpath (`common/plugins/...`, `common/tools/...`).
- **Keep docs in sync:** when you add, rename, or remove a widget or tool, update the layout above and the "Widgets in this repo" table in the same change.

## Workflow

```bash
npx icuewidget-cli init widgets/<name>        # scaffold (hello-world, windows + dashboard_lcd)
npx icuewidget-cli validate widgets/<name>    # validate manifest, files, and <head> XML
npx icuewidget-cli package widgets/<name>     # validate and build the .icuewidget
npx icuewidget-cli update widgets/<name> --min-app-version 5.47   # bump version, repackage
```

- After `init`, check `id` (`com.wilson1442.<name>`), `author`, and `interactive` in the manifest. The scaffold already targets `dashboard_lcd` (XENEON EDGE), which is our default.
- Move the built `.icuewidget` into `dist/` as `<widget-folder>-<version>.icuewidget` and remove that widget's older builds. Don't leave a copy where the CLI wrote it.
- **Install:** iCUE > Widgets section > **+** > choose the `.icuewidget` file. Bump `version` on every reinstall of a changed widget.
- Always run `validate` before telling the user a widget is done. It catches XML-head errors and undeclared network or file access.

## Hard rules (things that break import)

1. `<!DOCTYPE html>` **must be uppercase**. iCUE parses everything up to `</head>` as **strict XML**. In `<head>`:
   - every tag must be closed or self-closed (`<meta ... />`, `<link ... />`)
   - attributes must be quoted; no bare `&` (use `&amp;`)
   - JSON and CSS inside `<head>` must not contain XML-breaking characters (`<`, a lone `&`)
2. Required files: `index.html`, `manifest.json`, an icon (`.svg` or `.png`). `translation.json` is needed if `tr()` is used.
3. `<head>` must have a `<title>` (the selector name, can be `tr('Name')`) and `<link rel="icon" ... />`.
4. Network, file, and hardware access must be declared in `manifest.permissions`, or it is **silently blocked**.

## manifest.json

```json
{
  "author": "wilson1442",
  "id": "com.wilson1442.examplewidget",
  "name": "Example Widget",
  "description": "Short marketplace description",
  "version": "1.0.0",
  "preview_icon": "resources/icon.svg",
  "min_app_version": "5.47",
  "min_framework_version": "1.0.1",
  "os": [{ "platform": "windows" }],
  "supported_devices": [
    { "type": "dashboard_lcd" }
  ],
  "interactive": true,
  "required_plugins": [],
  "modules": [],
  "permissions": []
}
```

| Field | Notes |
|---|---|
| `supported_devices[].type` | `dashboard_lcd` (XENEON EDGE), `keyboard_lcd` (VANGUARD 96 / PRO 96), `pump_lcd` (iCUE LINK XC7/XD5 ELITE LCD). The built-in Weather widget also uses the undocumented `pump_dashboard_lcd`. Optional `"features": ["sensor-screen"]`. |
| `os` | Docs say only `windows` is supported. Built-ins also list `mac`. Default to windows only. |
| `interactive` | `true` enables touch/click on touch devices (XENEON EDGE). |
| `required_plugins` | `namespace:Name:version` strings (see Plugins). |
| `modules` | `.mjs`/`.js` files whose exports can be used in `data-*` expressions as `FileName.fn`. |
| `permissions` | See Permissions. |

## index.html anatomy

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>tr('My Widget')</title>
    <link rel="icon" type="image/svg+xml" href="resources/icon.svg" />

    <!-- Settings controls: each becomes a GLOBAL JS variable named by `content` -->
    <meta name="x-icue-property" content="textColor" data-label="tr('Text Color')"
          data-type="color" data-default="'#FFFFFF'" />

    <script type="application/json" id="x-icue-groups">
    [ { "title": "tr('Appearance')", "properties": ["textColor"] } ]
    </script>

    <link rel="stylesheet" href="styles/main.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      function update() {
        document.documentElement.style.setProperty("--text-color", textColor);
      }
      icueEvents = { onICUEInitialized: update, onDataUpdated: update };
      if (iCUE_initialized) update();   // handle a late script load
    </script>
  </body>
</html>
```

Optional head meta: `x-icue-widget-group` groups variants in the selector; `x-icue-widget-preview` is a 128×56 PNG preview.

### Lifecycle and injected globals

- Injected before your scripts: one global per `x-icue-property`, `iCUE`, `iCUE_initialized`, `device`, `uniqueId`, `window.plugins`, `tr()`.
- `icueEvents = { onICUEInitialized, onDataUpdated }`. `onDataUpdated` fires on **any** setting change, so make `update()` idempotent.
- **Always** do `if (iCUE_initialized) init()` as well. The event may fire before your script runs.
- Guard optional values: `typeof backgroundMedia !== "undefined"` (an unset media-selector is `undefined`).

### `iCUE` object
`iCUE.iCUELanguage` (`"en"`…), `iCUE.fpsLimit` (default 30), `iCUE.isPreview` (true in the iCUE preview, false on a device), `iCUE.defaultTemperatureUnit()` → `"°C"` or `"°F"`.
Undocumented, seen in built-ins: `iCUE.default24HourFormat()`, `iCUE.defaultLocation(timeoutMs)` (JSON string), `iCUE.widgetId`.

### `device` object
`device.deviceId` (UUID string). Available right after load, and needed for the DeviceAction plugin.

## Controls (`x-icue-property`)

Attributes: `content` (variable name, `[A-Za-z0-9_]`), `data-label`, `data-type`, `data-default`, plus per-type attributes. **Every `data-*` except `data-type` is a JS expression**, so:
- strings need inner quotes: `data-default="'#FFFFFF'"`, `data-unit-label="'%'"`
- numbers and booleans are bare: `data-default="30"`, `data-default="true"`
- expressions are bare: `data-label="tr('Theme')"`, `data-default="iCUE.defaultTemperatureUnit()"`
- arrays and objects use single quotes: `data-values="[{'key':'a','value':tr('A')}]"`

| `data-type` | Extra attrs | JS value |
|---|---|---|
| `textfield` | — | string |
| `switch` | — | boolean |
| `slider` | `data-min` `data-max` `data-step` `data-unit-label` | number |
| `color` | — | hex string `"#RRGGBB"` |
| `combobox` | `data-values` = `['a','b']` or `[{'key','value'}]` | selected key (string) |
| `tab-buttons` | `data-values` (same forms) | selected key (string) |
| `search-combobox` | `data-values="Module.searchFn"`, `data-default="Module.defaultFn"`, `data-placeholder` | selected key |
| `media-selector` | `data-filters="['*.png','*.jpg','*.gif','*.mp4','*.webm']"` | `{pathToAsset, scale, positionX, positionY, baseWidth, baseHeight, angle}` or `undefined` |
| `sensors-combobox` | `data-default="plugins.Sensorsdataprovider.getDefaultSensorIdBlock('temperature')"` | sensor ID string (needs Sensors plugin) |
| `sensors-factory` | same default as above | `[{sensorId, color}]` (needs Sensors plugin) |
| `stream-deck-virtual-device` | — | Stream Deck device ID |

- search-combobox module functions (per the Weather built-in): `searchFn(query)` → `Promise<[{key, value}]>`. `defaultFn()` → `Promise<[key, displayValue]>`.
- Groups: `<script type="application/json" id="x-icue-groups">[{ "title", "properties": [...], "info"? }]</script>`.
- XENEON EDGE: a group containing `textColor`, `accentColor`, or `backgroundColor` gets a "Custom Style" toggle. Use those exact names to opt in to device-default theming.

## Plugins

Declare the plugin in `required_plugins`, then access it via `window.plugins.<Module>`. The module name is the namespace minus `widgetbuilder.`, first letter capitalized.

| Plugin | `required_plugins` | `window.plugins.` | Key API |
|---|---|---|---|
| Sensors | `widgetbuilder.sensorsdataprovider:Sensors:1.0` | `Sensorsdataprovider` | get value/units/name/type/kind, `getAllSensorIds`, `sensorIsConnected`, `getDefaultSensorIdBlock(type, kind)`; signals `sensorValueChanged(id,val)`, `sensorUnitsChanged`, `sensorDataChanged`, `sensorAdded`, `sensorRemoved` |
| Media | `widgetbuilder.mediadataprovider:Media:1.1` | `Mediadataprovider` | props `songName artist album thumbnail isPlaying`; `triggerPlayPause/NextTrack/PreviousTrack()`; `*Changed` signals |
| Link | `widgetbuilder.linkprovider:Url:1.0` | `Linkprovider` | `open(url)` (sync) |
| FPS | `widgetbuilder.fpsdataprovider:Fps:1.0` | `Fpsdataprovider` | props `currentFps fpsAvailable currentProcess`; signals `fpsUpdated`, `fpsAvailabilityChanged`, `processChanged` |
| DeviceAction | `widgetbuilder.deviceactionprovider:DeviceAction:1.0` | `Deviceactionprovider` | `initDevice(device.deviceId)` once; signal `dialTriggered(actionType "press"/"long-press", dialIndex)` (real device only) |
| FileSystem | `widgetbuilder.filesystemprovider:FileSystem:1.0` | `Filesystemprovider` | `watchPath('{Documents}/x.txt')`, `unwatchPath`, `clearPaths`; signals `fileChanged(path, content)`, `fileContentDiff`, `fileAdded`, `fileRemoved`. Needs a file/folder permission. |
| Notifications | `widgetbuilder.notificationsprovider:Notifications:1.0` | `Notificationsprovider` | `getNotificationCount()`; signal `notificationCountChanged()` |
| Stream Deck | `widgetbuilder.streamdeck:StreamDeck:1.2` | `Streamdeck` | `connectStreamDeck(widgetId, deviceId, cols, rows)`, `sendKeyPress(widgetId, idx, pressed)`, etc. Needs the `application: "Stream Deck"` permission. |

Init pattern (same shape for every plugin):
```js
pluginSensorsdataproviderEvents = { onInitialized: onSensorsReady };
if (typeof pluginSensorsdataprovider_initialized !== "undefined" && pluginSensorsdataprovider_initialized) onSensorsReady();
// signals: window.plugins.Sensorsdataprovider.sensorValueChanged.connect((id, val) => { ... });
```

- Raw async methods take a `requestId` and answer via the `asyncResponse(requestId, value)` signal. **Prefer the Promise wrappers** (`new SimpleSensorApiWrapper(plugin)`, `SimpleMediaApiWrapper`, `SimpleFpsApiWrapper`, `SimpleNotificationsApiWrapper`). Each needs `IcueWidgetApiWrapper.js` loaded first.
- Sensors: a value or units of `"-1"` means unavailable. Show a fallback state, as the built-in Sensor widget does.
- Sensor types: temperature, pump, fan, voltage, load, current, power, battery-charge, battery-status, efficiency, fps, pin-protect, and DRAM timings. Kinds include `cpu-temp`, `gpu-temp`, `package`, `core`, `gpu-load`, `memory-load`, etc.

## Common helpers (copy them in, don't link to them)

The iCUE install ships helpers at `C:\Program Files\Corsair\Corsair iCUE5 Software\widgets\com\corsair\common\`:
- `plugins/`: `IcueWidgetApiWrapper.js`, `SimpleSensorApiWrapper.js`, `SimpleMediaApiWrapper.js`, `SimpleFpsApiWrapper.js`, `SimpleNotificationsApiWrapper.js`
- `tools/`: `media_viewer/MediaViewer.{js,css}` (renders media-selector output with zoom, pan, and rotate), `ColorTools.js`, `DateFormatter.js`, `ticker-tracker.js` + `ticker-track.css` (scrolling text)

Built-ins reference these as `../common/...`. **Third-party widgets must not.** Copy only the needed files into `widgets/<name>/common/...` and reference them as `common/...`. MediaViewer container: `width:100%; height:100%; position:relative`, with no `overflow:hidden` and no `visibility:hidden`.

## Permissions (`manifest.permissions`)

```json
[
  { "type": "url", "domain": "api.example.com" },
  { "type": "url", "domain": "localhost", "port": 8080 },
  { "type": "file", "path": "<Documents>/my-widget/data.txt" },
  { "type": "folder", "path": "<Documents>/my-widget" },
  { "type": "application", "application": "Stream Deck" }
]
```
- Types: `url` (domain only: no protocol, path, or port in the domain; subdomains included; localhost needs `port`), `file`, `folder`, `microphone`, `camera`, `speaker`, `screen`, `clipboard_read_write`, `local_fonts_access`, `self_signed_certificate` (`host`), `download`, `application`.
- Macros: manifest paths use `<Documents>` (angle brackets). `watchPath()` uses `{Documents}` (curly braces). Available: Home, Desktop, Documents, Downloads, Music, Pictures, Movies, Temp, AppData, Runtime.
- The CLI validator text-scans code for literal `fetch`/`XMLHttpRequest`/`WebSocket` hosts and `watchPath` paths, and **errors** if no permission covers them. This includes commented-out code.
- Users can revoke permissions at any time. Always handle failed fetches and empty reads with a fallback UI.

## Translations

`translation.json` sits next to `index.html`:
```json
{ "en": { "translation": { "Settings": "Settings" } }, "de": { "translation": { "Settings": "Einstellungen" } } }
```
- `en` is required (fallback). Others: de, es, fr, it, ja, ko, pt, ru, zh_CN, zh_TW, uk.
- In meta attributes, `tr('Key')` is synchronous. **In JS, `tr()` returns a Promise**: `el.textContent = await tr("Unavailable")`.
- Keep every `tr()` key used in `index.html` present in the `en` block.

## Persistence

`localStorage` persists across sessions. Key it by the injected `uniqueId` (per widget instance) and store one JSON object per instance:
```js
const state = JSON.parse(localStorage.getItem(uniqueId) || "{}");
state.count = 5; localStorage.setItem(uniqueId, JSON.stringify(state));
```

## Design and layout conventions

- The widget's tile on the Edge can be wide, tall, or square depending on its size and the screen orientation. **Size everything in `vmin`/`%`**, never fixed px. Check the layout at extreme aspect ratios (for example 32:9, 1:1, and 9:16). The built-ins use `vmin` for fonts and spacing throughout.
- `html, body { margin:0; height:100%; }`. Put the background on a full-size absolutely positioned layer.
- Drive theme colors through CSS variables set from the color controls in `update()`.
- Built-in fonts are available via Qt resources: `src: url("qrc:/fonts/OpenSans-Regular.ttf")` (also `OpenSans-SemiBold.ttf`).
- Respect `iCUE.fpsLimit`. Avoid heavy continuous animation. Prefer `requestAnimationFrame` throttled to the limit, or CSS transitions.
- Provide sensible defaults so the widget looks good with zero configuration, and a visible fallback state when data is unavailable.
- Use `iCUE.isPreview` to skip expensive work or show sample data in the iCUE preview.

## Testing

- Layout check: render `index.html` in headless Edge at several sizes (2560x720, 1260x720, 720x1600) and read the screenshots. Include a standalone shim that seeds the settings globals from the meta `data-default` values (see `widgets/unifi-stats/scripts/main.js`).
- Load widget JS as a classic `<script src>` (not `type="module"` from a file), and assign handlers via `window.icueEvents = ...`, so the page also runs from `file://` in a normal browser.
- No official local simulator. To iterate fast in a browser, guard iCUE-only globals (`typeof iCUE !== "undefined"`) and stub settings variables with defaults, so `index.html` also renders standalone in Chrome. Then validate, package, and import into iCUE for the real test.
- Device-only features: `dialTriggered` (not in preview), sensors and media (need real data sources).

## Widgets in this repo

| Folder | ID | Devices | Purpose | Status |
|---|---|---|---|---|
| `widgets/unifi-stats` | `com.wilson1442.unifistats` | dashboard_lcd | UniFi OS console stats (internet, WAN throughput graph, clients, devices, gateway CPU/RAM) via `GET /proxy/network/api/s/<site>/stat/health` with `X-API-KEY` | v1.0.0 built; validated plus browser-tested (demo data and the 401 path via proxy). Not yet tested inside iCUE or with a real key. |

### Notes: unifi-stats
- The UniFi console (`192.168.0.1`, the LAN gateway; `192.168.1.1` is a second UniFi console) sends **no `Access-Control-Allow-Origin`** and uses a **self-signed cert** (`CN=unifi.local`). Whether iCUE enforces CORS for widgets is unknown, so the manifest pre-declares the `url` and `self_signed_certificate` permissions for `192.168.0.1` and `localhost:8443`.
- Fallback: `node tools/unifi-proxy/unifi-proxy.mjs --target https://192.168.0.1` (127.0.0.1:8443, GET `/proxy/network/*` only, adds CORS, ignores the cert). Then set the widget's Console URL to `http://localhost:8443`.
- With no API key set, the widget shows demo data and an amber banner.
- Browser testing: open `index.html?unifiUrl=...&apiKey=...`. Headless screenshots: `msedge --headless=new --window-size=W,H --screenshot=out.png file:///...`.
- A different console IP needs new manifest permissions, or the user approves a runtime prompt.

Update this table whenever a widget is added or changes status.
