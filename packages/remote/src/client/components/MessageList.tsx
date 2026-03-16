import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "../stores/sessionStore";
import { MessageBubble } from "./MessageBubble";
import { StreamingMessage } from "./StreamingMessage";

export function MessageList() {
	const { t } = useTranslation();
	const {messages, streamingContent, streamingRole, isStreaming} = useSessionStore();
	const containerRef = useRef<HTMLDivElement>(null);
	const shouldAutoScroll = useRef(true);

	// Auto-scroll on new messages
	// biome-ignore lint/correctness/useExhaustiveDependencies: messages and streamingContent intentionally trigger scroll
	useEffect(() => {
		const el = containerRef.current;
		if (el && shouldAutoScroll.current) {
			el.scrollTop = el.scrollHeight;
		}
	}, [messages, streamingContent]);

	function handleScroll() {
		const el = containerRef.current;
		if (!el) return;
		const threshold = 100;
		shouldAutoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
	}

	return (
		<div ref={containerRef} onScroll={handleScroll} className="h-full overflow-y-auto px-4 py-4 space-y-4">
			{messages.length === 0 && !isStreaming && (
				<div className="flex items-center justify-center h-full">
					<div className="text-center text-muted">
						<p className="text-9xl mb-4">{t("messageList.emptySymbol")}</p>
						<p className="text-lg">{t("messageList.emptyTitle")}</p>
						<p className="text-sm mt-2">{t("messageList.emptySubtitle")}</p>
					</div>
				</div>
			)}
			{messages.map((msg, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: messages lack stable IDs
				<MessageBubble key={`msg-${i}`} message={msg} />
			))}
			{streamingContent.length > 0 && streamingRole && (
				<StreamingMessage role={streamingRole} content={streamingContent} />
			)}
		</div>
	);
}
