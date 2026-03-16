import clsx from "clsx";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FaRegFileLines } from "react-icons/fa6";
import { IoFolderOpenSharp } from "react-icons/io5";
import type { FuzzyFindMatch } from "../types";

interface FileTagMenuProps {
	items: FuzzyFindMatch[];
	selectedIndex: number;
	onSelect: (index: number) => void;
	onChangeSelectedIndex: (index: number) => void;
}

export function FileTagMenu({ items, selectedIndex, onSelect, onChangeSelectedIndex }: FileTagMenuProps) {
	const { t } = useTranslation();
	const selectedRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedIndex drives selectedRef via render
	useEffect(() => {
		selectedRef.current?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex]);

	if (items.length === 0) return null;

	return (
		<div
			className="absolute bottom-full left-0 right-0 mb-1.5 rounded-xl border border-separator bg-surface shadow-lg overflow-hidden z-50"
			role="listbox"
			aria-label={t("fileTag.ariaLabel")}
		>
			<div className="max-h-56 overflow-y-auto py-1">
				{items.map((item, index) => {
					const isSelected = index === selectedIndex;
					return (
						<div
							key={item.path}
							ref={isSelected ? selectedRef : undefined}
							role="option"
							aria-selected={isSelected}
							tabIndex={-1}
							className={clsx(
								"flex items-center gap-2 px-3 py-2 cursor-pointer select-none transition-colors",
								isSelected
									? "bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)] text-(--color-accent)"
									: "text-foreground hover:bg-surface-secondary",
							)}
							onMouseEnter={() => onChangeSelectedIndex(index)}
							onMouseDown={e => {
								e.preventDefault();
								onSelect(index);
							}}
						>
							<span className="text-xs shrink-0 opacity-60">{item.isDirectory ? <IoFolderOpenSharp /> : <FaRegFileLines />}</span>
							<span className="text-sm font-mono truncate">{item.path}</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
