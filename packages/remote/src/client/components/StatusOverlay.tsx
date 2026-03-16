import { Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { IoClose } from "react-icons/io5";
import { useSessionStore } from "../stores/sessionStore";

export function StatusOverlay() {
	const { t } = useTranslation();
	const {isCompacting, isRetrying, retryInfo, error, setError} = useSessionStore()

	if (!isCompacting && !isRetrying && !error) return null;

	return (
		<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
			{isCompacting && (
				<div className="flex items-center gap-2 bg-warning-50 text-warning-700 dark:bg-warning-100/10 dark:text-warning-400 rounded-full px-4 py-2">
					<Spinner size="sm" />
					<span className="text-sm">{t("status.compacting")}</span>
				</div>
			)}
			{isRetrying && retryInfo && (
				<div className="flex items-center gap-2 bg-secondary-50 text-secondary-700 dark:bg-secondary-100/10 dark:text-secondary-400 rounded-full px-4 py-2">
					<Spinner size="sm" />
					<span className="text-sm">
						{t("status.retrying", { attempt: retryInfo.attempt, maxAttempts: retryInfo.maxAttempts })}
					</span>
				</div>
			)}
			{error && (
				<button
					type="button"
					className="flex items-center gap-2 bg-danger-50 text-danger-700 dark:bg-danger-100/10 dark:text-danger-400 rounded-full px-4 py-2 cursor-pointer"
					onClick={() => setError(null)}
				>
					<span className="text-sm">{error}</span>
					<IoClose aria-hidden="true" size={14} className="ml-1" />
				</button>
			)}
		</div>
	);
}
