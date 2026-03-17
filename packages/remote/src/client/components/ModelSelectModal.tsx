import { useTranslation } from "react-i18next";
import { IoCheckmarkCircle, IoClose } from "react-icons/io5";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import type { ModelInfo, RpcCommand } from "../types";

interface ModelSelectModalProps {
	sendCommand: (cmd: RpcCommand) => void;
}

export function ModelSelectModal({ sendCommand }: ModelSelectModalProps) {
	const { t } = useTranslation();
	const { modelSelectOpen, closeModelSelect } = useUIStore();
	const availableModels = useSessionStore(s => s.availableModels);
	const currentModel = useSessionStore(s => s.sessionState?.model);

	if (!modelSelectOpen) return null;

	// Group models by provider, preserving insertion order.
	const byProvider = new Map<string, ModelInfo[]>();
	for (const model of availableModels) {
		let group = byProvider.get(model.provider);
		if (!group) {
			group = [];
			byProvider.set(model.provider, group);
		}
		group.push(model);
	}

	const handleSelect = (model: ModelInfo) => {
		sendCommand({ type: "set_model", provider: model.provider, modelId: model.id });
		closeModelSelect();
	};

	const handleBackdropKey = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") closeModelSelect();
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			role="dialog"
			aria-modal
			onKeyDown={handleBackdropKey}
		>
			{/* Backdrop — clicks on this element close the modal */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: presentation element, no semantic role needed */}
			<div role="presentation" className="absolute inset-0 bg-black/50" onClick={closeModelSelect} />

			<div className="relative z-10 w-full max-w-lg rounded-2xl bg-surface border border-separator shadow-xl overflow-y-auto max-h-[80vh]">
				<div className="flex items-center justify-between px-5 py-4 border-b border-separator">
					<h2 className="text-base font-semibold">{t("modelSelect.title")}</h2>
					<button
						type="button"
						className="text-muted hover:text-foreground transition-colors text-xl leading-none cursor-pointer"
						onClick={closeModelSelect}
						aria-label={t("actions.close")}
					>
						<IoClose />
					</button>
				</div>

				<div className="p-5">
					{availableModels.length === 0 ? (
						<p className="text-muted text-sm">{t("modelSelect.noModels")}</p>
					) : (
						<div className="space-y-5">
							{[...byProvider.entries()].map(([provider, models]) => (
								<section key={provider}>
									<p className="font-medium text-xs uppercase tracking-wider text-muted mb-2">{provider}</p>
									<div className="space-y-1">
										{models.map(model => {
											const isSelected =
												model.id === currentModel?.id && model.provider === currentModel?.provider;
											return (
												<button
													key={model.id}
													type="button"
													className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
														isSelected ? "bg-default text-(--color-accent)" : "hover:bg-default"
													}`}
													onClick={() => handleSelect(model)}
												>
													<div className="min-w-0">
														<p className="text-sm font-medium truncate">{model.name}</p>
														<p className="text-xs text-muted truncate">{model.id}</p>
													</div>
													{isSelected && (
														<IoCheckmarkCircle
															className="text-(--color-accent) shrink-0 ml-3"
															size={18}
														/>
													)}
												</button>
											);
										})}
									</div>
								</section>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
