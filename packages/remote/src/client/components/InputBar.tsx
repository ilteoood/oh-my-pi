import { Button } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IoSend, IoStop } from "react-icons/io5";
import {
	executeSlashCommand,
	extractAtPrefix,
	getSlashCommandHint,
	isKnownSlashCommand,
	matchSlashCommands,
	matchSubcommands,
	parseSlashCommand,
} from "../slashCommands";
import { useSessionStore } from "../stores/sessionStore";
import type { RpcCommand } from "../types";
import { FileTagMenu } from "./FileTagMenu";
import { SlashCommandMenu } from "./SlashCommandMenu";

interface InputBarProps {
	sendCommand: (cmd: RpcCommand) => void;
}

export function InputBar({ sendCommand }: InputBarProps) {
	const [input, setInput] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	// When true the dropdown stays hidden until the input or cursor changes again
	const [menuDismissed, setMenuDismissed] = useState(false);
	// Non-null when the cursor is inside a valid @-tag token
	const [atPrefix, setAtPrefix] = useState<{ query: string; tokenStart: number } | null>(null);

	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const { connected, isStreaming, fileSearch, clearFileSearch } = useSessionStore();

	const { t } = useTranslation();

	// -------------------------------------------------------------------------
	// @ file tagging — detect prefix and trigger debounced server search
	// -------------------------------------------------------------------------

	const updateAtPrefix = useCallback(
		(text: string, cursorPos: number) => {
			const info = extractAtPrefix(text, cursorPos);
			setAtPrefix(info);
			if (!info) {
				// Clear stale file results when cursor leaves the @ token
				clearFileSearch();
			}
		},
		[clearFileSearch],
	);

	// Stable query string used as effect dep (avoids object identity churn)
	const atQuery = atPrefix?.query ?? null;

	useEffect(() => {
		if (atQuery === null) return;
		const timer = window.setTimeout(() => {
			sendCommand({ type: "search_files", query: atQuery });
		}, 150);
		return () => window.clearTimeout(timer);
	}, [atQuery, sendCommand]);

	// -------------------------------------------------------------------------
	// Dropdown items — derived from current input
	// -------------------------------------------------------------------------

	// @ menu items (only when atPrefix matches the last search result)
	const atFileItems = atPrefix && fileSearch?.query === atPrefix.query ? fileSearch.matches : [];
	const isFileMenu = !!atPrefix && atFileItems.length > 0;

	// Slash command menus only shown when NOT in @ mode
	const commandMatches = atPrefix ? [] : matchSlashCommands(input);
	const subcommandMatches = atPrefix ? [] : matchSubcommands(input);
	const inlineHint = atPrefix ? null : getSlashCommandHint(input);

	const isCommandMenu = commandMatches.length > 0;
	const isSubcommandMenu = !isCommandMenu && subcommandMatches.length > 0;
	const slashMenuItems = isCommandMenu ? commandMatches : subcommandMatches;
	// Derive the parent command name when in subcommand mode for i18n key resolution
	const subcommandParent = isSubcommandMenu ? (input.slice(1).split(" ")[0] ?? "").toLowerCase() : undefined;

	// Unified menu length for keyboard navigation modulo
	const activeMenuLength = isFileMenu ? atFileItems.length : slashMenuItems.length;
	const menuVisible = !menuDismissed && (isFileMenu || slashMenuItems.length > 0);

	// Reset selection whenever the active menu changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: trigger-only deps — values are not read inside the effect
	useEffect(() => {
		setSelectedIndex(0);
	}, [menuVisible, activeMenuLength]);

	// -------------------------------------------------------------------------
	// Handlers
	// -------------------------------------------------------------------------

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			setMenuDismissed(false);
			setInput(e.target.value);
			updateAtPrefix(e.target.value, e.target.selectionStart);
		},
		[updateAtPrefix],
	);

	const handleTextareaSelect = useCallback(
		(e: React.SyntheticEvent<HTMLTextAreaElement>) => {
			const target = e.target as HTMLTextAreaElement;
			updateAtPrefix(target.value, target.selectionStart);
		},
		[updateAtPrefix],
	);

	/**
	 * Apply the file menu selection at `index`: replace the @token with the
	 * selected path and move the cursor to after the inserted text.
	 */
	const applyFileSelection = useCallback(
		(index: number) => {
			const item = atFileItems[index];
			if (!item || !atPrefix) return;

			const cursorPos = textareaRef.current?.selectionStart ?? input.length;
			const replacement = `@${item.path}`;
			const newInput = input.slice(0, atPrefix.tokenStart) + replacement + input.slice(cursorPos);
			setInput(newInput);
			setAtPrefix(null);
			setMenuDismissed(false);
			clearFileSearch();

			const newCursorPos = atPrefix.tokenStart + replacement.length;
			requestAnimationFrame(() => {
				textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
				textareaRef.current?.focus();
			});
		},
		[atFileItems, atPrefix, input, clearFileSearch],
	);

	/**
	 * Apply the slash-command menu selection at `index`, completing either the
	 * command name (with trailing space for args) or a subcommand argument.
	 */
	const applySlashSelection = useCallback(
		(index: number) => {
			const item = slashMenuItems[index];
			if (!item) return;

			if (isCommandMenu) {
				setInput(`/${item.name} `);
			} else {
				// Preserve the command name, replace/complete the argument
				const body = input.slice(1);
				const spaceIdx = body.indexOf(" ");
				const commandName = body.slice(0, spaceIdx);
				setInput(`/${commandName} ${item.name} `);
			}

			setMenuDismissed(false);
			textareaRef.current?.focus();
		},
		[slashMenuItems, isCommandMenu, input],
	);

	/** Dispatch to the right selection handler based on which menu is active. */
	const applySelection = useCallback(
		(index: number) => {
			const selectionFunction = isFileMenu ? applyFileSelection : applySlashSelection;
			selectionFunction(index);
		},
		[isFileMenu, applyFileSelection, applySlashSelection],
	);

	const handleSend = useCallback(() => {
		const trimmed = input.trim();
		if (!trimmed || !connected) return;

		if (trimmed.startsWith("/")) {
			const parsed = parseSlashCommand(trimmed);
			if (parsed && isKnownSlashCommand(parsed.name)) {
				// Known command — execute via RPC / client action.
				// If execution returns false the command needs more/valid args;
				// leave the input intact so the user can complete it.
				const executed = executeSlashCommand(parsed, { sendCommand });
				if (executed) setInput("");
				return;
			}
		}

		sendCommand({
			type: isStreaming ? "abort_and_prompt" : "prompt",
			message: trimmed,
		});
		setInput("");
	}, [input, connected, isStreaming, sendCommand]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (menuVisible) {
				switch (e.key) {
					case "ArrowDown":
						e.preventDefault();
						setSelectedIndex(i => (i + 1) % activeMenuLength);
						return;
					case "ArrowUp":
						e.preventDefault();
						setSelectedIndex(i => (i - 1 + activeMenuLength) % activeMenuLength);
						return;
					case "Tab":
					case "Enter":
						if (e.key === "Enter" && e.shiftKey) break;
						e.preventDefault();
						applySelection(selectedIndex);
						return;
					case "Escape":
						e.preventDefault();
						setMenuDismissed(true);
						setAtPrefix(null);
						return;
				}
			}

			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[menuVisible, activeMenuLength, selectedIndex, applySelection, handleSend],
	);

	const handleAbort = useCallback(() => {
		sendCommand({ type: "abort" });
	}, [sendCommand]);

	// -------------------------------------------------------------------------
	// Render
	// -------------------------------------------------------------------------

	return (
		<div className="border-t border-separator px-4 py-3 bg-surface shrink-0">
			<div className="max-w-5xl mx-auto">
				{/* Floating dropdown — rendered inside a relative wrapper
				    so `bottom: 100%` positions it directly above the input row */}
				<div className="relative">
					{menuVisible && isFileMenu && (
						<FileTagMenu
							items={atFileItems}
							selectedIndex={selectedIndex}
							onSelect={applyFileSelection}
							onChangeSelectedIndex={setSelectedIndex}
						/>
					)}
					{menuVisible && !isFileMenu && (
						<SlashCommandMenu
							items={slashMenuItems}
							selectedIndex={selectedIndex}
							onSelect={applySlashSelection}
							onChangeSelectedIndex={setSelectedIndex}
							isSubcommand={isSubcommandMenu}
							parentCommand={subcommandParent}
						/>
					)}

					<div className="flex items-center gap-2">
						<textarea
							ref={textareaRef}
							value={input}
							onChange={handleInputChange}
							onSelect={handleTextareaSelect}
							onKeyDown={handleKeyDown}
							placeholder={connected ? t("inputBar.placeholder") : t("inputBar.disconnectedPlaceholder")}
							disabled={!connected}
							rows={1}
							className="flex-1 resize-none rounded-xl border border-(--color-border) bg-default px-4 py-3 text-sm focus:outline-none focus:border-(--color-accent) transition-colors disabled:opacity-50 max-h-50 field-sizing-content"
						/>
						<div className="flex gap-1 shrink-0">
							{isStreaming && (
								<Button
									variant="danger"
									size="md"
									onPress={handleAbort}
									isIconOnly
									aria-label={t("inputBar.stopAriaLabel")}
								>
									<IoStop />
								</Button>
							)}
							<Button
								variant="primary"
								size="md"
								onPress={handleSend}
								isDisabled={!connected || !input.trim()}
								isIconOnly
								aria-label={t("inputBar.sendAriaLabel")}
							>
								<IoSend />
							</Button>
						</div>
					</div>
				</div>

				{!menuVisible && inlineHint && (
					<p className="mt-1 px-1 text-xs text-muted select-none pointer-events-none">{inlineHint}</p>
				)}
			</div>
		</div>
	);
}
