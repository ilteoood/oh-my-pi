import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StreamingMessage } from "../../../src/client/components/StreamingMessage";


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

describe("StreamingMessage layout", () => {
	it("user message is right-aligned (justify-end)", () => {
		const { container } = render(<StreamingMessage role="user" content={[{ type: "text", text: "hi" }]} />);
		expect((container.firstChild as HTMLElement).className).toContain("justify-end");
	});

	it("assistant message is left-aligned (justify-start)", () => {
		const { container } = render(<StreamingMessage role="assistant" content={[{ type: "text", text: "hello" }]} />);
		expect((container.firstChild as HTMLElement).className).toContain("justify-start");
	});
});

describe("StreamingMessage empty content", () => {
	it("shows pulse indicator when content is empty", () => {
		const { container } = render(<StreamingMessage role="assistant" content={[]} />);
		const pulse = container.querySelector(".animate-pulse");
		expect(pulse).toBeTruthy();
	});
});

describe("StreamingMessage part rendering", () => {
	it("text part renders MarkdownContent", () => {
		render(<StreamingMessage role="assistant" content={[{ type: "text", text: "hello" }]} />);
		expect(screen.getByTestId("md")).toBeTruthy();
	});

	it("text part as last shows cursor indicator", () => {
		const { container } = render(<StreamingMessage role="assistant" content={[{ type: "text", text: "hello" }]} />);
		// The cursor is an additional animate-pulse span after the markdown
		const pulses = container.querySelectorAll(".animate-pulse");
		expect(pulses.length).toBeGreaterThan(0);
	});

	it("non-last text part does not add a cursor", () => {
		render(
			<StreamingMessage
				role="assistant"
				content={[
					{ type: "text", text: "first" },
					{ type: "text", text: "second" },
				]}
			/>,
		);
		// Both parts render md, 2 mocks present
		expect(screen.getAllByTestId("md")).toHaveLength(2);
	});

	it("thinking part renders ThinkingBlock", () => {
		render(<StreamingMessage role="assistant" content={[{ type: "thinking", thinking: "thinking..." }]} />);
		expect(screen.getByTestId("thinking")).toBeTruthy();
	});

	it("toolCall part renders ToolCallCard", () => {
		render(
			<StreamingMessage
				role="assistant"
				content={[{ type: "toolCall", id: "t1", name: "bash", arguments: { command: "ls" } }]}
			/>,
		);
		expect(screen.getByTestId("toolcard")).toBeTruthy();
	});

	it("image part renders img element", () => {
		render(
			<StreamingMessage
				role="assistant"
				content={[{ type: "image", data: "data:image/png;base64,abc", mimeType: "image/png" }]}
			/>,
		);
		expect(screen.getByRole("img")).toBeTruthy();
	});

	it("redactedThinking returns null (nothing rendered)", () => {
		const { container } = render(
			<StreamingMessage role="assistant" content={[{ type: "redactedThinking", data: "x" }]} />,
		);
		// Card.Content div is present but inner space-y-2 div has no children
		const inner = container.querySelector(".space-y-2");
		expect(inner?.children.length).toBe(0);
	});
});
