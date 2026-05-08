<script lang="ts">
	import './styles.scss';
	import { onMount } from 'svelte';
	import { homeworksCountStore, userStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';

	let loading   = $state(true);
	let error     = $state('');

	let homeworks  = $state<any[]>([]);
	let journals   = $state<any[]>([]);
	let users      = $state<any[]>([]);
	let groups     = $state<any[]>([]);

	const role        = $derived($userStore?.role?.name ?? '');
	const isStudent   = $derived(role === 'student');
	const isProfessor = $derived(role === 'professor');
	const isAdmin     = $derived(role === 'admin' || role === 'moderator');

	function getGreeting(): string {
		const h = new Date().getHours();
		if (h < 6)  return 'Доброй ночи';
		if (h < 12) return 'Доброе утро';
		if (h < 18) return 'Добрый день';
		return 'Добрый вечер';
	}

	function getDate(): string {
		return new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
	}

	function formatDeadline(deadline: string): string {
		const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
		if (diff < 0)   return 'Просрочено';
		if (diff === 0) return 'Сегодня';
		if (diff === 1) return 'Завтра';
		if (diff <= 7)  return `${diff} дн.`;
		return new Date(deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
	}

	function deadlineColor(deadline: string): string {
		const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
		if (diff < 0)  return 'danger';
		if (diff <= 2) return 'danger';
		if (diff <= 5) return 'warning';
		return 'neutral';
	}

	function getInitials(name: string): string {
		return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
	}

	function calcJournalScore(journal: any) {
		const uid = String($userStore?.id);
		const entries = journal.entries?.[uid] ?? {};
		let total = 0;
		for (const e of Object.values(entries) as any[]) {
			if (e.score != null) total += e.score;
		}
		const capped  = Math.min(total, 40);
		const rating  = journal.ratings?.[uid];
		const rScore  = Math.min(rating?.rating_score ?? 0, 30);
		const eScore  = Math.min(rating?.exam_score   ?? 0, 30);
		return { current: total, capped, rScore, eScore, total: capped + rScore + eScore };
	}

	function calcAbsences(journalsList: any[]) {
		const uid = String($userStore?.id);
		let days = 0;
		for (const j of journalsList) {
			const entries = j.entries?.[uid] ?? {};
			for (const e of Object.values(entries) as any[]) {
				if ((e as any).is_absent) days++;
			}
		}
		return { days, hours: days * 2 };
	}

	async function loadData() {
		if (!$userStore) return;
		loading = true;
		error   = '';

		try {
			if (isStudent) {
				const [hwRes, jListRes] = await Promise.all([
					api<{ data: any[] }>('/homeworks'),
					api<{ data: any[] }>('/journals'),
				]);
				homeworks = hwRes.data?.data ?? [];
				const journalList = jListRes.data?.data ?? [];
				const details = await Promise.all(
					journalList.map((j: any) => api<{ data: any }>(`/journals/${j.id}`))
				);
				journals = details.map(r => r.data?.data).filter(Boolean);

			} else if (isProfessor) {
				const [hwRes, groupsRes] = await Promise.all([
					api<{ data: any[] }>('/homeworks'),
					api<{ data: any[] }>('/groups'),
				]);
				homeworks = hwRes.data?.data ?? [];
				groups    = groupsRes.data?.data ?? [];

			} else if (isAdmin) {
				const [usersRes, groupsRes, hwRes, journalsRes] = await Promise.all([
					api<{ data: any[] }>('/users'),
					api<{ data: any[] }>('/groups'),
					api<{ data: any[] }>('/homeworks'),
					api<{ data: any[] }>('/journals'),
				]);
				users     = usersRes.data?.data   ?? [];
				groups    = groupsRes.data?.data  ?? [];
				homeworks = hwRes.data?.data       ?? [];
				journals  = journalsRes.data?.data ?? [];
			}
		} catch {
			error = 'Не удалось загрузить данные';
		}
		loading = false;
	}

	onMount(() => {
		if ($userStore) loadData();
		else {
			const unsub = userStore.subscribe(u => {
				if (u) { loadData(); unsub(); }
			});
		}
	});

	// Студент
	const activeHw   = $derived(homeworks.filter(h => !h.is_expired && !h.submission?.is_checked));
	const expiredHw  = $derived(homeworks.filter(h => h.is_expired  && !h.submission?.is_checked));
	const checkedHw  = $derived(homeworks.filter(h => h.submission?.is_checked));
	const pendingHw  = $derived(homeworks.filter(h => h.submission  && !h.submission.is_checked));
	const absences   = $derived(calcAbsences(journals));
	const avgScore   = $derived((() => {
		const totals = journals.map(j => calcJournalScore(j).total).filter(t => t > 0);
		return totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : null;
	})());

	// Препод
	const pendingSubs  = $derived(homeworks.reduce((acc: number, hw: any) =>
		acc + (hw.submissions ?? []).filter((s: any) => !s.is_checked).length, 0));
	const activeHwProf = $derived(homeworks.filter(h => !h.is_expired).length);

	// Админ
	const studentsCount   = $derived(users.filter(u => u.role?.name === 'student').length);
	const professorsCount = $derived(users.filter(u => u.role?.name === 'professor').length);
	const unverifiedCount = $derived(users.filter(u => !u.email_verified_at).length);
	const activeHwAdmin   = $derived(homeworks.filter(h => !h.is_expired).length);
</script>

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
				<a href="/" class="nav-item nav-item--active">
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
			{#if role === 'admin' || role === 'moderator'}
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
					<a href="/specializations" class="nav-item">
						<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
						Специальности
					</a>
				</div>
			{/if}
			{#if role === 'professor'}
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
				<div class="user-avatar">{$userStore ? getInitials($userStore.name) : '?'}</div>
				<div class="user-info">
					<div class="user-name">{$userStore?.name ?? '...'}</div>
					<div class="user-role">{$userStore?.role?.display_name ?? ''}</div>
				</div>
			</a>
		</div>
	</aside>

	<main class="main">
		<header class="topbar">
			<div class="topbar__title">Главная</div>
		</header>

		<div class="content">
			<div class="greeting">
				<h1 class="greeting__text">{getGreeting()}, {$userStore?.name?.split(' ')[1] ?? $userStore?.name?.split(' ')[0] ?? ''}</h1>
				<p class="greeting__sub">{getDate()} · {$userStore?.role?.display_name ?? ''}</p>
			</div>

			{#if loading}
				<div class="state-wrap">
					<div class="spinner-lg"></div>
					<p>Загружаем данные...</p>
				</div>

			{:else if error}
				<div class="state-wrap">
					<p style="color:var(--danger)">{error}</p>
					<button class="btn" onclick={loadData}>Попробовать снова</button>
				</div>

				<!-- СТУДЕНТ -->
			{:else if isStudent}
				<div class="stats-grid">
					<div class="stat-card stat-card--accent">
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clip-rule="evenodd"/></svg></div>
						<div class="stat-card__val">{activeHw.length}</div>
						<div class="stat-card__label">Активных заданий</div>
						<div class="stat-card__sub" class:stat-card__sub--danger={expiredHw.length > 0}>
							{expiredHw.length > 0 ? `${expiredHw.length} просрочено` : 'Всё в порядке'}
						</div>
					</div>
					<div class="stat-card stat-card--success">
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg></div>
						<div class="stat-card__val">{checkedHw.length}</div>
						<div class="stat-card__label">Проверено заданий</div>
						<div class="stat-card__sub">{pendingHw.length > 0 ? `${pendingHw.length} ждут проверки` : 'Без ожидания'}</div>
					</div>
					<div class="stat-card" class:stat-card--danger={absences.days > 5}>
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg></div>
						<div class="stat-card__val">{absences.days}</div>
						<div class="stat-card__label">Пропущено занятий</div>
						<div class="stat-card__sub">{absences.hours} академических часов</div>
					</div>
					<div class="stat-card" class:stat-card--success={avgScore && avgScore >= 70} class:stat-card--warning={avgScore && avgScore >= 50 && avgScore < 70} class:stat-card--danger={avgScore && avgScore < 50}>
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg></div>
						<div class="stat-card__val">{avgScore ?? '—'}</div>
						<div class="stat-card__label">Средний балл</div>
						<div class="stat-card__sub">из 100 по предметам</div>
					</div>
				</div>

				<div class="bottom-grid">
					<div class="block">
						<div class="block__header">
							<span class="block__title">Ближайшие задания</span>
							<a href="/homework" class="block__link">Все задания→</a>
						</div>
						{#if activeHw.length === 0}
							<div class="empty-block">
								<svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor" style="color:var(--text3)"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
								<p>Нет активных заданий</p>
							</div>
						{:else}
							<div class="card">
								<table class="table">
									<thead><tr><th>Задание</th><th>Группа</th><th>Дедлайн</th><th></th></tr></thead>
									<tbody>
									{#each activeHw.slice(0, 5) as hw}
										{@const dl = hw.deadline_extended && hw.extended_deadline ? hw.extended_deadline : hw.deadline}
										<tr onclick={() => window.location.href=`/homework?open=${hw.id}`} style="cursor:pointer">
											<td class="table__main">{hw.title}</td>
											<td class="table__muted">{hw.group?.name}</td>
											<td><span class="badge badge--{deadlineColor(dl)}">{formatDeadline(dl)}</span></td>
											<td>{#if hw.submission}<span class="badge badge--accent">Ожидает проверки</span>{:else}<span class="badge badge--neutral">Не начато</span>{/if}</td>
										</tr>
									{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>

					<div class="block">
						<div class="block__header">
							<span class="block__title">Баллы по предметам</span>
							<a href="/journal" class="block__link">Ведомости →</a>
						</div>
						{#if journals.length === 0}
							<div class="empty-block">
								<p>Нет данных по журналам</p>
							</div>
						{:else}
							<div class="card card--pad">
								{#each journals as j}
									{@const sc = calcJournalScore(j)}
									<div class="subject-score">
										<div class="subject-score__name">{j.subject?.name}</div>
										<div class="subject-score__bar">
											<div class="progress-bar">
												<div class="progress-bar__fill"
														 class:progress-bar__fill--good={sc.total >= 60}
														 class:progress-bar__fill--warn={sc.total >= 40 && sc.total < 60}
														 class:progress-bar__fill--bad={sc.total < 40}
														 style="width:{sc.total}%"></div>
											</div>
											<span class="subject-score__val"
														class:subject-score__val--good={sc.total >= 60}
														class:subject-score__val--warn={sc.total >= 40 && sc.total < 60}
														class:subject-score__val--bad={sc.total > 0 && sc.total < 40}>
												{sc.total} / 100
											</span>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- ПРЕПОДАВАТЕЛЬ -->
			{:else if isProfessor}
				<div class="stats-grid">
					<div class="stat-card stat-card--danger">
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg></div>
						<div class="stat-card__val">{pendingSubs}</div>
						<div class="stat-card__label">Ждут проверки</div>
						<div class="stat-card__sub">Ответы студентов</div>
					</div>
					<div class="stat-card stat-card--accent">
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clip-rule="evenodd"/></svg></div>
						<div class="stat-card__val">{activeHwProf}</div>
						<div class="stat-card__label">Активных заданий</div>
						<div class="stat-card__sub">Текущий период</div>
					</div>
					<div class="stat-card">
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg></div>
						<div class="stat-card__val">{groups.length}</div>
						<div class="stat-card__label">Моих групп</div>
						<div class="stat-card__sub">Привязанных ко мне</div>
					</div>
					<div class="stat-card stat-card--success">
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg></div>
						<div class="stat-card__val">{homeworks.reduce((acc: number, hw: any) => acc + (hw.submissions ?? []).filter((s: any) => s.is_checked).length, 0)}</div>
						<div class="stat-card__label">Проверено всего</div>
						<div class="stat-card__sub">За всё время</div>
					</div>
				</div>

				<div class="bottom-grid">
					<div class="block">
						<div class="block__header">
							<span class="block__title">Ждут проверки</span>
							<a href="/homework" class="block__link">Все задания →</a>
						</div>
						{#if homeworks.filter((hw: any) => (hw.submissions ?? []).some((s: any) => !s.is_checked)).length === 0}
							<div class="empty-block">
								<svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor" style="color:var(--text3)"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
								<p>Все задания проверены</p>
							</div>
						{:else}
							<div class="card">
								<table class="table">
									<thead><tr><th>Задание</th><th>Группа</th><th>Ждут</th></tr></thead>
									<tbody>
									{#each homeworks.filter((hw: any) => (hw.submissions ?? []).some((s: any) => !s.is_checked)).slice(0, 6) as hw}
										<tr onclick={() => window.location.href=`/homework?open=${hw.id}`} style="cursor:pointer">
											<td class="table__main">{hw.title}</td>
											<td class="table__muted">{hw.group?.name}</td>
											<td><span class="badge badge--danger">{(hw.submissions ?? []).filter((s: any) => !s.is_checked).length} чел.</span></td>
										</tr>
									{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>

					<div class="block">
						<div class="block__header">
							<span class="block__title">Мои группы</span>
							<a href="/groups" class="block__link">Все группы →</a>
						</div>
						{#if groups.length === 0}
							<div class="empty-block"><p>Нет привязанных групп</p></div>
						{:else}
							<div class="card card--pad">
								{#each groups as group}
									<div class="group-row">
										<div class="group-row__icon"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg></div>
										<div class="group-row__info">
											<div class="group-row__name">{group.name}</div>
											<div class="group-row__meta">{group.course}-й курс · {group.students_count ?? 0} студентов</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- АДМИН/МОДЕРАТОР -->
			{:else if isAdmin}
				<div class="stats-grid stats-grid--6">
					<div class="stat-card stat-card--accent">
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg></div>
						<div class="stat-card__val">{studentsCount}</div>
						<div class="stat-card__label">Студентов</div>
						<div class="stat-card__sub">Зарегистрировано</div>
					</div>
					<div class="stat-card">
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg></div>
						<div class="stat-card__val">{professorsCount}</div>
						<div class="stat-card__label">Преподавателей</div>
						<div class="stat-card__sub">В системе</div>
					</div>
					<div class="stat-card">
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg></div>
						<div class="stat-card__val">{groups.length}</div>
						<div class="stat-card__label">Групп</div>
						<div class="stat-card__sub">Всего в системе</div>
					</div>
					<div class="stat-card stat-card--success">
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clip-rule="evenodd"/></svg></div>
						<div class="stat-card__val">{activeHwAdmin}</div>
						<div class="stat-card__label">Активных заданий</div>
						<div class="stat-card__sub">Из {homeworks.length} всего</div>
					</div>
					<div class="stat-card">
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg></div>
						<div class="stat-card__val">{journals.length}</div>
						<div class="stat-card__label">Журналов</div>
						<div class="stat-card__sub">В системе</div>
					</div>
					<div class="stat-card" class:stat-card--danger={unverifiedCount > 0}>
						<div class="stat-card__icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg></div>
						<div class="stat-card__val">{unverifiedCount}</div>
						<div class="stat-card__label">Email не подтверждён</div>
						<div class="stat-card__sub">Требует внимания</div>
					</div>
				</div>

				<div class="bottom-grid">
					<div class="block">
						<div class="block__header">
							<span class="block__title">Последние регистрации</span>
							<a href="/users" class="block__link">Все пользователи →</a>
						</div>
						<div class="card">
							<table class="table">
								<thead><tr><th>Пользователь</th><th>Роль</th><th>Email</th></tr></thead>
								<tbody>
								{#each users.slice(0, 6) as user}
									<tr>
										<td>
											<div style="display:flex;align-items:center;gap:8px;">
												<div style="width:26px;height:26px;border-radius:50%;background:var(--accent-light);color:var(--accent);font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">{getInitials(user.name)}</div>
												<span style="font-size:13px;font-weight:500;color:var(--text)">{user.name}</span>
											</div>
										</td>
										<td><span class="badge badge--{user.role?.name === 'student' ? 'neutral' : user.role?.name === 'professor' ? 'accent' : user.role?.name === 'admin' ? 'danger' : 'warning'}">{user.role?.display_name ?? '—'}</span></td>
										<td class="table__muted" style="font-size:12px">{user.email}</td>
									</tr>
								{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div class="block">
						<div class="block__header">
							<span class="block__title">Группы системы</span>
							<a href="/groups" class="block__link">Все группы →</a>
						</div>
						<div class="card card--pad">
							{#each groups.slice(0, 7) as group}
								<div class="group-row">
									<div class="group-row__icon"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg></div>
									<div class="group-row__info">
										<div class="group-row__name">{group.name}</div>
										<div class="group-row__meta">{group.course}-й курс · {group.students_count ?? 0} студентов</div>
									</div>
									<span class="badge badge--neutral" style="font-size:10px">{group.specialization?.name?.split(' ')[0] ?? ''}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</main>
</div>
