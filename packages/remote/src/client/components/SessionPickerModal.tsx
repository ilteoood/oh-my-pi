import { useTranslation } from "react-i18next";
import { IoCheckmarkCircle, IoClose } from "react-icons/io5";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import type { RpcCommand, SessionListEntry } from "../types";

interface SessionPickerModalProps {
	sendCommand: (cmd: RpcCommand) => void;
}

export function SessionPickerModal({ sendCommand }: SessionPickerModalProps) {
	const { t } = useTranslation();
	const { sessionPickerOpen, closeSessionPicker } = useUIStore();
	const sessions = useSessionStore(s => s.sessions);
	const currentSessionId = useSessionStore(s => s.sessionState?.sessionId);

	if (!sessionPickerOpen) return null;

	const handleSelect = (session: SessionListEntry) => {
		if (session.isCurrent) return;
		sendCommand({ type: "switch_session", sessionPath: session.path });
		closeSessionPicker();
	};

	const handleBackdropKey = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") closeSessionPicker();
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			role="dialog"
			aria-modal
			onKeyDown={handleBackdropKey}
		>
			{/* Backdrop */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: presentation element, no semantic role needed */}
			<div role="presentation" className="absolute inset-0 bg-black/50" onClick={closeSessionPicker} />

			<div className="relative z-10 w-full max-w-lg rounded-2xl bg-surface border border-separator shadow-xl overflow-y-auto max-h-[80vh]">
				<div className="flex items-center justify-between px-5 py-4 border-b border-separator">
					<h2 className="text-base font-semibold">{t("sessionPicker.title")}</h2>
					<button
						type="button"
						className="text-muted hover:text-foreground transition-colors text-xl leading-none cursor-pointer"
						onClick={closeSessionPicker}
						aria-label={t("actions.close")}
					>
						<IoClose />
					</button>
				</div>

				<div className="p-5">
					{sessions === null ? (
						<p className="text-muted text-sm">{t("sessionPicker.loading")}</p>
					) : sessions.length === 0 ? (
						<p className="text-muted text-sm">{t("sessionPicker.noSessions")}</p>
					) : (
						<div className="space-y-1">
							{sessions.map(session => (
								<SessionRow
									key={session.id}
									session={session}
									isCurrent={session.isCurrent || session.id === currentSessionId}
									onSelect={handleSelect}
									t={t}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

interface SessionRowProps {
	session: SessionListEntry;
	isCurrent: boolean;
	onSelect: (session: SessionListEntry) => void;
	t: (key: string, options?: Record<string, unknown>) => string;
}

function SessionRow({ session, isCurrent, onSelect, t }: SessionRowProps) {
	const displayName = session.title ?? session.id;
	const modified = new Date(session.modified).toLocaleString();

	return (
		<button
			type="button"
			className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
				isCurrent ? "bg-default text-(--color-accent)" : "hover:bg-default cursor-pointer"
			}`}
			onClick={() => onSelect(session)}
			disabled={isCurrent}
			aria-label={t("sessionPicker.switchAriaLabel")}
		>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium truncate">{displayName}</p>
				{session.firstMessage && <p className="text-xs text-muted truncate">{session.firstMessage}</p>}
				<p className="text-xs text-muted">
					{t("sessionPicker.messages", { count: session.messageCount })} · {modified}
				</p>
			</div>
			{isCurrent && <IoCheckmarkCircle className="text-(--color-accent) shrink-0 ml-3" size={18} />}
		</button>
	);
}
