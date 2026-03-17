import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("i18next", () => ({
	default: { t: (key: string) => key },
	t: (key: string) => key,
}));

vi.mock("../../src/client/stores/sessionStore", () => ({
	useSessionStore: {
		getState: vi.fn().mockReturnValue({
			messages: [],
			clearFileSearch: vi.fn(),
			fileSearch: null,
		}),
	},
}));

vi.mock("../../src/client/stores/uiStore", () => ({
	useUIStore: {
		getState: vi.fn().mockReturnValue({
			openSettings: vi.fn(),
			openHotkeys: vi.fn(),
			openSessionStats: vi.fn(),
			openModelSelect: vi.fn(),
		}),
	},
}));

import {
	executeSlashCommand,
	extractAtPrefix,
	getSlashCommandHint,
	isKnownSlashCommand,
	matchSlashCommands,
	matchSubcommands,
	parseSlashCommand,
	WEB_SLASH_COMMANDS,
} from "../../src/client/slashCommands";
import { useSessionStore } from "../../src/client/stores/sessionStore";
import { useUIStore } from "../../src/client/stores/uiStore";

// ---------------------------------------------------------------------------
// parseSlashCommand
// ---------------------------------------------------------------------------

describe("parseSlashCommand", () => {
	it("returns null when input does not start with /", () => {
		expect(parseSlashCommand("hello")).toBeNull();
		expect(parseSlashCommand("compact")).toBeNull();
	});

	it("returns null when body after slash is empty", () => {
		expect(parseSlashCommand("/")).toBeNull();
		expect(parseSlashCommand("/   ")).toBeNull();
	});

	it("returns name with empty args when no space after command", () => {
		expect(parseSlashCommand("/new")).toEqual({ name: "new", args: "" });
		expect(parseSlashCommand("/compact")).toEqual({ name: "compact", args: "" });
	});

	it("returns name and trimmed args when space present", () => {
		expect(parseSlashCommand("/compact   custom instructions  ")).toEqual({
			name: "compact",
			args: "custom instructions",
		});
		expect(parseSlashCommand("/thinking low")).toEqual({ name: "thinking", args: "low" });
	});
});

// ---------------------------------------------------------------------------
// isKnownSlashCommand
// ---------------------------------------------------------------------------

describe("isKnownSlashCommand", () => {
	it("returns true for every built-in command", () => {
		for (const cmd of WEB_SLASH_COMMANDS) {
			expect(isKnownSlashCommand(cmd.name)).toBe(true);
		}
	});

	it("returns false for unknown commands", () => {
		expect(isKnownSlashCommand("unknown")).toBe(false);
		expect(isKnownSlashCommand("")).toBe(false);
		expect(isKnownSlashCommand("foo")).toBe(false);
	});

	it("is case-insensitive", () => {
		expect(isKnownSlashCommand("NEW")).toBe(true);
		expect(isKnownSlashCommand("Compact")).toBe(true);
		expect(isKnownSlashCommand("THINKING")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// matchSlashCommands
// ---------------------------------------------------------------------------

describe("matchSlashCommands", () => {
	it("returns empty array when input does not start with /", () => {
		expect(matchSlashCommands("new")).toEqual([]);
		expect(matchSlashCommands("")).toEqual([]);
	});

	it("returns empty array when a space is present (past command name phase)", () => {
		expect(matchSlashCommands("/new ")).toEqual([]);
		expect(matchSlashCommands("/compact foo")).toEqual([]);
	});

	it("returns all commands when body is empty", () => {
		const result = matchSlashCommands("/");
		expect(result).toHaveLength(WEB_SLASH_COMMANDS.length);
	});

	it("returns filtered commands for a partial name match", () => {
		const result = matchSlashCommands("/co");
		const names = result.map(c => c.name);
		expect(names).toContain("copy");
		expect(names).toContain("compact");
		// copy and compact appear before others due to higher fuzzy score on the name
		const copyIdx = names.indexOf("copy");
		const compactIdx = names.indexOf("compact");
		const sessionIdx = names.indexOf("session");
		expect(copyIdx).toBeLessThan(sessionIdx);
		expect(compactIdx).toBeLessThan(sessionIdx);
	});

	it("returns the exact command first for a full name match", () => {
		const result = matchSlashCommands("/model");
		expect(result[0]?.name).toBe("model");
	});
});

// ---------------------------------------------------------------------------
// matchSubcommands
// ---------------------------------------------------------------------------

describe("matchSubcommands", () => {
	it("returns empty array when input does not start with /", () => {
		expect(matchSubcommands("thinking low")).toEqual([]);
	});

	it("returns empty array when no space is present", () => {
		expect(matchSubcommands("/thinking")).toEqual([]);
	});

	it("returns empty array for an unknown command", () => {
		expect(matchSubcommands("/unknown ")).toEqual([]);
	});

	it("returns empty array for commands with no subcommands", () => {
		// /new has no subcommands
		expect(matchSubcommands("/new ")).toEqual([]);
	});

	it("returns all subcommands when argText is empty", () => {
		const result = matchSubcommands("/thinking ");
		const names = result.map(s => s.name);
		expect(names).toContain("off");
		expect(names).toContain("minimal");
		expect(names).toContain("low");
		expect(names).toContain("medium");
		expect(names).toContain("high");
		expect(names).toContain("xhigh");
	});

	it("returns matching subcommands for partial argText", () => {
		const result = matchSubcommands("/thinking of");
		const names = result.map(s => s.name);
		expect(names).toContain("off");
		// "minimal" doesn't contain the sequence 'of'
		expect(names).not.toContain("minimal");
	});

	it("returns plan subcommands when argText is empty", () => {
		const result = matchSubcommands("/plan ");
		const names = result.map(s => s.name);
		expect(names).toContain("on");
		expect(names).toContain("off");
		expect(names).toContain("toggle");
	});
});

// ---------------------------------------------------------------------------
// getSlashCommandHint
// ---------------------------------------------------------------------------

describe("getSlashCommandHint", () => {
	it("returns null when input does not start with /", () => {
		expect(getSlashCommandHint("compact")).toBeNull();
		expect(getSlashCommandHint("")).toBeNull();
	});

	it("returns inlineHint for exact command name match", () => {
		// compact has an inlineHint
		expect(getSlashCommandHint("/compact")).toBe("slashCommands.descriptions.compactHint");
	});

	it("returns null for a command without an inlineHint", () => {
		expect(getSlashCommandHint("/new")).toBeNull();
		expect(getSlashCommandHint("/session")).toBeNull();
	});

	it("returns null after space when command has subcommands", () => {
		// thinking has subcommands — those appear in dropdown, no inline hint
		expect(getSlashCommandHint("/thinking low")).toBeNull();
		// plan also has subcommands
		expect(getSlashCommandHint("/plan on")).toBeNull();
	});

	it("returns inlineHint after space for commands with allowArgs but no subcommands (btw)", () => {
		// btw has inlineHint and no subcommands
		expect(getSlashCommandHint("/btw hello")).toBe("slashCommands.descriptions.btwHint");
	});

	it("returns null after space for commands with no inlineHint and no subcommands", () => {
		// /new has no inlineHint and no subcommands; the command lookup still finds it
		expect(getSlashCommandHint("/new something")).toBeNull();
	});

	it("returns null after space for an unknown command", () => {
		expect(getSlashCommandHint("/unknown arg")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// extractAtPrefix
// ---------------------------------------------------------------------------

describe("extractAtPrefix", () => {
	it("returns null when there is no @ before cursor", () => {
		expect(extractAtPrefix("hello world", 11)).toBeNull();
		expect(extractAtPrefix("", 0)).toBeNull();
	});

	it("returns query and tokenStart when @ is at start of string", () => {
		expect(extractAtPrefix("@foo", 4)).toEqual({ query: "foo", tokenStart: 0 });
	});

	it("returns query and tokenStart when @ is preceded by a space delimiter", () => {
		expect(extractAtPrefix("hello @world", 12)).toEqual({ query: "world", tokenStart: 6 });
	});

	it("returns null when @ is preceded by a non-delimiter character (inside a word)", () => {
		expect(extractAtPrefix("foo@bar", 7)).toBeNull();
	});

	it("returns query and tokenStart when @ is preceded by = (a delimiter)", () => {
		expect(extractAtPrefix("=@bar", 5)).toEqual({ query: "bar", tokenStart: 1 });
	});

	it("returns partial query when cursor is in the middle of an @token", () => {
		// "@foo" with cursor at 2 means only "f" has been typed after @
		expect(extractAtPrefix("@foo", 2)).toEqual({ query: "f", tokenStart: 0 });
	});

	it("returns null when a delimiter sits between cursor and @", () => {
		// space after @ then more chars — scanning backward hits space before @
		expect(extractAtPrefix("@foo bar", 8)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// executeSlashCommand
// ---------------------------------------------------------------------------

describe("executeSlashCommand", () => {
	let sendCommand: ReturnType<typeof vi.fn>;
	let openSettings: ReturnType<typeof vi.fn>;
	let openHotkeys: ReturnType<typeof vi.fn>;
	let openSessionStats: ReturnType<typeof vi.fn>;
	let openModelSelect: ReturnType<typeof vi.fn>;
	let openSessionPicker: ReturnType<typeof vi.fn>;
	let clipboardWriteText: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		sendCommand = vi.fn();
		openSettings = vi.fn();
		openHotkeys = vi.fn();
		openSessionStats = vi.fn();
		openModelSelect = vi.fn();
		openSessionPicker = vi.fn();
		clipboardWriteText = vi.fn().mockResolvedValue(undefined);

		vi.mocked(useUIStore.getState).mockReturnValue({
			openSettings,
			openHotkeys,
			openSessionStats,
			openModelSelect,
			openSessionPicker,
		} as unknown as ReturnType<typeof useUIStore.getState>);

		vi.mocked(useSessionStore.getState).mockReturnValue({
			messages: [],
			clearFileSearch: vi.fn(),
			fileSearch: null,
		} as unknown as ReturnType<typeof useSessionStore.getState>);

		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: clipboardWriteText },
			writable: true,
			configurable: true,
		});
	});

	// --- new ---
	it("new: sends new_session and returns true", () => {
		const result = executeSlashCommand({ name: "new", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "new_session" });
	});

	// --- compact ---
	it("compact (no args): sends compact with undefined customInstructions", () => {
		const result = executeSlashCommand({ name: "compact", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "compact", customInstructions: undefined });
	});

	it("compact (with args): sends compact with customInstructions", () => {
		const result = executeSlashCommand({ name: "compact", args: "keep it short" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "compact", customInstructions: "keep it short" });
	});

	// --- model ---
	it("model: opens model select and returns true", () => {
		const result = executeSlashCommand({ name: "model", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(openModelSelect).toHaveBeenCalled();
		expect(sendCommand).not.toHaveBeenCalled();
	});

	// --- thinking ---
	it("thinking (valid level): sends set_thinking_level and returns true", () => {
		for (const level of ["off", "minimal", "low", "medium", "high", "xhigh"] as const) {
			sendCommand.mockClear();
			const result = executeSlashCommand({ name: "thinking", args: level }, { sendCommand });
			expect(result).toBe(true);
			expect(sendCommand).toHaveBeenCalledWith({ type: "set_thinking_level", level });
		}
	});

	it("thinking (invalid level): returns false", () => {
		const result = executeSlashCommand({ name: "thinking", args: "maximum" }, { sendCommand });
		expect(result).toBe(false);
		expect(sendCommand).not.toHaveBeenCalled();
	});

	it("thinking (empty args): returns false", () => {
		const result = executeSlashCommand({ name: "thinking", args: "" }, { sendCommand });
		expect(result).toBe(false);
	});

	// --- plan ---
	it("plan (off): sends set_plan_mode with enabled:false", () => {
		const result = executeSlashCommand({ name: "plan", args: "off" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "set_plan_mode", enabled: false });
	});

	it("plan (on): sends set_plan_mode with enabled:true", () => {
		const result = executeSlashCommand({ name: "plan", args: "on" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "set_plan_mode", enabled: true });
	});

	it("plan (toggle): sends set_plan_mode with enabled:true", () => {
		const result = executeSlashCommand({ name: "plan", args: "toggle" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "set_plan_mode", enabled: true });
	});

	it("plan (empty args): sends set_plan_mode with enabled:true", () => {
		const result = executeSlashCommand({ name: "plan", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "set_plan_mode", enabled: true });
	});

	it("plan (with prompt text): sends set_plan_mode with enabled:true and prompt", () => {
		const result = executeSlashCommand({ name: "plan", args: "my plan prompt" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "set_plan_mode", enabled: true, prompt: "my plan prompt" });
	});

	// --- fast ---
	it("fast (empty args): sends toggle_fast_mode and returns true", () => {
		const result = executeSlashCommand({ name: "fast", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "toggle_fast_mode" });
	});

	it("fast (toggle): sends toggle_fast_mode and returns true", () => {
		const result = executeSlashCommand({ name: "fast", args: "toggle" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "toggle_fast_mode" });
	});

	it("fast (on): sends set_fast_mode with enabled:true", () => {
		const result = executeSlashCommand({ name: "fast", args: "on" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "set_fast_mode", enabled: true });
	});

	it("fast (off): sends set_fast_mode with enabled:false", () => {
		const result = executeSlashCommand({ name: "fast", args: "off" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "set_fast_mode", enabled: false });
	});

	it("fast (invalid arg): returns false", () => {
		const result = executeSlashCommand({ name: "fast", args: "ultra" }, { sendCommand });
		expect(result).toBe(false);
		expect(sendCommand).not.toHaveBeenCalled();
	});

	// --- copy ---
	it("copy (no assistant message): returns true without writing clipboard", () => {
		const result = executeSlashCommand({ name: "copy", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(clipboardWriteText).not.toHaveBeenCalled();
	});

	describe("copy with assistant message", () => {
		beforeEach(() => {
			vi.mocked(useSessionStore.getState).mockReturnValue({
				messages: [
					{
						role: "assistant",
						content: "Hello\n```typescript\nconsole.log('hi')\n```\n\n```bash\necho hello\n```",
					},
				],
				clearFileSearch: vi.fn(),
				fileSearch: null,
			} as unknown as ReturnType<typeof useSessionStore.getState>);
		});

		it("copy (last): writes full text to clipboard", () => {
			const result = executeSlashCommand({ name: "copy", args: "last" }, { sendCommand });
			expect(result).toBe(true);
			expect(clipboardWriteText).toHaveBeenCalledWith(
				"Hello\n```typescript\nconsole.log('hi')\n```\n\n```bash\necho hello\n```",
			);
		});

		it("copy (empty args defaults to last): writes full text", () => {
			const result = executeSlashCommand({ name: "copy", args: "" }, { sendCommand });
			expect(result).toBe(true);
			expect(clipboardWriteText).toHaveBeenCalled();
		});

		it("copy (code): writes first code block to clipboard", () => {
			const result = executeSlashCommand({ name: "copy", args: "code" }, { sendCommand });
			expect(result).toBe(true);
			expect(clipboardWriteText).toHaveBeenCalledWith("console.log('hi')");
		});

		it("copy (all): writes all code blocks joined to clipboard", () => {
			const result = executeSlashCommand({ name: "copy", args: "all" }, { sendCommand });
			expect(result).toBe(true);
			expect(clipboardWriteText).toHaveBeenCalledWith("console.log('hi')\n\necho hello");
		});

		it("copy (cmd): writes first bash block to clipboard", () => {
			const result = executeSlashCommand({ name: "copy", args: "cmd" }, { sendCommand });
			expect(result).toBe(true);
			expect(clipboardWriteText).toHaveBeenCalledWith("echo hello");
		});

		it("copy (invalid subcommand): returns false", () => {
			const result = executeSlashCommand({ name: "copy", args: "invalid" }, { sendCommand });
			expect(result).toBe(false);
			expect(clipboardWriteText).not.toHaveBeenCalled();
		});
	});

	it("copy (code): returns true without clipboard when no code blocks in message", () => {
		vi.mocked(useSessionStore.getState).mockReturnValue({
			messages: [{ role: "assistant", content: "Plain text, no code" }],
			clearFileSearch: vi.fn(),
			fileSearch: null,
		} as unknown as ReturnType<typeof useSessionStore.getState>);

		const result = executeSlashCommand({ name: "copy", args: "code" }, { sendCommand });
		expect(result).toBe(true);
		expect(clipboardWriteText).not.toHaveBeenCalled();
	});

	// --- dump ---
	it("dump: writes formatted messages to clipboard and returns true", () => {
		vi.mocked(useSessionStore.getState).mockReturnValue({
			messages: [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "World" },
			],
			clearFileSearch: vi.fn(),
			fileSearch: null,
		} as unknown as ReturnType<typeof useSessionStore.getState>);

		const result = executeSlashCommand({ name: "dump", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(clipboardWriteText).toHaveBeenCalledWith("## user\n\nHello\n\n---\n\n## assistant\n\nWorld");
	});

	// --- session ---
	it("session (no args): opens session stats and returns true", () => {
		const result = executeSlashCommand({ name: "session", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(openSessionStats).toHaveBeenCalled();
		expect(sendCommand).not.toHaveBeenCalled();
	});

	it("session pick: opens session picker and sends list_sessions", () => {
		const result = executeSlashCommand({ name: "session", args: "pick" }, { sendCommand });
		expect(result).toBe(true);
		expect(openSessionPicker).toHaveBeenCalled();
		expect(sendCommand).toHaveBeenCalledWith({ type: "list_sessions" });
	});

	it("session delete: sends delete_session with current sessionFile", () => {
		vi.mocked(useSessionStore.getState).mockReturnValue({
			messages: [],
			clearFileSearch: vi.fn(),
			fileSearch: null,
			sessionState: { sessionFile: "/sessions/active.jsonl" },
		} as unknown as ReturnType<typeof useSessionStore.getState>);
		const result = executeSlashCommand({ name: "session", args: "delete" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "delete_session", sessionPath: "/sessions/active.jsonl" });
	});

	it("session delete: returns false when no active session", () => {
		// sessionState is null / has no sessionFile
		const result = executeSlashCommand({ name: "session", args: "delete" }, { sendCommand });
		expect(result).toBe(false);
		expect(sendCommand).not.toHaveBeenCalled();
	});

	it("session (unknown subcommand): returns false", () => {
		const result = executeSlashCommand({ name: "session", args: "unknown" }, { sendCommand });
		expect(result).toBe(false);
	});

	// --- btw ---
	it("btw (no args): returns false", () => {
		const result = executeSlashCommand({ name: "btw", args: "" }, { sendCommand });
		expect(result).toBe(false);
		expect(sendCommand).not.toHaveBeenCalled();
	});

	it("btw (whitespace only): returns false", () => {
		const result = executeSlashCommand({ name: "btw", args: "   " }, { sendCommand });
		expect(result).toBe(false);
	});

	it("btw (with args): sends steer and returns true", () => {
		const result = executeSlashCommand({ name: "btw", args: "keep going" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "steer", message: "keep going" });
	});

	// --- settings ---
	it("settings: opens settings and returns true", () => {
		const result = executeSlashCommand({ name: "settings", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(openSettings).toHaveBeenCalled();
		expect(sendCommand).not.toHaveBeenCalled();
	});

	// --- hotkeys ---
	it("hotkeys: opens hotkeys and returns true", () => {
		const result = executeSlashCommand({ name: "hotkeys", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(openHotkeys).toHaveBeenCalled();
		expect(sendCommand).not.toHaveBeenCalled();
	});

	// --- unknown ---
	it("unknown command: returns false", () => {
		const result = executeSlashCommand({ name: "doesnotexist", args: "" }, { sendCommand });
		expect(result).toBe(false);
		expect(sendCommand).not.toHaveBeenCalled();
	});

	// --- case-insensitive dispatch ---
	it("command names are dispatched case-insensitively", () => {
		const result = executeSlashCommand({ name: "NEW", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "new_session" });
	});

	// --- remote-exit ---
	it("remote-exit: sends stop_remote_server and returns true", () => {
		const result = executeSlashCommand({ name: "remote-exit", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "stop_remote_server" });
	});
});

describe("remote-exit command registration", () => {
	it("is in WEB_SLASH_COMMANDS", () => {
		const names = WEB_SLASH_COMMANDS.map(c => c.name);
		expect(names).toContain("remote-exit");
	});

	it("isKnownSlashCommand recognises remote-exit", () => {
		expect(isKnownSlashCommand("remote-exit")).toBe(true);
	});

	it("executeSlashCommand sends stop_remote_server and returns true", () => {
		const sendCommand = vi.fn();
		const result = executeSlashCommand({ name: "remote-exit", args: "" }, { sendCommand });
		expect(result).toBe(true);
		expect(sendCommand).toHaveBeenCalledWith({ type: "stop_remote_server" });
	});
});
