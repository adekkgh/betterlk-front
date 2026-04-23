<script lang="ts">
	import '../styles/app.scss';
	import { browser } from '$app/environment';
	import { theme } from '$lib/stores/theme';
	import { userStore } from '$lib/stores/user';

	export let data;

	userStore.set(data?.user ?? null);

	if (browser) {
		document.documentElement.setAttribute('data-theme', $theme);
	}
</script>

<slot />
