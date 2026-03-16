import { Card } from "@heroui/react";
import clsx from "clsx";
import type { ContentPart, ImageContentPart, Message, TextContentPart } from "../types";
import { MarkdownContent } from "./MarkdownContent";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallCard } from "./ToolCallCard";

interface MessageBubbleProps {
	message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
	const isUser = message.role === "user";

	return (
		<div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
			<Card className={clsx("max-w-[85%]", isUser ? "bg-accent text-accent-foreground" : "bg-default")}>
				<Card.Content>
					<MessageContent content={message.content} isUser={isUser} />
				</Card.Content>
			</Card>
		</div>
	);
}

function MessageContent({ content, isUser }: { content: string | ContentPart[]; isUser: boolean }) {
	if (typeof content === "string") {
		if (isUser) {
			return <p className="whitespace-pre-wrap">{content}</p>;
		}
		return <MarkdownContent content={content} />;
	}

	return (
		<div className="space-y-2">
			{content.map((part, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: content parts lack stable IDs
				<ContentPartRenderer key={`${part.type}-${i}`} part={part} isUser={isUser} />
			))}
		</div>
	);
}

function ContentPartRenderer({ part, isUser }: { part: ContentPart; isUser: boolean }) {
	switch (part.type) {
		case "text":
			if (isUser) {
				return <p className="whitespace-pre-wrap">{part.text}</p>;
			}
			return <MarkdownContent content={part.text} />;
		case "thinking":
			return <ThinkingBlock content={part.thinking} />;
		case "toolCall":
			return <ToolCallCard name={part.name} args={part.arguments} id={part.id} />;
		case "toolResult":
			return <ToolResultDisplay content={part.content} />;
		case "image":
			return <img src={part.data} alt={part.mimeType} className="max-w-full rounded" />;
		case "redactedThinking":
			return null;
		default:
			return null;
	}
}

const contentSlicer = (content: string, _maxLengthh: number = 500) =>
	content.length > 500 ? `${content.slice(0, 500)}...` : content;

function ToolResultDisplay({ content }: { content: (TextContentPart | ImageContentPart)[] | string }) {
	if (!content) return null;
	if (typeof content === "string") {
		if (!content) return null;
		return (
			<div className="text-sm bg-surface-secondary rounded-lg px-3 py-2 font-mono whitespace-pre-wrap overflow-x-auto">
				{contentSlicer(content)}
			</div>
		);
	}
	if (Array.isArray(content)) {
		const text = content
			.filter((p): p is TextContentPart => (p as TextContentPart).type === "text")
			.map(p => p.text)
			.join("\n");
		if (!text) return null;
		return (
			<div className="text-sm bg-surface-secondary rounded-lg px-3 py-2 font-mono whitespace-pre-wrap overflow-x-auto">
				{contentSlicer(text)}
			</div>
		);
	}
	return null;
}
