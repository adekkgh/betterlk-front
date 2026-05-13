<script lang="ts">
	import './error.scss';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	// Читаем тему напрямую из localStorage (store может быть недоступен при ошибке)
	let isDark = $state(false);

	onMount(() => {
		const saved = localStorage.getItem('theme');
		isDark = saved === 'dark';
	});

	function toggleTheme() {
		isDark = !isDark;
		localStorage.setItem('theme', isDark ? 'dark' : 'light');
	}

	const is404 = $derived($page.status === 404);

	// Случайная цитата для 404
	const quotes = [
		'Эта страница ушла на пары и не вернулась.',
		'Преподаватель выставил этой странице прогул.',
		'Страница потерялась, как студент на первой паре.',
		'Здесь должна была быть страница, но она сдала досрочно.',
	];
	const quote = quotes[Math.floor(Math.random() * quotes.length)];
</script>

<svelte:head>
	<title>{is404 ? '404 — Страница не найдена' : `${$page.status} — Ошибка`} · BetterLK</title>
</svelte:head>

<div class="error" class:dark={isDark}>
	<div class="page">

		<!-- Тема + логотип в углу -->
		<header class="header">
			<button onclick={() => window.location.href = '/'} class="logo">
				<div class="logo__mark">
					<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"
							 stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 2L2 7l10 5 10-5-10-5z"/>
						<path d="M2 17l10 5 10-5"/>
						<path d="M2 12l10 5 10-5"/>
					</svg>
				</div>
				<span class="logo__text">BetterLK</span>
			</button>

			<button class="theme-btn" onclick={toggleTheme} aria-label="Переключить тему">
				{#if isDark}
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
					</svg>
				{:else}
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
						<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
					</svg>
				{/if}
			</button>
		</header>

		<!-- Контент -->
		<main class="main">
			<!-- Декоративные круги -->
			<div class="circle circle--1" aria-hidden="true"></div>
			<div class="circle circle--2" aria-hidden="true"></div>

			<!-- Код ошибки -->
			<div class="code" aria-hidden="true">
				{$page.status}
			</div>

			{#if is404}
				<h1 class="title">Страница не найдена</h1>
				<p class="subtitle">{quote}</p>
			{:else}
				<h1 class="title">Что-то пошло не так</h1>
				<p class="subtitle">
					{$page.error?.message ?? 'Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.'}
				</p>
			{/if}

			<div class="actions">
				<button onclick={() => window.location.href = '/'} class="btn btn--primary">
					<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
						<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
					</svg>
					На главную
				</button>
				<button class="btn btn--ghost" onclick={() => history.back()}>
					<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
					</svg>
					Назад
				</button>
			</div>
		</main>

		<!-- Подпись -->
		<footer class="footer">
			BetterLK · <a href="/">betterlk.ru</a>
		</footer>
	</div>
</div>
