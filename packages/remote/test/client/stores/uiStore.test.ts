import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "../../../src/client/stores/uiStore";

const initialState = {
	settingsOpen: false,
	hotkeysOpen: false,
	sessionStatsOpen: false,
	modelSelectOpen: false,
};

beforeEach(() => {
	useUIStore.setState(initialState);
});

describe("uiStore", () => {
	it("has correct initial state", () => {
		const state = useUIStore.getState();
		expect(state.settingsOpen).toBe(false);
		expect(state.hotkeysOpen).toBe(false);
		expect(state.sessionStatsOpen).toBe(false);
		expect(state.modelSelectOpen).toBe(false);
	});

	describe("settings", () => {
		it("opens", () => {
			useUIStore.getState().openSettings();
			expect(useUIStore.getState().settingsOpen).toBe(true);
		});
		it("closes", () => {
			useUIStore.setState({ settingsOpen: true });
			useUIStore.getState().closeSettings();
			expect(useUIStore.getState().settingsOpen).toBe(false);
		});
	});

	describe("hotkeys", () => {
		it("opens", () => {
			useUIStore.getState().openHotkeys();
			expect(useUIStore.getState().hotkeysOpen).toBe(true);
		});
		it("closes", () => {
			useUIStore.setState({ hotkeysOpen: true });
			useUIStore.getState().closeHotkeys();
			expect(useUIStore.getState().hotkeysOpen).toBe(false);
		});
	});

	describe("sessionStats", () => {
		it("opens", () => {
			useUIStore.getState().openSessionStats();
			expect(useUIStore.getState().sessionStatsOpen).toBe(true);
		});
		it("closes", () => {
			useUIStore.setState({ sessionStatsOpen: true });
			useUIStore.getState().closeSessionStats();
			expect(useUIStore.getState().sessionStatsOpen).toBe(false);
		});
	});

	describe("modelSelect", () => {
		it("opens", () => {
			useUIStore.getState().openModelSelect();
			expect(useUIStore.getState().modelSelectOpen).toBe(true);
		});
		it("closes", () => {
			useUIStore.setState({ modelSelectOpen: true });
			useUIStore.getState().closeModelSelect();
			expect(useUIStore.getState().modelSelectOpen).toBe(false);
		});
	});
});
