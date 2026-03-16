import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
	content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
	return (
		<div className="prose prose-sm prose-invert max-w-none prose-pre:bg-surface-secondary prose-pre:text-foreground prose-code:text-[var(--color-accent)] prose-code:before:content-none prose-code:after:content-none">
			<Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
				{content}
			</Markdown>
		</div>
	);
}
