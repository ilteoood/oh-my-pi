import * as path from "node:path";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { Hono } from "hono";
import { serveStatic, websocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { webSocketHandler } from "./webSocketHandler";

const PACKAGE_ROOT = path.join(import.meta.dir, "..", "..");
const STATIC_DIR = path.join(PACKAGE_ROOT, "dist", "client");

export async function startRemoteServer(
	session: AgentSession,
	port = 3848,
): Promise<{ port: number; url: string; stop: () => void }> {
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
