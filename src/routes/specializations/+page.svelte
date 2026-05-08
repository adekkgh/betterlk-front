<script lang="ts">
	import './styles.scss';
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/user';
	import { homeworksCountStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';

	interface Subject { id: number; name: string; created_at: string; }

	let subjects    = $state<Specialization[]>([]);
	let loading     = $state(true);
	let error       = $state('');
	let search      = $state('');

	let showForm    = $state(false);
	let editingSpec = $state<Specialization | null>(null);
	let formName    = $state('');
	let formLoading = $state(false);
	let formError   = $state('');

	let deletingId      = $state<number | null>(null);
	let deleteLoading   = $state(false);

	const canManage = $derived(['admin', 'moderator'].includes($userStore?.role?.name ?? ''));

	const filtered = $derived(
		subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
	);

	async function loadSpecializations() {
		loading = true;
		error   = '';
		const { data, error: err } = await api<{ data: Specialization[] }>('/specializations');
		loading  = false;
		if (err) { error = err; return; }
		subjects = data?.data ?? [];
	}

	onMount(loadSpecializations);

	function openForm(subj?: Subject) {
		editingSpec = subj ?? null;
		formName    = subj?.name ?? '';
		formError   = '';
		showForm    = true;
	}

	async function handleFormSubmit() {
		if (!formName.trim()) { formError = 'Введите название специальности'; return; }
		formLoading = true;
		formError   = '';

		const { error: err } = await api(
			editingSpec ? `/specializations/${editingSpec.id}` : '/specializations',
			{ method: editingSpec ? 'PUT' : 'POST', body: { name: formName.trim() } }
		);

		formLoading = false;
		if (err) { formError = err; return; }
		showForm = false;
		await loadSpecializations();
	}

	async function handleDelete(id: number) {
		deleteLoading = true;
		await api(`/specializations/${id}`, { method: 'DELETE' });
		deleteLoading = false;
		deletingId    = null;
		await loadSpecializations();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') { showForm = false; deletingId = null; }
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="layout">
	<aside class="sidebar">
		<div class="sidebar__logo">
			<div class="logo-mark">
				<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2L2 7l10 5 10-5-10-5z"/>
					<path d="M2 17l10 5 10-5"/>
					<path d="M2 12l10 5 10-5"/>
				</svg>
			</div>
			<span class="logo-text">BetterLK</span>
			<span class="logo-badge">beta</span>
		</div>
		<nav class="sidebar__nav">
			<div class="nav-section">
				<div class="nav-section__label">Основное</div>
				<a href="/" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
					Главная
				</a>
				<a href="/news" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"/><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/></svg>
					Новости
				</a>
				<a href="/homework" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
					Задания
					{#if $homeworksCountStore > 0}<span class="nav-badge">{$homeworksCountStore}</span>{/if}
				</a>
				<a href="/journals" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
					Ведомости
				</a>
			</div>
			{#if $userStore?.role?.name === 'admin' || $userStore?.role?.name === 'moderator'}
				<div class="nav-section">
					<div class="nav-section__label">Управление</div>
					<a href="/users" class="nav-item">
						<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
						Пользователи
					</a>
					<a href="/groups" class="nav-item">
						<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>
						Группы
					</a>
					<a href="/subjects" class="nav-item">
						<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
						Предметы
					</a>
					<a href="/specializations" class="nav-item nav-item--active">
						<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
						Специальности
					</a>
				</div>
			{/if}
			{#if $userStore?.role?.name === 'professor'}
				<div class="nav-section">
					<div class="nav-section__label">Управление</div>
					<a href="/groups" class="nav-item">
						<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>
						Группы
					</a>
				</div>
			{/if}
		</nav>
		<div class="sidebar__footer">
			<button class="theme-toggle" onclick={() => theme.toggle()}>
				{#if $theme === 'light'}
					<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
					Тёмная тема
				{:else}
					<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/></svg>
					Светлая тема
				{/if}
			</button>
			<form method="POST" action="/auth/logout">
				<button type="submit" class="logout-btn">
					<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/></svg>
					Выйти
				</button>
			</form>
			<a href="/profile" class="user-card">
				<div class="user-avatar">{$userStore?.name?.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase() ?? '?'}</div>
				<div class="user-info">
					<div class="user-name">{$userStore?.name ?? ''}</div>
					<div class="user-role">{$userStore?.role?.display_name ?? ''}</div>
				</div>
			</a>
		</div>
	</aside>

	<main class="main">
		<header class="topbar">
			<div class="topbar__title">Специальности</div>
			<div class="topbar__actions">
				<div class="search-wrap">
					<svg class="search-icon" width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
					<input class="search-input" type="text" placeholder="Поиск специальности..." bind:value={search} />
				</div>
				{#if canManage}
					<button class="btn btn--primary" onclick={() => openForm()}>
						<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
						Добавить специальность
					</button>
				{/if}
			</div>
		</header>

		<div class="content">
			<div class="stats-row">
				<div class="stat-pill">
					<span class="stat-pill__value">{subjects.length}</span>
					<span class="stat-pill__label">Специальностей всего</span>
				</div>
				{#if search && filtered.length !== subjects.length}
					<div class="stat-pill">
						<span class="stat-pill__value">{filtered.length}</span>
						<span class="stat-pill__label">найдено</span>
					</div>
				{/if}
			</div>

			{#if loading}
				<div class="state-wrap">
					<div class="spinner-lg"></div>
					<p>Загружаем специальности...</p>
				</div>
			{:else if error}
				<div class="state-wrap">
					<div class="state-icon state-icon--error">
						<svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
					</div>
					<p>{error}</p>
					<button class="btn btn--ghost" onclick={loadSpecializations}>Попробовать снова</button>
				</div>
			{:else if filtered.length === 0}
				<div class="state-wrap">
					<div class="state-icon">
						<svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
					</div>
					<p>{search ? 'Специальности не найдены' : 'Специальностей пока нет'}</p>
					{#if canManage && !search}
						<button class="btn btn--primary" onclick={() => openForm()}>Добавить первую специальность</button>
					{/if}
				</div>
			{:else}
				<div class="subjects-grid">
					{#each filtered as subj}
						<div class="subject-card">
							<div class="subject-card__icon">
								<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
							</div>
							<div class="subject-card__body">
								<div class="subject-card__name">{subj.name}</div>
								<div class="subject-card__id">ID: {subj.id}</div>
							</div>
							{#if canManage}
								<div class="subject-card__actions">
									<button class="icon-btn" title="Редактировать" onclick={() => openForm(subj)}>
										<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
									</button>
									<button class="icon-btn icon-btn--danger" title="Удалить" onclick={() => deletingId = subj.id}>
										<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</main>
</div>

<!-- ФОРМА -->
{#if showForm}
	<div class="modal-overlay" role="dialog">
		<div class="modal modal--sm" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<h2 class="modal__title">{editingSpec ? 'Редактировать специальность' : 'Новая специальность'}</h2>
				<button class="modal__close" onclick={() => showForm = false}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
			<div class="modal__body">
				{#if formError}
					<div class="alert alert--error">{formError}</div>
				{/if}
				<div class="form-group">
					<label class="form-label">Название специальности *</label>
					<input
						class="form-input"
						type="text"
						placeholder="Например: Анализ данных"
						bind:value={formName}
						onkeydown={(e) => e.key === 'Enter' && handleFormSubmit()}
						autofocus
					/>
				</div>
				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={() => showForm = false}>Отмена</button>
					<button class="btn btn--primary" onclick={handleFormSubmit} disabled={formLoading}>
						{#if formLoading}<span class="spinner"></span>{/if}
						{editingSpec ? 'Сохранить' : 'Добавить'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ -->
{#if deletingId !== null}
	<div class="modal-overlay" onclick={() => deletingId = null} role="dialog">
		<div class="modal modal--sm" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<h2 class="modal__title">Удалить специальность?</h2>
				<button class="modal__close" onclick={() => deletingId = null}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
			<div class="modal__body">
				<p style="font-size:14px;color:var(--text2);line-height:1.6;">
					Все ведомости связанные с этой специальностью также будут удалены. Это действие нельзя отменить.
				</p>
				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={() => deletingId = null}>Отмена</button>
					<button class="btn btn--danger-solid" onclick={() => handleDelete(deletingId!)} disabled={deleteLoading}>
						{#if deleteLoading}<span class="spinner"></span>{/if}
						Удалить
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
