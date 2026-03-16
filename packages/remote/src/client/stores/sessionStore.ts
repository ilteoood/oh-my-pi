import { create } from "zustand";
import type {
	ContentPart,
	FuzzyFindMatch,
	Message,
	MessageRole,
	ModelInfo,
	SessionState,
	SessionStats,
	ToolExecution,
} from "../types";

interface RetryInfo {
	attempt: number;
	maxAttempts: number;
	delayMs: number;
	errorMessage: string;
}

interface SessionStore {
	// --- State ---
	connected: boolean;
	sessionState: SessionState | null;
	messages: Message[];
	streamingContent: ContentPart[];
	streamingRole: MessageRole | null;
	toolExecutions: Record<string, ToolExecution>;
	isStreaming: boolean;
	isCompacting: boolean;
	isRetrying: boolean;
	retryInfo: RetryInfo | null;
	error: string | null;
	availableModels: ModelInfo[];
	sessionStats: SessionStats | null;
	fileSearch: { query: string; matches: FuzzyFindMatch[] } | null;

	// --- Actions ---
	setConnected: (connected: boolean) => void;
	setSessionState: (state: SessionState) => void;
	setMessages: (messages: Message[]) => void;
	messageStart: (role: MessageRole) => void;
	messageUpdate: (content: ContentPart[]) => void;
	messageEnd: (message: Message) => void;
	toolExecutionStart: (id: string, name: string, args: Record<string, unknown>, intent?: string) => void;
	toolExecutionUpdate: (id: string, updates: { args?: Record<string, unknown>; partialResult?: unknown }) => void;
	toolExecutionEnd: (id: string, result: unknown, isError?: boolean) => void;
	turnEnd: () => void;
	agentEnd: (messages?: Message[]) => void;
	compactionStart: () => void;
	compactionEnd: () => void;
	retryStart: (info: RetryInfo) => void;
	retryEnd: () => void;
	setError: (error: string | null) => void;
	setAvailableModels: (models: ModelInfo[]) => void;
	setSessionStats: (stats: SessionStats | null) => void;
	setFileSearch: (query: string, matches: FuzzyFindMatch[]) => void;
	clearFileSearch: () => void;
	clearMessages: () => void;
}

export const useSessionStore = create<SessionStore>(set => ({
	// --- Initial state ---
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

	// --- Actions ---

	setConnected: connected => set({ connected }),

	setSessionState: sessionState => set({ sessionState }),

	setMessages: messages => set({ messages }),

	messageStart: role =>
		set(prev => ({
			streamingRole: role,
			streamingContent: [],
			isStreaming: true,
			// Clear tool executions from previous turn when assistant starts a new message
			toolExecutions: role === "assistant" ? {} : prev.toolExecutions,
		})),

	messageUpdate: content => set({ streamingContent: content }),

	messageEnd: message =>
		set(prev => ({
			messages: [...prev.messages, message],
			streamingContent: [],
			streamingRole: null,
			isStreaming: false,
		})),

	toolExecutionStart: (id, name, args, intent) =>
		set(prev => ({
			toolExecutions: {
				...prev.toolExecutions,
				[id]: { id, name, args, intent, status: "running" as const },
			},
		})),

	toolExecutionUpdate: (id, updates) =>
		set(prev => {
			const existing = prev.toolExecutions[id];
			if (!existing) return prev;
			return {
				toolExecutions: {
					...prev.toolExecutions,
					[id]: {
						...existing,
						...(updates.args !== undefined && { args: updates.args }),
						...(updates.partialResult !== undefined && {
							partialResult: updates.partialResult,
						}),
					},
				},
			};
		}),

	toolExecutionEnd: (id, result, isError) =>
		set(prev => {
			const existing = prev.toolExecutions[id];
			if (!existing) return prev;
			return {
				toolExecutions: {
					...prev.toolExecutions,
					[id]: {
						...existing,
						result,
						isError: isError ?? false,
						status: isError ? "error" : "complete",
					},
				},
			};
		}),

	turnEnd: () => set({ isStreaming: false }),

	agentEnd: messages =>
		set(_prev => ({
			isStreaming: false,
			streamingContent: [],
			streamingRole: null,
			...(messages ? { messages } : {}),
		})),

	compactionStart: () => set({ isCompacting: true }),

	compactionEnd: () => set({ isCompacting: false }),

	retryStart: retryInfo => set({ isRetrying: true, retryInfo }),

	retryEnd: () => set({ isRetrying: false, retryInfo: null }),

	setError: error => set({ error }),

	setAvailableModels: availableModels => set({ availableModels }),
	setSessionStats: stats => set({ sessionStats: stats }),
	setFileSearch: (query, matches) => set({ fileSearch: { query, matches } }),
	clearFileSearch: () => set({ fileSearch: null }),

	clearMessages: () =>
		set({
			messages: [],
			streamingContent: [],
			streamingRole: null,
			toolExecutions: {},
			isStreaming: false,
		}),
}));
