import type { RpcCommand, RpcResponse, RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { logger } from "@oh-my-pi/pi-utils";

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

		// =================================================================
		// Messages
		// =================================================================

		case "get_messages": {
			return success(id, "get_messages", { messages: session.messages });
		}

		default: {
			const unknownCommand = command as { type: string };
			return error(undefined, unknownCommand.type, `Unknown command: ${unknownCommand.type}`);
		}
	}
}
