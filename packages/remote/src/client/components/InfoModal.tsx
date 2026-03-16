import { useTranslation } from "react-i18next";
import { IoClose } from "react-icons/io5";
import { WEB_SLASH_COMMANDS } from "../slashCommands";
import type { SessionStats } from "../types";
import { useUIStore } from "../stores/uiStore";
import { useSessionStore } from "../stores/sessionStore";

interface InfoModalProps {
	variant: "hotkeys" | "session";
}

export function InfoModal({ variant }: InfoModalProps) {
	const { hotkeysOpen, closeHotkeys, sessionStatsOpen, closeSessionStats } = useUIStore();
	const { t } = useTranslation();
	const {sessionStats} = useSessionStore();
	const isHotkeys = variant === "hotkeys";

	const open = isHotkeys ? hotkeysOpen : sessionStatsOpen;
	const onClose = isHotkeys ? closeHotkeys : closeSessionStats;

	if (!open) return null;
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			role="dialog"
			aria-modal
			onClick={e => {
				// Close when clicking the backdrop (target is this element, not child content)
				if (e.target === e.currentTarget) onClose();
			}}
			onKeyDown={e => {
				if (e.key === "Escape") onClose();
			}}
		>
			<div className="absolute inset-0 bg-black/50" />
			<div className="relative z-10 w-full max-w-lg rounded-2xl bg-surface border border-separator shadow-xl overflow-y-auto max-h-[80vh]">
				<div className="flex items-center justify-between px-5 py-4 border-b border-separator">
					<h2 className="text-base font-semibold">
						{variant === "hotkeys" ? t("hotkeys.title") : t("sessionStats.title")}
					</h2>
					<button
						type="button"
						className="text-muted hover:text-foreground transition-colors text-xl leading-none cursor-pointer"
						onClick={onClose}
						aria-label="Close"
					>
						<IoClose />
					</button>
				</div>
				<div className="p-5">
					{variant === "hotkeys" ? <HotkeysContent /> : <SessionContent stats={sessionStats} />}
				</div>
			</div>
		</div>
	);
}

function HotkeysContent() {
	const { t } = useTranslation();
	return (
		<div className="space-y-5 text-sm">
			<section>
				<p className="font-medium text-xs uppercase tracking-wider text-muted mb-2">{t("hotkeys.inputSection")}</p>
				<table className="w-full">
					<tbody className="divide-y divide-separator">
						{(
							[
							["Enter", t("hotkeys.keys.enter")],
							["Shift+Enter", t("hotkeys.keys.shiftEnter")],
							["↑ / ↓", t("hotkeys.keys.arrowUpDown")],
							["Tab or Enter", t("hotkeys.keys.tabOrEnter")],
							["Escape", t("hotkeys.keys.escape")],
						] as [string, string][]
						).map(([key, desc]) => (
							<tr key={key}>
								<td className="py-1.5 pr-4 font-mono text-xs text-muted whitespace-nowrap">{key}</td>
								<td className="py-1.5 text-foreground">{desc}</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>
			<section>
				<p className="font-medium text-xs uppercase tracking-wider text-muted mb-2">{t("hotkeys.slashSection")}</p>
				<table className="w-full">
					<tbody className="divide-y divide-separator">
						{WEB_SLASH_COMMANDS.map(cmd => (
							<tr key={cmd.name}>
								<td className="py-1.5 pr-4 font-mono text-xs text-(--color-accent) whitespace-nowrap">
									/{cmd.name}
									{cmd.inlineHint ? ` ${cmd.inlineHint}` : ""}
								</td>
							<td className="py-1.5 text-foreground">{t(`slashCommands.descriptions.${cmd.name}`)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>
			<section>
				<p className="font-medium text-xs uppercase tracking-wider text-muted mb-2">
					{t("hotkeys.fileTagSection")}
				</p>
				<p className="text-muted">{t("hotkeys.fileTagHint")}</p>
			</section>
		</div>
	);
}

function SessionContent({ stats }: { stats?: SessionStats | null }) {
	const { t } = useTranslation();
	if (!stats) return <p className="text-muted text-sm">{t("sessionStats.loading")}</p>;
	return (
		<div className="space-y-4 text-sm">
			<section>
				<p className="font-medium text-xs uppercase tracking-wider text-muted mb-2">{t("sessionStats.messages")}</p>
				<table className="w-full">
					<tbody className="divide-y divide-separator">
						<tr>
							<td className="py-1.5 pr-4 text-muted">{t("sessionStats.user")}</td>
							<td className="py-1.5 tabular-nums">{stats.userMessages}</td>
						</tr>
						<tr>
							<td className="py-1.5 pr-4 text-muted">{t("sessionStats.assistant")}</td>
							<td className="py-1.5 tabular-nums">{stats.assistantMessages}</td>
						</tr>
						<tr>
							<td className="py-1.5 pr-4 text-muted">{t("sessionStats.toolCalls")}</td>
							<td className="py-1.5 tabular-nums">{stats.toolCalls}</td>
						</tr>
					</tbody>
				</table>
			</section>
			<section>
				<p className="font-medium text-xs uppercase tracking-wider text-muted mb-2">{t("sessionStats.tokens")}</p>
				<table className="w-full">
					<tbody className="divide-y divide-separator">
						<tr>
							<td className="py-1.5 pr-4 text-muted">{t("sessionStats.input")}</td>
							<td className="py-1.5 tabular-nums">{stats.tokens.input.toLocaleString()}</td>
						</tr>
						<tr>
							<td className="py-1.5 pr-4 text-muted">{t("sessionStats.output")}</td>
							<td className="py-1.5 tabular-nums">{stats.tokens.output.toLocaleString()}</td>
						</tr>
						<tr>
							<td className="py-1.5 pr-4 text-muted">{t("sessionStats.cacheRead")}</td>
							<td className="py-1.5 tabular-nums">{stats.tokens.cacheRead.toLocaleString()}</td>
						</tr>
						<tr>
							<td className="py-1.5 pr-4 text-muted">{t("sessionStats.cacheWrite")}</td>
							<td className="py-1.5 tabular-nums">{stats.tokens.cacheWrite.toLocaleString()}</td>
						</tr>
						<tr>
							<td className="py-1.5 pr-4 text-muted font-medium">{t("sessionStats.total")}</td>
							<td className="py-1.5 tabular-nums font-medium">{stats.tokens.total.toLocaleString()}</td>
						</tr>
					</tbody>
				</table>
			</section>
			<section>
				<p className="font-medium text-xs uppercase tracking-wider text-muted mb-2">{t("sessionStats.cost")}</p>
				<p className="tabular-nums">${stats.cost.toFixed(4)}</p>
			</section>
		</div>
	);
}
