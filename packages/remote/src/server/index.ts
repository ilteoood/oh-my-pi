import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { logger } from "@oh-my-pi/pi-utils";
import { $ } from "bun";
import { Hono } from "hono";
import { serveStatic, websocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { webSocketHandler } from "./webSocketHandler";

const PACKAGE_ROOT = path.join(import.meta.dir, "..", "..");
const CLIENT_SRC_DIR = path.join(PACKAGE_ROOT, "src", "client");
const STATIC_DIR = path.join(PACKAGE_ROOT, "dist", "client");
const IS_BUN_COMPILED =
	Bun.env.PI_COMPILED ||
	import.meta.url.includes("$bunfs") ||
	import.meta.url.includes("~BUN") ||
	import.meta.url.includes("%7EBUN");

async function getLatestMtime(dir: string): Promise<number> {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	const promises = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			promises.push(getLatestMtime(fullPath));
		} else if (entry.isFile()) {
			promises.push(fs.stat(fullPath).then(stats => stats.mtimeMs));
		}
	}

	let latest = 0;
	await Promise.allSettled(promises).then(results => {
		for (const result of results) {
			if (result.status === "fulfilled") {
				latest = Math.max(latest, result.value);
			}
		}
	});
	return latest;
}

async function ensureClientBuild(): Promise<void> {
	if (IS_BUN_COMPILED) return;

	const indexPath = path.join(STATIC_DIR, "index.html");
	let clientSourceMtime: number;
	try {
		clientSourceMtime = await getLatestMtime(CLIENT_SRC_DIR);
	} catch {
		// Source directory may not exist in compiled mode
		return;
	}

	let shouldBuild = true;
	try {
		const indexStats = await fs.stat(indexPath);
		if (indexStats.isFile() && indexStats.mtimeMs >= clientSourceMtime) {
			shouldBuild = false;
		}
	} catch {
		shouldBuild = true;
	}

	if (!shouldBuild) return;

	logger.debug("Building remote client...");
	const buildResult = await $`bunx vite build`.cwd(PACKAGE_ROOT).quiet().nothrow();
	if (buildResult.exitCode !== 0) {
		const output = buildResult.text().trim();
		const details = output ? `\n${output}` : "";
		throw new Error(`Failed to build remote client (exit ${buildResult.exitCode})${details}`);
	}
}

export async function startRemoteServer(
	session: AgentSession,
	port = 3848,
): Promise<{ port: number; url: string; stop: () => void }> {
	await ensureClientBuild();

	const clients = new Set<WSContext>();

	const app = new Hono();

	const stopRef = { fn: (): void => {} };

	app.get(
		"/ws",
		webSocketHandler(session, clients, () => stopRef.fn()),
	);

	// Static file serving — direct match first, then SPA fallback to index.html
	app.use("*", serveStatic({ root: STATIC_DIR }));
	app.use("*", serveStatic({ root: STATIC_DIR, path: "/index.html" }));

	// Subscribe to session events and broadcast to all connected clients
	const unsubscribe = session.subscribe(event => {
		const json = JSON.stringify(event);
		for (const ws of clients) {
			try {
				ws.send(json);
			} catch {
				clients.delete(ws);
			}
		}
	});

	const server = Bun.serve({
		fetch: app.fetch,
		websocket,
		port,
	});

	const actualPort = server.port ?? port;

	stopRef.fn = () => {
		unsubscribe();
		for (const ws of clients) {
			try {
				ws.close();
			} catch {
				// Connection may already be gone
			}
		}
		clients.clear();
		server.stop(true);
	};

	return {
		port: actualPort,
		url: `http://localhost:${actualPort}`,
		stop: stopRef.fn,
	};
}
