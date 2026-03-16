import { useCallback, useEffect, useRef } from "react";
import { useSessionStore } from "../stores/sessionStore";
import type {
	ContentPart,
	FuzzyFindMatch,
	Message,
	MessageRole,
	ModelInfo,
	RpcCommand,
	SessionState,
	SessionStats,
} from "../types";

const NEEDS_STATE_REFETCH_EVENTS = new Set<string | undefined>([
	"cycle_model",
	"cycle_thinking_level",
	"set_model",
	"set_thinking_level",
	"set_plan_mode",
	"toggle_fast_mode",
	"set_fast_mode",
])

export function useWebSocket(): { sendCommand: (cmd: RpcCommand) => void } {
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<number | undefined>(undefined);
	const reconnectDelayRef = useRef(2000);

	const store = useSessionStore;

	const sendCommand = useCallback((command: RpcCommand) => {
		const ws = wsRef.current;
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(command));
		}
	}, []);

	useEffect(() => {
		let disposed = false;
		function connect() {
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
			const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
			wsRef.current = ws;

			ws.onopen = () => {
				store.getState().setConnected(true);
				reconnectDelayRef.current = 2000;
			};

			ws.onmessage = event => {
				try {
					const data = JSON.parse(event.data);
					handleServerEvent(data);
				} catch {
					// Ignore malformed messages
				}
			};

			ws.onclose = () => {
				store.getState().setConnected(false);
				wsRef.current = null;
				scheduleReconnect();
			};

			ws.onerror = () => {
				// onclose will fire after onerror, reconnect handled there
			};
		}

		function scheduleReconnect() {
			if (disposed) return;
			const delay = reconnectDelayRef.current;
			reconnectTimeoutRef.current = window.setTimeout(() => {
				reconnectDelayRef.current = Math.min(delay * 2, 30_000);
				connect();
			}, delay);
		}

		function handleServerEvent(data: Record<string, unknown>) {
			const s = store.getState();
			switch (data.type) {
				case "state":
					s.setSessionState(data.data as SessionState);
					break;
				case "messages":
					s.setMessages((data.data as { messages: Message[] })?.messages ?? []);
					break;
				case "message_start":
					s.messageStart(((data.message as { role?: string })?.role as MessageRole) ?? "assistant");
					break;
				case "message_update":
					s.messageUpdate((data.message as { content?: ContentPart[] })?.content ?? []);
					break;
				case "message_end":
					s.messageEnd(data.message as Message);
					break;
				case "tool_execution_start":
					s.toolExecutionStart(
						data.toolCallId as string,
						data.toolName as string,
						(data.args as Record<string, unknown>) ?? {},
						data.intent as string | undefined,
					);
					break;
				case "tool_execution_update":
					s.toolExecutionUpdate(data.toolCallId as string, {
						...(data.args !== undefined && {
							args: data.args as Record<string, unknown>,
						}),
						...(data.partialResult !== undefined && {
							partialResult: data.partialResult,
						}),
					});
					break;
				case "tool_execution_end":
					s.toolExecutionEnd(data.toolCallId as string, data.result, data.isError as boolean | undefined);
					break;
				case "turn_end":
					s.turnEnd();
					break;
				case "agent_end":
					s.agentEnd();
					break;
				case "agent_start":
				case "turn_start":
				case "ttsr_triggered":
				case "todo_reminder":
				case "todo_auto_clear":
					// No client-side handling needed
					break;
				case "auto_compaction_start":
					s.compactionStart();
					break;
				case "auto_compaction_end":
					s.compactionEnd();
					if (data.errorMessage) {
						s.setError(`Compaction failed: ${data.errorMessage as string}`);
					}
					break;
				case "auto_retry_start":
					s.retryStart({
						attempt: data.attempt as number,
						maxAttempts: data.maxAttempts as number,
						delayMs: data.delayMs as number,
						errorMessage: data.errorMessage as string,
					});
					break;
				case "auto_retry_end":
					s.retryEnd();
					break;
				case "response": {
					const resp = data as {
						command?: string;
						success?: boolean;
						data?: unknown;
						error?: string;
					};
					if (resp.command === "get_available_models" && resp.success && resp.data) {
						const models = (resp.data as { models?: ModelInfo[] })?.models;
						if (models) s.setAvailableModels(models);
					}
					if (resp.command === "get_state" && resp.success && resp.data) {
						s.setSessionState(resp.data as SessionState);
					}
					if (resp.success && NEEDS_STATE_REFETCH_EVENTS.has(resp.command)) {
						const ws = wsRef.current;
						if (ws?.readyState === WebSocket.OPEN) {
							ws.send(JSON.stringify({ type: "get_state" }));
						}
					}
					if (!resp.success && resp.error) {
						s.setError(resp.error);
					}
					if (resp.command === "get_session_stats" && resp.success && resp.data) {
						s.setSessionStats(resp.data as SessionStats);
					}
					if (resp.command === "search_files" && resp.success && resp.data) {
						const data = resp.data as { query: string; files: FuzzyFindMatch[] };
						s.setFileSearch(data.query, data.files);
					}
					break;
				}
			}
		}

		connect();

		return () => {
			disposed = true;
			clearTimeout(reconnectTimeoutRef.current);
			wsRef.current?.close();
		};
	}, []);

	return { sendCommand };
}
