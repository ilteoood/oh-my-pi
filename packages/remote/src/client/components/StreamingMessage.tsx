import { Card } from "@heroui/react";
import clsx from "clsx";
import type { ContentPart, MessageRole } from "../types";
import { MarkdownContent } from "./MarkdownContent";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallCard } from "./ToolCallCard";

interface StreamingMessageProps {
	role: MessageRole;
	content: ContentPart[];
}

export function StreamingMessage({ role, content }: StreamingMessageProps) {
	const isUser = role === "user";

	const contentLength = content.length

	return (
		<div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
			<Card className={clsx('max-w-[85%]', isUser ? 'bg-primary text-primary-foreground' : 'bg-content2')}>
				<Card.Content className="px-4 py-3">
					<div className="space-y-2">
						{content.map((part, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: streaming parts lack stable IDs
							<StreamingPart key={`${part.type}-${i}`} part={part} isLast={i === contentLength - 1} />
						))}
						{contentLength === 0 && (
							<span className="inline-block w-2 h-5 bg-primary animate-pulse rounded-sm" />
						)}
					</div>
				</Card.Content>
			</Card>
		</div>
	);
}

function StreamingPart({ part, isLast }: { part: ContentPart; isLast: boolean }) {
	switch (part.type) {
		case "text":
			return (
				<div>
					<MarkdownContent content={part.text} />
					{isLast && (
						<span className="inline-block w-2 h-5 bg-primary animate-pulse rounded-sm ml-0.5 align-text-bottom" />
					)}
				</div>
			);
		case "thinking":
			return <ThinkingBlock content={part.thinking} />;
		case "toolCall":
			return <ToolCallCard name={part.name} args={part.arguments} id={part.id} />;
		case "image":
			return <img src={part.data} alt={part.mimeType} className="max-w-full rounded" />;
		case "redactedThinking":
			return null;
		default:
			return null;
	}
}
