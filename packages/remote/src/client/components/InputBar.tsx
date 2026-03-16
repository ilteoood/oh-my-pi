import { Button } from "@heroui/react";
import { useCallback, useRef, useState } from "react";
import { SendIcon } from "../icons/SendIcon";
import { StopIcon } from "../icons/StopIcon";
import { useSessionStore } from "../stores/sessionStore";
import type { RpcCommand } from "../types";

interface InputBarProps {
	sendCommand: (cmd: RpcCommand) => void;
}

export function InputBar({ sendCommand }: InputBarProps) {
	const [input, setInput] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const connected = useSessionStore(s => s.connected);
	const isStreaming = useSessionStore(s => s.isStreaming);

	const handleSend = useCallback(() => {
		const trimmed = input.trim();
		if (!trimmed || !connected) return;

		sendCommand({
			type: isStreaming ? "abort_and_prompt" : "prompt",
			message: trimmed,
		})

		setInput("");
	}, [input, connected, isStreaming, sendCommand]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const handleAbort = useCallback(() => {
		sendCommand({ type: "abort" });
	}, [sendCommand]);

	return (
		<div className="border-t border-divider px-4 py-3 bg-content1 shrink-0">
			<div className="flex items-end gap-2 max-w-5xl mx-auto">
				<textarea
					ref={textareaRef}
					value={input}
					onChange={e => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={
						connected ? "Type a message... (Enter to send, Shift+Enter for newline)" : "Disconnected..."
					}
					disabled={!connected}
					rows={1}
					className="flex-1 resize-none rounded-xl border border-default-300 bg-content2 px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-50 max-h-[200] field-sizing-content"
				/>
				<div className="flex gap-1">
					{isStreaming && (
						<Button variant="danger" size="md" onPress={handleAbort} isIconOnly aria-label="Stop">
							<StopIcon />
						</Button>
					)}
					<Button
						variant="primary"
						size="md"
						onPress={handleSend}
						isDisabled={!connected || !input.trim()}
						isIconOnly
						aria-label="Send"
					>
						<SendIcon />
					</Button>
				</div>
			</div>
		</div>
	);
}
