import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModelSelectModal } from "../../../src/client/components/ModelSelectModal";
import { useUIStore } from "../../../src/client/stores/uiStore";
import { useSessionStore } from "../../../src/client/stores/sessionStore";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-icons/io5", () => ({
	IoCheckmarkCircle: () => null,
	IoClose: () => null,
}));

const MODELS = [
	{ provider: "anthropic", id: "claude-3-5", name: "Claude 3.5" },
	{ provider: "anthropic", id: "claude-3", name: "Claude 3" },
	{ provider: "openai", id: "gpt-4", name: "GPT-4" },
];

describe("ModelSelectModal", () => {
	let sendCommand: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		sendCommand = vi.fn();
		useUIStore.setState({ modelSelectOpen: false });
		useSessionStore.setState({ availableModels: [], sessionState: null });
	});

	it("renders null when modelSelectOpen=false", () => {
		const { container } = render(<ModelSelectModal sendCommand={sendCommand} />);
		expect(container.firstChild).toBeNull();
	});

	it("shows noModels message when modelSelectOpen=true and models list is empty", () => {
		useUIStore.setState({ modelSelectOpen: true });
		render(<ModelSelectModal sendCommand={sendCommand} />);
		expect(screen.getByText("modelSelect.noModels")).toBeInTheDocument();
	});

	it("groups models by provider and shows names when modelSelectOpen=true", () => {
		useUIStore.setState({ modelSelectOpen: true });
		useSessionStore.setState({ availableModels: MODELS });
		render(<ModelSelectModal sendCommand={sendCommand} />);

		// Provider headers
		expect(screen.getByText("anthropic")).toBeInTheDocument();
		expect(screen.getByText("openai")).toBeInTheDocument();

		// Model names
		expect(screen.getByText("Claude 3.5")).toBeInTheDocument();
		expect(screen.getByText("Claude 3")).toBeInTheDocument();
		expect(screen.getByText("GPT-4")).toBeInTheDocument();
	});

	it("clicking a model calls sendCommand with set_model and closes the modal", () => {
		useUIStore.setState({ modelSelectOpen: true });
		useSessionStore.setState({ availableModels: MODELS });
		render(<ModelSelectModal sendCommand={sendCommand} />);

		fireEvent.click(screen.getByText("Claude 3"));
		expect(sendCommand).toHaveBeenCalledWith({
			type: "set_model",
			provider: "anthropic",
			modelId: "claude-3",
		});
		expect(useUIStore.getState().modelSelectOpen).toBe(false);
	});

	it("Escape key closes modal", () => {
		useUIStore.setState({ modelSelectOpen: true });
		useSessionStore.setState({ availableModels: MODELS });
		render(<ModelSelectModal sendCommand={sendCommand} />);

		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		expect(useUIStore.getState().modelSelectOpen).toBe(false);
	});

	it("clicking the backdrop closes modal", () => {
		useUIStore.setState({ modelSelectOpen: true });
		useSessionStore.setState({ availableModels: MODELS });
		render(<ModelSelectModal sendCommand={sendCommand} />);

		// Backdrop has role="presentation"
		fireEvent.click(screen.getByRole("presentation"));
		expect(useUIStore.getState().modelSelectOpen).toBe(false);
	});

	it("close button closes modal", () => {
		useUIStore.setState({ modelSelectOpen: true });
		useSessionStore.setState({ availableModels: MODELS });
		render(<ModelSelectModal sendCommand={sendCommand} />);

		fireEvent.click(screen.getByLabelText("Close"));
		expect(useUIStore.getState().modelSelectOpen).toBe(false);
	});

	it("currently selected model button is visually distinguished", () => {
		useUIStore.setState({ modelSelectOpen: true });
		useSessionStore.setState({
			availableModels: MODELS,
			sessionState: {
				model: { provider: "anthropic", id: "claude-3-5", name: "Claude 3.5" },
				thinkingLevel: "off",
				isStreaming: false,
				isCompacting: false,
				steeringMode: "all",
				followUpMode: "all",
				interruptMode: "immediate",
				sessionFile: undefined,
				sessionId: "sid",
				sessionName: "Test",
				autoCompactionEnabled: true,
				messageCount: 0,
				queuedMessageCount: 0,
				planModeEnabled: false,
				fastModeEnabled: false,
			},
		});
		render(<ModelSelectModal sendCommand={sendCommand} />);

		// The selected model's button gets an extra class not present on others
		const selectedBtn = screen.getByText("Claude 3.5").closest("button");
		const unselectedBtn = screen.getByText("Claude 3").closest("button");

		expect(selectedBtn?.className).toContain("bg-default");
		// Unselected has hover style only, not the selected bg
		expect(unselectedBtn?.className).not.toContain("text-(--color-accent)");
	});
});
