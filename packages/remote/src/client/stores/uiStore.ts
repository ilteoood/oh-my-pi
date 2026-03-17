import { create } from "zustand";

interface UIStore {
	settingsOpen: boolean;
	hotkeysOpen: boolean;
	sessionStatsOpen: boolean;
	modelSelectOpen: boolean;
	sessionPickerOpen: boolean;

	openSettings: () => void;
	closeSettings: () => void;
	openHotkeys: () => void;
	closeHotkeys: () => void;
	openSessionStats: () => void;
	closeSessionStats: () => void;
	openModelSelect: () => void;
	closeModelSelect: () => void;
	openSessionPicker: () => void;
	closeSessionPicker: () => void;
}

export const useUIStore = create<UIStore>(set => ({
	settingsOpen: false,
	hotkeysOpen: false,
	sessionStatsOpen: false,
	modelSelectOpen: false,
	sessionPickerOpen: false,

	openSettings: () => set({ settingsOpen: true }),
	closeSettings: () => set({ settingsOpen: false }),
	openHotkeys: () => set({ hotkeysOpen: true }),
	closeHotkeys: () => set({ hotkeysOpen: false }),
	openSessionStats: () => set({ sessionStatsOpen: true }),
	closeSessionStats: () => set({ sessionStatsOpen: false }),
	openModelSelect: () => set({ modelSelectOpen: true }),
	closeModelSelect: () => set({ modelSelectOpen: false }),
	openSessionPicker: () => set({ sessionPickerOpen: true }),
	closeSessionPicker: () => set({ sessionPickerOpen: false }),
}));
