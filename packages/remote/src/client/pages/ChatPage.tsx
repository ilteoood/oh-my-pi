import { useEffect } from "react";
import { Header } from "../components/Header";
import { InfoModal } from "../components/InfoModal";
import { InputBar } from "../components/InputBar";
import { MessageList } from "../components/MessageList";
import { SettingsDrawer } from "../components/SettingsDrawer";
import { StatusOverlay } from "../components/StatusOverlay";
import { useWebSocket } from "../hooks/useWebsocket";
import { useUIStore } from "../stores/uiStore";

export function ChatPage() {
	const { sendCommand } = useWebSocket();
	const { sessionStatsOpen } = useUIStore();

	// Fetch fresh stats whenever the session stats modal is opened
	useEffect(() => {
		if (sessionStatsOpen) {
			sendCommand({ type: "get_session_stats" });
		}
	}, [sessionStatsOpen, sendCommand]);

	return (
		<>
			<Header sendCommand={sendCommand} />
			<main className="flex-1 overflow-hidden relative">
				<MessageList />
				<StatusOverlay />
			</main>
			<InputBar sendCommand={sendCommand} />
			<SettingsDrawer sendCommand={sendCommand} />
			<InfoModal variant="hotkeys" />
			<InfoModal variant="session" />
		</>
	);
}
