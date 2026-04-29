<script lang="ts">
	import './styles.scss';
	import { onMount } from 'svelte';
	import { homeworksCountStore, userStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';

	// --- ТИПЫ ---
	interface Specialization { id: number; name: string; }
	interface Student { id: number; name: string; email: string; }
	interface Group {
		id: number;
		name: string;
		course: number;
		specialization: Specialization | null;
		students_count: number;
		students: Student[];
	}

	// --- СОСТОЯНИЕ ---
	let groups          = $state<Group[]>([]);
	let specializations = $state<Specialization[]>([]);
	let loading         = $state(true);
	let error           = $state('');
	let search          = $state('');

	// Раскрытая группа
	let expandedId      = $state<number | null>(null);

	// Модалка создания/редактирования
	let showForm        = $state(false);
	let editingGroup    = $state<Group | null>(null);
	let formName        = $state('');
	let formCourse      = $state(1);
	let formSpecId      = $state<number | null>(null);
	let formLoading     = $state(false);
	let formError       = $state('');

	// Подтверждение удаления
	let deletingId      = $state<number | null>(null);
	let deleteLoading   = $state(false);

	// --- РОЛИ ---
	const isAdmin     = $derived($userStore?.role?.name === 'admin');
	const isModerator = $derived($userStore?.role?.name === 'moderator');
	const canManage   = $derived(isAdmin || isModerator);

	// --- ФИЛЬТРАЦИЯ ---
	const filtered = $derived(groups.filter(g =>
		g.name.toLowerCase().includes(search.toLowerCase()) ||
		g.specialization?.name.toLowerCase().includes(search.toLowerCase())
	));

	// --- ЗАГРУЗКА ---
	async function loadData() {
		loading = true;
		error   = '';

		const [groupsRes, specsRes] = await Promise.all([
			api<{ data: Group[] }>('/groups'),
			api<{ data: Specialization[] }>('/specializations'),
		]);

		loading = false;

		if (groupsRes.error) { error = groupsRes.error; return; }
		groups          = groupsRes.data?.data ?? [];
		specializations = specsRes.data?.data ?? [];
	}

	onMount(loadData);

	// --- ХЕЛПЕРЫ ---
	function courseLabel(course: number): string {
		const map: Record<number, string> = { 1: '1-й курс', 2: '2-й курс', 3: '3-й курс', 4: '4-й курс', 5: '5-й курс', 6: '6-й курс' };
		return map[course] ?? `${course} курс`;
	}

	function getInitials(name: string): string {
		return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
	}

	function toggleExpand(id: number) {
		expandedId = expandedId === id ? null : id;
	}

	// --- ФОРМА ---
	function openForm(group?: Group) {
		editingGroup = group ?? null;
		formName     = group?.name ?? '';
		formCourse   = group?.course ?? 1;
		formSpecId   = group?.specialization?.id ?? null;
		formError    = '';
		showForm     = true;
	}

	async function handleFormSubmit() {
		if (!formName || !formSpecId) {
			formError = 'Заполните все поля';
			return;
		}
		formLoading = true;
		formError   = '';

		const { error: err } = await api(
			editingGroup ? `/groups/${editingGroup.id}` : '/groups',
			{
				method: editingGroup ? 'PUT' : 'POST',
				body: { name: formName, course: formCourse, specialization_id: formSpecId },
			}
		);

		formLoading = false;
		if (err) { formError = err; return; }
		showForm = false;
		await loadData();
	}

	// --- УДАЛЕНИЕ ---
	async function handleDelete(id: number) {
		deleteLoading = true;

		const { error: err } = await api(`/groups/${id}`, { method: 'DELETE' });

		deleteLoading = false;
		deletingId    = null;

		if (err) { error = err; return; }
		await loadData();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') { showForm = false; deletingId = null; }
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="layout">
	<!-- SIDEBAR -->
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
				<a href="/homework" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
					Задания
					{#if $homeworksCountStore > 0}
						<span class="nav-badge">{$homeworksCountStore}</span>
					{/if}
				</a>
				<a href="/journal" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
					Журнал
				</a>
				<a href="/groups" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
					Группы
				</a>
				<a href="/profile" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
					Профиль
				</a>
			</div>
			<div class="nav-section">
				{#if isAdmin}
					<div class="nav-section__label">Управление</div>
					<a href="/users" class="nav-item">
						<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
						Пользователи
					</a>
				{/if}
			</div>
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

	<!-- MAIN -->
	<main class="main">
		<header class="topbar">
			<div class="topbar__title">Группы</div>
			<div class="topbar__actions">
				<div class="search-wrap">
					<svg class="search-icon" width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
					</svg>
					<input class="search-input" type="text" placeholder="Поиск по группе..." bind:value={search} />
				</div>
				{#if canManage}
					<button class="btn btn--primary" onclick={() => openForm()}>
						<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
						Создать группу
					</button>
				{/if}
			</div>
		</header>

		<div class="content">
			<!-- СТАТЫ -->
			<div class="stats-row">
				<div class="stat-pill">
					<span class="stat-pill__value">{groups.length}</span>
					<span class="stat-pill__label">групп всего</span>
				</div>
				<div class="stat-pill">
					<span class="stat-pill__value">{groups.reduce((s, g) => s + g.students_count, 0)}</span>
					<span class="stat-pill__label">студентов</span>
				</div>
				<div class="stat-pill">
					<span class="stat-pill__value">{specializations.length}</span>
					<span class="stat-pill__label">специальностей</span>
				</div>
			</div>

			<!-- КОНТЕНТ -->
			{#if loading}
				<div class="state-wrap">
					<div class="spinner-lg"></div>
					<p>Загружаем группы...</p>
				</div>

			{:else if error}
				<div class="state-wrap">
					<div class="state-icon state-icon--error">
						<svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
					</div>
					<p>{error}</p>
					<button class="btn btn--ghost" onclick={loadData}>Попробовать снова</button>
				</div>

			{:else if filtered.length === 0}
				<div class="state-wrap">
					<div class="state-icon">
						<svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>
					</div>
					<p>Групп не найдено</p>
					{#if canManage}
						<button class="btn btn--primary" onclick={() => openForm()}>Создать первую группу</button>
					{/if}
				</div>

			{:else}
				<div class="groups-grid">
					{#each filtered as group}
						<div class="group-card" class:group-card--expanded={expandedId === group.id}>

							<!-- ШАПКА КАРТОЧКИ -->
							<div class="group-card__header">
								<div class="group-card__icon">
									<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>
								</div>
								<div class="group-card__info">
									<div class="group-card__name">{group.name}</div>
									<div class="group-card__meta">
										<span class="badge badge--accent">{courseLabel(group.course)}</span>
										{#if group.specialization}
											<span class="group-card__spec">{group.specialization.name}</span>
										{/if}
									</div>
								</div>
								<div class="group-card__actions">
									{#if canManage}
										<button class="icon-btn" title="Редактировать" onclick={() => openForm(group)}>
											<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
										</button>
										<button class="icon-btn icon-btn--danger" title="Удалить" onclick={() => deletingId = group.id}>
											<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
										</button>
									{/if}
									<button
										class="expand-btn"
										class:expand-btn--open={expandedId === group.id}
										onclick={() => toggleExpand(group.id)}
										title={expandedId === group.id ? 'Свернуть' : 'Показать студентов'}
									>
										<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
									</button>
								</div>
							</div>

							<!-- СЧЁТЧИК СТУДЕНТОВ -->
							<div class="group-card__footer">
								<div class="students-count">
									<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
									{group.students_count} {group.students_count === 1 ? 'студент' : group.students_count < 5 ? 'студента' : 'студентов'}
								</div>
							</div>

							<!-- СПИСОК СТУДЕНТОВ (раскрывается) -->
							{#if expandedId === group.id}
								<div class="students-list">
									<div class="students-list__header">Студенты группы</div>
									{#if group.students.length === 0}
										<div class="students-list__empty">В группе пока нет студентов</div>
									{:else}
										{#each group.students as student}
											<div class="student-item">
												<div class="student-item__avatar">{getInitials(student.name)}</div>
												<div class="student-item__info">
													<div class="student-item__name">{student.name}</div>
													<div class="student-item__email">{student.email}</div>
												</div>
												<div class="student-item__id">#{student.id}</div>
											</div>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</main>
</div>

<!-- МОДАЛКА СОЗДАНИЯ/РЕДАКТИРОВАНИЯ -->
{#if showForm}
	<div class="modal-overlay" onclick={() => showForm = false} role="dialog">
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<h2 class="modal__title">{editingGroup ? 'Редактировать группу' : 'Новая группа'}</h2>
				<button class="modal__close" onclick={() => showForm = false}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
			<div class="modal__body">
				{#if formError}
					<div class="alert alert--error">{formError}</div>
				{/if}

				<div class="form-group">
					<label class="form-label">Название группы *</label>
					<input class="form-input" type="text" placeholder="Например: ИСП-301" bind:value={formName} />
				</div>

				<div class="form-row">
					<div class="form-group">
						<label class="form-label">Курс *</label>
						<select class="form-input" bind:value={formCourse}>
							{#each [1,2,3,4,5,6] as c}
								<option value={c}>{c}-й курс</option>
							{/each}
						</select>
					</div>
					<div class="form-group">
						<label class="form-label">Специальность *</label>
						<select class="form-input" bind:value={formSpecId}>
							<option value={null}>Выберите специальность</option>
							{#each specializations as spec}
								<option value={spec.id}>{spec.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={() => showForm = false}>Отмена</button>
					<button class="btn btn--primary" onclick={handleFormSubmit} disabled={formLoading}>
						{#if formLoading}<span class="spinner"></span>{/if}
						{editingGroup ? 'Сохранить' : 'Создать группу'}
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
				<h2 class="modal__title">Удалить группу?</h2>
				<button class="modal__close" onclick={() => deletingId = null}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
			<div class="modal__body">
				<p style="font-size:14px;color:var(--text2);line-height:1.6;">
					Это действие нельзя отменить. Все данные группы, включая привязки студентов и преподавателей, будут удалены.
				</p>
				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={() => deletingId = null}>Отмена</button>
					<button class="btn btn--danger-solid" onclick={() => handleDelete(deletingId!)} disabled={deleteLoading}>
						{#if deleteLoading}<span class="spinner spinner--dark"></span>{/if}
						Удалить группу
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
