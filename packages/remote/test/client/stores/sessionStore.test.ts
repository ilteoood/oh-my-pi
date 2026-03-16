import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "../../../src/client/stores/sessionStore";
import type {
	FuzzyFindMatch,
	Message,
	ModelInfo,
	SessionState,
	SessionStats,
	ToolExecution,
} from "../../../src/client/types";

beforeEach(() => {
	useSessionStore.setState({
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
	});
});

const makeMessage = (role: Message["role"] = "user"): Message => ({
	role,
	content: "hello",
});

const makeToolExecution = (id: string): ToolExecution => ({
	id,
	name: "bash",
	args: { cmd: "ls" },
	status: "running",
});

describe("setConnected", () => {
	it("sets connected to true", () => {
		useSessionStore.getState().setConnected(true);
		expect(useSessionStore.getState().connected).toBe(true);
	});

	it("sets connected to false", () => {
		useSessionStore.setState({ connected: true });
		useSessionStore.getState().setConnected(false);
		expect(useSessionStore.getState().connected).toBe(false);
	});
});

describe("setSessionState", () => {
	it("stores the provided session state", () => {
		const state: SessionState = {
			model: { provider: "anthropic", id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
			thinkingLevel: "medium",
			isStreaming: false,
			isCompacting: false,
			steeringMode: "all",
			followUpMode: "all",
			interruptMode: "immediate",
			sessionFile: "/tmp/session.json",
			sessionId: "abc123",
			sessionName: "Test Session",
			autoCompactionEnabled: true,
			messageCount: 5,
			queuedMessageCount: 0,
			planModeEnabled: false,
			fastModeEnabled: false,
		};
		useSessionStore.getState().setSessionState(state);
		expect(useSessionStore.getState().sessionState).toEqual(state);
	});
});

describe("setMessages", () => {
	it("replaces the messages array", () => {
		const msgs: Message[] = [makeMessage("user"), makeMessage("assistant")];
		useSessionStore.getState().setMessages(msgs);
		expect(useSessionStore.getState().messages).toEqual(msgs);
	});

	it("replaces a non-empty array with a new one", () => {
		useSessionStore.setState({ messages: [makeMessage("user")] });
		const fresh: Message[] = [makeMessage("assistant")];
		useSessionStore.getState().setMessages(fresh);
		expect(useSessionStore.getState().messages).toEqual(fresh);
	});
});

describe("messageStart", () => {
	it("sets streamingRole and isStreaming, clears streamingContent", () => {
		useSessionStore.setState({ streamingContent: [{ type: "text", text: "old" }] });
		useSessionStore.getState().messageStart("user");
		const { streamingRole, isStreaming, streamingContent } = useSessionStore.getState();
		expect(streamingRole).toBe("user");
		expect(isStreaming).toBe(true);
		expect(streamingContent).toEqual([]);
	});

	it("clears toolExecutions when role is assistant", () => {
		useSessionStore.setState({
			toolExecutions: { t1: makeToolExecution("t1") },
		});
		useSessionStore.getState().messageStart("assistant");
		expect(useSessionStore.getState().toolExecutions).toEqual({});
	});

	it("preserves toolExecutions when role is user", () => {
		const existing = { t1: makeToolExecution("t1") };
		useSessionStore.setState({ toolExecutions: existing });
		useSessionStore.getState().messageStart("user");
		expect(useSessionStore.getState().toolExecutions).toEqual(existing);
	});

	it("preserves toolExecutions when role is developer", () => {
		const existing = { t2: makeToolExecution("t2") };
		useSessionStore.setState({ toolExecutions: existing });
		useSessionStore.getState().messageStart("developer");
		expect(useSessionStore.getState().toolExecutions).toEqual(existing);
	});
});

describe("messageUpdate", () => {
	it("replaces streamingContent", () => {
		const parts = [{ type: "text" as const, text: "partial" }];
		useSessionStore.getState().messageUpdate(parts);
		expect(useSessionStore.getState().streamingContent).toEqual(parts);
	});
});

describe("messageEnd", () => {
	it("appends message to messages and resets streaming state", () => {
		const existing = makeMessage("user");
		useSessionStore.setState({
			messages: [existing],
			streamingContent: [{ type: "text", text: "x" }],
			streamingRole: "assistant",
			isStreaming: true,
		});
		const ended = makeMessage("assistant");
		useSessionStore.getState().messageEnd(ended);
		const state = useSessionStore.getState();
		expect(state.messages).toEqual([existing, ended]);
		expect(state.streamingContent).toEqual([]);
		expect(state.streamingRole).toBeNull();
		expect(state.isStreaming).toBe(false);
	});

	it("works when messages array is initially empty", () => {
		const msg = makeMessage("assistant");
		useSessionStore.getState().messageEnd(msg);
		expect(useSessionStore.getState().messages).toEqual([msg]);
	});
});

describe("toolExecutionStart", () => {
	it("adds a new tool execution with running status", () => {
		useSessionStore.getState().toolExecutionStart("id1", "bash", { cmd: "pwd" });
		const exec = useSessionStore.getState().toolExecutions.id1;
		expect(exec).toEqual({
			id: "id1",
			name: "bash",
			args: { cmd: "pwd" },
			intent: undefined,
			status: "running",
		});
	});

	it("stores intent when provided", () => {
		useSessionStore.getState().toolExecutionStart("id2", "read_file", { path: "/tmp/a" }, "reading config");
		expect(useSessionStore.getState().toolExecutions.id2?.intent).toBe("reading config");
	});

	it("preserves existing executions", () => {
		useSessionStore.setState({ toolExecutions: { old: makeToolExecution("old") } });
		useSessionStore.getState().toolExecutionStart("new", "grep", { pattern: "foo" });
		const execs = useSessionStore.getState().toolExecutions;
		expect(Object.keys(execs)).toContain("old");
		expect(Object.keys(execs)).toContain("new");
	});
});

describe("toolExecutionUpdate", () => {
	it("updates args when provided", () => {
		useSessionStore.setState({ toolExecutions: { t1: makeToolExecution("t1") } });
		useSessionStore.getState().toolExecutionUpdate("t1", { args: { cmd: "pwd" } });
		expect(useSessionStore.getState().toolExecutions.t1?.args).toEqual({ cmd: "pwd" });
	});

	it("updates partialResult when provided", () => {
		useSessionStore.setState({ toolExecutions: { t1: makeToolExecution("t1") } });
		useSessionStore.getState().toolExecutionUpdate("t1", { partialResult: "partial output" });
		expect(useSessionStore.getState().toolExecutions.t1?.partialResult).toBe("partial output");
	});

	it("is a no-op when id is unknown", () => {
		const before = useSessionStore.getState();
		useSessionStore.getState().toolExecutionUpdate("unknown", { args: { x: 1 } });
		expect(useSessionStore.getState().toolExecutions).toEqual(before.toolExecutions);
	});

	it("does not add args key when args is absent from updates", () => {
		useSessionStore.setState({ toolExecutions: { t1: makeToolExecution("t1") } });
		useSessionStore.getState().toolExecutionUpdate("t1", { partialResult: "data" });
		// args remains as original, no spurious override
		expect(useSessionStore.getState().toolExecutions.t1?.args).toEqual({ cmd: "ls" });
	});
});

describe("toolExecutionEnd", () => {
	it("marks execution complete with result", () => {
		useSessionStore.setState({ toolExecutions: { t1: makeToolExecution("t1") } });
		useSessionStore.getState().toolExecutionEnd("t1", "output text");
		const exec = useSessionStore.getState().toolExecutions.t1;
		expect(exec?.status).toBe("complete");
		expect(exec?.result).toBe("output text");
		expect(exec?.isError).toBe(false);
	});

	it("marks execution error when isError is true", () => {
		useSessionStore.setState({ toolExecutions: { t1: makeToolExecution("t1") } });
		useSessionStore.getState().toolExecutionEnd("t1", "error detail", true);
		const exec = useSessionStore.getState().toolExecutions.t1;
		expect(exec?.status).toBe("error");
		expect(exec?.isError).toBe(true);
	});

	it("defaults isError to false when omitted", () => {
		useSessionStore.setState({ toolExecutions: { t1: makeToolExecution("t1") } });
		useSessionStore.getState().toolExecutionEnd("t1", null);
		expect(useSessionStore.getState().toolExecutions.t1?.isError).toBe(false);
	});

	it("is a no-op when id is unknown", () => {
		const before = useSessionStore.getState().toolExecutions;
		useSessionStore.getState().toolExecutionEnd("ghost", "result");
		expect(useSessionStore.getState().toolExecutions).toEqual(before);
	});
});

describe("turnEnd", () => {
	it("sets isStreaming to false", () => {
		useSessionStore.setState({ isStreaming: true });
		useSessionStore.getState().turnEnd();
		expect(useSessionStore.getState().isStreaming).toBe(false);
	});
});

describe("agentEnd", () => {
	it("clears streaming state", () => {
		useSessionStore.setState({
			isStreaming: true,
			streamingContent: [{ type: "text", text: "partial" }],
			streamingRole: "assistant",
		});
		useSessionStore.getState().agentEnd();
		const state = useSessionStore.getState();
		expect(state.isStreaming).toBe(false);
		expect(state.streamingContent).toEqual([]);
		expect(state.streamingRole).toBeNull();
	});
});

describe("compactionStart / compactionEnd", () => {
	it("compactionStart sets isCompacting to true", () => {
		useSessionStore.getState().compactionStart();
		expect(useSessionStore.getState().isCompacting).toBe(true);
	});

	it("compactionEnd sets isCompacting to false", () => {
		useSessionStore.setState({ isCompacting: true });
		useSessionStore.getState().compactionEnd();
		expect(useSessionStore.getState().isCompacting).toBe(false);
	});
});

describe("retryStart / retryEnd", () => {
	const info = { attempt: 1, maxAttempts: 3, delayMs: 1000, errorMessage: "timeout" };

	it("retryStart sets isRetrying and stores retryInfo", () => {
		useSessionStore.getState().retryStart(info);
		const state = useSessionStore.getState();
		expect(state.isRetrying).toBe(true);
		expect(state.retryInfo).toEqual(info);
	});

	it("retryEnd clears isRetrying and retryInfo", () => {
		useSessionStore.setState({ isRetrying: true, retryInfo: info });
		useSessionStore.getState().retryEnd();
		const state = useSessionStore.getState();
		expect(state.isRetrying).toBe(false);
		expect(state.retryInfo).toBeNull();
	});
});

describe("setError", () => {
	it("stores an error string", () => {
		useSessionStore.getState().setError("connection lost");
		expect(useSessionStore.getState().error).toBe("connection lost");
	});

	it("clears error when passed null", () => {
		useSessionStore.setState({ error: "old error" });
		useSessionStore.getState().setError(null);
		expect(useSessionStore.getState().error).toBeNull();
	});
});

describe("setAvailableModels", () => {
	it("replaces the available models list", () => {
		const models: ModelInfo[] = [{ provider: "anthropic", id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" }];
		useSessionStore.getState().setAvailableModels(models);
		expect(useSessionStore.getState().availableModels).toEqual(models);
	});

	it("clears models when passed empty array", () => {
		useSessionStore.setState({
			availableModels: [{ provider: "openai", id: "gpt-4o", name: "GPT-4o" }],
		});
		useSessionStore.getState().setAvailableModels([]);
		expect(useSessionStore.getState().availableModels).toEqual([]);
	});
});

describe("setSessionStats", () => {
	const stats: SessionStats = {
		sessionFile: "/tmp/s.json",
		sessionId: "xyz",
		userMessages: 2,
		assistantMessages: 2,
		toolCalls: 1,
		toolResults: 1,
		totalMessages: 4,
		tokens: { input: 100, output: 200, cacheRead: 0, cacheWrite: 0, total: 300 },
		premiumRequests: 0,
		cost: 0.005,
	};

	it("stores session stats", () => {
		useSessionStore.getState().setSessionStats(stats);
		expect(useSessionStore.getState().sessionStats).toEqual(stats);
	});

	it("clears stats when passed null", () => {
		useSessionStore.setState({ sessionStats: stats });
		useSessionStore.getState().setSessionStats(null);
		expect(useSessionStore.getState().sessionStats).toBeNull();
	});
});

describe("setFileSearch / clearFileSearch", () => {
	const matches: FuzzyFindMatch[] = [{ path: "/src/foo.ts", isDirectory: false, score: 0.9 }];

	it("setFileSearch stores query and matches", () => {
		useSessionStore.getState().setFileSearch("foo", matches);
		expect(useSessionStore.getState().fileSearch).toEqual({ query: "foo", matches });
	});

	it("clearFileSearch resets fileSearch to null", () => {
		useSessionStore.setState({ fileSearch: { query: "foo", matches } });
		useSessionStore.getState().clearFileSearch();
		expect(useSessionStore.getState().fileSearch).toBeNull();
	});
});

describe("clearMessages", () => {
	it("resets messages, streaming state, toolExecutions, and isStreaming", () => {
		useSessionStore.setState({
			messages: [makeMessage("user"), makeMessage("assistant")],
			streamingContent: [{ type: "text", text: "partial" }],
			streamingRole: "assistant",
			toolExecutions: { t1: makeToolExecution("t1") },
			isStreaming: true,
		});
		useSessionStore.getState().clearMessages();
		const state = useSessionStore.getState();
		expect(state.messages).toEqual([]);
		expect(state.streamingContent).toEqual([]);
		expect(state.streamingRole).toBeNull();
		expect(state.toolExecutions).toEqual({});
		expect(state.isStreaming).toBe(false);
	});

	it("is idempotent on already-empty state", () => {
		useSessionStore.getState().clearMessages();
		const state = useSessionStore.getState();
		expect(state.messages).toEqual([]);
		expect(state.toolExecutions).toEqual({});
	});
});
