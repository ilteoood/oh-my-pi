import { useCallback } from "react";
import { useBoolean } from "usehooks-ts";
import { Header } from "../components/Header";
import { InfoModal } from "../components/InfoModal";
import { InputBar } from "../components/InputBar";
import { MessageList } from "../components/MessageList";
import { SettingsDrawer } from "../components/SettingsDrawer";
import { StatusOverlay } from "../components/StatusOverlay";
import { useSessionStore } from "../stores/sessionStore";
import type { RpcCommand } from "../types";

interface ChatPageProps {
	sendCommand: (cmd: RpcCommand) => void;
}

export function ChatPage({ sendCommand }: ChatPageProps) {
	const { value: settingsOpen, setTrue: openSettings, setFalse: closeSettings } = useBoolean(false);
	const { value: hotkeysOpen, setTrue: openHotkeys, setFalse: closeHotkeys } = useBoolean(false);
	const { value: sessionStatsOpen, setTrue: openSessionStats, setFalse: closeSessionStats } = useBoolean(false);

	const sessionStats = useSessionStore(s => s.sessionStats);

	// Fetch fresh stats whenever the session stats modal is opened
	const handleShowSessionStats = useCallback(() => {
		sendCommand({ type: "get_session_stats" });
		openSessionStats();
	}, [sendCommand, openSessionStats]);

	return (
		<>
			<Header sendCommand={sendCommand} onOpenSettings={openSettings} />
			<main className="flex-1 overflow-hidden relative">
				<MessageList />
				<StatusOverlay />
			</main>
			<InputBar
				sendCommand={sendCommand}
				onOpenSettings={openSettings}
				onShowHotkeys={openHotkeys}
				onShowSessionStats={handleShowSessionStats}
			/>
			<SettingsDrawer open={settingsOpen} onClose={closeSettings} sendCommand={sendCommand} />
			<InfoModal variant="hotkeys" open={hotkeysOpen} onClose={closeHotkeys} />
			<InfoModal variant="session" open={sessionStatsOpen} onClose={closeSessionStats} sessionStats={sessionStats} />
		</>
	);
}
