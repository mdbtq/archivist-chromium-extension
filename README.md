# Archivist - Chromium Extension

A Chromium extension that archives all open tabs for a given domain into a local JSON file, paired with a Node.js viewer to browse your archives.

> Looking for installation and day-to-day usage instructions? See the
> [User Guide](USAGE.md). This README covers the project layout and internals.

## How it works

1. Click the extension icon — it detects the current domain and lists all matching open tabs
2. Select the tabs you want to keep, choose whether they start a new archive or
   are added to an existing one for that domain, and hit **Archive**
3. The local server saves the archive to `server/data/archives.json`
4. Open the viewer at `http://localhost:3000` to browse, search, and manage your archives

The extension auto-discovers which port the server is running on (scans 3000–3009), so no manual configuration is needed.

## Setup

### Server

```bash
cd server
npm install
npm start
```

The server starts on port 3000, or the next available port if 3000 is already in use.

### Extension

1. Open `chrome://extensions` in Chromium or Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `extension/` folder

### Starting and stopping the server from the popup (optional)

The popup header shows the server state and a **Start** / **Stop** button.
Stopping works out of the box. Starting requires a one-time registration of a
native messaging host, because a browser extension cannot launch a local process
by itself:

```bash
cd server
npm run install-host <extension-id>
```

Copy `<extension-id>` from `chrome://extensions` (visible with Developer mode
on), then reload the extension. To undo the registration:

```bash
npm run uninstall-host
```

The extension id changes when the extension is loaded into a different browser
profile. If the popup shows *Host not installed*, re-run `install-host` with the
current id.

## Viewer

Navigate to `http://localhost:3000` to view all archives. The viewer supports:

- Filter by domain
- Full-text search across titles and URLs
- Copy all URLs from an archive to clipboard
- Open all archived tabs at once
- Delete archives

## Project structure

```
archivist/
├── extension/          # Chromium extension (Manifest v3)
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── icons/          # icon.svg is the source; PNGs are derived from it
├── host/               # Native messaging host (start/stop the server)
│   ├── archivist_host.js
│   ├── archivist_host.sh
│   └── install-host.js
└── server/             # Express.js server + viewer
    ├── server.js
    ├── package.json
    ├── data/           # archives.json, runtime.json (git-ignored)
    └── public/
        ├── index.html  # Viewer UI
        ├── favicon.svg
        └── favicon.png
```

## Icons

`extension/icons/icon.svg` is the single source for the logomark. The PNGs next
to it are the sizes Chrome asks for, and `server/public/favicon.*` is the same
mark serving as the viewer favicon.

The mark carries a fixed fill rather than `currentColor`, because a toolbar icon
inherits no CSS context. After changing the SVG, regenerate the PNGs and copy
them across:

```bash
cd extension/icons
for s in 16 32 48 128; do sips -s format png -z $s $s icon.svg --out icon-$s.png; done
cp icon.svg ../../server/public/favicon.svg
cp icon-32.png ../../server/public/favicon.png
```

`sips` is built into macOS; on other platforms use any SVG rasteriser.

## Requirements

- Node.js 18+
- Chromium-based browser (Chrome, Edge, Brave, etc.)
