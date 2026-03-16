import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageBubble } from "../../../src/client/components/MessageBubble";
import type { Message } from "../../../src/client/types";


vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-markdown", () => ({ default: ({ children }: { children: string }) => <span data-testid="markdown">{children}</span> }));
vi.mock("rehype-highlight", () => ({ default: () => ({}) }));
vi.mock("remark-gfm", () => ({ default: () => ({}) }));
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

vi.mock("../../../src/client/components/MarkdownContent", () => ({ MarkdownContent: () => <span data-testid="md" /> }));
vi.mock("../../../src/client/components/ThinkingBlock", () => ({ ThinkingBlock: () => <span data-testid="thinking" /> }));
vi.mock("../../../src/client/components/ToolCallCard", () => ({ ToolCallCard: () => <span data-testid="toolcard" /> }));

const userMsg = (content: Message["content"]): Message => ({ role: "user", content });
const assistantMsg = (content: Message["content"]): Message => ({ role: "assistant", content });

describe("MessageBubble layout", () => {
	it("user message is right-aligned", () => {
		const { container } = render(<MessageBubble message={userMsg("hello")} />);
		expect((container.firstChild as HTMLElement).className).toContain("justify-end");
	});

	it("assistant message is left-aligned", () => {
		const { container } = render(<MessageBubble message={assistantMsg("hello")} />);
		expect((container.firstChild as HTMLElement).className).toContain("justify-start");
	});
});

describe("MessageBubble string content", () => {
	it("user string content renders as <p>", () => {
		render(<MessageBubble message={userMsg("plain text")} />);
		expect(screen.getByText("plain text").tagName).toBe("P");
	});

	it("assistant string content renders MarkdownContent", () => {
		render(<MessageBubble message={assistantMsg("markdown text")} />);
		expect(screen.getByTestId("md")).toBeTruthy();
	});
});

describe("MessageBubble array content", () => {
	it("text part for user renders as <p>", () => {
		render(<MessageBubble message={userMsg([{ type: "text", text: "user text" }])} />);
		expect(screen.getByText("user text").tagName).toBe("P");
	});

	it("text part for assistant renders MarkdownContent", () => {
		render(<MessageBubble message={assistantMsg([{ type: "text", text: "asst text" }])} />);
		expect(screen.getByTestId("md")).toBeTruthy();
	});

	it("thinking part renders ThinkingBlock", () => {
		render(<MessageBubble message={assistantMsg([{ type: "thinking", thinking: "hmm" }])} />);
		expect(screen.getByTestId("thinking")).toBeTruthy();
	});

	it("toolCall part renders ToolCallCard", () => {
		render(
			<MessageBubble
				message={assistantMsg([{ type: "toolCall", id: "t1", name: "bash", arguments: { command: "ls" } }])}
			/>,
		);
		expect(screen.getByTestId("toolcard")).toBeTruthy();
	});

	it("image part renders img", () => {
		render(
			<MessageBubble
				message={assistantMsg([{ type: "image", data: "data:image/png;base64,abc", mimeType: "image/png" }])}
			/>,
		);
		expect(screen.getByRole("img")).toBeTruthy();
	});

	it("redactedThinking returns null for that part", () => {
		const { container } = render(
			<MessageBubble message={assistantMsg([{ type: "redactedThinking", data: "x" }])} />,
		);
		// space-y-2 wrapper exists but has no rendered children
		const spaceDiv = container.querySelector(".space-y-2");
		expect(spaceDiv?.children.length).toBe(0);
	});
});

describe("MessageBubble toolResult content", () => {
	it("renders string tool result content", () => {
		render(
			<MessageBubble
				message={assistantMsg([
					{
						type: "toolResult",
						toolCallId: "t1",
						toolName: "bash",
						content: "some output",
						isError: false,
					},
				])}
			/>,
		);
		expect(screen.getByText("some output")).toBeTruthy();
	});

	it("renders joined text from array tool result", () => {
		const { container } = render(
			<MessageBubble
				message={assistantMsg([
					{
						type: "toolResult",
						toolCallId: "t1",
						toolName: "bash",
						content: [
							{ type: "text", text: "line one" },
							{ type: "text", text: "line two" },
						],
						isError: false,
					},
				])}
			/>,
		);
		const el = container.querySelector(".font-mono");
		expect(el?.textContent?.trim()).toBe("line one\nline two");
	});

	it("empty array tool result returns null", () => {
		const { container } = render(
			<MessageBubble
				message={assistantMsg([
					{
						type: "toolResult",
						toolCallId: "t1",
						toolName: "bash",
						content: [],
						isError: false,
					},
				])}
			/>,
		);
		// no font-mono div should appear
		expect(container.querySelector(".font-mono")).toBeNull();
	});

	it("long string content gets truncated to 500 chars with ellipsis", () => {
		const longStr = "a".repeat(600);
		render(
			<MessageBubble
				message={assistantMsg([
					{
						type: "toolResult",
						toolCallId: "t1",
						toolName: "bash",
						content: longStr,
						isError: false,
					},
				])}
			/>,
		);
		const displayed = screen.getByText(/a+\.\.\./);
		// Truncated: 500 a's + "..."
		expect(displayed.textContent).toHaveLength(503);
	});
});
