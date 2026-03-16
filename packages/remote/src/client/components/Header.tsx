import { Button, Chip, Tooltip } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { IoSettings } from "react-icons/io5";
import { useSessionStore } from "../stores/sessionStore";
import type { RpcCommand } from "../types";

interface HeaderProps {
	sendCommand: (cmd: RpcCommand) => void;
	onOpenSettings: () => void;
}

export function Header({ sendCommand, onOpenSettings }: HeaderProps) {
	const { t } = useTranslation();
	const {connected, sessionState, isStreaming, isCompacting} = useSessionStore();

	const modelName = sessionState?.model?.name ?? t("header.noModel");
	const thinkingLevel = sessionState?.thinkingLevel ?? "off";
	const sessionName = sessionState?.sessionName;

	return (
		<header className="flex items-center justify-between px-4 py-2 border-b border-divider bg-content1 shrink-0">
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2">
					<div className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-success" : "bg-danger"}`} />
					<span className="font-bold text-sm">{t("header.brand")}</span>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<Tooltip>
					<Tooltip.Trigger>
						<Button variant="ghost" size="sm" onPress={() => sendCommand({ type: "cycle_model" })}>
							{modelName}
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>{t("header.cycleModelTooltip")}</Tooltip.Content>
				</Tooltip>
				{thinkingLevel !== "off" && (
					<Chip
						size="sm"
						variant="soft"
						color="accent"
						className="cursor-pointer"
						onClick={() => sendCommand({ type: "cycle_thinking_level" })}
					>
						<Chip.Label>{t("header.thinking", { level: thinkingLevel })}</Chip.Label>
					</Chip>
				)}
				{isStreaming && (
					<Chip size="sm" color="accent" variant="soft">
						<Chip.Label>{t("header.streaming")}</Chip.Label>
					</Chip>
				)}
				{isCompacting && (
					<Chip size="sm" color="warning" variant="soft">
						<Chip.Label>{t("header.compacting")}</Chip.Label>
					</Chip>
				)}
			</div>

			<div className="flex items-center gap-2">
				{sessionName && <span className="text-sm text-default-500">{sessionName}</span>}
				<Button variant="ghost" size="sm" onPress={onOpenSettings} aria-label={t("header.settingsAriaLabel")}>
					<IoSettings />
				</Button>
			</div>
		</header>
	);
}
