import {
	Button,
	Drawer,
	type Key,
	ListBox,
	ListBoxItem,
	Select,
	Separator,
	Switch,
	useOverlayState,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import type { RpcCommand, ThinkingLevel } from "../types";

interface SettingsDrawerProps {
	sendCommand: (cmd: RpcCommand) => void;
}

const THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];

export function SettingsDrawer({ sendCommand }: SettingsDrawerProps) {
	const { t } = useTranslation();
	const { settingsOpen, closeSettings } = useUIStore();
	const sessionState = useSessionStore(s => s.sessionState);
	const [sessionName, setSessionName] = useState("");

	const state = useOverlayState({
		isOpen: settingsOpen,
		onOpenChange: isOpen => {
			if (!isOpen) closeSettings();
		},
	});

	if (!sessionState) return null;

	const handleRenameSession = () => {
		const name = sessionName.trim();
		if (name) {
			sendCommand({ type: "set_session_name", name });
			setSessionName("");
		}
	};

	return (
		<Drawer state={state}>
			<Drawer.Backdrop>
				<Drawer.Content placement="right">
					<Drawer.Dialog>
						<Drawer.Header>
							<Drawer.Heading>{t("settings.title")}</Drawer.Heading>
						</Drawer.Header>
						<Drawer.Body>
							<div className="space-y-6">
								{/* Thinking Level */}
								<div>
									<p className="text-sm font-medium mb-2">{t("settings.thinkingLevel")}</p>
									<Select
										value={sessionState.thinkingLevel ?? "off"}
										onChange={(key: Key | null) => {
											if (key) sendCommand({ type: "set_thinking_level", level: key as ThinkingLevel });
										}}
										aria-label={t("settings.thinkingLevel")}
									>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												{THINKING_LEVELS.map(level => (
													<ListBoxItem key={level} id={level}>
														{level}
													</ListBoxItem>
												))}
											</ListBox>
										</Select.Popover>
									</Select>
								</div>

								<Separator />

								{/* Toggles */}
								<div className="space-y-3">
									<Switch
										isSelected={sessionState.autoCompactionEnabled}
										onChange={(v: boolean) => sendCommand({ type: "set_auto_compaction", enabled: v })}
									>
										<Switch.Control>
											<Switch.Thumb />
										</Switch.Control>
										<Switch.Content>{t("settings.autoCompaction")}</Switch.Content>
									</Switch>
								</div>

								<Separator />

								{/* Queue Modes */}
								<div>
									<p className="text-sm font-medium mb-2">{t("settings.steeringMode")}</p>
									<Select
										value={sessionState.steeringMode}
										onChange={(key: Key | null) => {
											if (key)
												sendCommand({ type: "set_steering_mode", mode: key as "all" | "one-at-a-time" });
										}}
										aria-label={t("settings.steeringMode")}
									>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												<ListBoxItem id="all">{t("settings.allAtOnce")}</ListBoxItem>
												<ListBoxItem id="one-at-a-time">{t("settings.oneAtATime")}</ListBoxItem>
											</ListBox>
										</Select.Popover>
									</Select>
								</div>

								<div>
									<p className="text-sm font-medium mb-2">{t("settings.followUpMode")}</p>
									<Select
										value={sessionState.followUpMode}
										onChange={(key: Key | null) => {
											if (key)
												sendCommand({ type: "set_follow_up_mode", mode: key as "all" | "one-at-a-time" });
										}}
										aria-label={t("settings.followUpMode")}
									>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												<ListBoxItem id="all">{t("settings.allAtOnce")}</ListBoxItem>
												<ListBoxItem id="one-at-a-time">{t("settings.oneAtATime")}</ListBoxItem>
											</ListBox>
										</Select.Popover>
									</Select>
								</div>

								<div>
									<p className="text-sm font-medium mb-2">{t("settings.interruptMode")}</p>
									<Select
										value={sessionState.interruptMode}
										onChange={(key: Key | null) => {
											if (key)
												sendCommand({ type: "set_interrupt_mode", mode: key as "immediate" | "wait" });
										}}
										aria-label={t("settings.interruptMode")}
									>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												<ListBoxItem id="immediate">{t("settings.immediate")}</ListBoxItem>
												<ListBoxItem id="wait">{t("settings.waitForTurnEnd")}</ListBoxItem>
											</ListBox>
										</Select.Popover>
									</Select>
								</div>

								<Separator />

								{/* Session Actions */}
								<div>
									<p className="text-sm font-medium mb-2">{t("settings.session")}</p>
									<div className="space-y-2">
										<div className="flex gap-2">
											<input
												type="text"
												className="flex-1 rounded-lg border border-[var(--color-border)] bg-default px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
												placeholder={sessionState.sessionName ?? t("settings.sessionNamePlaceholder")}
												value={sessionName}
												onChange={e => setSessionName(e.target.value)}
												onKeyDown={e => {
													if (e.key === "Enter") handleRenameSession();
												}}
											/>
											<Button size="sm" variant="outline" onPress={handleRenameSession}>
												{t("settings.rename")}
											</Button>
										</div>
										<div className="flex gap-2">
											<Button size="sm" variant="outline" onPress={() => sendCommand({ type: "compact" })}>
												{t("settings.compact")}
											</Button>
											<Button
												size="sm"
												variant="outline"
												onPress={() => sendCommand({ type: "new_session" })}
											>
												{t("settings.newSession")}
											</Button>
										</div>
									</div>
								</div>

								<Separator />

								{/* Info */}
								<div className="text-xs text-muted space-y-1">
									<p>{t("settings.sessionId", { id: sessionState.sessionId })}</p>
									<p>{t("settings.messages", { count: sessionState.messageCount })}</p>
									{sessionState.queuedMessageCount > 0 && (
										<p>{t("settings.queued", { count: sessionState.queuedMessageCount })}</p>
									)}
								</div>
							</div>
						</Drawer.Body>
					</Drawer.Dialog>
				</Drawer.Content>
			</Drawer.Backdrop>
		</Drawer>
	);
}
