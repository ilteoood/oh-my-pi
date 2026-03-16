import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InputBar } from "../../../src/client/components/InputBar";
import {
	executeSlashCommand,
	extractAtPrefix,
	isKnownSlashCommand,
	matchSlashCommands,
	parseSlashCommand
} from "../../../src/client/slashCommands";
import { useSessionStore } from "../../../src/client/stores/sessionStore";


vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-icons/io5", () => ({
	IoSettings: () => null,
	IoBulb: () => null,
	IoClose: () => null,
	IoSend: () => null,
	IoStop: () => null,
	IoCheckmarkCircle: () => null,
	IoFolderOpenSharp: () => null,
}));
vi.mock("react-icons/fa6", () => ({ FaRegFileLines: () => null }));

vi.mock("../../../src/client/slashCommands", () => ({
	matchSlashCommands: vi.fn().mockReturnValue([]),
	matchSubcommands: vi.fn().mockReturnValue([]),
	getSlashCommandHint: vi.fn().mockReturnValue(null),
	isKnownSlashCommand: vi.fn().mockReturnValue(false),
	parseSlashCommand: vi.fn().mockReturnValue(null),
	executeSlashCommand: vi.fn().mockReturnValue(false),
	extractAtPrefix: vi.fn().mockReturnValue(null),
}));

vi.mock("../../../src/client/components/FileTagMenu", () => ({
	FileTagMenu: vi.fn(({ items, onSelect }: { items: Array<{ path: string; isDirectory: boolean; score: number }>; onSelect: (i: number) => void; selectedIndex: number; onChangeSelectedIndex: (i: number) => void }) =>
		items.length > 0 ? (
			<div data-testid="file-tag-menu">
				{items.map((item, i) => (
					<button key={item.path} data-testid={`file-item-${i}`} type="button" onMouseDown={() => onSelect(i)}>
						{item.path}
					</button>
				))}
			</div>
		) : null,
	),
}));
vi.mock("../../../src/client/components/SlashCommandMenu", () => ({
	SlashCommandMenu: () => <div data-testid="slash-menu" />,
}));

beforeEach(() => {
	useSessionStore.setState({ connected: false, isStreaming: false, fileSearch: null });
	vi.mocked(matchSlashCommands).mockReturnValue([]);
	vi.mocked(extractAtPrefix).mockReturnValue(null);
	vi.mocked(parseSlashCommand).mockReturnValue(null);
	vi.mocked(isKnownSlashCommand).mockReturnValue(false);
	vi.mocked(executeSlashCommand).mockReturnValue(false);
});

describe("InputBar", () => {
	it("textarea is disabled when not connected", () => {
		render(<InputBar sendCommand={vi.fn()} />);
		expect(screen.getByRole("textbox")).toBeDisabled();
	});

	it("textarea is enabled when connected", () => {
		useSessionStore.setState({ connected: true });
		render(<InputBar sendCommand={vi.fn()} />);
		expect(screen.getByRole("textbox")).not.toBeDisabled();
	});

	it("shows connected placeholder when connected", () => {
		useSessionStore.setState({ connected: true });
		render(<InputBar sendCommand={vi.fn()} />);
		expect(screen.getByPlaceholderText("inputBar.placeholder")).toBeInTheDocument();
	});

	it("shows disconnected placeholder when not connected", () => {
		render(<InputBar sendCommand={vi.fn()} />);
		expect(screen.getByPlaceholderText("inputBar.disconnectedPlaceholder")).toBeInTheDocument();
	});

	it("typing updates input value", async () => {
		useSessionStore.setState({ connected: true });
		const user = userEvent.setup();
		render(<InputBar sendCommand={vi.fn()} />);
		await user.type(screen.getByRole("textbox"), "hello");
		expect(screen.getByRole("textbox")).toHaveValue("hello");
	});

	it("send button is disabled when input is empty", () => {
		useSessionStore.setState({ connected: true });
		render(<InputBar sendCommand={vi.fn()} />);
		expect(screen.getByRole("button", { name: "inputBar.sendAriaLabel" })).toBeDisabled();
	});

	it("send button is disabled when not connected", () => {
		render(<InputBar sendCommand={vi.fn()} />);
		expect(screen.getByRole("button", { name: "inputBar.sendAriaLabel" })).toBeDisabled();
	});

	it("pressing Enter sends a prompt message", async () => {
		useSessionStore.setState({ connected: true, isStreaming: false });
		const sendCommand = vi.fn();
		const user = userEvent.setup();
		render(<InputBar sendCommand={sendCommand} />);
		await user.type(screen.getByRole("textbox"), "hello");
		await user.keyboard("{Enter}");
		expect(sendCommand).toHaveBeenCalledWith({ type: "prompt", message: "hello" });
	});

	it("pressing Shift+Enter does not send", async () => {
		useSessionStore.setState({ connected: true });
		const sendCommand = vi.fn();
		const user = userEvent.setup();
		render(<InputBar sendCommand={sendCommand} />);
		await user.type(screen.getByRole("textbox"), "hello");
		await user.keyboard("{Shift>}{Enter}{/Shift}");
		expect(sendCommand).not.toHaveBeenCalled();
	});

	it("sending clears the input", async () => {
		useSessionStore.setState({ connected: true, isStreaming: false });
		const user = userEvent.setup();
		render(<InputBar sendCommand={vi.fn()} />);
		const textarea = screen.getByRole("textbox");
		await user.type(textarea, "hello");
		await user.keyboard("{Enter}");
		expect(textarea).toHaveValue("");
	});

	it("abort button appears when isStreaming is true", () => {
		useSessionStore.setState({ connected: true, isStreaming: true });
		render(<InputBar sendCommand={vi.fn()} />);
		expect(screen.getByRole("button", { name: "inputBar.stopAriaLabel" })).toBeInTheDocument();
	});

	it("abort button is absent when not streaming", () => {
		useSessionStore.setState({ connected: true, isStreaming: false });
		render(<InputBar sendCommand={vi.fn()} />);
		expect(screen.queryByRole("button", { name: "inputBar.stopAriaLabel" })).not.toBeInTheDocument();
	});

	it("clicking abort button sends abort command", async () => {
		useSessionStore.setState({ connected: true, isStreaming: true });
		const sendCommand = vi.fn();
		const user = userEvent.setup();
		render(<InputBar sendCommand={sendCommand} />);
		await user.click(screen.getByRole("button", { name: "inputBar.stopAriaLabel" }));
		expect(sendCommand).toHaveBeenCalledWith({ type: "abort" });
	});

	it("when streaming, Enter sends abort_and_prompt instead of prompt", async () => {
		useSessionStore.setState({ connected: true, isStreaming: true });
		const sendCommand = vi.fn();
		const user = userEvent.setup();
		render(<InputBar sendCommand={sendCommand} />);
		await user.type(screen.getByRole("textbox"), "hello");
		await user.keyboard("{Enter}");
		expect(sendCommand).toHaveBeenCalledWith({ type: "abort_and_prompt", message: "hello" });
	});

	it("clears input when known slash command is successfully executed", async () => {
		useSessionStore.setState({ connected: true, isStreaming: false });
		vi.mocked(parseSlashCommand).mockReturnValue({ name: "help", args: [] } as any);
		vi.mocked(isKnownSlashCommand).mockReturnValue(true);
		vi.mocked(executeSlashCommand).mockReturnValue(true);
		const sendCommand = vi.fn();
		const user = userEvent.setup();
		render(<InputBar sendCommand={sendCommand} />);
		const textarea = screen.getByRole("textbox");
		await user.type(textarea, "/help");
		await user.keyboard("{Enter}");
		expect(textarea).toHaveValue("");
	});

	it("does not clear input when executeSlashCommand returns false", async () => {
		useSessionStore.setState({ connected: true, isStreaming: false });
		vi.mocked(parseSlashCommand).mockReturnValue({ name: "help", args: [] } as any);
		vi.mocked(isKnownSlashCommand).mockReturnValue(true);
		vi.mocked(executeSlashCommand).mockReturnValue(false);
		const user = userEvent.setup();
		render(<InputBar sendCommand={vi.fn()} />);
		const textarea = screen.getByRole("textbox");
		await user.type(textarea, "/help");
		await user.keyboard("{Enter}");
		expect(textarea).toHaveValue("/help");
	});

	it("shows slash command menu when matchSlashCommands returns items", async () => {
		useSessionStore.setState({ connected: true });
		vi.mocked(matchSlashCommands).mockReturnValue([{ name: "help", description: "Show help" }] as any);
		const user = userEvent.setup();
		render(<InputBar sendCommand={vi.fn()} />);
		await user.type(screen.getByRole("textbox"), "/");
		expect(screen.getByTestId("slash-menu")).toBeInTheDocument();
	});

	it("shows file tag menu when atPrefix matches fileSearch results", async () => {
		vi.mocked(extractAtPrefix).mockReturnValue({ query: "foo", tokenStart: 0 });
		useSessionStore.setState({
			connected: true,
			fileSearch: { query: "foo", matches: [{ path: "foo.ts", score: 1 }] as any },
		});
		const user = userEvent.setup();
		render(<InputBar sendCommand={vi.fn()} />);
		await user.type(screen.getByRole("textbox"), "@foo");
		expect(screen.getByTestId("file-tag-menu")).toBeInTheDocument();
	});
});

describe("InputBar keyboard navigation", () => {
	it("ArrowDown moves selection, Tab applies command", async () => {
		vi.mocked(matchSlashCommands).mockReturnValue([
			{ name: "compact", description: "" },
			{ name: "new", description: "" },
		]);
		useSessionStore.setState({ connected: true });
		const user = userEvent.setup();
		render(<InputBar sendCommand={vi.fn()} />);
		const textarea = screen.getByRole("textbox");
		await user.type(textarea, "/");
		await user.keyboard("{ArrowDown}");
		await user.keyboard("{Tab}");
		expect(textarea).toHaveValue("/new ");
	});

	it("ArrowUp wraps selection to last item", async () => {
		vi.mocked(matchSlashCommands).mockReturnValue([
			{ name: "compact", description: "" },
			{ name: "new", description: "" },
		]);
		useSessionStore.setState({ connected: true });
		const user = userEvent.setup();
		render(<InputBar sendCommand={vi.fn()} />);
		const textarea = screen.getByRole("textbox");
		await user.type(textarea, "/");
		await user.keyboard("{ArrowUp}");
		await user.keyboard("{Enter}");
		expect(textarea).toHaveValue("/new ");
	});

	it("Escape dismisses the menu", async () => {
		vi.mocked(matchSlashCommands).mockReturnValue([{ name: "compact", description: "" }]);
		useSessionStore.setState({ connected: true });
		const user = userEvent.setup();
		render(<InputBar sendCommand={vi.fn()} />);
		const textarea = screen.getByRole("textbox");
		await user.type(textarea, "/");
		expect(screen.getByTestId("slash-menu")).toBeInTheDocument();
		await user.keyboard("{Escape}");
		expect(screen.queryByTestId("slash-menu")).not.toBeInTheDocument();
	});

	it("Tab in subcommand menu completes the subcommand (applySlashSelection branch)", async () => {
		const { matchSubcommands } = await import("../../../src/client/slashCommands");
		vi.mocked(matchSlashCommands).mockReturnValue([]);
		vi.mocked(matchSubcommands).mockReturnValue([{ name: "off", description: "" }]);
		useSessionStore.setState({ connected: true });
		const user = userEvent.setup();
		render(<InputBar sendCommand={vi.fn()} />);
		const textarea = screen.getByRole("textbox");
		await user.type(textarea, "/thinking ");
		await user.keyboard("{Tab}");
		expect(textarea).toHaveValue("/thinking off");
	});
});

describe("InputBar @ file tagging", () => {
	it("sends search_files after debounce when @ prefix detected", async () => {
		vi.useFakeTimers();
		vi.mocked(extractAtPrefix).mockReturnValue({ query: "test", tokenStart: 0 });
		useSessionStore.setState({ connected: true });
		const sendCommand = vi.fn();
		render(<InputBar sendCommand={sendCommand} />);
		const textarea = screen.getByRole("textbox");
		act(() => { fireEvent.change(textarea, { target: { value: "@test" } }); });
		act(() => { vi.advanceTimersByTime(200); });
		expect(sendCommand).toHaveBeenCalledWith({ type: "search_files", query: "test" });
		vi.useRealTimers();
	});

	it("applies file selection replacing @token in textarea", async () => {
		vi.mocked(extractAtPrefix).mockReturnValue({ query: "src", tokenStart: 0 });
		useSessionStore.setState({
			connected: true,
			fileSearch: { query: "src", matches: [{ path: "src/index.ts", isDirectory: false, score: 0.9 }] },
		});
		render(<InputBar sendCommand={vi.fn()} />);
		const textarea = screen.getByRole("textbox");
		act(() => { fireEvent.change(textarea, { target: { value: "@src" } }); });
		const btn = screen.getByTestId("file-item-0");
		fireEvent.mouseDown(btn);
		expect(textarea).toHaveValue("@src/index.ts");
	});
});
