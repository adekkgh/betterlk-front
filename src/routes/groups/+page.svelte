<script lang="ts">
	import './styles.scss';
	import { onMount } from 'svelte';
	import { homeworksCountStore, userStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';

	interface Specialization { id: number; name: string; }
	interface Student { id: number; name: string; email: string; }
	interface Group {
		id: number; name: string; course: number;
		specialization: Specialization | null;
		students_count: number; students: Student[];
	}

	let groups          = $state<Group[]>([]);
	let specializations = $state<Specialization[]>([]);
	let loading         = $state(true);
	let error           = $state('');
	let search          = $state('');
	let expandedId      = $state<number | null>(null);

	// Форма группы
	let showForm     = $state(false);
	let editingGroup = $state<Group | null>(null);
	let formName     = $state('');
	let formCourse   = $state(1);
	let formSpecId   = $state<number | null>(null);
	let formLoading  = $state(false);
	let formError    = $state('');

	// Удаление группы
	let deletingId    = $state<number | null>(null);
	let deleteLoading = $state(false);

	// Добавление студентов
	let addGroupId        = $state<number | null>(null);
	let addSearch         = $state('');
	let availableStudents = $state<Student[]>([]);
	let availableLoading  = $state(false);
	let selectedToAdd     = $state<Set<number>>(new Set());
	let addLoading        = $state(false);
	let addError          = $state('');

	// Удаление студентов из группы
	let removeGroupId  = $state<number | null>(null);
	let removeLoading  = $state(false);
	// groupId → Set<studentId>
	let removeSelected = $state<Map<number, Set<number>>>(new Map());

	const canManage = $derived(['admin', 'moderator'].includes($userStore?.role?.name ?? ''));

	const filtered = $derived(groups.filter(g =>
		g.name.toLowerCase().includes(search.toLowerCase()) ||
		(g.specialization?.name ?? '').toLowerCase().includes(search.toLowerCase())
	));

	const filteredAvailable = $derived(
		availableStudents.filter(s =>
			s.name.toLowerCase().includes(addSearch.toLowerCase()) ||
			s.email.toLowerCase().includes(addSearch.toLowerCase()) ||
			String(s.id).includes(addSearch)
		)
	);

	async function loadData() {
		loading = true; error = '';
		const [gr, sp] = await Promise.all([
			api<{ data: Group[] }>('/groups'),
			api<{ data: Specialization[] }>('/specializations'),
		]);
		loading = false;
		if (gr.error) { error = gr.error; return; }
		groups          = gr.data?.data ?? [];
		specializations = sp.data?.data ?? [];
		removeSelected  = new Map();
	}
	onMount(loadData);

	function courseLabel(c: number) {
		return ({1:'1-й курс',2:'2-й курс',3:'3-й курс',4:'4-й курс',5:'5-й курс',6:'6-й курс'} as Record<number,string>)[c] ?? `${c} курс`;
	}
	function initials(name: string) {
		return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
	}
	function toggleExpand(id: number) {
		expandedId = expandedId === id ? null : id;
	}

	// ── ФОРМА ──────────────────────────────────────────────────
	function openForm(g?: Group) {
		editingGroup = g ?? null;
		formName = g?.name ?? ''; formCourse = g?.course ?? 1;
		formSpecId = g?.specialization?.id ?? null; formError = ''; showForm = true;
	}
	async function submitForm() {
		if (!formName || !formSpecId) { formError = 'Заполните все поля'; return; }
		formLoading = true; formError = '';
		const { error: err } = await api(
			editingGroup ? `/groups/${editingGroup.id}` : '/groups',
			{ method: editingGroup ? 'PUT' : 'POST', body: { name: formName, course: formCourse, specialization_id: formSpecId } }
		);
		formLoading = false;
		if (err) { formError = err; return; }
		showForm = false; await loadData();
	}

	// ── УДАЛЕНИЕ ГРУППЫ ────────────────────────────────────────
	async function deleteGroup() {
		if (!deletingId) return;
		deleteLoading = true;
		const { error: err } = await api(`/groups/${deletingId}`, { method: 'DELETE' });
		deleteLoading = false; deletingId = null;
		if (err) { error = err; return; }
		await loadData();
	}

	// ── ДОБАВЛЕНИЕ СТУДЕНТОВ ────────────────────────────────────
	async function openAddStudents(groupId: number) {
		addGroupId = groupId; addSearch = ''; selectedToAdd = new Set(); addError = '';
		availableLoading = true; availableStudents = [];
		const { data, error: err } = await api<{ data: Student[] }>('/groups/students-without-group');
		availableLoading = false;
		if (err) { addError = err; return; }
		availableStudents = data?.data ?? [];
	}
	function toggleAdd(id: number) {
		const s = new Set(selectedToAdd);
		s.has(id) ? s.delete(id) : s.add(id);
		selectedToAdd = s;
	}
	function toggleAddAll() {
		selectedToAdd = selectedToAdd.size === filteredAvailable.length
			? new Set()
			: new Set(filteredAvailable.map(s => s.id));
	}
	async function addStudents() {
		if (!addGroupId || !selectedToAdd.size) return;
		addLoading = true; addError = '';
		const { error: err } = await api(`/groups/${addGroupId}/students`, {
			method: 'POST', body: { student_ids: Array.from(selectedToAdd) }
		});
		addLoading = false;
		if (err) { addError = err; return; }
		const prevExpanded = addGroupId;
		addGroupId = null;
		await loadData();
		expandedId = prevExpanded;
	}

	// ── УДАЛЕНИЕ СТУДЕНТОВ ИЗ ГРУППЫ ───────────────────────────
	function getRemoveSel(groupId: number) {
		return removeSelected.get(groupId) ?? new Set<number>();
	}
	function toggleRemove(groupId: number, studentId: number) {
		const map = new Map(removeSelected);
		const s = new Set(map.get(groupId) ?? []);
		s.has(studentId) ? s.delete(studentId) : s.add(studentId);
		map.set(groupId, s); removeSelected = map;
	}
	function toggleRemoveAll(groupId: number) {
		const group = groups.find(g => g.id === groupId);
		if (!group) return;
		const map = new Map(removeSelected);
		const cur = map.get(groupId) ?? new Set();
		map.set(groupId, cur.size === group.students.length
			? new Set()
			: new Set(group.students.map(s => s.id)));
		removeSelected = map;
	}
	async function removeStudents() {
		if (!removeGroupId) return;
		const ids = Array.from(getRemoveSel(removeGroupId));
		if (!ids.length) return;
		removeLoading = true;
		const { error: err } = await api(`/groups/${removeGroupId}/students`, {
			method: 'DELETE', body: { student_ids: ids }
		});
		removeLoading = false;
		const prevGroupId = removeGroupId;
		removeGroupId = null;
		if (err) { error = err; return; }
		const map = new Map(removeSelected);
		map.delete(prevGroupId);
		removeSelected = map;
		await loadData();
		expandedId = prevGroupId;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') { showForm = false; deletingId = null; addGroupId = null; removeGroupId = null; }
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="layout">
	<aside class="sidebar">
		<div class="sidebar__logo">
			<div class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
			<span class="logo-text">BetterLK</span><span class="logo-badge">beta</span>
		</div>
		<nav class="sidebar__nav">
			<div class="nav-section">
				<div class="nav-section__label">Основное</div>
				<a href="/" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>Главная</a>
				<a href="/news" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"/><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/></svg>Новости</a>
				<a href="/homework" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clip-rule="evenodd"/></svg>Задания{#if $homeworksCountStore > 0}<span class="nav-badge">{$homeworksCountStore}</span>{/if}</a>
				<a href="/journals" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>Ведомости</a>
			</div>
			{#if $userStore?.role?.name === 'admin' || $userStore?.role?.name === 'moderator'}
				<div class="nav-section">
					<div class="nav-section__label">Управление</div>
					<a href="/users" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>Пользователи</a>
					<a href="/groups" class="nav-item nav-item--active"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>Группы</a>
					<a href="/subjects" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>Предметы</a>
					<a href="/specializations" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/></svg>Специальности</a>
				</div>
			{/if}
			{#if $userStore?.role?.name === 'professor'}
				<div class="nav-section">
					<div class="nav-section__label">Управление</div>
					<a href="/groups" class="nav-item nav-item--active"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>Группы</a>
					<a href="/subjects" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>Предметы</a>
				</div>
			{/if}
		</nav>
		<div class="sidebar__footer">
			<button class="theme-toggle" onclick={() => theme.toggle()}>
				{#if $theme === 'light'}<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>Тёмная тема
				{:else}<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/></svg>Светлая тема{/if}
			</button>
			<form method="POST" action="/auth/logout">
				<button type="submit" class="logout-btn"><svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/></svg>Выйти</button>
			</form>
			<a href="/profile" class="user-card">
				<div class="user-avatar">{$userStore?.name?.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase() ?? '?'}</div>
				<div class="user-info"><div class="user-name">{$userStore?.name ?? ''}</div><div class="user-role">{$userStore?.role?.display_name ?? ''}</div></div>
			</a>
		</div>
	</aside>

	<main class="main">
		<header class="topbar">
			<div class="topbar__title">Группы</div>
			<div class="topbar__actions">
				<div class="search-wrap">
					<svg class="search-icon" width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
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
			<div class="stats-row">
				<div class="stat-pill"><span class="stat-pill__value">{groups.length}</span><span class="stat-pill__label">групп всего</span></div>
				<div class="stat-pill"><span class="stat-pill__value">{groups.reduce((s,g) => s+g.students_count, 0)}</span><span class="stat-pill__label">студентов</span></div>
				<div class="stat-pill"><span class="stat-pill__value">{specializations.length}</span><span class="stat-pill__label">специальностей</span></div>
			</div>

			{#if loading}
				<div class="state-wrap"><div class="spinner-lg"></div><p>Загружаем группы...</p></div>
			{:else if error}
				<div class="state-wrap">
					<div class="state-icon state-icon--error"><svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg></div>
					<p>{error}</p>
					<button class="btn btn--ghost" onclick={loadData}>Повторить</button>
				</div>
			{:else if filtered.length === 0}
				<div class="state-wrap">
					<div class="state-icon"><svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg></div>
					<p>Групп не найдено</p>
					{#if canManage}<button class="btn btn--primary" onclick={() => openForm()}>Создать первую группу</button>{/if}
				</div>
			{:else}
				<!--
					ФИКС: flex-wrap + align-items:flex-start
					При grid все ячейки в строке растягиваются до высоты самой высокой.
					С flex каждая карточка независима по высоте.
				-->
				<div class="groups-grid">
					{#each filtered as group}
						{@const sel = getRemoveSel(group.id)}
						<div class="group-card" class:group-card--expanded={expandedId === group.id}>

							<div class="group-card__header">
								<div class="group-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg></div>
								<div class="group-card__info">
									<div class="group-card__name">{group.name}</div>
									<div class="group-card__meta">
										<span class="badge badge--accent">{courseLabel(group.course)}</span>
										{#if group.specialization}<span class="group-card__spec">{group.specialization.name}</span>{/if}
									</div>
								</div>
								<div class="group-card__actions">
									{#if canManage}
										<button class="icon-btn" title="Редактировать" onclick={() => openForm(group)}><svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg></button>
										<button class="icon-btn icon-btn--danger" title="Удалить" onclick={() => deletingId = group.id}><svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg></button>
									{/if}
									<button class="expand-btn" class:expand-btn--open={expandedId === group.id} onclick={() => toggleExpand(group.id)}>
										<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
									</button>
								</div>
							</div>

							<div class="group-card__footer">
								<div class="students-count">
									<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
									{group.students_count} {group.students_count === 1 ? 'студент' : group.students_count < 5 ? 'студента' : 'студентов'}
								</div>
							</div>

							{#if expandedId === group.id}
								<div class="students-list">
									<!-- Тулбар -->
									<div class="students-list__toolbar">
										<span class="students-list__label">Студенты группы</span>
										{#if canManage}
											<div class="students-list__btns">
												{#if sel.size > 0}
													<button class="btn btn--danger-solid btn--xs" onclick={() => removeGroupId = group.id}>
														<svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clip-rule="evenodd"/></svg>
														Удалить {sel.size}
													</button>
												{/if}
												<button class="btn btn--ghost btn--xs" onclick={() => openAddStudents(group.id)}>
													<svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
													Добавить
												</button>
											</div>
										{/if}
									</div>

									{#if group.students.length === 0}
										<div class="students-list__empty">В группе пока нет студентов</div>
									{:else}
										{#if canManage && group.students.length > 1}
											<div class="select-all-row">
												<label class="chk-label">
													<input type="checkbox"
																 checked={sel.size === group.students.length}
																 onchange={() => toggleRemoveAll(group.id)}
													/> Выбрать всех
												</label>
											</div>
										{/if}
										{#each group.students as student}
											<div class="student-item" class:student-item--selected={sel.has(student.id)}>
												{#if canManage}
													<input type="checkbox" class="student-check"
																 checked={sel.has(student.id)}
																 onchange={() => toggleRemove(group.id, student.id)}
													/>
												{/if}
												<div class="student-item__avatar">{initials(student.name)}</div>
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

<!-- ══ СОЗДАНИЕ / РЕДАКТИРОВАНИЕ ГРУППЫ ══ -->
{#if showForm}
	<div class="modal-overlay" onclick={() => showForm = false} role="dialog">
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<h2 class="modal__title">{editingGroup ? 'Редактировать группу' : 'Новая группа'}</h2>
				<button class="modal__close" onclick={() => showForm = false}><svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
			</div>
			<div class="modal__body">
				{#if formError}<div class="alert alert--error">{formError}</div>{/if}
				<div class="form-group"><label class="form-label">Название группы *</label><input class="form-input" type="text" placeholder="Например: ИСП-301" bind:value={formName} /></div>
				<div class="form-row">
					<div class="form-group"><label class="form-label">Курс *</label><select class="form-input" bind:value={formCourse}>{#each [1,2,3,4,5,6] as c}<option value={c}>{c}-й курс</option>{/each}</select></div>
					<div class="form-group"><label class="form-label">Специальность *</label><select class="form-input" bind:value={formSpecId}><option value={null}>Выберите...</option>{#each specializations as s}<option value={s.id}>{s.name}</option>{/each}</select></div>
				</div>
				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={() => showForm = false}>Отмена</button>
					<button class="btn btn--primary" onclick={submitForm} disabled={formLoading}>{#if formLoading}<span class="spinner"></span>{/if}{editingGroup ? 'Сохранить' : 'Создать'}</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- ══ УДАЛЕНИЕ ГРУППЫ ══ -->
{#if deletingId !== null}
	<div class="modal-overlay" onclick={() => deletingId = null} role="dialog">
		<div class="modal modal--sm" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header"><h2 class="modal__title">Удалить группу?</h2><button class="modal__close" onclick={() => deletingId = null}><svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button></div>
			<div class="modal__body">
				<p style="font-size:14px;color:var(--text2);line-height:1.6;">Все данные группы, привязки студентов и преподавателей будут удалены. Это действие нельзя отменить.</p>
				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={() => deletingId = null}>Отмена</button>
					<button class="btn btn--danger-solid" onclick={deleteGroup} disabled={deleteLoading}>{#if deleteLoading}<span class="spinner"></span>{/if}Удалить группу</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- ══ ДОБАВЛЕНИЕ СТУДЕНТОВ ══ -->
{#if addGroupId !== null}
	{@const tg = groups.find(g => g.id === addGroupId)}
	<div class="modal-overlay" onclick={() => addGroupId = null} role="dialog">
		<div class="modal modal--lg" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<div><h2 class="modal__title">Добавить студентов</h2>{#if tg}<div class="modal__sub">в группу {tg.name}</div>{/if}</div>
				<button class="modal__close" onclick={() => addGroupId = null}><svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
			</div>
			<div class="modal__body">
				{#if addError}<div class="alert alert--error">{addError}</div>{/if}

				<div class="search-wrap" style="width:100%;margin-bottom:12px">
					<svg class="search-icon" width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
					<input class="search-input" style="width:100%" type="text" placeholder="Имя, email или ID..." bind:value={addSearch} autofocus />
				</div>

				{#if availableLoading}
					<div style="display:flex;justify-content:center;padding:32px"><div class="spinner-lg"></div></div>
				{:else if availableStudents.length === 0}
					<div class="state-wrap" style="padding:28px 0">
						<div class="state-icon"><svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg></div>
						<p>Все студенты уже в группах</p>
					</div>
				{:else if filteredAvailable.length === 0}
					<p style="text-align:center;color:var(--text3);padding:24px 0;font-size:14px">Никого не нашлось</p>
				{:else}
					<div class="select-all-row">
						<label class="chk-label">
							<input type="checkbox"
										 checked={selectedToAdd.size === filteredAvailable.length && filteredAvailable.length > 0}
										 onchange={toggleAddAll}
							/> Выбрать всех ({filteredAvailable.length})
						</label>
						{#if selectedToAdd.size > 0}<span class="sel-badge">{selectedToAdd.size} выбрано</span>{/if}
					</div>

					<div class="available-list">
						{#each filteredAvailable as s}
							<div
								class="student-item student-item--clickable"
								class:student-item--selected={selectedToAdd.has(s.id)}
								onclick={() => toggleAdd(s.id)}
							>
								<input type="checkbox" class="student-check" checked={selectedToAdd.has(s.id)} onchange={() => toggleAdd(s.id)} onclick={(e) => e.stopPropagation()} />
								<div class="student-item__avatar">{initials(s.name)}</div>
								<div class="student-item__info">
									<div class="student-item__name">{s.name}</div>
									<div class="student-item__email">{s.email}</div>
								</div>
								<div class="student-item__id">#{s.id}</div>
							</div>
						{/each}
					</div>
				{/if}

				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={() => addGroupId = null}>Отмена</button>
					<button class="btn btn--primary" onclick={addStudents} disabled={addLoading || !selectedToAdd.size}>
						{#if addLoading}<span class="spinner"></span>{/if}
						Добавить{selectedToAdd.size > 0 ? ` (${selectedToAdd.size})` : ''}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- ══ ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ СТУДЕНТОВ ══ -->
{#if removeGroupId !== null}
	{@const rg = groups.find(g => g.id === removeGroupId)}
	{@const rc = getRemoveSel(removeGroupId!).size}
	<div class="modal-overlay" onclick={() => removeGroupId = null} role="dialog">
		<div class="modal modal--sm" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header"><h2 class="modal__title">Открепить {rc} {rc===1?'студента':'студентов'}?</h2><button class="modal__close" onclick={() => removeGroupId = null}><svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button></div>
			<div class="modal__body">
				<p style="font-size:14px;color:var(--text2);line-height:1.6;">
					{rc===1?'Студент будет':'Студенты будут'} откреплены от группы <strong>{rg?.name}</strong>. Аккаунты останутся, они просто окажутся без группы.
				</p>
				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={() => removeGroupId = null}>Отмена</button>
					<button class="btn btn--danger-solid" onclick={removeStudents} disabled={removeLoading}>{#if removeLoading}<span class="spinner"></span>{/if}Открепить</button>
				</div>
			</div>
		</div>
	</div>
{/if}
