import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "../../../src/client/pages/ChatPage";
import { useWebSocket } from "../../../src/client/hooks/useWebsocket";
import { useSessionStore } from "../../../src/client/stores/sessionStore";
import { useUIStore } from "../../../src/client/stores/uiStore";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

vi.mock("../../../src/client/hooks/useWebsocket", () => ({
	useWebSocket: vi.fn(),
}));
vi.mock("../../../src/client/components/Header", () => ({ Header: () => <div data-testid="header" /> }));
vi.mock("../../../src/client/components/InputBar", () => ({ InputBar: () => <div data-testid="input-bar" /> }));
vi.mock("../../../src/client/components/MessageList", () => ({ MessageList: () => <div data-testid="message-list" /> }));
vi.mock("../../../src/client/components/StatusOverlay", () => ({ StatusOverlay: () => null }));
vi.mock("../../../src/client/components/SettingsDrawer", () => ({ SettingsDrawer: () => null }));
vi.mock("../../../src/client/components/InfoModal", () => ({ InfoModal: () => null }));
vi.mock("../../../src/client/components/ModelSelectModal", () => ({ ModelSelectModal: () => null }));

const mockSendCommand = vi.fn();

beforeEach(() => {
	mockSendCommand.mockReset();
	vi.mocked(useWebSocket).mockReturnValue({ sendCommand: mockSendCommand });
	useUIStore.setState({ sessionStatsOpen: false, modelSelectOpen: false });
	useSessionStore.setState({ connected: false });
});

describe("ChatPage", () => {
	it("renders without crashing — snapshot", () => {
		const { container } = render(<ChatPage />);
		expect(container.firstChild).toMatchSnapshot();
	});

	it("renders header, input bar, and message list", () => {
		render(<ChatPage />);
		expect(screen.getByTestId("header")).toBeInTheDocument();
		expect(screen.getByTestId("input-bar")).toBeInTheDocument();
		expect(screen.getByTestId("message-list")).toBeInTheDocument();
	});

	it("calls sendCommand with get_session_stats when sessionStatsOpen becomes true", () => {
		render(<ChatPage />);
		act(() => {
			useUIStore.setState({ sessionStatsOpen: true });
		});
		expect(mockSendCommand).toHaveBeenCalledWith({ type: "get_session_stats" });
	});

	it("calls sendCommand with get_available_models when modelSelectOpen becomes true", () => {
		render(<ChatPage />);
		act(() => {
			useUIStore.setState({ modelSelectOpen: true });
		});
		expect(mockSendCommand).toHaveBeenCalledWith({ type: "get_available_models" });
	});
});
