import type { ImageContentPart } from "../types";

interface ImageRendererProps {
	part: ImageContentPart;
}

export function ImageRenderer({ part }: ImageRendererProps) {
	return <img src={`data:${part.mimeType};base64,${part.data}`} alt={""} className="max-w-full rounded" />;
}
