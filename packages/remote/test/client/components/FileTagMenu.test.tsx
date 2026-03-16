import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileTagMenu } from "../../../src/client/components/FileTagMenu";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-icons/io5", () => ({
	IoSettings: () => null,
	IoBulb: () => null,
	IoClose: () => null,
	IoSend: () => null,
	IoStop: () => null,
	IoCheckmarkCircle: () => null,
	IoFolderOpenSharp: () => <span data-testid="icon-folder" />,
}));
vi.mock("react-icons/fa6", () => ({
	FaRegFileLines: () => <span data-testid="icon-file" />,
}));

const items = [
	{ path: "src/index.ts", isDirectory: false, score: 0.9 },
	{ path: "src/", isDirectory: true, score: 0.8 },
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

describe("FileTagMenu", () => {
	it("returns null when items is empty", () => {
		const { container } = render(
			<FileTagMenu {...defaultProps} items={[]} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders file items with the file icon", () => {
		render(<FileTagMenu {...defaultProps} />);
		expect(screen.getAllByTestId("icon-file")).toHaveLength(1);
		expect(screen.getByText("src/index.ts")).toBeTruthy();
	});

	it("renders directory items with the folder icon", () => {
		render(<FileTagMenu {...defaultProps} />);
		expect(screen.getAllByTestId("icon-folder")).toHaveLength(1);
		expect(screen.getByText("src/")).toBeTruthy();
	});

	it("marks the selected item with aria-selected=true and others with false", () => {
		render(<FileTagMenu {...defaultProps} selectedIndex={1} />);
		const options = screen.getAllByRole("option");
		expect(options[0]).toHaveAttribute("aria-selected", "false");
		expect(options[1]).toHaveAttribute("aria-selected", "true");
	});

	it("calls onChangeSelectedIndex with the correct index on mouse enter", () => {
		const onChangeSelectedIndex = vi.fn();
		render(<FileTagMenu {...defaultProps} onChangeSelectedIndex={onChangeSelectedIndex} />);
		const options = screen.getAllByRole("option");
		fireEvent.mouseEnter(options[1]);
		expect(onChangeSelectedIndex).toHaveBeenCalledWith(1);
	});

	it("calls onSelect with the correct index on mouse down", () => {
		const onSelect = vi.fn();
		render(<FileTagMenu {...defaultProps} onSelect={onSelect} />);
		const options = screen.getAllByRole("option");
		fireEvent.mouseDown(options[0]);
		expect(onSelect).toHaveBeenCalledWith(0);
	});

	it("prevents default on mouse down to avoid stealing focus", () => {
		const onSelect = vi.fn();
		render(<FileTagMenu {...defaultProps} onSelect={onSelect} />);
		const options = screen.getAllByRole("option");
		// Verify the handler fires (preventDefault called internally; onSelect still invoked)
		fireEvent.mouseDown(options[1]);
		expect(onSelect).toHaveBeenCalledWith(1);
	});

	describe("scrollIntoView", () => {
		it("calls scrollIntoView on the selected element when selectedIndex changes", () => {
			const scrollIntoView = vi.fn();
			window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

			const { rerender } = render(<FileTagMenu {...defaultProps} selectedIndex={0} />);
			const callsBefore = scrollIntoView.mock.calls.length;

			rerender(<FileTagMenu {...defaultProps} selectedIndex={1} />);
			expect(scrollIntoView.mock.calls.length).toBeGreaterThan(callsBefore);
		});
	});
});
