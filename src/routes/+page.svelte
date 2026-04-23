<script lang="ts">
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';

	let test;

	testApi();

	async function testApi() {
		const response = await api('/health-check');
		test = response.data;
	}
</script>

<h1>betterlk test</h1>

<pre>{JSON.stringify(test, null, 2)}</pre>

<button onclick={() => theme.toggle()}>
	{$theme === 'light' ? 'dark' : 'light'}
</button>
