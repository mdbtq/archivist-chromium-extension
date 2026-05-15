# Archivist

A Chromium extension that archives all open tabs for a given domain into a local JSON file, paired with a Node.js viewer to browse your archives.

## How it works

1. Click the extension icon — it detects the current domain and lists all matching open tabs
2. Select the tabs you want to keep, add an optional label, and hit **Archive**
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
│   └── popup.js
└── server/             # Express.js server + viewer
    ├── server.js
    ├── package.json
    ├── data/           # archives.json (git-ignored)
    └── public/
        └── index.html  # Viewer UI
```

## Requirements

- Node.js 18+
- Chromium-based browser (Chrome, Edge, Brave, etc.)
