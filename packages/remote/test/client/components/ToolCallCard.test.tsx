import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolCallCard } from "../../../src/client/components/ToolCallCard";
import { useSessionStore } from "../../../src/client/stores/sessionStore";


vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const resetStore = () =>
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

beforeEach(resetStore);

const setExecution = (overrides: Partial<Parameters<typeof useSessionStore.setState>[0]["toolExecutions"][string]> & { id: string }) => {
	const { id, ...rest } = overrides;
	useSessionStore.setState({
		toolExecutions: {
			[id]: {
				id,
				name: rest.name ?? "bash",
				args: rest.args ?? {},
				status: rest.status ?? "running",
				...rest,
			},
		},
	});
};

describe("ToolCallCard status rendering", () => {
	it("shows Spinner when status is running", () => {
		setExecution({ id: "t1", name: "bash", args: { command: "ls" }, status: "running" });
		render(<ToolCallCard id="t1" name="bash" args={{ command: "ls" }} />);
		expect(document.querySelector('[data-slot="spinner"]')).toBeTruthy();
	});

	it("shows done chip when status is complete and not error", () => {
		setExecution({ id: "t1", name: "bash", args: {}, status: "complete", isError: false });
		render(<ToolCallCard id="t1" name="bash" args={{}} />);
		expect(document.querySelector('[data-slot="spinner"]')).toBeNull();
		expect(screen.getByText("tool.status.done")).toBeTruthy();
	});

	it("shows error chip when status is complete with isError", () => {
		setExecution({ id: "t1", name: "bash", args: {}, status: "complete", isError: true });
		render(<ToolCallCard id="t1" name="bash" args={{}} />);
		expect(screen.getAllByText("tool.status.error").length).toBeGreaterThan(0);
	});

	it("shows error chip when status is error", () => {
		setExecution({ id: "t1", name: "bash", args: {}, status: "error" });
		render(<ToolCallCard id="t1" name="bash" args={{}} />);
		expect(screen.getByText("error")).toBeTruthy();
	});
});

describe("ToolCallCard intent and result", () => {
	it("shows intent when provided", () => {
		setExecution({ id: "t1", name: "bash", args: {}, status: "running", intent: "doing something" });
		render(<ToolCallCard id="t1" name="bash" args={{}} />);
		expect(screen.getByText("doing something")).toBeTruthy();
	});

	it("shows result when execution is complete", () => {
		setExecution({ id: "t1", name: "bash", args: {}, status: "complete", isError: false, result: "output here" });
		render(<ToolCallCard id="t1" name="bash" args={{}} />);
		expect(screen.getByText("output here")).toBeTruthy();
	});

	it("shows error result with error label", () => {
		setExecution({ id: "t1", name: "bash", args: {}, status: "complete", isError: true, result: "bad error" });
		render(<ToolCallCard id="t1" name="bash" args={{}} />);
		expect(screen.getByText("bad error")).toBeTruthy();
		// error label appears at least once (chip + result label)
		expect(screen.getAllByText("tool.status.error").length).toBeGreaterThanOrEqual(1);
	});
});

describe("getToolSummary branches", () => {
	it("read: shows path", () => {
		setExecution({ id: "t1", name: "read", args: { path: "/etc/hosts" }, status: "running" });
		render(<ToolCallCard id="t1" name="read" args={{ path: "/etc/hosts" }} />);
		expect(screen.getByText("/etc/hosts")).toBeTruthy();
	});

	it("write: shows path", () => {
		setExecution({ id: "t1", name: "write", args: { path: "/tmp/out.txt" }, status: "running" });
		render(<ToolCallCard id="t1" name="write" args={{ path: "/tmp/out.txt" }} />);
		expect(screen.getByText("/tmp/out.txt")).toBeTruthy();
	});

	it("edit: shows path", () => {
		setExecution({ id: "t1", name: "edit", args: { path: "/src/index.ts" }, status: "running" });
		render(<ToolCallCard id="t1" name="edit" args={{ path: "/src/index.ts" }} />);
		expect(screen.getByText("/src/index.ts")).toBeTruthy();
	});

	it("bash: shows command (truncated to 80)", () => {
		const cmd = "echo hello";
		setExecution({ id: "t1", name: "bash", args: { command: cmd }, status: "running" });
		render(<ToolCallCard id="t1" name="bash" args={{ command: cmd }} />);
		expect(screen.getByText(cmd)).toBeTruthy();
	});

	it("python: shows first code line", () => {
		const code = "import os\nprint(os.getcwd())";
		setExecution({ id: "t1", name: "python", args: { code }, status: "running" });
		render(<ToolCallCard id="t1" name="python" args={{ code }} />);
		expect(screen.getByText("import os")).toBeTruthy();
	});

	it("grep: shows pattern in path", () => {
		setExecution({ id: "t1", name: "grep", args: { pattern: "TODO", path: "src/" }, status: "running" });
		render(<ToolCallCard id="t1" name="grep" args={{ pattern: "TODO", path: "src/" }} />);
		expect(screen.getByText("TODO in src/")).toBeTruthy();
	});

	it("find: shows pattern", () => {
		setExecution({ id: "t1", name: "find", args: { pattern: "*.ts" }, status: "running" });
		render(<ToolCallCard id="t1" name="find" args={{ pattern: "*.ts" }} />);
		expect(screen.getByText("*.ts")).toBeTruthy();
	});

	it("fetch: shows url", () => {
		setExecution({ id: "t1", name: "fetch", args: { url: "https://example.com" }, status: "running" });
		render(<ToolCallCard id="t1" name="fetch" args={{ url: "https://example.com" }} />);
		expect(screen.getByText("https://example.com")).toBeTruthy();
	});

	it("web_search: shows query when no url", () => {
		setExecution({ id: "t1", name: "web_search", args: { query: "vitest docs" }, status: "running" });
		render(<ToolCallCard id="t1" name="web_search" args={{ query: "vitest docs" }} />);
		expect(screen.getByText("vitest docs")).toBeTruthy();
	});

	it("lsp: shows action and file", () => {
		setExecution({ id: "t1", name: "lsp", args: { action: "hover", file: "main.ts" }, status: "running" });
		render(<ToolCallCard id="t1" name="lsp" args={{ action: "hover", file: "main.ts" }} />);
		expect(screen.getByText("hover main.ts")).toBeTruthy();
	});

	it("lsp: shows action without file when file absent", () => {
		setExecution({ id: "t1", name: "lsp", args: { action: "diagnostics" }, status: "running" });
		render(<ToolCallCard id="t1" name="lsp" args={{ action: "diagnostics" }} />);
		expect(screen.getByText("diagnostics")).toBeTruthy();
	});
});
