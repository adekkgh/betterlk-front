import { browser } from '$app/environment';
import { writable } from 'svelte/store';

type Theme = 'light' | 'dark';

function createThemeStore() {
	// reading saved theme or taking a system one
	const getInitial = (): Theme => {
		if (!browser) return 'light';
		const saved = localStorage.getItem('theme') as Theme;
		if (saved) return saved;
		return window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light';
	};

	const { subscribe, set, update } = writable<Theme>(getInitial());

	// applying changes to html upon theme swap
	subscribe((theme) => {
		if (!browser) return;
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	});

	return {
		subscribe,
		toggle: () => update(t => t === 'light' ? 'dark' : 'light'),
		set,
	};
}

export const theme = createThemeStore();