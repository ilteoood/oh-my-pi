import { describe, expect, it, vi } from "bun:test";
import { DEFAULT_PORT } from "@oh-my-pi/pi-coding-agent/config/resolve-config-value";
import type { InteractiveModeContext } from "@oh-my-pi/pi-coding-agent/modes/types";
import { executeBuiltinSlashCommand } from "@oh-my-pi/pi-coding-agent/slash-commands/builtin-registry";

describe("/remote slash command", () => {
	it("starts remote server with default port when no arg given", async () => {
		const handleRemoteCommand = vi.fn(async (_port: number) => {});
		const setText = vi.fn();
		const runtime = {
			ctx: {
				editor: { setText } as unknown as InteractiveModeContext["editor"],
				handleRemoteCommand,
			} as unknown as InteractiveModeContext,
			handleBackgroundCommand: () => {},
		};
		const handled = await executeBuiltinSlashCommand("/remote", runtime);
		expect(handled).toBe(true);
		expect(setText).toHaveBeenCalledWith("");
		expect(handleRemoteCommand).toHaveBeenCalledWith(DEFAULT_PORT);
	});

	it("passes custom port when provided as argument", async () => {
		const handleRemoteCommand = vi.fn(async (_port: number) => {});
		const setText = vi.fn();
		const runtime = {
			ctx: {
				editor: { setText } as unknown as InteractiveModeContext["editor"],
				handleRemoteCommand,
			} as unknown as InteractiveModeContext,
			handleBackgroundCommand: () => {},
		};
		const handled = await executeBuiltinSlashCommand("/remote 4000", runtime);
		expect(handled).toBe(true);
		expect(setText).toHaveBeenCalledWith("");
		expect(handleRemoteCommand).toHaveBeenCalledWith(4000);
	});
});

describe("/remote-exit slash command", () => {
	it("stops the remote server", async () => {
		const handleRemoteExitCommand = vi.fn();
		const setText = vi.fn();
		const runtime = {
			ctx: {
				editor: { setText } as unknown as InteractiveModeContext["editor"],
				handleRemoteExitCommand,
			} as unknown as InteractiveModeContext,
			handleBackgroundCommand: () => {},
		};
		const handled = await executeBuiltinSlashCommand("/remote-exit", runtime);
		expect(handled).toBe(true);
		expect(setText).toHaveBeenCalledWith("");
		expect(handleRemoteExitCommand).toHaveBeenCalled();
	});
});
