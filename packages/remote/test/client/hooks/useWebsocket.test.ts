import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "../../../src/client/hooks/useWebsocket";
import { useSessionStore } from "../../../src/client/stores/sessionStore";

// --- MockWebSocket ---

class MockWebSocket {
	static OPEN = 1;
	static CONNECTING = 0;
	static CLOSING = 2;
	static CLOSED = 3;

	static instances: MockWebSocket[] = [];

	realyState = MockWebSocket.CONNECTING;
	onopen: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	send = vi.fn();
	close = vi.fn();
	url: string;

	constructor(url: string) {
		this.url = url;
		MockWebSocket.instances.push(this);
	}

	simulateOpen() {
		this.realyState = MockWebSocket.OPEN;
		this.onopen?.(new Event("open"));
	}

	simulateMessage(data: unknown) {
		const event = { data: JSON.stringify(data) } as MessageEvent;
		this.onmessage?.(event);
	}

	simulateClose() {
		this.realyState = MockWebSocket.CLOSED;
		this.onclose?.(new CloseEvent("close"));
	}
}

// readyState must be a property so the hook's `ws.readyState === WebSocket.OPEN` check works.
Object.defineProperty(MockWebSocket.prototype, "readyState", {
	get() {
		return (this as MockWebSocket).realyState ?? MockWebSocket.CONNECTING;
	},
	set(v: number) {
		(this as MockWebSocket).realyState = v;
	},
	configurable: true,
});

vi.stubGlobal("WebSocket", MockWebSocket);

// --- Helpers ---

const initialSessionState = {
	connected: false,
	sessionState: null,
	messages: [],
	streamingContent: [],
	streamingRole: null,
	toolExecutions: {},
	isStreaming: false,
	isCompacting: false,
	isRetrying: false,
	retryInfo: null,
	error: null,
	availableModels: [],
	sessionStats: null,
	fileSearch: null,
};

// --- Tests ---

beforeEach(() => {
	MockWebSocket.instances = [];
	useSessionStore.setState(initialSessionState);
	vi.useRealTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("useWebSocket", () => {
	it("connects to ws://host/ws", () => {
		renderHook(() => useWebSocket());
		expect(MockWebSocket.instances).toHaveLength(1);
		expect(MockWebSocket.instances[0].url).toBe("ws://localhost:3000/ws");
	});

	it("sets connected=true on open", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateOpen();
		});
		expect(useSessionStore.getState().connected).toBe(true);
	});

	it("resets reconnect delay on successful open", () => {
		// We verify indirectly: after an open event, a subsequent close + fast-forward
		// should reconnect using the base 2000 ms delay, not an escalated one.
		vi.useFakeTimers();
		const { unmount } = renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];

		act(() => {
			ws.simulateOpen();
		});
		// Reconnect delay is reset to 2000. Close now.
		act(() => {
			ws.simulateClose();
		});
		// Advance exactly 2000 ms — a reconnect attempt must fire.
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(MockWebSocket.instances).toHaveLength(2);
		unmount();
	});

	it("sets connected=false on close", () => {
		vi.useFakeTimers();
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateOpen();
		});
		expect(useSessionStore.getState().connected).toBe(true);
		act(() => {
			ws.simulateClose();
		});
		expect(useSessionStore.getState().connected).toBe(false);
	});

	it("schedules reconnect on close", () => {
		vi.useFakeTimers();
		const { unmount } = renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateClose();
		});
		expect(MockWebSocket.instances).toHaveLength(1);
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(MockWebSocket.instances).toHaveLength(2);
		unmount();
	});

	it("sendCommand sends JSON when WS is OPEN", () => {
		const { result } = renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateOpen();
		});
		act(() => {
			result.current.sendCommand({ type: "get_state" });
		});
		expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "get_state" }));
	});

	it("sendCommand is a no-op when WS is not OPEN", () => {
		const { result } = renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		// readyState is CONNECTING by default — no send
		act(() => {
			result.current.sendCommand({ type: "get_state" });
		});
		expect(ws.send).not.toHaveBeenCalled();
	});

	it("handles state event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		const sessionState = { model: undefined, thinkingLevel: "none", planModeEnabled: false } as unknown;
		act(() => {
			ws.simulateMessage({ type: "state", data: sessionState });
		});
		expect(useSessionStore.getState().sessionState).toEqual(sessionState);
	});

	it("handles messages event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		const messages = [{ role: "user", content: "hello" }];
		act(() => {
			ws.simulateMessage({ type: "messages", data: { messages } });
		});
		expect(useSessionStore.getState().messages).toEqual(messages);
	});

	it("handles message_start event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateMessage({ type: "message_start", message: { role: "assistant" } });
		});
		const state = useSessionStore.getState();
		expect(state.isStreaming).toBe(true);
		expect(state.streamingRole).toBe("assistant");
	});

	it("handles message_update event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		const content = [{ type: "text", text: "hello" }];
		act(() => {
			ws.simulateMessage({ type: "message_update", message: { content } });
		});
		expect(useSessionStore.getState().streamingContent).toEqual(content);
	});

	it("handles message_end event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateMessage({ type: "message_start", message: { role: "user" } });
		});
		const endMessage = { role: "user", content: "done" };
		act(() => {
			ws.simulateMessage({ type: "message_end", message: endMessage });
		});
		const state = useSessionStore.getState();
		expect(state.isStreaming).toBe(false);
		expect(state.streamingRole).toBeNull();
		expect(state.messages).toContainEqual(endMessage);
	});

	it("handles tool_execution_start event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateMessage({
				type: "tool_execution_start",
				toolCallId: "call-1",
				toolName: "bash",
				args: { cmd: "ls" },
				intent: "list files",
			});
		});
		const exec = useSessionStore.getState().toolExecutions["call-1"];
		expect(exec).toBeDefined();
		expect(exec.name).toBe("bash");
		expect(exec.status).toBe("running");
		expect(exec.intent).toBe("list files");
	});

	it("handles tool_execution_update event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		// Start first so update has an existing entry to patch.
		act(() => {
			ws.simulateMessage({
				type: "tool_execution_start",
				toolCallId: "call-2",
				toolName: "read",
				args: {},
			});
		});
		act(() => {
			ws.simulateMessage({
				type: "tool_execution_update",
				toolCallId: "call-2",
				partialResult: "partial output",
			});
		});
		const exec = useSessionStore.getState().toolExecutions["call-2"];
		expect(exec.partialResult).toBe("partial output");
	});

	it("handles tool_execution_end event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateMessage({
				type: "tool_execution_start",
				toolCallId: "call-3",
				toolName: "bash",
				args: {},
			});
		});
		act(() => {
			ws.simulateMessage({
				type: "tool_execution_end",
				toolCallId: "call-3",
				result: "output",
				isError: false,
			});
		});
		const exec = useSessionStore.getState().toolExecutions["call-3"];
		expect(exec.status).toBe("complete");
		expect(exec.result).toBe("output");
	});

	it("handles turn_end event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		// Put the store into streaming state first.
		act(() => {
			ws.simulateMessage({ type: "message_start", message: { role: "assistant" } });
		});
		expect(useSessionStore.getState().isStreaming).toBe(true);
		act(() => {
			ws.simulateMessage({ type: "turn_end" });
		});
		expect(useSessionStore.getState().isStreaming).toBe(false);
	});

	it("handles agent_end event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateMessage({ type: "message_start", message: { role: "assistant" } });
		});
		act(() => {
			ws.simulateMessage({ type: "agent_end" });
		});
		const state = useSessionStore.getState();
		expect(state.isStreaming).toBe(false);
		expect(state.streamingRole).toBeNull();
	});

	it("handles auto_compaction_start event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateMessage({ type: "auto_compaction_start" });
		});
		expect(useSessionStore.getState().isCompacting).toBe(true);
	});

	it("handles auto_compaction_end event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateMessage({ type: "auto_compaction_start" });
		});
		act(() => {
			ws.simulateMessage({ type: "auto_compaction_end" });
		});
		expect(useSessionStore.getState().isCompacting).toBe(false);
	});

	it("sets error when auto_compaction_end carries errorMessage", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateMessage({
				type: "auto_compaction_end",
				errorMessage: "out of tokens",
			});
		});
		expect(useSessionStore.getState().error).toBe("Compaction failed: out of tokens");
	});

	it("handles auto_retry_start event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateMessage({
				type: "auto_retry_start",
				attempt: 1,
				maxAttempts: 3,
				delayMs: 500,
				errorMessage: "rate limit",
			});
		});
		const state = useSessionStore.getState();
		expect(state.isRetrying).toBe(true);
		expect(state.retryInfo).toEqual({
			attempt: 1,
			maxAttempts: 3,
			delayMs: 500,
			errorMessage: "rate limit",
		});
	});

	it("handles auto_retry_end event", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateMessage({
				type: "auto_retry_start",
				attempt: 1,
				maxAttempts: 3,
				delayMs: 500,
				errorMessage: "rate limit",
			});
		});
		act(() => {
			ws.simulateMessage({ type: "auto_retry_end" });
		});
		expect(useSessionStore.getState().isRetrying).toBe(false);
		expect(useSessionStore.getState().retryInfo).toBeNull();
	});

	it("handles response event for get_available_models", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		const models = [{ id: "claude-3", name: "Claude 3" }];
		act(() => {
			ws.simulateMessage({
				type: "response",
				command: "get_available_models",
				success: true,
				data: { models },
			});
		});
		expect(useSessionStore.getState().availableModels).toEqual(models);
	});

	it("handles response event for get_state", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		const state = { model: undefined, thinkingLevel: "none" } as unknown;
		act(() => {
			ws.simulateMessage({
				type: "response",
				command: "get_state",
				success: true,
				data: state,
			});
		});
		expect(useSessionStore.getState().sessionState).toEqual(state);
	});

	it("handles response event for get_session_stats", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		const stats = { totalTokens: 100, totalCost: 0.01 } as unknown;
		act(() => {
			ws.simulateMessage({
				type: "response",
				command: "get_session_stats",
				success: true,
				data: stats,
			});
		});
		expect(useSessionStore.getState().sessionStats).toEqual(stats);
	});

	it("handles response event for search_files", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		const files = [{ path: "src/foo.ts", score: 1 }];
		act(() => {
			ws.simulateMessage({
				type: "response",
				command: "search_files",
				success: true,
				data: { query: "foo", files },
			});
		});
		const fileSearch = useSessionStore.getState().fileSearch;
		expect(fileSearch).not.toBeNull();
		expect(fileSearch?.query).toBe("foo");
		expect(fileSearch?.matches).toEqual(files);
	});

	it("sends get_state after NEEDS_STATE_REFETCH_EVENTS response", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateOpen();
		});
		act(() => {
			ws.simulateMessage({
				type: "response",
				command: "set_model",
				success: true,
			});
		});
		expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "get_state" }));
	});

	it("sets error on failed response", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		act(() => {
			ws.simulateMessage({
				type: "response",
				command: "set_model",
				success: false,
				error: "model not found",
			});
		});
		expect(useSessionStore.getState().error).toBe("model not found");
	});

	it("ignores malformed JSON messages", () => {
		renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		// Simulate a raw malformed JSON string bypassing simulateMessage helper.
		act(() => {
			ws.onmessage?.({ data: "not-json{{{" } as MessageEvent);
		});
		// Store must remain at initial state — no throws, no mutations.
		expect(useSessionStore.getState().connected).toBe(false);
		expect(useSessionStore.getState().error).toBeNull();
	});

	it("cleans up WebSocket on unmount", () => {
		const { unmount } = renderHook(() => useWebSocket());
		const ws = MockWebSocket.instances[0];
		unmount();
		expect(ws.close).toHaveBeenCalled();
	});
});
