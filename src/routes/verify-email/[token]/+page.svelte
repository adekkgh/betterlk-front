<script lang="ts">
	import './styles.scss';
	import { onMount } from 'svelte';
	import { api } from '$lib/helpers/api';

	const { data } = $props();

	type Status = 'loading' | 'success' | 'error';
	let status = $state<Status>('loading');
	let message = $state('');

	onMount(async () => {
		const { data: res, error } = await api<{ message: string }>(
			`/auth/verify-email/${data.token}`
		);

		if (error) {
			status = 'error';
			message = 'Ссылка недействительна или уже была использована.';
			return;
		}

		status = 'success';
		message = res?.message ?? 'Email подтверждён!';

		// Редирект на логин через 2 секунды
		setTimeout(() => {
			window.location.href = '/login';
		}, 2000);
	});
</script>

<div class="verify-page">
	<div class="verify-card">
		<div class="logo-wrap">
			<div class="logo-mark">
				<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2L2 7l10 5 10-5-10-5z"/>
					<path d="M2 17l10 5 10-5"/>
					<path d="M2 12l10 5 10-5"/>
				</svg>
			</div>
			<span class="logo-text">BetterLK</span>
		</div>

		{#if status === 'loading'}
			<div class="verify-state">
				<div class="spinner-lg"></div>
				<h2>Подтверждаем email...</h2>
				<p>Пожалуйста, подождите</p>
			</div>

		{:else if status === 'success'}
			<div class="verify-state">
				<div class="verify-icon verify-icon--success">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
				</div>
				<h2>Email подтверждён!</h2>
				<p>{message}</p>
				<p class="redirect-note">Перенаправляем на страницу входа...</p>
				<a href="/login" class="btn-link-styled">Войти сейчас →</a>
			</div>

		{:else}
			<div class="verify-state">
				<div class="verify-icon verify-icon--error">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</div>
				<h2>Что-то пошло не так</h2>
				<p>{message}</p>
				<a href="/login" class="btn-link-styled">Вернуться ко входу →</a>
			</div>
		{/if}
	</div>
</div>
