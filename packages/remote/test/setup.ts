import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
	cleanup();
});

// DOM-specific stubs — only in browser-like environments
if (typeof window !== "undefined") {
	// Mock navigator.clipboard — happy-dom does not implement it
	Object.defineProperty(navigator, "clipboard", {
		value: {
			writeText: vi.fn().mockResolvedValue(undefined),
			readText: vi.fn().mockResolvedValue(""),
		},
		configurable: true,
		writable: true,
	});

	// requestAnimationFrame stub for happy-dom
	global.requestAnimationFrame = (cb: FrameRequestCallback) => {
		cb(0);
		return 0;
	};

	global.cancelAnimationFrame = () => {};

	// scrollIntoView is not implemented in happy-dom
	window.HTMLElement.prototype.scrollIntoView = vi.fn();
}