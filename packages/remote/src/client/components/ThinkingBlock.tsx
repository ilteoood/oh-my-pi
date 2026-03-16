import { Accordion } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { IoBulb } from "react-icons/io5";

interface ThinkingBlockProps {
	content: string;
}

export function ThinkingBlock({ content }: ThinkingBlockProps) {
	const { t } = useTranslation();
	if (!content) return null;

	return (
		<Accordion className="my-2">
			<Accordion.Item id="thinking">
				<Accordion.Heading>
					<Accordion.Trigger>
						<span className="text-sm text-default-500 flex items-center gap-1">
							<IoBulb aria-hidden="true" size={14} />
							{t("thinking.label")}
						</span>
						<Accordion.Indicator />
					</Accordion.Trigger>
				</Accordion.Heading>
				<Accordion.Panel>
					<Accordion.Body>
						<p className="text-sm text-default-600 whitespace-pre-wrap font-mono">{content}</p>
					</Accordion.Body>
				</Accordion.Panel>
			</Accordion.Item>
		</Accordion>
	);
}
