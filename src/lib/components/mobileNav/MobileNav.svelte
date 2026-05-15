<script lang="ts">
	import './mobileNav.scss';
	import { page } from '$app/stores';
	import { userStore, homeworksCountStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';

	let menuOpen = $state(false);

	const mainTabs = [
		{
			href: '/',
			label: 'Главная',
			icon: `<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>`,
		},
		{
			href: '/news',
			label: 'Новости',
			icon: `<path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"/><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/>`,
		},
		{
			href: '/journals',
			label: 'Ведомости',
			icon: `<path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>`,
		},
	];

	// Полный список для менюшки "Другое"
	const menuSections = $derived((() => {
		const role = $userStore?.role?.name ?? '';
		const sections: { label: string; items: { href: string; label: string; icon: string }[] }[] = [
			{
				label: 'Основное',
				items: [
					{
						href: '/',
						label: 'Главная',
						icon: `<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>`,
					},
					{
						href: '/homework',
						label: 'Задания',
						icon: `<path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>`,
					},
					{
						href: '/journals',
						label: 'Ведомости',
						icon: `<path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>`,
					},
					{
						href: '/news',
						label: 'Новости',
						icon: `<path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"/><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/>`,
					},
				],
			},
		];

		if (role === 'admin' || role === 'moderator') {
			sections.push({
				label: 'Управление',
				items: [
					{
						href: '/users',
						label: 'Пользователи',
						icon: `<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>`,
					},
					{
						href: '/groups',
						label: 'Группы',
						icon: `<path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/>`,
					},
					{
						href: '/subjects',
						label: 'Предметы',
						icon: `<path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>`,
					},
					{
						href: '/specializations',
						label: 'Специальности',
						icon: `<path fill-rule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/>`,
					},
				],
			});
		}

		if (role === 'professor') {
			sections.push({
				label: 'Управление',
				items: [
					{
						href: '/groups',
						label: 'Группы',
						icon: `<path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/>`,
					},
					{
						href: '/subjects',
						label: 'Предметы',
						icon: `<path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>`,
					},
				],
			});
		}

		return sections;
	})());

	function isActive(href: string) {
		if (href === '/') return $page.url.pathname === '/';
		return $page.url.pathname.startsWith(href);
	}

	function closeMenu() { menuOpen = false; }

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeMenu();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Нижний бар -->
<nav class="mobile-nav">
	{#each mainTabs as tab}
		<a
			href={tab.href}
			class="mobile-nav__tab"
			class:mobile-nav__tab--active={isActive(tab.href)}
			onclick={closeMenu}
		>
			<svg viewBox="0 0 20 20" fill="currentColor">
				{@html tab.icon}
			</svg>
			<span>{tab.label}</span>
		</a>
	{/each}

	<!-- Кнопка "Другое" -->
	<button
		class="mobile-nav__tab"
		class:mobile-nav__tab--active={menuOpen}
		onclick={() => menuOpen = !menuOpen}
		aria-label="Меню"
		aria-expanded={menuOpen}
	>
		{#if menuOpen}
			<svg viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
			</svg>
		{:else}
			<svg viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
			</svg>
		{/if}
		<span>Другое</span>
	</button>
</nav>

<!-- Полноэкранное меню -->
{#if menuOpen}
	<!-- Оверлей -->
	<div
		class="menu-overlay"
		onclick={closeMenu}
		aria-hidden="true"
	></div>

	<!-- Панель меню -->
	<div class="menu-panel" role="dialog" aria-modal="true" aria-label="Навигация">
		<!-- Шапка -->
		<div class="menu-panel__header">
			<div class="menu-panel__logo">
				<div class="menu-logo-mark">
					<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 2L2 7l10 5 10-5-10-5z"/>
						<path d="M2 17l10 5 10-5"/>
						<path d="M2 12l10 5 10-5"/>
					</svg>
				</div>
				<span class="menu-logo-text">BetterLK</span>
			</div>
			<button class="menu-close" onclick={closeMenu} aria-label="Закрыть">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
				</svg>
			</button>
		</div>

		<!-- Пользователь -->
		{#if $userStore}
			<div class="menu-user">
				<div class="menu-user__avatar">
					{$userStore.name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()}
				</div>
				<div class="menu-user__info">
					<div class="menu-user__name">{$userStore.name}</div>
					<div class="menu-user__role">{$userStore.role?.display_name ?? ''}</div>
				</div>
			</div>
		{/if}

		<!-- Навигационные секции -->
		<div class="menu-nav">
			{#each menuSections as section}
				<div class="menu-section">
					<div class="menu-section__label">{section.label}</div>
					{#each section.items as item}
						<a
							href={item.href}
							class="menu-item"
							class:menu-item--active={isActive(item.href)}
							onclick={closeMenu}
						>
							<svg class="menu-item__icon" viewBox="0 0 20 20" fill="currentColor">
								{@html item.icon}
							</svg>
							{item.label}
							{#if item.href === '/homework' && $homeworksCountStore > 0}
								<span class="menu-badge">{$homeworksCountStore}</span>
							{/if}
						</a>
					{/each}
				</div>
			{/each}
		</div>

		<!-- Низ панели: тема + выход -->
		<div class="menu-footer">
			<!-- Переключатель темы -->
			<div class="theme-row">
				<div class="theme-row__label">
					{#if $theme === 'light'}
						<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/></svg>
						Светлая тема
					{:else}
						<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
						Тёмная тема
					{/if}
				</div>
				<!-- Тогл -->
				<button
					class="theme-toggle"
					class:theme-toggle--dark={$theme === 'dark'}
					onclick={() => theme.toggle()}
					aria-label="Переключить тему"
				>
					<span class="theme-toggle__knob"></span>
				</button>
			</div>

			<form method="POST" action="/auth/logout">
				<button type="submit" class="logout-btn">
					<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/></svg>
					Выйти
				</button>
			</form>
		</div>
	</div>
{/if}