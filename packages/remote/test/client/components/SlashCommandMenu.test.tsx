import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlashCommandMenu } from "../../../src/client/components/SlashCommandMenu";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const items = [
	{ name: "new", description: "Start a new session" },
	{ name: "compact", description: "Compact conversation" },
];

const defaultProps = {
	items,
	selectedIndex: 0,
	onSelect: vi.fn(),
	onChangeSelectedIndex: vi.fn(),
};

beforeEach(() => {
	defaultProps.onSelect = vi.fn();
	defaultProps.onChangeSelectedIndex = vi.fn();
});

describe("SlashCommandMenu", () => {
	it("returns null when items is empty", () => {
		const { container } = render(
			<SlashCommandMenu {...defaultProps} items={[]} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders all items", () => {
		render(<SlashCommandMenu {...defaultProps} />);
		expect(screen.getAllByRole("option")).toHaveLength(items.length);
	});

	it("highlights the selected item via aria-selected", () => {
		render(<SlashCommandMenu {...defaultProps} selectedIndex={1} />);
		const options = screen.getAllByRole("option");
		expect(options[0]).toHaveAttribute("aria-selected", "false");
		expect(options[1]).toHaveAttribute("aria-selected", "true");
	});

	it("calls onChangeSelectedIndex with the correct index on mouse enter", () => {
		const onChangeSelectedIndex = vi.fn();
		render(<SlashCommandMenu {...defaultProps} onChangeSelectedIndex={onChangeSelectedIndex} />);
		const options = screen.getAllByRole("option");
		fireEvent.mouseEnter(options[1]);
		expect(onChangeSelectedIndex).toHaveBeenCalledWith(1);
	});

	it("calls onSelect with the correct index and prevents default on mouse down", () => {
		const onSelect = vi.fn();
		render(<SlashCommandMenu {...defaultProps} onSelect={onSelect} />);
		const options = screen.getAllByRole("option");
		const event = fireEvent.mouseDown(options[0]);
		expect(onSelect).toHaveBeenCalledWith(0);
		// fireEvent returns false when preventDefault() was called by the handler
		expect(event).toBe(false);
	});

	describe("item label formatting", () => {
		it("prefixes item name with / when isSubcommand is false", () => {
			render(<SlashCommandMenu {...defaultProps} isSubcommand={false} />);
			expect(screen.getByText("/new")).toBeTruthy();
			expect(screen.getByText("/compact")).toBeTruthy();
		});

		it("shows item name without / when isSubcommand is true", () => {
			render(<SlashCommandMenu {...defaultProps} isSubcommand={true} />);
			expect(screen.getByText("new")).toBeTruthy();
			expect(screen.getByText("compact")).toBeTruthy();
		});
	});

	describe("description", () => {
		it("shows description using the descriptions i18n key when not a subcommand", () => {
			render(<SlashCommandMenu {...defaultProps} isSubcommand={false} />);
			// t() mock returns the key; the key for 'new' description is:
			expect(screen.getByText("slashCommands.descriptions.new")).toBeTruthy();
		});

		it("uses parentCommand in i18n key when isSubcommand is true", () => {
			render(
				<SlashCommandMenu {...defaultProps} isSubcommand={true} parentCommand="session" />,
			);
			expect(screen.getByText("slashCommands.subcommands.session.new")).toBeTruthy();
		});

		it("hides description span when description is absent", () => {
			const noDescItems = [{ name: "bare" }];
			render(<SlashCommandMenu {...defaultProps} items={noDescItems as typeof items} />);
			// Only the name label is present; no description text
			expect(screen.getByText("/bare")).toBeTruthy();
			expect(screen.queryByText(/slashCommands\.descriptions/)).toBeNull();
		});
	});

	describe("scrollIntoView", () => {
		it("calls scrollIntoView on the selected element when selectedIndex changes", () => {
			const scrollIntoView = vi.fn();
			window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

			const { rerender } = render(<SlashCommandMenu {...defaultProps} selectedIndex={0} />);
			// Initial render triggers the effect for index 0
			const callsBefore = scrollIntoView.mock.calls.length;

			rerender(
				<SlashCommandMenu
					{...defaultProps}
					selectedIndex={1}
				/>,
			);
			// Effect re-runs because selectedIndex changed
			expect(scrollIntoView.mock.calls.length).toBeGreaterThan(callsBefore);
		});
	});
});
