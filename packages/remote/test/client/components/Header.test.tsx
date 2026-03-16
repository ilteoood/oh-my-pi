import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "../../../src/client/components/Header";
import { useSessionStore } from "../../../src/client/stores/sessionStore";
import { useUIStore } from "../../../src/client/stores/uiStore";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-icons/io5", () => ({ IoSettings: () => null }));

const baseSessionState = {
	model: null,
	thinkingLevel: "off" as const,
	sessionName: undefined,
	tools: [],
	cwd: "/",
};

beforeEach(() => {
	useSessionStore.setState({
		connected: false,
		sessionState: null,
		isStreaming: false,
		isCompacting: false,
	});
	useUIStore.setState({
		settingsOpen: false,
		hotkeysOpen: false,
		sessionStatsOpen: false,
		modelSelectOpen: false,
	});
});

describe("Header", () => {
	function renderHeader(sendCommand = vi.fn()) {
		return render(<Header sendCommand={sendCommand} />);
	}

	describe("connection indicator", () => {
		it("renders green dot when connected", () => {
			useSessionStore.setState({ connected: true });
			const { container } = renderHeader();
			expect(container.querySelector(".bg-success")).toBeTruthy();
			expect(container.querySelector(".bg-danger")).toBeNull();
		});

		it("renders danger dot when not connected", () => {
			useSessionStore.setState({ connected: false });
			const { container } = renderHeader();
			expect(container.querySelector(".bg-danger")).toBeTruthy();
			expect(container.querySelector(".bg-success")).toBeNull();
		});
	});

	describe("model name", () => {
		it("shows model name from sessionState", () => {
			useSessionStore.setState({
				sessionState: { ...baseSessionState, model: { provider: "a", id: "b", name: "Claude" } },
			});
			renderHeader();
			expect(screen.getByText("Claude")).toBeTruthy();
		});

		it("shows noModel key when model is absent", () => {
			useSessionStore.setState({ sessionState: null });
			renderHeader();
			expect(screen.getByText("header.noModel")).toBeTruthy();
		});
	});

	describe("thinking level chip", () => {
		it("shows chip when thinkingLevel is not off", () => {
			useSessionStore.setState({
				sessionState: { ...baseSessionState, thinkingLevel: "medium" },
			});
			renderHeader();
			expect(screen.getByText("header.thinking")).toBeTruthy();
		});

		it("hides chip when thinkingLevel is off", () => {
			useSessionStore.setState({
				sessionState: { ...baseSessionState, thinkingLevel: "off" },
			});
			renderHeader();
			expect(screen.queryByText("header.thinking")).toBeNull();
		});

		it("sends cycle_thinking_level command when chip is clicked", () => {
			useSessionStore.setState({
				sessionState: { ...baseSessionState, thinkingLevel: "medium" },
			});
			const sendCommand = vi.fn();
			renderHeader(sendCommand);
			// Chip.Label text is nested inside the Chip span which has onClick
			fireEvent.click(screen.getByText("header.thinking"));
			expect(sendCommand).toHaveBeenCalledWith({ type: "cycle_thinking_level" });
		});
	});

	describe("streaming chip", () => {
		it("shows streaming chip when isStreaming is true", () => {
			useSessionStore.setState({ isStreaming: true });
			renderHeader();
			expect(screen.getByText("header.streaming")).toBeTruthy();
		});

		it("hides streaming chip when isStreaming is false", () => {
			useSessionStore.setState({ isStreaming: false });
			renderHeader();
			expect(screen.queryByText("header.streaming")).toBeNull();
		});
	});

	describe("compacting chip", () => {
		it("shows compacting chip when isCompacting is true", () => {
			useSessionStore.setState({ isCompacting: true });
			renderHeader();
			expect(screen.getByText("header.compacting")).toBeTruthy();
		});

		it("hides compacting chip when isCompacting is false", () => {
			useSessionStore.setState({ isCompacting: false });
			renderHeader();
			expect(screen.queryByText("header.compacting")).toBeNull();
		});
	});

	describe("session name", () => {
		it("displays sessionName when set", () => {
			useSessionStore.setState({
				sessionState: { ...baseSessionState, sessionName: "my-session" },
			});
			renderHeader();
			expect(screen.getByText("my-session")).toBeTruthy();
		});

		it("hides session name when absent", () => {
			useSessionStore.setState({ sessionState: null });
			renderHeader();
			expect(screen.queryByText("my-session")).toBeNull();
		});
	});

	describe("settings button", () => {
		it("calls openSettings from uiStore on press", () => {
			const openSettings = vi.fn();
			useUIStore.setState({ openSettings });
			renderHeader();
			fireEvent.click(screen.getByRole("button", { name: "header.settingsAriaLabel" }));
			expect(openSettings).toHaveBeenCalledOnce();
		});
	});

	describe("model select button", () => {
		it("calls openModelSelect on press", () => {
			const openModelSelect = vi.fn();
			useUIStore.setState({ openModelSelect });
			useSessionStore.setState({
				sessionState: { ...baseSessionState, model: { provider: "a", id: "b", name: "Claude" } },
			});
			renderHeader();
			const claudeButtons = screen.getAllByRole("button", { name: "Claude" });
			const modelButton = claudeButtons.find(el => el.tagName === "BUTTON")!;
			fireEvent.click(modelButton);
			expect(openModelSelect).toHaveBeenCalledOnce();
		});
	});
});
