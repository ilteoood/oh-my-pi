import { Accordion, Card, Chip, Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "../stores/sessionStore";

interface ToolCallCardProps {
	id: string;
	name: string;
	args: Record<string, unknown>;
}

const TOOL_COLOR_MAP = {
	"running": "accent",
	"complete": "success",
	"error": "danger"
} as const

export function ToolCallCard({ id, name, args }: ToolCallCardProps) {
	const execution = useSessionStore(s => s.toolExecutions[id]);
	const status = execution?.status ?? "running";
	const result = execution?.result;
	const isError = execution?.isError;
	const intent = execution?.intent;

	const { t } = useTranslation();
	const displayName = t(`tool.names.${name}`, { defaultValue: name });
	const color = TOOL_COLOR_MAP[status] ?? "default";
	const summary = getToolSummary(name, execution?.args ?? args);

	return (
		<Card className="bg-content3/50">
			<Accordion>
				<Accordion.Item id="tool">
					<Accordion.Heading>
						<Accordion.Trigger>
							<div className="flex items-center gap-2">
								{status === "running" ? (
									<Spinner size="sm" />
								) : (
									<Chip size="sm" color={color} variant="soft">
									<Chip.Label>{status === "complete" ? (isError ? t("tool.status.error") : t("tool.status.done")) : status}</Chip.Label>
									</Chip>
								)}
								<span className="font-mono text-sm font-semibold">{displayName}</span>
								{summary && <span className="text-xs text-default-500 truncate">{summary}</span>}
								{intent && <span className="text-xs text-default-400 italic">{intent}</span>}
							</div>
							<Accordion.Indicator />
						</Accordion.Trigger>
					</Accordion.Heading>
					<Accordion.Panel>
						<Accordion.Body>
							<div className="space-y-2 text-sm">
								<div>
									<p className="text-xs text-default-500 mb-1">{t("tool.arguments")}</p>
									<pre className="bg-content1 rounded-lg px-3 py-2 overflow-x-auto text-xs font-mono whitespace-pre-wrap">
										{formatArgs(execution?.args ?? args)}
									</pre>
								</div>
								{result !== undefined && (
									<div>
									<p className="text-xs text-default-500 mb-1">{isError ? t("tool.status.error") : t("tool.result")}</p>
										<pre
											className={`rounded-lg px-3 py-2 overflow-x-auto text-xs font-mono whitespace-pre-wrap ${
												isError ? "bg-danger-50 text-danger" : "bg-content1"
											}`}
										>
											{formatResult(result)}
										</pre>
									</div>
								)}
							</div>
						</Accordion.Body>
					</Accordion.Panel>
				</Accordion.Item>
			</Accordion>
		</Card>
	);
}

function getToolSummary(name: string, args: Record<string, unknown>): string {
	switch (name) {
		case "read":
		case "write":
		case "edit":
			return (args.path as string) ?? "";
		case "bash":
			return (args.command as string)?.slice(0, 80) ?? "";
		case "python":
			return (args.code as string)?.split("\n")[0]?.slice(0, 80) ?? "";
		case "grep":
			return `${args.pattern ?? ""} in ${args.path ?? "."}`;
		case "find":
			return (args.pattern as string) ?? "";
		case "fetch":
		case "web_search":
			return (args.url as string) ?? (args.query as string) ?? "";
		case "lsp":
			return `${args.action ?? ""}${args.file ? ` ${args.file}` : ""}`;
		case "task":
			return "";
		default:
			return "";
	}
}

function formatArgs(args: Record<string, unknown>): string {
	const display: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(args)) {
		if (key === "_i") continue;
		if (typeof value === "string" && value.length > 1000) {
			display[key] = `${value.slice(0, 1000)}... (${value.length} chars)`;
		} else {
			display[key] = value;
		}
	}
	return JSON.stringify(display, null, 2);
}

function formatResult(result: unknown): string {
	if (typeof result === "string") {
		return result.length > 2000 ? `${result.slice(0, 2000)}... (${result.length} chars)` : result;
	}
	return JSON.stringify(result, null, 2);
}
