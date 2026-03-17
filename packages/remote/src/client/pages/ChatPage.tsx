import { useEffect } from "react";
import { Header } from "../components/Header";
import { InfoModal } from "../components/InfoModal";
import { InputBar } from "../components/InputBar";
import { MessageList } from "../components/MessageList";
import { ModelSelectModal } from "../components/ModelSelectModal";
import { SessionPickerModal } from "../components/SessionPickerModal";
import { SettingsDrawer } from "../components/SettingsDrawer";
import { StatusOverlay } from "../components/StatusOverlay";
import { useWebSocket } from "../hooks/useWebsocket";
import { useUIStore } from "../stores/uiStore";

export function ChatPage() {
	const { sendCommand } = useWebSocket();
	const { sessionStatsOpen, modelSelectOpen, sessionPickerOpen } = useUIStore();

	// Fetch fresh stats whenever the session stats modal is opened
	useEffect(() => {
		if (sessionStatsOpen) {
			sendCommand({ type: "get_session_stats" });
		}
	}, [sessionStatsOpen, sendCommand]);

	// Fetch available models whenever the model select modal is opened
	useEffect(() => {
		if (modelSelectOpen) {
			sendCommand({ type: "get_available_models" });
		}
	}, [modelSelectOpen, sendCommand]);

	// Fetch fresh session list whenever the session picker is opened
	useEffect(() => {
		if (sessionPickerOpen) {
			sendCommand({ type: "list_sessions" });
		}
	}, [sessionPickerOpen, sendCommand]);

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
			<ModelSelectModal sendCommand={sendCommand} />
			<SessionPickerModal sendCommand={sendCommand} />
		</>
	);
}
