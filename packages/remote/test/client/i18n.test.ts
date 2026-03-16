import { describe, expect, it } from "vitest";
import i18n from "../../src/client/i18n";

describe("i18n", () => {
	it("initializes with English as the active language", () => {
		expect(i18n.language).toBe("en");
	});

	it("provides the expected translation keys", () => {
		expect(i18n.t("header.brand")).toBeTruthy();
	});
});
