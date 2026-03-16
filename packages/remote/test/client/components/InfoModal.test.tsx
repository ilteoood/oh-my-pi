import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InfoModal } from "../../../src/client/components/InfoModal";
import { useUIStore } from "../../../src/client/stores/uiStore";
import { useSessionStore } from "../../../src/client/stores/sessionStore";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-icons/io5", () => ({ IoClose: () => null }));
vi.mock("../../../src/client/slashCommands", () => ({
	WEB_SLASH_COMMANDS: [{ name: "new", description: "new-desc" }],
}));

describe("InfoModal", () => {
	beforeEach(() => {
		useUIStore.setState({ hotkeysOpen: false, sessionStatsOpen: false });
		useSessionStore.setState({ sessionStats: null });
	});

	describe("variant=hotkeys", () => {
		it("renders null when hotkeysOpen=false", () => {
			const { container } = render(<InfoModal variant="hotkeys" />);
			expect(container.firstChild).toBeNull();
		});

		it("renders dialog when hotkeysOpen=true", () => {
			useUIStore.setState({ hotkeysOpen: true });
			render(<InfoModal variant="hotkeys" />);
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});

		it("renders slash commands in hotkeys table", () => {
			useUIStore.setState({ hotkeysOpen: true });
			render(<InfoModal variant="hotkeys" />);
			// The slash command name is rendered as "/new" in the table cell
			expect(screen.getByText("/new")).toBeInTheDocument();
		});

		it("clicking close button calls closeHotkeys", () => {
			useUIStore.setState({ hotkeysOpen: true });
			render(<InfoModal variant="hotkeys" />);
			fireEvent.click(screen.getByLabelText("Close"));
			expect(useUIStore.getState().hotkeysOpen).toBe(false);
		});

		it("Escape key closes modal", () => {
			useUIStore.setState({ hotkeysOpen: true });
			render(<InfoModal variant="hotkeys" />);
			fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
			expect(useUIStore.getState().hotkeysOpen).toBe(false);
		});

		it("clicking backdrop (dialog root) closes modal", () => {
			useUIStore.setState({ hotkeysOpen: true });
			render(<InfoModal variant="hotkeys" />);
			// Click directly on the dialog div (not a child) so target === currentTarget
			fireEvent.click(screen.getByRole("dialog"));
			expect(useUIStore.getState().hotkeysOpen).toBe(false);
		});
	});

	describe("variant=session", () => {
		it("renders null when sessionStatsOpen=false", () => {
			const { container } = render(<InfoModal variant="session" />);
			expect(container.firstChild).toBeNull();
		});

		it("shows loading message when sessionStatsOpen=true but stats are null", () => {
			useUIStore.setState({ sessionStatsOpen: true });
			render(<InfoModal variant="session" />);
			expect(screen.getByText("sessionStats.loading")).toBeInTheDocument();
		});

		it("shows message counts, token counts, and cost when stats are present", () => {
			useUIStore.setState({ sessionStatsOpen: true });
			useSessionStore.setState({
				sessionStats: {
					sessionId: "test",
					userMessages: 5,
					assistantMessages: 3,
					toolCalls: 10,
					toolResults: 10,
					totalMessages: 18,
					tokens: { input: 1000, output: 500, cacheRead: 200, cacheWrite: 100, total: 1800 },
					premiumRequests: 0,
					cost: 0.05,
					sessionFile: undefined,
				},
			});
			render(<InfoModal variant="session" />);

			// Message counts (translation keys are labels; raw numbers are cell values)
			expect(screen.getByText("sessionStats.user")).toBeInTheDocument();
			expect(screen.getByText("5")).toBeInTheDocument();
			expect(screen.getByText("sessionStats.assistant")).toBeInTheDocument();
			expect(screen.getByText("3")).toBeInTheDocument();
			expect(screen.getByText("sessionStats.toolCalls")).toBeInTheDocument();

			// Cost — rendered as `$${cost.toFixed(4)}` — deterministic, no locale dependency
			expect(screen.getByText("$0.0500")).toBeInTheDocument();

			// Token section label present
			expect(screen.getByText("sessionStats.tokens")).toBeInTheDocument();
		});

		it("close button closes session stats modal", () => {
			useUIStore.setState({ sessionStatsOpen: true });
			render(<InfoModal variant="session" />);
			fireEvent.click(screen.getByLabelText("Close"));
			expect(useUIStore.getState().sessionStatsOpen).toBe(false);
		});

		it("Escape key closes session stats modal", () => {
			useUIStore.setState({ sessionStatsOpen: true });
			render(<InfoModal variant="session" />);
			fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
			expect(useUIStore.getState().sessionStatsOpen).toBe(false);
		});

		it("clicking backdrop closes session stats modal", () => {
			useUIStore.setState({ sessionStatsOpen: true });
			render(<InfoModal variant="session" />);
			fireEvent.click(screen.getByRole("dialog"));
			expect(useUIStore.getState().sessionStatsOpen).toBe(false);
		});
	});
});
