import type { AgentSession } from "@oh-my-pi/pi-coding-agent";
import type { RpcCommand } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { upgradeWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { getSessionState, handleCommand } from "./commandHandler";

function send(ws: WSContext, data: object): void {
	try {
		ws.send(JSON.stringify(data));
	} catch {
		// Client may have disconnected between check and send
	}
}

export const webSocketHandler = (session: AgentSession, clients: Set<WSContext>, onStop: () => void) => {
	return upgradeWebSocket(() => ({
		onOpen(_event, ws) {
			clients.add(ws);

			// Send initial state and message history
			send(ws, { type: "state", data: getSessionState(session) });
			send(ws, { type: "messages", data: { messages: session.messages } });
		},

		async onMessage(event, ws) {
			let command: RpcCommand;
			try {
				const raw = typeof event.data === "string" ? event.data : event.data.toString();
				command = JSON.parse(raw) as RpcCommand;
			} catch {
				send(ws, {
					type: "response",
					command: "unknown",
					success: false,
					error: "Invalid JSON",
				});
				return;
			}

			if (command.type === "stop_remote_server") {
				send(ws, { id: command.id, type: "response", command: "stop_remote_server", success: true });
				// Yield the microtask queue so the response frame is flushed before the server stops
				await Bun.sleep(0);
				onStop();
				return;
			}

			try {
				const response = await handleCommand(session, command);
				send(ws, response);
			} catch (e) {
				const message = e instanceof Error ? e.message : "Unknown error";
				send(ws, {
					id: command.id,
					type: "response",
					command: command.type,
					success: false,
					error: message,
				});
			}
		},

		onClose(_event, ws) {
			clients.delete(ws);
		},
	}));
};
