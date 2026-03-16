import { Route, Routes } from "react-router";
import { useWebSocket } from "./hooks/useWebsocket";
import { ChatPage } from "./pages/ChatPage";

export function App() {
	const { sendCommand } = useWebSocket();

	return (
		<div className="h-dvh flex flex-col bg-background text-foreground">
			<Routes>
				<Route path="*" element={<ChatPage sendCommand={sendCommand} />} />
			</Routes>
		</div>
	);
}
