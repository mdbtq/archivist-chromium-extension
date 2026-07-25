#!/usr/bin/env node

/**
 * Registers the Archivist native messaging host with the browser, so the
 * extension popup is allowed to start and stop the local server.
 *
 * Usage:
 *   node host/install-host.js <extension-id>
 *   node host/install-host.js --uninstall
 *
 * The extension id is shown on chrome://extensions after loading the unpacked
 * extension. It changes when the extension is loaded into a different profile
 * directory, so re-run this if the popup reports the host is not registered.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const HOST_NAME = 'nl.mdbtq.archivist';
const HOST_SCRIPT = path.join(__dirname, 'archivist_host.sh');

/** Native messaging host directories per browser, by platform. */
function targetDirs() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    const support = path.join(home, 'Library', 'Application Support');
    return [
      path.join(support, 'Chromium', 'NativeMessagingHosts'),
      path.join(support, 'Google', 'Chrome', 'NativeMessagingHosts'),
      path.join(support, 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
    ];
  }
  if (process.platform === 'linux') {
    const config = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    return [
      path.join(config, 'chromium', 'NativeMessagingHosts'),
      path.join(config, 'google-chrome', 'NativeMessagingHosts'),
      path.join(config, 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
    ];
  }
  throw new Error(`Unsupported platform: ${process.platform}. Register ${HOST_NAME} manually.`);
}

function uninstall() {
  for (const dir of targetDirs()) {
    const file = path.join(dir, `${HOST_NAME}.json`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`Removed ${file}`);
    }
  }
  console.log('Done. Reload the extension for the change to take effect.');
}

function install(extensionId) {
  fs.chmodSync(HOST_SCRIPT, 0o755);
  // The wrapper is launched with a minimal PATH, so record the node binary now.
  fs.writeFileSync(path.join(__dirname, 'node-path'), process.execPath);

  const manifest = {
    name: HOST_NAME,
    description: 'Starts and stops the local Archivist server',
    path: HOST_SCRIPT,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };

  let written = 0;
  for (const dir of targetDirs()) {
    // Only install for browsers that are actually present on this machine.
    if (!fs.existsSync(path.dirname(dir))) continue;
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${HOST_NAME}.json`);
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
    console.log(`Installed ${file}`);
    written++;
  }

  if (written === 0) {
    console.error('No Chromium-based browser profile directories found.');
    process.exit(1);
  }
  console.log('\nDone. Reload the extension, then use Start/Stop in the popup.');
}

const arg = process.argv[2];

if (arg === '--uninstall') {
  uninstall();
} else if (!arg || !/^[a-p]{32}$/.test(arg)) {
  console.error('Usage: node host/install-host.js <extension-id>');
  console.error('       node host/install-host.js --uninstall');
  console.error('\nFind the extension id on chrome://extensions (Developer mode).');
  process.exit(1);
} else {
  install(arg);
}
