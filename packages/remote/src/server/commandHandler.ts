import * as os from "node:os";
import * as path from "node:path";
import type { RpcCommand, RpcResponse, RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { FileSessionStorage } from "@oh-my-pi/pi-coding-agent/session/session-storage";
import { fuzzyFind } from "@oh-my-pi/pi-natives";
import { getProjectDir, logger } from "@oh-my-pi/pi-utils";

function success<T extends RpcCommand["type"]>(id: string | undefined, command: T, data?: object | null): RpcResponse {
	return { id, type: "response", command, success: true, data } as RpcResponse;
}

function error(id: string | undefined, command: string, message: string): RpcResponse {
	return { id, type: "response", command, success: false, error: message };
}

export function getSessionState(session: AgentSession): RpcSessionState {
	return {
		model: session.model,
		thinkingLevel: session.thinkingLevel,
		isStreaming: session.isStreaming,
		isCompacting: session.isCompacting,
		steeringMode: session.steeringMode,
		followUpMode: session.followUpMode,
		interruptMode: session.interruptMode,
		sessionFile: session.sessionFile,
		sessionId: session.sessionId,
		sessionName: session.sessionName,
		autoCompactionEnabled: session.autoCompactionEnabled,
		messageCount: session.messages.length,
		queuedMessageCount: session.queuedMessageCount,
		planModeEnabled: session.getPlanModeState()?.enabled ?? false,
		fastModeEnabled: session.isFastModeEnabled(),
	};
}

export async function handleCommand(session: AgentSession, command: RpcCommand): Promise<RpcResponse> {
	const id = command.id;

	switch (command.type) {
		// =================================================================
		// Prompting
		// =================================================================

		case "prompt": {
			session
				.prompt(command.message, {
					images: command.images,
					streamingBehavior: command.streamingBehavior,
				})
				.catch(e => logger.error("remote prompt error", { detail: e.message }));
			return success(id, "prompt");
		}

		case "steer": {
			await session.steer(command.message, command.images);
			return success(id, "steer");
		}

		case "follow_up": {
			await session.followUp(command.message, command.images);
			return success(id, "follow_up");
		}

		case "abort": {
			await session.abort();
			return success(id, "abort");
		}

		case "abort_and_prompt": {
			await session.abort();
			session
				.prompt(command.message, { images: command.images })
				.catch(e => logger.error("remote abort_and_prompt error", { detail: e.message }));
			return success(id, "abort_and_prompt");
		}

		case "new_session": {
			const options = command.parentSession ? { parentSession: command.parentSession } : undefined;
			const cancelled = !(await session.newSession(options));
			return success(id, "new_session", { cancelled });
		}

		// =================================================================
		// State
		// =================================================================

		case "get_state": {
			return success(id, "get_state", getSessionState(session));
		}

		// =================================================================
		// Model
		// =================================================================

		case "set_model": {
			const models = session.getAvailableModels();
			const model = models.find(m => m.provider === command.provider && m.id === command.modelId);
			if (!model) {
				return error(id, "set_model", `Model not found: ${command.provider}/${command.modelId}`);
			}
			await session.setModel(model);
			return success(id, "set_model", model);
		}

		case "cycle_model": {
			const result = await session.cycleModel();
			if (!result) {
				return success(id, "cycle_model", null);
			}
			return success(id, "cycle_model", result);
		}

		case "get_available_models": {
			const models = session.getAvailableModels();
			return success(id, "get_available_models", { models });
		}

		// =================================================================
		// Thinking
		// =================================================================

		case "set_thinking_level": {
			session.setThinkingLevel(command.level);
			return success(id, "set_thinking_level");
		}

		case "cycle_thinking_level": {
			const level = session.cycleThinkingLevel();
			if (!level) {
				return success(id, "cycle_thinking_level", null);
			}
			return success(id, "cycle_thinking_level", { level });
		}

		// =================================================================
		// Queue Modes
		// =================================================================

		case "set_steering_mode": {
			session.setSteeringMode(command.mode);
			return success(id, "set_steering_mode");
		}

		case "set_follow_up_mode": {
			session.setFollowUpMode(command.mode);
			return success(id, "set_follow_up_mode");
		}

		case "set_interrupt_mode": {
			session.setInterruptMode(command.mode);
			return success(id, "set_interrupt_mode");
		}

		// =================================================================
		// Compaction
		// =================================================================

		case "compact": {
			const result = await session.compact(command.customInstructions);
			return success(id, "compact", result);
		}

		case "set_auto_compaction": {
			session.setAutoCompactionEnabled(command.enabled);
			return success(id, "set_auto_compaction");
		}

		// =================================================================
		// Retry
		// =================================================================

		case "set_auto_retry": {
			session.setAutoRetryEnabled(command.enabled);
			return success(id, "set_auto_retry");
		}

		case "abort_retry": {
			session.abortRetry();
			return success(id, "abort_retry");
		}

		// =================================================================
		// Session
		// =================================================================

		case "get_session_stats": {
			const stats = session.getSessionStats();
			return success(id, "get_session_stats", stats);
		}

		case "set_session_name": {
			const name = command.name.trim();
			if (!name) {
				return error(id, "set_session_name", "Session name cannot be empty");
			}
			session.setSessionName(name);
			return success(id, "set_session_name");
		}

		case "list_sessions": {
			const cwd = session.sessionManager.getCwd();
			const sessionDir = session.sessionManager.getSessionDir();
			try {
				const sessions = await SessionManager.list(cwd, sessionDir);
				const currentFile = session.sessionFile;
				const entries = sessions.map(s => ({
					path: s.path,
					id: s.id,
					cwd: s.cwd,
					title: s.title,
					created: s.created.toISOString(),
					modified: s.modified.toISOString(),
					messageCount: s.messageCount,
					firstMessage: s.firstMessage,
					isCurrent: s.path === currentFile,
				}));
				return success(id, "list_sessions", { sessions: entries });
			} catch (e) {
				return error(id, "list_sessions", e instanceof Error ? e.message : String(e));
			}
		}

		case "switch_session": {
			try {
				const cancelled = !(await session.switchSession(command.sessionPath));
				return success(id, "switch_session", { cancelled });
			} catch (e) {
				return error(id, "switch_session", e instanceof Error ? e.message : String(e));
			}
		}

		case "delete_session": {
			const targetPath = command.sessionPath;
			const currentFile = session.sessionFile;
			// If deleting the active session, detach first so we don't leave a broken state.
			if (targetPath === currentFile) {
				const switched = await session.newSession();
				if (!switched) {
					return error(id, "delete_session", "Cannot delete active session: new session was cancelled");
				}
			}
			try {
				const storage = new FileSessionStorage();
				await storage.deleteSessionWithArtifacts(targetPath);
				return success(id, "delete_session");
			} catch (e) {
				return error(id, "delete_session", e instanceof Error ? e.message : String(e));
			}
		}

		// =================================================================
		// Messages
		// =================================================================

		case "get_messages": {
			return success(id, "get_messages", { messages: session.messages });
		}

		case "search_files": {
			const basePath = getProjectDir();
			try {
				const result = await fuzzyFind({
					query: command.query,
					path: basePath,
					maxResults: 20,
					hidden: false,
					gitignore: true,
					cache: true,
				});
				return success(id, "search_files", {
					query: command.query,
					files: result.matches.map(m => ({ path: m.path, isDirectory: m.isDirectory, score: m.score })),
				});
			} catch (e) {
				return error(id, "search_files", e instanceof Error ? e.message : String(e));
			}
		}

		case "toggle_fast_mode": {
			const enabled = session.toggleFastMode();
			return success(id, "toggle_fast_mode", { enabled });
		}

		case "set_fast_mode": {
			session.setFastMode(command.enabled);
			return success(id, "set_fast_mode", { enabled: command.enabled });
		}

		case "set_plan_mode": {
			if (!command.enabled) {
				session.setPlanModeState(undefined);
				return success(id, "set_plan_mode", { enabled: false });
			}
			const planFilePath = path.join(os.tmpdir(), `plan-${session.sessionId}.md`);
			session.setPlanModeState({ enabled: true, planFilePath });
			if (command.prompt) {
				session
					.prompt(command.prompt)
					.catch(e => logger.error("plan prompt error", { detail: e instanceof Error ? e.message : String(e) }));
			}
			return success(id, "set_plan_mode", { enabled: true });
		}

		case "get_last_assistant_text": {
			const lastMsg = session.getLastAssistantMessage();
			if (!lastMsg) return success(id, "get_last_assistant_text", { text: null });
			const text = lastMsg.content
				.filter(c => c.type === "text")
				.map(c => (c as { type: "text"; text: string }).text)
				.join("\n");
			return success(id, "get_last_assistant_text", { text: text || null });
		}

		default: {
			const unknownCommand = command as { type: string };
			return error(undefined, unknownCommand.type, `Unknown command: ${unknownCommand.type}`);
		}
	}
}
