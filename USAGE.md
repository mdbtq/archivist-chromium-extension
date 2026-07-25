# Archivist — User Guide

Archivist saves the tabs you have open for a website into a local archive, so you
can close them without losing them. Everything stays on your own computer.

A typical use: you have fifteen tabs open while researching something, you are
done for now, but you are not ready to throw them away. Archivist stores them
under a label, you close the tabs, and you come back to the list whenever you
want.

**Contents**

- [Installation](#installation)
- [Archiving tabs](#archiving-tabs)
- [Browsing your archives](#browsing-your-archives)
- [Starting and stopping the server](#starting-and-stopping-the-server)
- [Where your data lives](#where-your-data-lives)
- [Troubleshooting](#troubleshooting)

## Installation

You need [Node.js](https://nodejs.org) version 18 or newer, and a
Chromium-based browser (Chrome, Chromium, Brave, or Edge).

### 1. Install the server

Archivist stores your archives through a small program that runs on your own
machine, called the server. Open a terminal in the project folder and run:

```bash
cd server
npm install
npm start
```

Leave this terminal open. You should see:

```
Archivist running at http://localhost:3000
```

### 2. Install the extension

1. Open `chrome://extensions` in your browser
2. Turn on **Developer mode** with the toggle in the top right
3. Click **Load unpacked** and select the `extension/` folder from this project

The Archivist icon now appears in your toolbar. Click it and the header should
show a green dot with the port number, meaning it found the server.

### 3. Optional: enable the Start button

You can stop the server from the extension right away, but starting it needs one
extra step. Browsers do not let an extension launch a program on your computer
unless you explicitly permit that specific extension to do so.

Copy the extension's ID from `chrome://extensions` — it is the long string of
letters shown under the Archivist entry while Developer mode is on. Then run:

```bash
cd server
npm run install-host <paste-the-id-here>
```

Reload the extension afterwards. Skip this step if you prefer starting the
server yourself from a terminal.

## Archiving tabs

1. Go to a tab on the site you want to archive and click the Archivist icon
2. The domain of the current tab is filled in, and every open tab on that domain
   is listed with a checkbox — all selected by default
3. Uncheck anything you do not want to keep, or use **All** / **None**
4. Optionally type a label, such as `pricing research` or `bug #412`, to help you
   recognise the archive later
5. Tick **Close after archiving** if you want the tabs closed once they are saved
6. Click **Archive Selected Tabs**

A green confirmation tells you how many tabs were saved.

To archive a different site than the one you are on, type its domain in the box
at the top and press Enter. Subdomains are included: searching `example.com`
also matches tabs on `docs.example.com`.

## Browsing your archives

Click **Open Viewer →** at the bottom of the popup, or go to
`http://localhost:3000` directly.

Each archive shows its domain, its label, how many tabs it holds, and when you
saved it. Click one to expand it and see the individual pages.

What you can do there:

- **Filter by domain** with the **All domains** dropdown
- **Search** across your labels and the titles and URLs of every archived tab
- **Copy URLs** to put every link in an archive on your clipboard
- **Open all** to reopen the whole archive in new tabs — you are asked to confirm
  when an archive holds more than ten tabs
- **Delete** to remove an archive permanently
- **↻ Refresh** to reload the list

Deleting an archive cannot be undone.

## Starting and stopping the server

The popup header shows the server state at a glance:

| Indicator | Meaning |
| --- | --- |
| Green dot, `Server on :3000` | Running and ready |
| Red dot, `Server stopped` | Not running — click **Start** |
| Red dot, `Host not installed` | Not running, and the Start button cannot work yet (see [step 3](#3-optional-enable-the-start-button)) |
| Yellow dot | Starting or stopping right now |

Use the **Start** and **Stop** button next to it. While the server is stopped you
cannot archive tabs or open the viewer, so those buttons are disabled.

The server normally uses port 3000. If something else on your computer is
already using that port, it takes the next free one, up to 3009. The extension
looks for it automatically, so you do not need to configure anything.

## Where your data lives

Everything is stored in a single file on your computer:

```
server/data/archives.json
```

Nothing is sent anywhere. There is no account, no sync, and no external service
involved — the extension only ever talks to the server running on your own
machine.

Since it is a plain file, you can back it up by copying it. To move your
archives to another computer, copy that file into the same location there.

## Troubleshooting

**The popup says the server is stopped, but I started it**

Check the terminal where you ran `npm start` for errors. If the server reports a
port above 3009, the extension will not find it — free up the lower ports and
restart it.

**The Start button is greyed out and says "Host not installed"**

The one-time setup in [step 3](#3-optional-enable-the-start-button) has not been
done, or it was done with a different extension ID. Re-run
`npm run install-host <extension-id>` with the ID currently shown on
`chrome://extensions`, then reload the extension.

**The Start button stopped working after it worked before**

The extension's ID changes when you load it into a different browser profile, and
the permission is tied to that ID. Re-run `npm run install-host` with the new ID.

**"Server unreachable" when I try to archive**

The server stopped while the popup was open. Close and reopen the popup to pick
up the current state, then start the server.

**The viewer says it cannot load archives**

The server is not running, or it is on a different port than the viewer page you
have open. Check the port in the popup header and use that address.

**I want to remove the permission again**

```bash
cd server
npm run uninstall-host
```

Your archives are untouched by this — it only removes the browser's permission
to start the server for you.
