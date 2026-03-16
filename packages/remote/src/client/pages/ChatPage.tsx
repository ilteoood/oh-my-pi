import { useBoolean } from 'usehooks-ts';
import { Header } from "../components/Header";
import { InputBar } from "../components/InputBar";
import { MessageList } from "../components/MessageList";
import { SettingsDrawer } from "../components/SettingsDrawer";
import { StatusOverlay } from "../components/StatusOverlay";
import type { RpcCommand } from "../types";

interface ChatPageProps {
	sendCommand: (cmd: RpcCommand) => void;
}

export function ChatPage({ sendCommand }: ChatPageProps) {
	const {value: settingsOpen, setTrue: openSettings, setFalse: closeSettings} = useBoolean(false);

	return (
		<>
			<Header sendCommand={sendCommand} onOpenSettings={openSettings} />
			<main className="flex-1 overflow-hidden relative">
				<MessageList />
				<StatusOverlay />
			</main>
			<InputBar sendCommand={sendCommand} />
			<SettingsDrawer open={settingsOpen} onClose={closeSettings} sendCommand={sendCommand} />
		</>
	);
}
