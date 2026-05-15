<script lang="ts">
	import '../styles/app.scss';
	import { browser } from '$app/environment';
	import { theme } from '$lib/stores/theme';
	import { homeworksCountStore, tokenStore, userStore } from '$lib/stores/user';
	import MobileNav from '$lib/components/mobileNav/MobileNav.svelte';

	export let data;

	userStore.set(data?.user ?? null);
	tokenStore.set(data.token);
	homeworksCountStore.set(data.activeHomeworksCount ?? 0);

	if (browser) {
		document.documentElement.setAttribute('data-theme', $theme);
	}
</script>

<slot />

{#if $userStore}
	<MobileNav />
{/if}
