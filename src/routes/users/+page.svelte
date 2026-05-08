<script lang="ts">
	import './styles.scss';
	import { onMount } from 'svelte';
	import { homeworksCountStore, userStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';

	// --- ТИПЫ ---
	interface Role { id: number; name: string; display_name: string; }
	interface User {
		id: number;
		name: string;
		email: string;
		email_verified_at: string | null;
		is_active: boolean;
		created_at: string;
		role: Role | null;
		group: string | null;
		professor_groups: { id: number; name: string; course: number }[] | null;
	}

	// --- СОСТОЯНИЕ ---
	let users       = $state<User[]>([]);
	let roles       = $state<Role[]>([]);
	let loading     = $state(true);
	let error       = $state('');
	let search      = $state('');
	let filterRole  = $state('all');

	// Модалка изменения роли
	let selectedUser  = $state<User | null>(null);
	let showModal     = $state(false);
	let newRole       = $state('');
	let roleLoading   = $state(false);
	let roleError     = $state('');
	let roleSuccess   = $state('');

	let groups          = $state<{ id: number; name: string; course: number }[]>([]);
	let selectedGroupId   = $state<number | null>(null);      // для студента
	let selectedGroupIds  = $state<number[]>([]);              // для профессора
	let groupLoading      = $state(false);
	let groupError        = $state('');
	let groupSuccess      = $state('');

	let allSubjects        = $state<{ id: number; name: string }[]>([]);
	let selectedSubjectIds = $state<number[]>([]);
	let subjectLoading     = $state(false);
	let subjectSuccess     = $state('');
	let subjectError       = $state('');

	// --- ФИЛЬТРАЦИЯ ---
	const filtered = $derived(users.filter(u => {
		const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
			u.email.toLowerCase().includes(search.toLowerCase());
		const matchRole   = filterRole === 'all' || u.role?.name === filterRole;
		return matchSearch && matchRole;
	}));

	const counts = $derived({
		all:       users.length,
		admin:     users.filter(u => u.role?.name === 'admin').length,
		moderator: users.filter(u => u.role?.name === 'moderator').length,
		professor: users.filter(u => u.role?.name === 'professor').length,
		student:   users.filter(u => u.role?.name === 'student').length,
		unverified: users.filter(u => !u.email_verified_at).length,
	});

	// --- ЗАГРУЗКА ---
	async function loadData() {
		loading = true;
		error   = '';

		const [usersRes, rolesRes, groupsRes, subjectsRes] = await Promise.all([
			api<{ data: any[] }>('/users'),
			api<{ data: any[] }>('/roles'),
			api<{ data: any[] }>('/groups'),
			api<{ data: any[] }>('/subjects'),
		]);

		loading = false;

		if (usersRes.error) { error = usersRes.error; return; }
		users  = usersRes.data?.data ?? [];
		roles  = rolesRes.data?.data ?? [];
		groups = groupsRes.data?.data ?? [];
		allSubjects = subjectsRes.data?.data ?? [];
	}

	onMount(loadData);

	// --- ХЕЛПЕРЫ ---
	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString('ru-RU', {
			day: 'numeric', month: 'short', year: 'numeric'
		});
	}

	function getInitials(name: string): string {
		return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
	}

	function getRoleColor(role: Role | null): string {
		const map: Record<string, string> = {
			admin: 'danger', moderator: 'warning',
			professor: 'accent', student: 'neutral',
		};
		return map[role?.name ?? ''] ?? 'neutral';
	}

	// --- МОДАЛКА ---
	async function openModal(user: User) {
		selectedUser     = user;
		newRole          = user.role?.name ?? 'student';
		selectedGroupId  = groups.find(g => g.name === user.group)?.id ?? null;
		selectedGroupIds = user.professor_groups?.map(g => g.id) ?? [];
		roleError        = '';
		roleSuccess      = '';
		groupError       = '';
		groupSuccess     = '';
		subjectError     = '';
		subjectSuccess   = '';
		selectedSubjectIds = [];
		showModal        = true;

		// Загружаем предметы препода
		if (user.role?.name === 'professor') {
			const { data } = await api<{ data: any[] }>(`/users/${user.id}/subjects`);
			selectedSubjectIds = data?.data?.map((s: any) => s.id) ?? [];
		}
	}

	function closeModal() {
		showModal    = false;
		selectedUser = null;
	}

	async function handleRoleUpdate() {
		if (!selectedUser || !newRole) return;
		if (newRole === selectedUser.role?.name) {
			roleError = 'Выберите другую роль';
			return;
		}

		roleLoading = true;
		roleError   = '';
		roleSuccess = '';

		const { error: err } = await api(`/users/${selectedUser.id}/role`, {
			method: 'PUT',
			body: { role: newRole },
		});

		roleLoading = false;

		if (err) { roleError = err; return; }

		roleSuccess = 'Роль успешно обновлена';
		await loadData();
		selectedUser = users.find(u => u.id === selectedUser!.id) ?? null;
		setTimeout(() => {
			closeModal();
		}, 500);
	}

	async function handleGroupUpdate() {
		if (!selectedUser) return;
		groupLoading = true;
		groupError   = '';
		groupSuccess = '';

		const isProfessor = selectedUser.role?.name === 'professor';

		const { error: err } = await api(`/users/${selectedUser.id}/group`, {
			method: 'PUT',
			body: isProfessor
				? { group_ids: selectedGroupIds }
				: { group_id: selectedGroupId },
		});

		groupLoading = false;
		if (err) { groupError = err; return; }

		groupSuccess = 'Группы успешно обновлены';
		await loadData();
		selectedUser = users.find(u => u.id === selectedUser!.id) ?? null;

		setTimeout(() => {
			closeModal();
		}, 750);
	}

	async function handleSubjectsUpdate() {
		if (!selectedUser) return;
		subjectLoading = true;
		subjectError   = '';
		subjectSuccess = '';

		const { error: err } = await api(`/users/${selectedUser.id}/subjects`, {
			method: 'PUT',
			body: { subject_ids: selectedSubjectIds },
		});

		subjectLoading = false;
		if (err) { subjectError = err; return; }
		subjectSuccess = 'Предметы успешно обновлены';

		setTimeout(() => {
			closeModal();
		}, 750);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
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
				<a href="/news" class="nav-item nav-item--active">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"/><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/></svg>
					Новости
				</a>
				<a href="/homework" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
					Задания
					{#if $homeworksCountStore > 0}
						<span class="nav-badge">{$homeworksCountStore}</span>
					{/if}
				</a>
				<a href="/journals" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
					Ведомости
				</a>
			</div>
			{#if $userStore?.role?.name === 'admin' || $userStore?.role?.name === 'moderator'}
				<div class="nav-section">
					<div class="nav-section__label">Управление</div>
					<a href="/users" class="nav-item nav-item--active">
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
					<a href="/specializations" class="nav-item">
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

	<!-- MAIN -->
	<main class="main">
		<header class="topbar">
			<div class="topbar__title">Пользователи</div>
			<div class="topbar__actions">
				<div class="search-wrap">
					<svg class="search-icon" width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
					</svg>
					<input
						class="search-input"
						type="text"
						placeholder="Поиск по имени или email..."
						bind:value={search}
					/>
				</div>
			</div>
		</header>

		<div class="content">
			<!-- СТАТЫ -->
			<div class="stats-grid">
				<div class="stat-card">
					<div class="stat-card__label">Всего пользователей</div>
					<div class="stat-card__value">{counts.all}</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__label">Студентов</div>
					<div class="stat-card__value stat-card__value--accent">{counts.student}</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__label">Преподавателей</div>
					<div class="stat-card__value" style="color:var(--accent)">{counts.professor}</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__label">Не подтвердили email</div>
					<div class="stat-card__value" style="color:var(--warning)">{counts.unverified}</div>
				</div>
			</div>

			<!-- ФИЛЬТРЫ ПО РОЛЯМ -->
			<div class="filters">
				{#each [
					{ key: 'all',       label: 'Все',           count: counts.all       },
					{ key: 'student',   label: 'Студенты',      count: counts.student   },
					{ key: 'professor', label: 'Преподаватели', count: counts.professor  },
					{ key: 'moderator', label: 'Модераторы',    count: counts.moderator  },
					{ key: 'admin',     label: 'Администраторы', count: counts.admin    },
				] as f}
					<button
						class="filter-btn"
						class:filter-btn--active={filterRole === f.key}
						onclick={() => filterRole = f.key}
					>
						{f.label}
						{#if f.count > 0}
							<span class="filter-count">{f.count}</span>
						{/if}
					</button>
				{/each}
			</div>

			<!-- ТАБЛИЦА -->
			{#if loading}
				<div class="state-wrap">
					<div class="spinner-lg"></div>
					<p>Загружаем пользователей...</p>
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
						<svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
					</div>
					<p>Пользователи не найдены</p>
				</div>

			{:else}
				<!-- ДЕСКТОП ТАБЛИЦА -->
				<div class="card table-wrap">
					<table class="table">
						<thead>
						<tr>
							<th>Пользователь</th>
							<th>Email</th>
							<th>Роль</th>
							<th>Группа</th>
							<th>Зарегистрирован</th>
							<th>Статус</th>
							<th></th>
						</tr>
						</thead>
						<tbody>
						{#each filtered as user}
							<tr>
								<td>
									<div class="user-cell">
										<div class="user-cell__avatar" style="background: {user.id === $userStore?.id ? 'var(--accent)' : 'var(--bg3)'}; color: {user.id === $userStore?.id ? 'white' : 'var(--text2)'}">
											{getInitials(user.name)}
										</div>
										<div>
											<div class="user-cell__name">
												{user.name}
												{#if user.id === $userStore?.id}
													<span class="you-badge">вы</span>
												{/if}
											</div>
											<div class="user-cell__id">ID: {user.id}</div>
										</div>
									</div>
								</td>
								<td class="table__muted">{user.email}</td>
								<td>
									{#if user.role}
										<span class="badge badge--{getRoleColor(user.role)}">{user.role.display_name}</span>
									{:else}
										<span class="badge badge--neutral">Без роли</span>
									{/if}
								</td>
								<td class="table__muted">{user.group ?? '—'}</td>
								<td class="table__mono">{formatDate(user.created_at)}</td>
								<td>
									{#if user.email_verified_at}
										<span class="badge badge--success">Активен</span>
									{:else}
										<span class="badge badge--warning">Не подтверждён</span>
									{/if}
								</td>
								<td>
									{#if user.id !== $userStore?.id}
										<button class="btn btn--ghost btn--sm" onclick={() => openModal(user)}>
											Изменить
										</button>
									{/if}
								</td>
							</tr>
						{/each}
						</tbody>
					</table>
				</div>

				<!-- МОБИЛЬНЫЕ КАРТОЧКИ -->
				<div class="mobile-cards">
					{#each filtered as user}
						<div class="mobile-card">
							<div class="mobile-card__header">
								<div class="user-cell">
									<div class="user-cell__avatar" style="background: {user.id === $userStore?.id ? 'var(--accent)' : 'var(--bg3)'}; color: {user.id === $userStore?.id ? 'white' : 'var(--text2)'}">
										{getInitials(user.name)}
									</div>
									<div>
										<div class="user-cell__name">
											{user.name}
											{#if user.id === $userStore?.id}
												<span class="you-badge">вы</span>
											{/if}
										</div>
										<div class="user-cell__id">{user.email}</div>
									</div>
								</div>
								<div class="mobile-card__badges">
									{#if user.role}
										<span class="badge badge--{getRoleColor(user.role)}">{user.role.display_name}</span>
									{/if}
									{#if user.email_verified_at}
										<span class="badge badge--success">Активен</span>
									{:else}
										<span class="badge badge--warning">Не подтверждён</span>
									{/if}
								</div>
							</div>
							<div class="mobile-card__meta">
								<span>ID: {user.id}</span>
								{#if user.group}<span>Группа: {user.group}</span>{/if}
								<span>Зарегистрирован: {formatDate(user.created_at)}</span>
							</div>
							{#if user.id !== $userStore?.id}
								<button class="btn btn--ghost btn--sm" style="width:100%;justify-content:center;margin-top:10px;" onclick={() => openModal(user)}>
									Изменить
								</button>
							{/if}
						</div>
					{/each}
				</div>

				<div class="table-footer">
					Показано {filtered.length} из {users.length} пользователей
				</div>
			{/if}
		</div>
	</main>
</div>

<!-- МОДАЛКА ИЗМЕНЕНИЯ РОЛИ -->
{#if showModal && selectedUser}
	<div class="modal-overlay" onclick={closeModal} role="dialog" aria-modal="true">
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<h2 class="modal__title">Изменить</h2>
				<button class="modal__close" onclick={closeModal}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
			<div class="modal__body">
				<!-- Пользователь -->
				<div class="modal-user">
					<div class="user-cell__avatar user-cell__avatar--lg">
						{getInitials(selectedUser.name)}
					</div>
					<div>
						<div class="modal-user__name">{selectedUser.name}</div>
						<div class="modal-user__email">{selectedUser.email}</div>
						<div style="margin-top:6px;">
              <span class="badge badge--{getRoleColor(selectedUser.role)}">
                {selectedUser.role?.display_name ?? 'Без роли'}
              </span>
						</div>
					</div>
				</div>

				<div class="modal__divider"></div>

				{#if roleSuccess}
					<div class="alert alert--success">
						<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
						{roleSuccess}
					</div>
				{/if}

				{#if roleError}
					<div class="alert alert--error">
						<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
						{roleError}
					</div>
				{/if}

				<!-- Выбор роли -->
				<div class="role-grid">
					{#each roles as role}
						<button
							class="role-option"
							class:role-option--active={newRole === role.name}
							onclick={() => newRole = role.name}
						>
							<div class="role-option__indicator"></div>
							<div>
								<div class="role-option__name">{role.display_name}</div>
								<div class="role-option__desc">
									{#if role.name === 'admin'}Полный доступ ко всему
									{:else if role.name === 'moderator'}Управление данными
									{:else if role.name === 'professor'}Создание заданий и журналов
									{:else}Просмотр и сдача заданий
									{/if}
								</div>
							</div>
						</button>
					{/each}
				</div>

				{#if selectedUser.role?.name === 'student' || selectedUser.role?.name === 'professor'}
					<div class="modal__divider"></div>

					<div class="group-section">
						<div class="group-section__title">
							{selectedUser.role.name === 'professor' ? 'Группы преподавателя' : 'Группа студента'}
						</div>

						{#if groupSuccess}
							<div class="alert alert--success">
								<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
								{groupSuccess}
							</div>
						{/if}

						{#if groupError}
							<div class="alert alert--error">
								<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
								{groupError}
							</div>
						{/if}

						{#if selectedUser.role.name === 'student'}
							<!-- СТУДЕНТ — один селект -->
							<div class="group-select-row">
								<select class="form-input" bind:value={selectedGroupId}>
									<option value={null}>— Без группы —</option>
									{#each groups as g}
										<option value={g.id}>{g.name} ({g.course}-й курс)</option>
									{/each}
								</select>
								<button class="btn btn--primary btn--sm" onclick={handleGroupUpdate} disabled={groupLoading}>
									{#if groupLoading}<span class="spinner"></span>{/if}
									Сохранить
								</button>
							</div>

							{#if selectedUser.group}
								<div class="current-group">
									<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>
									Текущая группа: <strong>{selectedUser.group}</strong>
								</div>
							{/if}

						{:else}
							<!-- ПРЕПОДАВАТЕЛЬ — мультиселект чекбоксами -->
							<div class="groups-checklist">
								{#each groups as g}
									<label class="group-check">
										<input
											type="checkbox"
											checked={selectedGroupIds.includes(g.id)}
											onchange={(e) => {
                const checked = (e.target as HTMLInputElement).checked;
                selectedGroupIds = checked
                  ? [...selectedGroupIds, g.id]
                  : selectedGroupIds.filter(id => id !== g.id);
              }}
										/>
										<div class="group-check__box">
											{#if selectedGroupIds.includes(g.id)}
												<svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
											{/if}
										</div>
										<div class="group-check__info">
											<span class="group-check__name">{g.name}</span>
											<span class="group-check__course">{g.course}-й курс</span>
										</div>
									</label>
								{/each}
							</div>

							{#if selectedGroupIds.length > 0}
								<div class="selected-count">
									Выбрано групп: <strong>{selectedGroupIds.length}</strong>
								</div>
							{/if}

							<button
								class="btn btn--primary"
								style="width:100%;justify-content:center;margin-top:12px;"
								onclick={handleGroupUpdate}
								disabled={groupLoading}
							>
								{#if groupLoading}<span class="spinner"></span>{/if}
								Сохранить группы
							</button>
						{/if}
					</div>
				{/if}

				<!-- Предметы — только для преподавателей -->
				{#if selectedUser.role?.name === 'professor'}
					<div class="modal__divider"></div>

					<div class="group-section">
						<div class="group-section__title">Предметы преподавателя</div>

						{#if subjectSuccess}
							<div class="alert alert--success">
								<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
								{subjectSuccess}
							</div>
						{/if}

						{#if subjectError}
							<div class="alert alert--error">
								<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
								{subjectError}
							</div>
						{/if}

						<div class="groups-checklist">
							{#each allSubjects as subject}
								<label class="group-check" class:group-check--active={selectedSubjectIds.includes(subject.id)}>
									<input
										type="checkbox"
										checked={selectedSubjectIds.includes(subject.id)}
										onchange={(e) => {
                            const checked = (e.target as HTMLInputElement).checked;
                            selectedSubjectIds = checked
                                ? [...selectedSubjectIds, subject.id]
                                : selectedSubjectIds.filter(id => id !== subject.id);
                        }}
									/>
									<div class="group-check__box">
										{#if selectedSubjectIds.includes(subject.id)}
											<svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
										{/if}
									</div>
									<span class="group-check__name">{subject.name}</span>
								</label>
							{/each}
						</div>

						<button
							class="btn btn--primary"
							style="width:100%;justify-content:center;margin-top:12px;"
							onclick={handleSubjectsUpdate}
							disabled={subjectLoading}
						>
							{#if subjectLoading}<span class="spinner"></span>{/if}
							Сохранить предметы
						</button>
					</div>
				{/if}

				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={closeModal}>Отмена</button>
					<button
						class="btn btn--primary"
						onclick={handleRoleUpdate}
						disabled={roleLoading || newRole === selectedUser.role?.name}
					>
						{#if roleLoading}<span class="spinner"></span>{/if}
						Сохранить роль
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
