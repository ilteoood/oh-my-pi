import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDrawer } from "../../../src/client/components/SettingsDrawer";
import { useSessionStore } from "../../../src/client/stores/sessionStore";
import { useUIStore } from "../../../src/client/stores/uiStore";


vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

// Baseline session state used across most tests
const baseSessionState = {
	model: { provider: "a", id: "b", name: "Model" },
	thinkingLevel: "off" as const,
	isStreaming: false,
	isCompacting: false,
	steeringMode: "all" as const,
	followUpMode: "all" as const,
	interruptMode: "immediate" as const,
	sessionFile: undefined,
	sessionId: "sid",
	sessionName: "My Session",
	autoCompactionEnabled: true,
	messageCount: 5,
	queuedMessageCount: 0,
	planModeEnabled: false,
	fastModeEnabled: false,
};

describe("SettingsDrawer", () => {
	let sendCommand: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		sendCommand = vi.fn();
		useUIStore.setState({ settingsOpen: true });
		useSessionStore.setState({ sessionState: null });
	});

	it("renders null when sessionState is null", () => {
		const { container } = render(<SettingsDrawer sendCommand={sendCommand} />);
		expect(container.firstChild).toBeNull();
	});

	it("renders drawer content when sessionState is set", () => {
		useSessionStore.setState({ sessionState: baseSessionState });
		render(<SettingsDrawer sendCommand={sendCommand} />);
		// The drawer heading is always present when session state exists
		expect(screen.getByText("settings.title")).toBeInTheDocument();
	});

	describe("thinking level select", () => {
		it("shows the current thinking level as the selected value", () => {
			useSessionStore.setState({ sessionState: { ...baseSessionState, thinkingLevel: "off" } });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const select = screen.getByRole("combobox", { name: "settings.thinkingLevel" });
			expect((select as HTMLSelectElement).value).toBe("off");
		});

		it("sends set_thinking_level command when value changes", () => {
			useSessionStore.setState({ sessionState: baseSessionState });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const select = screen.getByRole("combobox", { name: "settings.thinkingLevel" });
			fireEvent.change(select, { target: { value: "minimal" } });
			expect(sendCommand).toHaveBeenCalledWith({ type: "set_thinking_level", level: "minimal" });
		});
	});

	describe("auto-compaction switch", () => {
		it("reflects the current autoCompactionEnabled state", () => {
			useSessionStore.setState({ sessionState: { ...baseSessionState, autoCompactionEnabled: true } });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			// Switch mock wraps in <label> with <input type="checkbox">; label text is Switch.Content child
			const checkbox = screen.getByLabelText("settings.autoCompaction") as HTMLInputElement;
			expect(checkbox.checked).toBe(true);
		});

		it("sends set_auto_compaction when toggled", () => {
			useSessionStore.setState({ sessionState: { ...baseSessionState, autoCompactionEnabled: true } });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const checkbox = screen.getByLabelText("settings.autoCompaction");
			fireEvent.click(checkbox);
			expect(sendCommand).toHaveBeenCalledWith({ type: "set_auto_compaction", enabled: false });
		});
	});

	describe("steering mode select", () => {
		it("reflects the current steeringMode", () => {
			useSessionStore.setState({ sessionState: { ...baseSessionState, steeringMode: "all" } });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const select = screen.getByRole("combobox", { name: "settings.steeringMode" });
			expect((select as HTMLSelectElement).value).toBe("all");
		});

		it("sends set_steering_mode when changed", () => {
			useSessionStore.setState({ sessionState: baseSessionState });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const select = screen.getByRole("combobox", { name: "settings.steeringMode" });
			fireEvent.change(select, { target: { value: "one-at-a-time" } });
			expect(sendCommand).toHaveBeenCalledWith({ type: "set_steering_mode", mode: "one-at-a-time" });
		});
	});

	describe("follow-up mode select", () => {
		it("reflects the current followUpMode", () => {
			useSessionStore.setState({ sessionState: { ...baseSessionState, followUpMode: "all" } });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const select = screen.getByRole("combobox", { name: "settings.followUpMode" });
			expect((select as HTMLSelectElement).value).toBe("all");
		});

		it("sends set_follow_up_mode when changed", () => {
			useSessionStore.setState({ sessionState: baseSessionState });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const select = screen.getByRole("combobox", { name: "settings.followUpMode" });
			fireEvent.change(select, { target: { value: "one-at-a-time" } });
			expect(sendCommand).toHaveBeenCalledWith({ type: "set_follow_up_mode", mode: "one-at-a-time" });
		});
	});

	describe("interrupt mode select", () => {
		it("reflects the current interruptMode", () => {
			useSessionStore.setState({ sessionState: { ...baseSessionState, interruptMode: "immediate" } });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const select = screen.getByRole("combobox", { name: "settings.interruptMode" });
			expect((select as HTMLSelectElement).value).toBe("immediate");
		});

		it("sends set_interrupt_mode when changed", () => {
			useSessionStore.setState({ sessionState: baseSessionState });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const select = screen.getByRole("combobox", { name: "settings.interruptMode" });
			fireEvent.change(select, { target: { value: "wait" } });
			expect(sendCommand).toHaveBeenCalledWith({ type: "set_interrupt_mode", mode: "wait" });
		});
	});

	describe("rename session", () => {
		it("sends set_session_name when Enter is pressed in the name input", () => {
			useSessionStore.setState({ sessionState: baseSessionState });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const input = screen.getByRole("textbox");
			fireEvent.change(input, { target: { value: "New Name" } });
			fireEvent.keyDown(input, { key: "Enter" });
			expect(sendCommand).toHaveBeenCalledWith({ type: "set_session_name", name: "New Name" });
		});

		it("does not send command if name is blank", () => {
			useSessionStore.setState({ sessionState: baseSessionState });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const input = screen.getByRole("textbox");
			fireEvent.keyDown(input, { key: "Enter" });
			expect(sendCommand).not.toHaveBeenCalled();
		});

		it("sends set_session_name when rename button is pressed", () => {
			useSessionStore.setState({ sessionState: baseSessionState });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			const input = screen.getByRole("textbox");
			fireEvent.change(input, { target: { value: "Renamed" } });
			fireEvent.click(screen.getByRole("button", { name: "settings.rename" }));
			expect(sendCommand).toHaveBeenCalledWith({ type: "set_session_name", name: "Renamed" });
		});
	});

	describe("session action buttons", () => {
		it("compact button sends compact command", () => {
			useSessionStore.setState({ sessionState: baseSessionState });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			fireEvent.click(screen.getByRole("button", { name: "settings.compact" }));
			expect(sendCommand).toHaveBeenCalledWith({ type: "compact" });
		});

		it("new session button sends new_session command", () => {
			useSessionStore.setState({ sessionState: baseSessionState });
			render(<SettingsDrawer sendCommand={sendCommand} />);

			fireEvent.click(screen.getByRole("button", { name: "settings.newSession" }));
			expect(sendCommand).toHaveBeenCalledWith({ type: "new_session" });
		});
	});

	describe("queued message count", () => {
		it("shows queued count when queuedMessageCount > 0", () => {
			useSessionStore.setState({
				sessionState: { ...baseSessionState, queuedMessageCount: 3 },
			});
			render(<SettingsDrawer sendCommand={sendCommand} />);
			expect(screen.getByText("settings.queued")).toBeInTheDocument();
		});

		it("does not show queued count when queuedMessageCount = 0", () => {
			useSessionStore.setState({
				sessionState: { ...baseSessionState, queuedMessageCount: 0 },
			});
			render(<SettingsDrawer sendCommand={sendCommand} />);
			expect(screen.queryByText("settings.queued")).toBeNull();
		});
	});
});
