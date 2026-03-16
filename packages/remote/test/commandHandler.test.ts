// @vitest-environment node

import type { AgentSession, SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionState, handleCommand } from "../../src/commandHandler";

vi.mock("@oh-my-pi/pi-natives", () => ({
	fuzzyFind: vi.fn().mockResolvedValue({ matches: [] }),
}));

vi.mock("@oh-my-pi/pi-utils", () => ({
	getProjectDir: vi.fn().mockReturnValue("/project"),
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
	},
}));

const MOCK_MODEL = { provider: "anthropic", id: "claude-3-5", name: "Claude 3.5" } as const;

const MOCK_STATS: SessionStats = {
	sessionId: "test",
	userMessages: 0,
	assistantMessages: 0,
	toolCalls: 0,
	toolResults: 0,
	totalMessages: 0,
	tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	premiumRequests: 0,
	cost: 0,
	sessionFile: undefined,
};

function makeSession(): AgentSession {
	return {
		model: MOCK_MODEL,
		thinkingLevel: "off",
		isStreaming: false,
		isCompacting: false,
		steeringMode: "all",
		followUpMode: "all",
		interruptMode: "immediate",
		sessionFile: undefined,
		sessionId: "test-session",
		sessionName: "Test",
		autoCompactionEnabled: true,
		messages: [],
		queuedMessageCount: 0,

		getPlanModeState: vi.fn().mockReturnValue(null),
		isFastModeEnabled: vi.fn().mockReturnValue(false),
		prompt: vi.fn().mockReturnValue({ catch: vi.fn() }),
		steer: vi.fn().mockResolvedValue(undefined),
		followUp: vi.fn().mockResolvedValue(undefined),
		abort: vi.fn().mockResolvedValue(undefined),
		newSession: vi.fn().mockResolvedValue(true),
		compact: vi.fn().mockResolvedValue({ summary: "ok" }),
		setModel: vi.fn().mockResolvedValue(undefined),
		cycleModel: vi.fn().mockResolvedValue({ provider: "a", id: "b", name: "B" }),
		getAvailableModels: vi.fn().mockReturnValue([MOCK_MODEL]),
		setThinkingLevel: vi.fn(),
		cycleThinkingLevel: vi.fn().mockReturnValue("medium"),
		setSteeringMode: vi.fn(),
		setFollowUpMode: vi.fn(),
		setInterruptMode: vi.fn(),
		setAutoCompactionEnabled: vi.fn(),
		setAutoRetryEnabled: vi.fn(),
		abortRetry: vi.fn(),
		getSessionStats: vi.fn().mockReturnValue(MOCK_STATS),
		setSessionName: vi.fn(),
		getLastAssistantMessage: vi.fn().mockReturnValue(null),
		setPlanModeState: vi.fn(),
		toggleFastMode: vi.fn().mockReturnValue(false),
		setFastMode: vi.fn(),
	} as unknown as AgentSession;
}

describe("getSessionState", () => {
	it("returns all RpcSessionState fields from session", () => {
		const session = makeSession();
		const state = getSessionState(session);

		expect(state).toEqual({
			model: MOCK_MODEL,
			thinkingLevel: "off",
			isStreaming: false,
			isCompacting: false,
			steeringMode: "all",
			followUpMode: "all",
			interruptMode: "immediate",
			sessionFile: undefined,
			sessionId: "test-session",
			sessionName: "Test",
			autoCompactionEnabled: true,
			messageCount: 0,
			queuedMessageCount: 0,
			planModeEnabled: false,
			fastModeEnabled: false,
		});
	});

	it("derives planModeEnabled from getPlanModeState().enabled", () => {
		const session = makeSession();
		(session.getPlanModeState as ReturnType<typeof vi.fn>).mockReturnValue({ enabled: true, planFilePath: "/tmp/plan.md" });

		const state = getSessionState(session);
		expect(state.planModeEnabled).toBe(true);
	});

	it("uses false when getPlanModeState returns null", () => {
		const session = makeSession();
		(session.getPlanModeState as ReturnType<typeof vi.fn>).mockReturnValue(null);

		const state = getSessionState(session);
		expect(state.planModeEnabled).toBe(false);
	});

	it("derives fastModeEnabled from isFastModeEnabled()", () => {
		const session = makeSession();
		(session.isFastModeEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);

		const state = getSessionState(session);
		expect(state.fastModeEnabled).toBe(true);
	});

	it("reflects message count from session.messages.length", () => {
		const session = makeSession();
		// @ts-expect-error: overriding readonly-like field for test
		session.messages = [{}, {}, {}] as AgentSession["messages"];

		const state = getSessionState(session);
		expect(state.messageCount).toBe(3);
	});
});

describe("handleCommand", () => {
	let session: AgentSession;

	beforeEach(() => {
		session = makeSession();
	});

	describe("prompt", () => {
		it("calls session.prompt and returns success", async () => {
			const res = await handleCommand(session, { type: "prompt", message: "hello" });

			expect(session.prompt).toHaveBeenCalledWith("hello", {
				images: undefined,
				streamingBehavior: undefined,
			});
			expect(res).toMatchObject({ type: "response", command: "prompt", success: true });
		});

		it("passes images and streamingBehavior", async () => {
			const images = [{ type: "base64" as const, mediaType: "image/png" as const, data: "abc" }];
			await handleCommand(session, { type: "prompt", message: "hi", images, streamingBehavior: "steer" });

			expect(session.prompt).toHaveBeenCalledWith("hi", { images, streamingBehavior: "steer" });
		});
	});

	describe("steer", () => {
		it("awaits session.steer and returns success", async () => {
			const res = await handleCommand(session, { type: "steer", message: "steer me" });

			expect(session.steer).toHaveBeenCalledWith("steer me", undefined);
			expect(res).toMatchObject({ type: "response", command: "steer", success: true });
		});
	});

	describe("follow_up", () => {
		it("awaits session.followUp and returns success", async () => {
			const res = await handleCommand(session, { type: "follow_up", message: "more" });

			expect(session.followUp).toHaveBeenCalledWith("more", undefined);
			expect(res).toMatchObject({ type: "response", command: "follow_up", success: true });
		});
	});

	describe("abort", () => {
		it("awaits session.abort and returns success", async () => {
			const res = await handleCommand(session, { type: "abort" });

			expect(session.abort).toHaveBeenCalled();
			expect(res).toMatchObject({ type: "response", command: "abort", success: true });
		});
	});

	describe("abort_and_prompt", () => {
		it("calls abort then prompt, returns success", async () => {
			const res = await handleCommand(session, { type: "abort_and_prompt", message: "retry" });

			expect(session.abort).toHaveBeenCalled();
			expect(session.prompt).toHaveBeenCalledWith("retry", { images: undefined });
			expect(res).toMatchObject({ type: "response", command: "abort_and_prompt", success: true });
		});
	});

	describe("new_session", () => {
		it("returns cancelled:false when newSession resolves true", async () => {
			const res = await handleCommand(session, { type: "new_session" });

			expect(res).toMatchObject({ type: "response", command: "new_session", success: true, data: { cancelled: false } });
		});

		it("returns cancelled:true when newSession resolves false", async () => {
			(session.newSession as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			const res = await handleCommand(session, { type: "new_session" });

			expect(res).toMatchObject({ type: "response", command: "new_session", success: true, data: { cancelled: true } });
		});

		it("passes parentSession option when provided", async () => {
			await handleCommand(session, { type: "new_session", parentSession: "parent-id" });

			expect(session.newSession).toHaveBeenCalledWith({ parentSession: "parent-id" });
		});

		it("passes undefined options when no parentSession", async () => {
			await handleCommand(session, { type: "new_session" });

			expect(session.newSession).toHaveBeenCalledWith(undefined);
		});
	});

	describe("get_state", () => {
		it("returns full session state", async () => {
			const res = await handleCommand(session, { type: "get_state" });

			expect(res).toMatchObject({ type: "response", command: "get_state", success: true });
			expect((res as { data: unknown }).data).toHaveProperty("sessionId", "test-session");
		});
	});

	describe("set_model", () => {
		it("calls setModel with found model and returns success", async () => {
			const res = await handleCommand(session, { type: "set_model", provider: "anthropic", modelId: "claude-3-5" });

			expect(session.setModel).toHaveBeenCalledWith(MOCK_MODEL);
			expect(res).toMatchObject({ type: "response", command: "set_model", success: true, data: MOCK_MODEL });
		});

		it("returns error when model not found", async () => {
			const res = await handleCommand(session, { type: "set_model", provider: "openai", modelId: "gpt-4" });

			expect(res).toMatchObject({ type: "response", command: "set_model", success: false });
			expect((res as { error: string }).error).toContain("not found");
		});
	});

	describe("cycle_model", () => {
		it("returns success with model data", async () => {
			const cycleResult = { provider: "a", id: "b", name: "B" };
			(session.cycleModel as ReturnType<typeof vi.fn>).mockResolvedValue(cycleResult);

			const res = await handleCommand(session, { type: "cycle_model" });

			expect(res).toMatchObject({ type: "response", command: "cycle_model", success: true, data: cycleResult });
		});

		it("returns success with null data when cycleModel returns null", async () => {
			(session.cycleModel as ReturnType<typeof vi.fn>).mockResolvedValue(null);

			const res = await handleCommand(session, { type: "cycle_model" });

			expect(res).toMatchObject({ type: "response", command: "cycle_model", success: true, data: null });
		});
	});

	describe("get_available_models", () => {
		it("returns models list", async () => {
			const res = await handleCommand(session, { type: "get_available_models" });

			expect(res).toMatchObject({
				type: "response",
				command: "get_available_models",
				success: true,
				data: { models: [MOCK_MODEL] },
			});
		});
	});

	describe("set_thinking_level", () => {
		it("calls setThinkingLevel and returns success", async () => {
			const res = await handleCommand(session, { type: "set_thinking_level", level: "medium" });

			expect(session.setThinkingLevel).toHaveBeenCalledWith("medium");
			expect(res).toMatchObject({ type: "response", command: "set_thinking_level", success: true });
		});
	});

	describe("cycle_thinking_level", () => {
		it("returns success with level when cycleThinkingLevel returns value", async () => {
			(session.cycleThinkingLevel as ReturnType<typeof vi.fn>).mockReturnValue("medium");

			const res = await handleCommand(session, { type: "cycle_thinking_level" });

			expect(res).toMatchObject({
				type: "response",
				command: "cycle_thinking_level",
				success: true,
				data: { level: "medium" },
			});
		});

		it("returns success with null when cycleThinkingLevel returns null", async () => {
			(session.cycleThinkingLevel as ReturnType<typeof vi.fn>).mockReturnValue(null);

			const res = await handleCommand(session, { type: "cycle_thinking_level" });

			expect(res).toMatchObject({ type: "response", command: "cycle_thinking_level", success: true, data: null });
		});
	});

	describe("set_steering_mode", () => {
		it("calls setSteeringMode and returns success", async () => {
			const res = await handleCommand(session, { type: "set_steering_mode", mode: "one-at-a-time" });

			expect(session.setSteeringMode).toHaveBeenCalledWith("one-at-a-time");
			expect(res).toMatchObject({ type: "response", command: "set_steering_mode", success: true });
		});
	});

	describe("set_follow_up_mode", () => {
		it("calls setFollowUpMode and returns success", async () => {
			const res = await handleCommand(session, { type: "set_follow_up_mode", mode: "all" });

			expect(session.setFollowUpMode).toHaveBeenCalledWith("all");
			expect(res).toMatchObject({ type: "response", command: "set_follow_up_mode", success: true });
		});
	});

	describe("set_interrupt_mode", () => {
		it("calls setInterruptMode and returns success", async () => {
			const res = await handleCommand(session, { type: "set_interrupt_mode", mode: "wait" });

			expect(session.setInterruptMode).toHaveBeenCalledWith("wait");
			expect(res).toMatchObject({ type: "response", command: "set_interrupt_mode", success: true });
		});
	});

	describe("compact", () => {
		it("calls compact and returns success with result", async () => {
			(session.compact as ReturnType<typeof vi.fn>).mockResolvedValue({ summary: "compacted" });

			const res = await handleCommand(session, { type: "compact" });

			expect(session.compact).toHaveBeenCalledWith(undefined);
			expect(res).toMatchObject({ type: "response", command: "compact", success: true, data: { summary: "compacted" } });
		});

		it("passes customInstructions to compact", async () => {
			await handleCommand(session, { type: "compact", customInstructions: "be brief" });

			expect(session.compact).toHaveBeenCalledWith("be brief");
		});
	});

	describe("set_auto_compaction", () => {
		it("calls setAutoCompactionEnabled and returns success", async () => {
			const res = await handleCommand(session, { type: "set_auto_compaction", enabled: false });

			expect(session.setAutoCompactionEnabled).toHaveBeenCalledWith(false);
			expect(res).toMatchObject({ type: "response", command: "set_auto_compaction", success: true });
		});
	});

	describe("set_auto_retry", () => {
		it("calls setAutoRetryEnabled and returns success", async () => {
			const res = await handleCommand(session, { type: "set_auto_retry", enabled: true });

			expect(session.setAutoRetryEnabled).toHaveBeenCalledWith(true);
			expect(res).toMatchObject({ type: "response", command: "set_auto_retry", success: true });
		});
	});

	describe("abort_retry", () => {
		it("calls abortRetry and returns success", async () => {
			const res = await handleCommand(session, { type: "abort_retry" });

			expect(session.abortRetry).toHaveBeenCalled();
			expect(res).toMatchObject({ type: "response", command: "abort_retry", success: true });
		});
	});

	describe("get_session_stats", () => {
		it("calls getSessionStats and returns success with stats", async () => {
			const res = await handleCommand(session, { type: "get_session_stats" });

			expect(session.getSessionStats).toHaveBeenCalled();
			expect(res).toMatchObject({ type: "response", command: "get_session_stats", success: true, data: MOCK_STATS });
		});
	});

	describe("set_session_name", () => {
		it("calls setSessionName and returns success for valid name", async () => {
			const res = await handleCommand(session, { type: "set_session_name", name: "New Name" });

			expect(session.setSessionName).toHaveBeenCalledWith("New Name");
			expect(res).toMatchObject({ type: "response", command: "set_session_name", success: true });
		});

		it("returns error when name is empty", async () => {
			const res = await handleCommand(session, { type: "set_session_name", name: "   " });

			expect(session.setSessionName).not.toHaveBeenCalled();
			expect(res).toMatchObject({ type: "response", command: "set_session_name", success: false });
			expect((res as { error: string }).error).toMatch(/cannot be empty/i);
		});
	});

	describe("get_messages", () => {
		it("returns messages array", async () => {
			const res = await handleCommand(session, { type: "get_messages" });

			expect(res).toMatchObject({ type: "response", command: "get_messages", success: true, data: { messages: [] } });
		});
	});

	describe("search_files", () => {
		it("calls fuzzyFind and returns success with files", async () => {
			const { fuzzyFind: mockFuzzyFind } = await import("@oh-my-pi/pi-natives");
			(mockFuzzyFind as ReturnType<typeof vi.fn>).mockResolvedValue({
				matches: [{ path: "/project/foo.ts", isDirectory: false, score: 0.9 }],
			});

			const res = await handleCommand(session, { type: "search_files", query: "foo" });

			expect(res).toMatchObject({
				type: "response",
				command: "search_files",
				success: true,
				data: {
					query: "foo",
					files: [{ path: "/project/foo.ts", isDirectory: false, score: 0.9 }],
				},
			});
		});

		it("returns error when fuzzyFind throws", async () => {
			const { fuzzyFind: mockFuzzyFind } = await import("@oh-my-pi/pi-natives");
			(mockFuzzyFind as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("search failed"));

			const res = await handleCommand(session, { type: "search_files", query: "foo" });

			expect(res).toMatchObject({ type: "response", command: "search_files", success: false });
			expect((res as { error: string }).error).toContain("search failed");
		});

		it("handles non-Error throws in search_files", async () => {
			const { fuzzyFind: mockFuzzyFind } = await import("@oh-my-pi/pi-natives");
			(mockFuzzyFind as ReturnType<typeof vi.fn>).mockRejectedValue("raw string error");

			const res = await handleCommand(session, { type: "search_files", query: "bar" });

			expect(res).toMatchObject({ success: false });
			expect((res as { error: string }).error).toContain("raw string error");
		});
	});

	describe("toggle_fast_mode", () => {
		it("calls toggleFastMode and returns success with enabled", async () => {
			(session.toggleFastMode as ReturnType<typeof vi.fn>).mockReturnValue(true);

			const res = await handleCommand(session, { type: "toggle_fast_mode" });

			expect(session.toggleFastMode).toHaveBeenCalled();
			expect(res).toMatchObject({ type: "response", command: "toggle_fast_mode", success: true, data: { enabled: true } });
		});
	});

	describe("set_fast_mode", () => {
		it("calls setFastMode and returns success", async () => {
			const res = await handleCommand(session, { type: "set_fast_mode", enabled: true });

			expect(session.setFastMode).toHaveBeenCalledWith(true);
			expect(res).toMatchObject({
				type: "response",
				command: "set_fast_mode",
				success: true,
				data: { enabled: true },
			});
		});
	});

	describe("set_plan_mode", () => {
		it("calls setPlanModeState(undefined) and returns enabled:false when disabled", async () => {
			const res = await handleCommand(session, { type: "set_plan_mode", enabled: false });

			expect(session.setPlanModeState).toHaveBeenCalledWith(undefined);
			expect(res).toMatchObject({
				type: "response",
				command: "set_plan_mode",
				success: true,
				data: { enabled: false },
			});
		});

		it("calls setPlanModeState with enabled:true and returns enabled:true", async () => {
			const res = await handleCommand(session, { type: "set_plan_mode", enabled: true });

			expect(session.setPlanModeState).toHaveBeenCalledWith(
				expect.objectContaining({ enabled: true, planFilePath: expect.stringContaining("plan-test-session") }),
			);
			expect(res).toMatchObject({
				type: "response",
				command: "set_plan_mode",
				success: true,
				data: { enabled: true },
			});
		});

		it("also calls prompt when enabling with a prompt string", async () => {
			await handleCommand(session, { type: "set_plan_mode", enabled: true, prompt: "plan it" });

			expect(session.prompt).toHaveBeenCalledWith("plan it");
		});

		it("does not call prompt when enabling without a prompt string", async () => {
			await handleCommand(session, { type: "set_plan_mode", enabled: true });

			expect(session.prompt).not.toHaveBeenCalled();
		});
	});

	describe("get_last_assistant_text", () => {
		it("returns text:null when no last message", async () => {
			(session.getLastAssistantMessage as ReturnType<typeof vi.fn>).mockReturnValue(null);

			const res = await handleCommand(session, { type: "get_last_assistant_text" });

			expect(res).toMatchObject({
				type: "response",
				command: "get_last_assistant_text",
				success: true,
				data: { text: null },
			});
		});

		it("extracts text from TextContentPart", async () => {
			(session.getLastAssistantMessage as ReturnType<typeof vi.fn>).mockReturnValue({
				content: [
					{ type: "text", text: "hello" },
					{ type: "tool_use", id: "x", name: "bash", input: {} },
					{ type: "text", text: "world" },
				],
			});

			const res = await handleCommand(session, { type: "get_last_assistant_text" });

			expect(res).toMatchObject({
				type: "response",
				command: "get_last_assistant_text",
				success: true,
				data: { text: "hello\nworld" },
			});
		});

		it("returns text:null when message has no text parts", async () => {
			(session.getLastAssistantMessage as ReturnType<typeof vi.fn>).mockReturnValue({
				content: [{ type: "tool_use", id: "x", name: "bash", input: {} }],
			});

			const res = await handleCommand(session, { type: "get_last_assistant_text" });

			expect(res).toMatchObject({
				type: "response",
				command: "get_last_assistant_text",
				success: true,
				data: { text: null },
			});
		});
	});

	describe("unknown command", () => {
		it("returns error response for unrecognized command type", async () => {
			const res = await handleCommand(session, { type: "unknown_cmd" } as unknown as Parameters<typeof handleCommand>[1]);

			expect(res).toMatchObject({ type: "response", command: "unknown_cmd", success: false });
			expect((res as { error: string }).error).toContain("Unknown command");
		});
	});

	describe("id propagation", () => {
		it("echoes command id in response", async () => {
			const res = await handleCommand(session, { type: "abort", id: "req-42" });

			expect((res as { id: string }).id).toBe("req-42");
		});

		it("returns undefined id when command has no id", async () => {
			const res = await handleCommand(session, { type: "abort" });

			expect((res as { id?: string }).id).toBeUndefined();
		});
	});
});
