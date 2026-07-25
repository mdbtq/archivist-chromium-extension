#!/usr/bin/env node

/**
 * Native messaging host for the Archivist extension.
 *
 * Chrome launches this process when the popup connects to it, speaks the native
 * messaging protocol over stdio (4-byte little-endian length prefix + JSON), and
 * kills it when the port closes. Its only job is to start and stop the local
 * Archivist server on the extension's behalf — something the extension sandbox
 * cannot do itself.
 *
 * Supported commands:
 *   { "command": "status" }  -> { running, pid, port }
 *   { "command": "start" }   -> { running, pid, port } (starts if not running)
 *   { "command": "stop" }    -> { running: false }
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SERVER_DIR = path.join(__dirname, '..', 'server');
const SERVER_FILE = path.join(SERVER_DIR, 'server.js');
const RUNTIME_FILE = path.join(SERVER_DIR, 'data', 'runtime.json');
const LOG_FILE = path.join(SERVER_DIR, 'data', 'server.log');
const START_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 150;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Reads the runtime file, treating a stale entry (dead pid) as "not running". */
function runtime() {
  try {
    const { pid, port } = JSON.parse(fs.readFileSync(RUNTIME_FILE, 'utf8'));
    if (pid && port && alive(pid)) return { running: true, pid, port };
  } catch { /* missing or malformed */ }
  return { running: false };
}

async function start() {
  const current = runtime();
  if (current.running) return current;

  // Clear a stale runtime file so we don't read the previous run's port.
  try {
    fs.unlinkSync(RUNTIME_FILE);
  } catch { /* nothing to clear */ }

  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  const log = fs.openSync(LOG_FILE, 'a');

  // Detached so the server outlives this short-lived host process.
  const child = spawn(process.execPath, [SERVER_FILE], {
    cwd: SERVER_DIR,
    detached: true,
    stdio: ['ignore', log, log],
  });
  child.unref();

  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const started = runtime();
    if (started.running) return started;
    if (child.exitCode !== null) {
      return { running: false, error: `Server exited with code ${child.exitCode}. See ${LOG_FILE}` };
    }
  }
  return { running: false, error: `Server did not report ready within ${START_TIMEOUT_MS}ms. See ${LOG_FILE}` };
}

async function stop() {
  const current = runtime();
  if (!current.running) return { running: false };

  try {
    process.kill(current.pid, 'SIGTERM');
  } catch (err) {
    return { running: false, error: `Could not signal pid ${current.pid}: ${err.message}` };
  }

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    if (!alive(current.pid)) return { running: false };
  }
  try {
    process.kill(current.pid, 'SIGKILL');
  } catch { /* already gone */ }
  return { running: false };
}

async function handle(message) {
  switch (message?.command) {
    case 'status': return runtime();
    case 'start': return await start();
    case 'stop': return await stop();
    default: return { error: `Unknown command: ${message?.command}` };
  }
}

function send(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]));
}

let buffer = Buffer.alloc(0);
let handling = Promise.resolve();

process.stdin.on('data', chunk => {
  buffer = Buffer.concat([buffer, chunk]);

  // A single chunk may carry several framed messages, or only part of one.
  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    if (buffer.length < 4 + length) break;
    const message = JSON.parse(buffer.subarray(4, 4 + length).toString('utf8'));
    buffer = buffer.subarray(4 + length);
    // Serialize handling so replies keep the order the requests arrived in.
    handling = handling.then(() => handle(message)).then(send);
  }
});

process.stdin.on('end', () => process.exit(0));
