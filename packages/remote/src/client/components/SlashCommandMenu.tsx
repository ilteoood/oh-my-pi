import clsx from "clsx";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { SlashMenuItem } from "../slashCommands";

interface SlashCommandMenuProps {
	items: SlashMenuItem[];
	selectedIndex: number;
	/** Fired when the user clicks or keyboard-confirms an item. */
	onSelect: (index: number) => void;
	/** Fired when the user hovers an item (keeps keyboard + mouse in sync). */
	onChangeSelectedIndex: (index: number) => void;
	/** When true, items are subcommand names (no "/" prefix). */
	isSubcommand?: boolean;
}

/**
 * Floating autocomplete dropdown for slash commands and subcommands.
 *
 * Positioned above the input bar via `position: absolute; bottom: 100%`.
 * The parent container must have `position: relative`.
 *
 * Mouse interaction uses `onMouseDown` + `preventDefault` to avoid stealing
 * focus from the textarea before the selection is applied.
 */
export function SlashCommandMenu({
	items,
	selectedIndex,
	onSelect,
	onChangeSelectedIndex,
	isSubcommand = false,
}: SlashCommandMenuProps) {
	const { t } = useTranslation();
	const selectedRef = useRef<HTMLDivElement>(null);

	// Keep the selected row visible when navigating by keyboard.
	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedIndex drives selectedRef via render; must be listed to re-run
	useEffect(() => {
		selectedRef.current?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex]);

	if (items.length === 0) return null;

	return (
		<div
			className="absolute bottom-full left-0 right-0 mb-1.5 rounded-xl border border-separator bg-surface shadow-lg overflow-hidden z-50"
			role="listbox"
			aria-label={t("slashCommands.ariaLabel")}
		>
			<div className="max-h-56 overflow-y-auto py-1">
				{items.map((item, index) => {
					const isSelected = index === selectedIndex;
					return (
						<div
							key={item.name}
							ref={isSelected ? selectedRef : undefined}
							role="option"
							aria-selected={isSelected}
							// tabIndex makes the option focusable, satisfying aria/useFocusableInteractive
							tabIndex={-1}
							className={clsx(
								"flex items-center gap-3 px-3 py-2 cursor-pointer select-none transition-colors",
								isSelected
									? "bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)] text-(--color-accent)"
									: "text-foreground hover:bg-surface-secondary",
							)}
							onMouseEnter={() => onChangeSelectedIndex(index)}
							onMouseDown={e => {
								// Prevent the textarea from losing focus
								e.preventDefault();
								onSelect(index);
							}}
						>
							<span className="text-sm font-mono font-medium shrink-0">
								{isSubcommand ? item.name : `/${item.name}`}
							</span>
							{item.description && (
								<span className={clsx("text-xs truncate", isSelected ? "text-(--color-accent)/70" : "text-muted")}>
									{item.description}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
