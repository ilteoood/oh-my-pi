// Browser-side type definitions for the WebSocket protocol.
// These duplicate server types to avoid pulling Node.js dependencies into the browser bundle.

// --- Session state ---

export interface ModelInfo {
	provider: string;
	id: string;
	name: string;
}

export type ThinkingLevel = "inherit" | "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface SessionState {
	model: ModelInfo | undefined;
	thinkingLevel: ThinkingLevel | undefined;
	isStreaming: boolean;
	isCompacting: boolean;
	steeringMode: "all" | "one-at-a-time";
	followUpMode: "all" | "one-at-a-time";
	interruptMode: "immediate" | "wait";
	sessionFile: string | undefined;
	sessionId: string;
	sessionName: string | undefined;
	autoCompactionEnabled: boolean;
	messageCount: number;
	queuedMessageCount: number;
}

// --- Message types ---

export type MessageRole = "user" | "assistant" | "developer" | "toolResult";

export interface TextContentPart {
	type: "text";
	text: string;
}

export interface ThinkingContentPart {
	type: "thinking";
	thinking: string;
}

export interface ToolCallContentPart {
	type: "toolCall";
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export interface ToolResultContentPart {
	type: "toolResult";
	toolCallId: string;
	toolName: string;
	content: (TextContentPart | ImageContentPart)[];
	isError: boolean;
}

export interface ImageContentPart {
	type: "image";
	data: string;
	mimeType: string;
}

export interface RedactedThinkingContentPart {
	type: "redactedThinking";
	data: string;
}

export type ContentPart =
	| TextContentPart
	| ThinkingContentPart
	| ToolCallContentPart
	| ToolResultContentPart
	| ImageContentPart
	| RedactedThinkingContentPart;

export interface Message {
	role: MessageRole;
	content: string | ContentPart[];
}

// --- Tool execution tracking ---

export interface ToolExecution {
	id: string;
	name: string;
	args: Record<string, unknown>;
	result?: unknown;
	isError?: boolean;
	status: "running" | "complete" | "error";
	intent?: string;
	partialResult?: unknown;
}

// --- WebSocket events (server → client) ---

// Server envelope messages (sent on initial WS connect, NOT AgentSessionEvents)
export type ServerEnvelope =
	| { type: "state"; data: SessionState }
	| { type: "messages"; data: { messages: Message[] } };

// Response to RPC commands
export interface RpcResponse {
	type: "response";
	id?: string;
	command: string;
	success: boolean;
	data?: unknown;
	error?: string;
}

// Any message the server can send over the WebSocket
export type ServerMessage = ServerEnvelope | AgentSessionEvent | RpcResponse;

export type AgentSessionEvent =
	// Agent lifecycle
	| { type: "agent_start" }
	| { type: "agent_end"; messages: Message[] }
	// Turn lifecycle
	| { type: "turn_start" }
	| { type: "turn_end"; message: Message }
	// Message lifecycle
	| { type: "message_start"; message: Message }
	| { type: "message_update"; message: Message }
	| { type: "message_end"; message: Message }
	// Tool execution
	| {
			type: "tool_execution_start";
			toolCallId: string;
			toolName: string;
			args: Record<string, unknown>;
			intent?: string;
	  }
	| {
			type: "tool_execution_update";
			toolCallId: string;
			toolName: string;
			args: Record<string, unknown>;
			partialResult?: unknown;
	  }
	| {
			type: "tool_execution_end";
			toolCallId: string;
			toolName: string;
			result: unknown;
			isError?: boolean;
	  }
	// Compaction
	| { type: "auto_compaction_start" }
	| { type: "auto_compaction_end" }
	// Retry
	| { type: "auto_retry_start"; attempt: number; maxAttempts: number; delayMs: number; errorMessage: string }
	| { type: "auto_retry_end" }
	// Other
	| { type: "ttsr_triggered" }
	| { type: "todo_reminder" }
	| { type: "todo_auto_clear" };

// --- Commands (client → server) ---

export type RpcCommand =
	| { id?: string; type: "prompt"; message: string; images?: unknown[]; streamingBehavior?: "steer" | "followUp" }
	| { id?: string; type: "steer"; message: string; images?: unknown[] }
	| { id?: string; type: "follow_up"; message: string; images?: unknown[] }
	| { id?: string; type: "abort" }
	| { id?: string; type: "abort_and_prompt"; message: string; images?: unknown[] }
	| { id?: string; type: "new_session"; parentSession?: string }
	| { id?: string; type: "get_state" }
	| { id?: string; type: "set_model"; provider: string; modelId: string }
	| { id?: string; type: "cycle_model" }
	| { id?: string; type: "get_available_models" }
	| { id?: string; type: "set_thinking_level"; level: ThinkingLevel }
	| { id?: string; type: "cycle_thinking_level" }
	| { id?: string; type: "set_steering_mode"; mode: "all" | "one-at-a-time" }
	| { id?: string; type: "set_follow_up_mode"; mode: "all" | "one-at-a-time" }
	| { id?: string; type: "set_interrupt_mode"; mode: "immediate" | "wait" }
	| { id?: string; type: "compact"; customInstructions?: string }
	| { id?: string; type: "set_auto_compaction"; enabled: boolean }
	| { id?: string; type: "set_auto_retry"; enabled: boolean }
	| { id?: string; type: "abort_retry" }
	| { id?: string; type: "set_session_name"; name: string }
	| { id?: string; type: "get_messages" }
	| { id?: string; type: "get_session_stats" };
