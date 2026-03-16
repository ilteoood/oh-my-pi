import { Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { IoClose } from "react-icons/io5";
import { useSessionStore } from "../stores/sessionStore";

export function StatusOverlay() {
	const { t } = useTranslation();
	const { isCompacting, isRetrying, retryInfo, error, setError } = useSessionStore();

	if (!isCompacting && !isRetrying && !error) return null;

	return (
		<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
			{isCompacting && (
				<div className="flex items-center gap-2 bg-[color-mix(in_oklab,var(--color-warning)_12%,transparent)] text-[var(--color-warning)] rounded-full px-4 py-2">
					<Spinner size="sm" />
					<span className="text-sm">{t("status.compacting")}</span>
				</div>
			)}
			{isRetrying && retryInfo && (
				<div className="flex items-center gap-2 bg-surface-secondary text-muted rounded-full px-4 py-2">
					<Spinner size="sm" />
					<span className="text-sm">
						{t("status.retrying", { attempt: retryInfo.attempt, maxAttempts: retryInfo.maxAttempts })}
					</span>
				</div>
			)}
			{error && (
				<button
					type="button"
					className="flex items-center gap-2 bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-[var(--color-danger)] rounded-full px-4 py-2 cursor-pointer"
					onClick={() => setError(null)}
				>
					<span className="text-sm">{error}</span>
					<IoClose aria-hidden="true" size={14} className="ml-1" />
				</button>
			)}
		</div>
	);
}
