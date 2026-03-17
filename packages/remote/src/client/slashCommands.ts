import { t } from "i18next";
import { useSessionStore } from "./stores/sessionStore";
import { useUIStore } from "./stores/uiStore";
import type { Message, RpcCommand, TextContentPart, ThinkingLevel } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlashMenuItem {
	name: string;
	description?: string;
}

export interface WebSlashCommandDef extends SlashMenuItem {
	description: string;
	/** Ghost-text hint shown below the input when this command is active */
	inlineHint?: string;
	/** Sub-items shown in the dropdown after the command name + space */
	subcommands?: SlashMenuItem[];
	/** Whether this command accepts arbitrary text arguments */
	allowArgs?: boolean;
}

export interface ParsedSlashCommand {
	name: string;
	args: string;
}

// ---------------------------------------------------------------------------
// Fuzzy matching — same algorithm as tui/src/autocomplete.ts
// ---------------------------------------------------------------------------

function fuzzyMatch(query: string, target: string): boolean {
	if (query.length === 0) return true;
	if (query.length > target.length) return false;
	let qi = 0;
	for (let ti = 0; ti < target.length && qi < query.length; ti++) {
		if (query[qi] === target[ti]) qi++;
	}
	return qi === query.length;
}

function fuzzyScore(query: string, target: string): number {
	if (query.length === 0) return 1;
	if (target === query) return 100;
	if (target.startsWith(query)) return 80;
	if (target.includes(query)) return 60;
	let qi = 0;
	let gaps = 0;
	let lastMatchIdx = -1;
	for (let ti = 0; ti < target.length && qi < query.length; ti++) {
		if (query[qi] === target[ti]) {
			if (lastMatchIdx >= 0 && ti - lastMatchIdx > 1) gaps++;
			lastMatchIdx = ti;
			qi++;
		}
	}
	if (qi !== query.length) return 0;
	return Math.max(1, 40 - gaps * 5);
}

// ---------------------------------------------------------------------------
// Command registry
// ---------------------------------------------------------------------------

// Subset of the TUI builtin registry that maps cleanly onto RPC commands or
// client-side actions available in the web UI.
export const WEB_SLASH_COMMANDS: ReadonlyArray<WebSlashCommandDef> = [
	{ name: "new", description: t("slashCommands.descriptions.new") },
	{
		name: "compact",
		description: t("slashCommands.descriptions.compact"),
		inlineHint: t("slashCommands.descriptions.compactHint"),
		allowArgs: true,
	},
	{ name: "model", description: t("slashCommands.descriptions.model") },
	{
		name: "thinking",
		description: t("slashCommands.descriptions.thinking"),
		allowArgs: true,
		subcommands: [
			{ name: "off", description: t("slashCommands.subcommands.thinking.off") },
			{ name: "minimal", description: t("slashCommands.subcommands.thinking.minimal") },
			{ name: "low", description: t("slashCommands.subcommands.thinking.low") },
			{ name: "medium", description: t("slashCommands.subcommands.thinking.medium") },
			{ name: "high", description: t("slashCommands.subcommands.thinking.high") },
			{ name: "xhigh", description: t("slashCommands.subcommands.thinking.xhigh") },
		],
	},
	{
		name: "plan",
		description: t("slashCommands.descriptions.plan"),
		inlineHint: t("slashCommands.descriptions.planHint"),
		allowArgs: true,
		subcommands: [
			{ name: "on", description: t("slashCommands.subcommands.plan.on") },
			{ name: "off", description: t("slashCommands.subcommands.plan.off") },
			{ name: "toggle", description: t("slashCommands.subcommands.plan.toggle") },
		],
	},
	{
		name: "fast",
		description: t("slashCommands.descriptions.fast"),
		allowArgs: true,
		subcommands: [
			{ name: "on", description: t("slashCommands.subcommands.fast.on") },
			{ name: "off", description: t("slashCommands.subcommands.fast.off") },
			{ name: "toggle", description: t("slashCommands.subcommands.fast.toggle") },
		],
	},
	{
		name: "copy",
		description: t("slashCommands.descriptions.copy"),
		allowArgs: true,
		subcommands: [
			{ name: "last", description: t("slashCommands.subcommands.copy.last") },
			{ name: "code", description: t("slashCommands.subcommands.copy.code") },
			{ name: "all", description: t("slashCommands.subcommands.copy.all") },
			{ name: "cmd", description: t("slashCommands.subcommands.copy.cmd") },
		],
	},
	{ name: "dump", description: t("slashCommands.descriptions.dump") },
	{ name: "session", description: t("slashCommands.descriptions.session") },
	{
		name: "btw",
		description: t("slashCommands.descriptions.btw"),
		inlineHint: t("slashCommands.descriptions.btwHint"),
		allowArgs: true,
	},
	{ name: "settings", description: t("slashCommands.descriptions.settings") },
	{ name: "hotkeys", description: t("slashCommands.descriptions.hotkeys") },
	{ name: "remote-exit", description: t("slashCommands.descriptions.remote-exit") },
];

const COMMAND_LOOKUP = new Map<string, WebSlashCommandDef>(WEB_SLASH_COMMANDS.map(cmd => [cmd.name, cmd]));

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseSlashCommand(text: string): ParsedSlashCommand | null {
	if (!text.startsWith("/")) return null;
	const body = text.slice(1).trim();
	if (!body) return null;
	const spaceIdx = body.indexOf(" ");
	if (spaceIdx === -1) return { name: body, args: "" };
	return { name: body.slice(0, spaceIdx), args: body.slice(spaceIdx + 1).trim() };
}

// ---------------------------------------------------------------------------
// Matching — used by InputBar to compute dropdown items
// ---------------------------------------------------------------------------

/**
 * Returns command definitions matching the current slash-command prefix.
 * Only active before the first space (command name phase).
 */
export function matchSlashCommands(input: string): WebSlashCommandDef[] {
	if (!input.startsWith("/")) return [];
	const body = input.slice(1);
	if (body.includes(" ")) return []; // past command name
	const lowerBody = body.toLowerCase();
	if (!lowerBody) return [...WEB_SLASH_COMMANDS];

	return WEB_SLASH_COMMANDS.filter(
		cmd => fuzzyMatch(lowerBody, cmd.name.toLowerCase()) || fuzzyMatch(lowerBody, cmd.description.toLowerCase()),
	).sort((a, b) => {
		const sa = Math.max(
			fuzzyScore(lowerBody, a.name.toLowerCase()),
			fuzzyScore(lowerBody, a.description.toLowerCase()) * 0.5,
		);
		const sb = Math.max(
			fuzzyScore(lowerBody, b.name.toLowerCase()),
			fuzzyScore(lowerBody, b.description.toLowerCase()) * 0.5,
		);
		return sb - sa;
	});
}

/**
 * Returns subcommand matches when the user has typed a command name + space.
 */
export function matchSubcommands(input: string): SlashMenuItem[] {
	if (!input.startsWith("/")) return [];
	const body = input.slice(1);
	const spaceIdx = body.indexOf(" ");
	if (spaceIdx === -1) return [];

	const commandName = body.slice(0, spaceIdx).toLowerCase();
	const cmd = COMMAND_LOOKUP.get(commandName);
	if (!cmd?.subcommands?.length) return [];

	const argText = body.slice(spaceIdx + 1).toLowerCase();
	if (!argText) return [...cmd.subcommands];

	return cmd.subcommands
		.filter(sub => fuzzyMatch(argText, sub.name.toLowerCase()))
		.sort((a, b) => fuzzyScore(argText, b.name.toLowerCase()) - fuzzyScore(argText, a.name.toLowerCase()));
}

/**
 * Returns the inline hint text for the currently-typed command, or null when
 * none applies. Used to display ghost text below the input.
 */
export function getSlashCommandHint(input: string): string | null {
	if (!input.startsWith("/")) return null;
	const body = input.slice(1);
	const spaceIdx = body.indexOf(" ");

	if (spaceIdx === -1) {
		// Still typing the command name — only show hint on exact match
		const cmd = COMMAND_LOOKUP.get(body.toLowerCase());
		return cmd?.inlineHint ?? null;
	}

	const commandName = body.slice(0, spaceIdx).toLowerCase();
	const cmd = COMMAND_LOOKUP.get(commandName);
	if (!cmd) return null;
	// If command has subcommands they are shown in the dropdown, no inline hint
	if (cmd.subcommands?.length) return null;
	return cmd.inlineHint ?? null;
}

/**
 * Whether `name` is a known web slash command (used to decide if unexecuted
 * commands should fall through to the AI or stay silent).
 */
export function isKnownSlashCommand(name: string): boolean {
	return COMMAND_LOOKUP.has(name.toLowerCase());
}

// ---------------------------------------------------------------------------
// @-file-tag prefix extraction — used by InputBar
// ---------------------------------------------------------------------------

const AT_DELIMITERS = new Set([" ", "\t", "\n", '"', "'", "="]);

/**
 * Extract an @-file-tag prefix from the text before `cursorPos`.
 * Returns the query (everything after the `@`) and the start index of the `@` in `text`.
 * Returns null if no valid @-prefix is at the cursor.
 */
export function extractAtPrefix(text: string, cursorPos: number): { query: string; tokenStart: number } | null {
	const before = text.slice(0, cursorPos);
	for (let i = before.length - 1; i >= 0; i--) {
		const ch = before[i]!;
		if (ch === "@") {
			if (i === 0 || AT_DELIMITERS.has(before[i - 1]!)) {
				return { query: before.slice(i + 1), tokenStart: i };
			}
			return null;
		}
		if (AT_DELIMITERS.has(ch)) return null;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface SlashCommandExtras {
	sendCommand: (cmd: RpcCommand) => void;
}

function getMessageText(msg: Message): string {
	if (typeof msg.content === "string") return msg.content;
	return msg.content
		.filter((p): p is TextContentPart => p.type === "text")
		.map(p => p.text)
		.join("\n");
}

function extractCodeBlocks(text: string): string[] {
	const blocks: string[] = [];
	const regex = /```(?:[\w+-]*)\n([\s\S]*?)```/g;
	let match = regex.exec(text);
	while (match !== null) {
		if (match[1]) blocks.push(match[1].trim());
		match = regex.exec(text);
	}
	return blocks;
}

function extractBashBlocks(text: string): string[] {
	const blocks: string[] = [];
	const regex = /```(?:bash|sh|shell|zsh)\n([\s\S]*?)```/g;
	let match = regex.exec(text);
	while (match !== null) {
		if (match[1]) blocks.push(match[1].trim());
		match = regex.exec(text);
	}
	return blocks;
}

/**
 * Execute a parsed slash command.
 *
 * Returns `true` when the command was handled (caller should clear the input).
 * Returns `false` when the command is recognised but cannot execute yet
 * (e.g. required args are missing or invalid) — caller should leave the input
 * unchanged so the user can complete it.
 *
 * Unrecognised names are NOT passed here; the caller handles fall-through to
 * the AI separately via `isKnownSlashCommand`.
 */
export function executeSlashCommand(parsed: ParsedSlashCommand, extras: SlashCommandExtras): boolean {
	const { name, args } = parsed;
	const { sendCommand } = extras;
	const { openSettings, openHotkeys, openSessionStats, openModelSelect } = useUIStore.getState();
	switch (name.toLowerCase()) {
		case "new":
			sendCommand({ type: "new_session" });
			return true;
		case "compact":
			sendCommand({ type: "compact", customInstructions: args || undefined });
			return true;
		case "model":
		case "models":
			openModelSelect();
			return true;
		case "thinking": {
			const level = args.trim();
			const valid: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];
			if (!valid.includes(level as ThinkingLevel)) return false;
			sendCommand({ type: "set_thinking_level", level: level as ThinkingLevel });
			return true;
		}
		case "plan": {
			const arg = args.trim().toLowerCase();
			if (arg === "off") {
				sendCommand({ type: "set_plan_mode", enabled: false });
				return true;
			}
			if (arg === "on" || arg === "toggle" || !arg) {
				sendCommand({ type: "set_plan_mode", enabled: true });
				return true;
			}
			// has prompt text — enable plan mode with the supplied prompt
			sendCommand({ type: "set_plan_mode", enabled: true, prompt: args.trim() });
			return true;
		}
		case "fast": {
			const arg = args.trim().toLowerCase();
			if (!arg || arg === "toggle") {
				sendCommand({ type: "toggle_fast_mode" });
				return true;
			}
			if (arg === "on") {
				sendCommand({ type: "set_fast_mode", enabled: true });
				return true;
			}
			if (arg === "off") {
				sendCommand({ type: "set_fast_mode", enabled: false });
				return true;
			}
			return false;
		}
		case "copy": {
			const sub = args.trim().toLowerCase() || "last";
			const messages = useSessionStore.getState().messages;
			const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
			if (!lastAssistant) return true;
			const text = getMessageText(lastAssistant);
			let toCopy: string | null = null;
			switch (sub) {
				case "last":
					toCopy = text;
					break;
				case "code":
					toCopy = extractCodeBlocks(text)[0] ?? null;
					break;
				case "all":
					toCopy = extractCodeBlocks(text).join("\n\n") || null;
					break;
				case "cmd":
					toCopy = extractBashBlocks(text)[0] ?? null;
					break;
				default:
					return false;
			}
			if (toCopy) navigator.clipboard.writeText(toCopy).catch(() => {});
			return true;
		}
		case "dump": {
			const messages = useSessionStore.getState().messages;
			const text = messages.map(m => `## ${m.role}\n\n${getMessageText(m)}`).join("\n\n---\n\n");
			navigator.clipboard.writeText(text).catch(() => {});
			return true;
		}
		case "session":
			openSessionStats();
			return true;
		case "btw":
			if (!args.trim()) return false;
			sendCommand({ type: "steer", message: args.trim() });
			return true;
		case "settings":
			openSettings();
			return true;
		case "hotkeys":
			openHotkeys();
			return true;
		case "remote-exit":
			sendCommand({ type: "stop_remote_server" });
			return true;
		default:
			return false;
	}
}
