import { create } from "zustand";

interface UIStore {
	settingsOpen: boolean;
	hotkeysOpen: boolean;
	sessionStatsOpen: boolean;

	openSettings: () => void;
	closeSettings: () => void;
	openHotkeys: () => void;
	closeHotkeys: () => void;
	openSessionStats: () => void;
	closeSessionStats: () => void;
}

export const useUIStore = create<UIStore>(set => ({
	settingsOpen: false,
	hotkeysOpen: false,
	sessionStatsOpen: false,

	openSettings: () => set({ settingsOpen: true }),
	closeSettings: () => set({ settingsOpen: false }),
	openHotkeys: () => set({ hotkeysOpen: true }),
	closeHotkeys: () => set({ hotkeysOpen: false }),
	openSessionStats: () => set({ sessionStatsOpen: true }),
	closeSessionStats: () => set({ sessionStatsOpen: false }),
}));
