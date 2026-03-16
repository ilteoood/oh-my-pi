import { useSessionStore } from "../stores/sessionStore";
import { ToolCallCard } from "./ToolCallCard";

export function ToolExecutionList() {
	const { toolExecutions } = useSessionStore();
	const entries = Object.values(toolExecutions);

	if (entries.length === 0) return null;

	return (
		<div className="space-y-2 px-4 py-2">
			{entries.map(exec => (
				<ToolCallCard key={exec.id} id={exec.id} name={exec.name} args={exec.args} />
			))}
		</div>
	);
}
