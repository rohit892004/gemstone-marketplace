#!/usr/bin/env node
/**
 * Local development PostgreSQL, managed with the binaries from the `embedded-postgres` package.
 *
 *   node scripts/db.mjs init     create the data directory (once)
 *   node scripts/db.mjs start    start the server and create the "gemstone" database
 *   node scripts/db.mjs stop     stop the server (data is kept)
 *   node scripts/db.mjs status   show whether it is running
 *
 * Data lives in .data/pg (git-ignored). Port 54330 on 127.0.0.1 (override with DB_PORT), user postgres, password postgres.
 * Refuses to run when NODE_ENV is production. This is a development tool only.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const PORT = Number(process.env.DB_PORT ?? 54330);
const DB_NAME = "gemstone";
const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, ".data", "pg");
const LOG_FILE = path.join(ROOT, ".data", "pg.log");

if (process.env.NODE_ENV === "production") {
  console.error("scripts/db.mjs is a development tool and refuses to run with NODE_ENV=production.");
  process.exit(1);
}

function binDir() {
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const dir = path.join(ROOT, "node_modules", "@embedded-postgres", `${platform}-${process.arch}`, "native", "bin");
  if (!existsSync(dir)) throw new Error(`PostgreSQL binaries not found at ${dir}. Run npm install.`);
  return dir;
}

const exe = (name) => path.join(binDir(), process.platform === "win32" ? `${name}.exe` : name);

/**
 * Runs a binary and returns its exit code. stdio is ignored on purpose: pg_ctl starts a server that
 * inherits the pipes, and a piped spawn would wait for that server to exit. Output goes to the log.
 */
function run(file, args) {
  const result = spawnSync(file, args, { stdio: "ignore", windowsHide: true, timeout: 90_000 });
  return result.status ?? 1;
}

function init() {
  if (existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    console.log(`Data directory already exists: ${DATA_DIR}`);
    return 0;
  }
  mkdirSync(path.dirname(DATA_DIR), { recursive: true });
  return run(exe("initdb"), ["-D", DATA_DIR, "-U", "postgres", "--auth=trust", "-E", "UTF8"]);
}

function status() {
  return run(exe("pg_ctl"), ["-D", DATA_DIR, "status"]);
}

async function ensureDatabase() {
  const client = new pg.Client({
    connectionString: `postgres://postgres:postgres@127.0.0.1:${PORT}/template1?sslmode=disable`,
  });
  await client.connect();
  try {
    const found = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
    if (found.rowCount === 0) {
      await client.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`Created database "${DB_NAME}".`);
    }
  } finally {
    await client.end();
  }
}

async function start() {
  if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    const code = init();
    if (code !== 0) return code;
  }
  const code = run(exe("pg_ctl"), [
    "-D", DATA_DIR, "-l", LOG_FILE, "-w", "-t", "60",
    "-o", `-p ${PORT} -h 127.0.0.1`,
    "start",
  ]);
  if (code !== 0) return code;
  await ensureDatabase();
  console.log(`PostgreSQL is running on 127.0.0.1:${PORT}, database "${DB_NAME}".`);
  return 0;
}

function stop() {
  return run(exe("pg_ctl"), ["-D", DATA_DIR, "-m", "fast", "-w", "stop"]);
}

const command = process.argv[2];
const commands = { init, start, stop, status };
if (!commands[command]) {
  console.error("Usage: node scripts/db.mjs <init|start|stop|status>");
  process.exit(2);
}
const result = await commands[command]();
process.exit(typeof result === "number" ? result : 0);
