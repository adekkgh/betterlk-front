<script lang="ts">
	import './styles.scss';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { userStore, homeworksCountStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';

	interface Student { id: number; name: string; }
	interface Entry { id?: number; is_absent: boolean; score: number | null; }
	interface Rating { id?: number; rating_score: number | null; exam_score: number | null; }
	interface JournalData {
		id: number;
		subject: { id: number; name: string };
		group: { id: number; name: string };
		professor: { id: number; name: string };
		semester: 1 | 2;
		year: number;
		students: Student[];
		entries: Record<number, Record<string, Entry>>;
		ratings: Record<number, Rating>;
	}

	const journalId = $derived(Number($page.params.id));

	let journal     = $state<JournalData | null>(null);
	let loading     = $state(true);
	let error       = $state('');

	// Inline-редактирование ячейки
	let editingCell = $state<{ studentId: number; date: string } | null>(null);
	let editAbsent  = $state(false);
	let editScore   = $state<string>('');
	let saving      = $state(false);

	// Редактирование рейтинга — отдельная модалка
	let editingRating   = $state<number | null>(null); // student_id
	let editRatingScore = $state<string>('');
	let editExamScore   = $state<string>('');
	let savingRating    = $state(false);
	let ratingError     = $state('');

	// Навигация по месяцам
	let tableRef = $state<HTMLDivElement | null>(null);

	const isStudent = $derived($userStore?.role?.name === 'student');
	const canEdit   = $derived(['admin', 'moderator', 'professor'].includes($userStore?.role?.name ?? ''));

	// Генерация ВСЕХ дат семестра (только будни)
	const allDates = $derived((() => {
		if (!journal) return [];
		const dates: string[] = [];
		const sem  = journal.semester;
		const year = journal.year;

		// Используем последний день месяца через day=0 следующего месяца
		const startDate = sem === 1
			? new Date(year, 8, 1)       // 1 сентября
			: new Date(year, 1, 1);      // 1 февраля

		const endDate = sem === 1
			? new Date(year + 1, 1, 0)   // последний день января (0-й день февраля)
			: new Date(year, 6, 0);      // последний день июня (0-й день июля)

		const cur = new Date(startDate);
		while (cur <= endDate) {
			const dow = cur.getDay();
			// 0 = воскресенье, 6 = суббота — исключаем
			if (dow !== 0 && dow !== 6) {
				// Безопасное получение локальной строки yyyy-mm-dd
				dates.push(cur.toLocaleDateString('sv-SE'));
			}
			cur.setDate(cur.getDate() + 1);
		}
		return dates;
	})());

	// Месяцы семестра для навигации
	const semesterMonths = $derived((() => {
		if (!journal) return [];
		const months = journal.semester === 1
			? [
				{ label: 'Сентябрь', month: 9,  year: journal.year     },
				{ label: 'Октябрь',  month: 10, year: journal.year     },
				{ label: 'Ноябрь',   month: 11, year: journal.year     },
				{ label: 'Декабрь',  month: 12, year: journal.year     },
				{ label: 'Январь',   month: 1,  year: journal.year + 1 },
			]
			: [
				{ label: 'Февраль', month: 2, year: journal.year },
				{ label: 'Март',    month: 3, year: journal.year },
				{ label: 'Апрель',  month: 4, year: journal.year },
				{ label: 'Май',     month: 5, year: journal.year },
				{ label: 'Июнь',    month: 6, year: journal.year },
			];
		return months;
	})());

	function scrollToMonth(month: number, year: number) {
		if (!tableRef) return;
		const targetDate = `${year}-${String(month).padStart(2, '0')}-01`;
		// Ищем первую дату этого месяца в allDates
		const firstDate = allDates.find(d => d.startsWith(`${year}-${String(month).padStart(2, '0')}`));
		if (!firstDate) return;
		const idx = allDates.indexOf(firstDate);
		// Каждая ячейка ~44px, колонка имени ~180px
		const scrollX = idx * 40;
		tableRef.scrollTo({ left: scrollX, behavior: 'smooth' });
	}

	function fmtDate(dateStr: string): { day: string; month: string; dow: string; isToday: boolean } {
		const d    = new Date(dateStr + 'T00:00:00');
		const dows = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
		const mons = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
		const today = new Date().toISOString().split('T')[0];
		return {
			day:     String(d.getDate()),
			month:   mons[d.getMonth()],
			dow:     dows[d.getDay()],
			isToday: dateStr === today,
		};
	}

	// Группировка дат по месяцам для рендера разделителей
	function getMonthSpan(dates: string[]): { label: string; count: number }[] {
		const spans: { label: string; count: number }[] = [];
		const mons = ['','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
		let cur = '';
		let count = 0;
		for (const d of dates) {
			const m = Number(d.split('-')[1]);
			const label = mons[m];
			if (label !== cur) {
				if (cur) spans.push({ label: cur, count });
				cur   = label;
				count = 1;
			} else {
				count++;
			}
		}
		if (cur) spans.push({ label: cur, count });
		return spans;
	}

	function getStats(studentId: number) {
		const entries = journal?.entries[studentId] ?? {};
		let totalScore = 0;
		let absentDays = 0;

		for (const e of Object.values(entries)) {
			if (e.score !== null) totalScore += e.score;
			if (e.is_absent) absentDays++;
		}

		const cappedScore  = Math.min(totalScore, 40);
		const rating       = journal?.ratings[studentId];
		const ratingScore  = Math.min(rating?.rating_score ?? 0, 30);
		const examScore    = Math.min(rating?.exam_score   ?? 0, 30);
		const grandTotal   = cappedScore + ratingScore + examScore;

		return { totalScore, cappedScore, absentDays, absentHours: absentDays * 2, ratingScore, examScore, grandTotal };
	}

	async function loadJournal() {
		loading = true;
		error   = '';
		const { data, error: err } = await api<{ data: JournalData }>(`/journals/${journalId}`);
		loading = false;
		if (err) { error = err; return; }
		journal = data?.data ?? null;
	}

	onMount(loadJournal);

	// Открытие ячейки
	function openCell(studentId: number, date: string) {
		if (!canEdit) return;
		// Если кликнули на ту же ячейку — закрываем
		if (editingCell?.studentId === studentId && editingCell?.date === date) {
			editingCell = null;
			return;
		}
		const entry = journal?.entries[studentId]?.[date];
		editingCell = { studentId, date };
		editAbsent  = entry?.is_absent ?? false;
		editScore   = entry?.score != null ? String(entry.score) : '';
	}

	async function saveCell() {
		if (!editingCell || !journal) return;
		saving = true;

		const score = String(editScore).trim() !== '' ? Number(editScore) : null;

		const { error: err } = await api(`/journals/${journal.id}/entry`, {
			method: 'POST',
			body: {
				student_id: editingCell.studentId,
				date:       editingCell.date,
				is_absent:  editAbsent,
				score,
			},
		});

		saving = false;
		if (err) { return; }

		if (!journal.entries[editingCell.studentId]) {
			journal.entries[editingCell.studentId] = {};
		}

		if (!editAbsent && score === null) {
			delete journal.entries[editingCell.studentId][editingCell.date];
		} else {
			journal.entries[editingCell.studentId][editingCell.date] = { is_absent: editAbsent, score };
		}

		journal = { ...journal };
		editingCell = null;
	}

	// Модалка рейтинга
	function openRatingModal(studentId: number) {
		if (!canEdit) return;
		const r = journal?.ratings[studentId];
		editingRating   = studentId;
		editRatingScore = r?.rating_score != null ? String(r.rating_score) : '';
		editExamScore   = r?.exam_score   != null ? String(r.exam_score)   : '';
		ratingError     = '';
	}

	async function saveRating() {
		if (editingRating === null || !journal) return;

		const rScore = String(editRatingScore).trim() !== '' ? Number(editRatingScore) : null;
		const eScore = String(editExamScore).trim()   !== '' ? Number(editExamScore)   : null;

		// Валидация
		if (rScore !== null && (rScore < 0 || rScore > 30)) {
			ratingError = 'Рейтинговая работа: максимум 30 баллов';
			return;
		}
		if (eScore !== null && (eScore < 0 || eScore > 30)) {
			ratingError = 'Экзамен: максимум 30 баллов';
			return;
		}

		savingRating = true;
		ratingError  = '';

		const { error: err } = await api(`/journals/${journal.id}/rating`, {
			method: 'POST',
			body: {
				student_id:   editingRating,
				rating_score: rScore,
				exam_score:   eScore,
			},
		});

		savingRating = false;
		if (err) { ratingError = err; return; }

		if (!journal.ratings[editingRating]) {
			journal.ratings[editingRating] = { rating_score: null, exam_score: null };
		}
		journal.ratings[editingRating].rating_score = rScore;
		journal.ratings[editingRating].exam_score   = eScore;
		journal = { ...journal };
		editingRating = null;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			editingCell   = null;
			editingRating = null;
		}
		if (e.key === 'Enter' && editingRating !== null) saveRating();
	}

	function semLabel(sem: 1 | 2) {
		return sem === 1 ? '1 семестр (сен–янв)' : '2 семестр (фев–июн)';
	}

	// Студент для модалки рейтинга
	const editingStudent = $derived(
		editingRating !== null ? journal?.students.find(s => s.id === editingRating) : null
	);
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
				<a href="/homework" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
					Задания
					{#if $homeworksCountStore > 0}<span class="nav-badge">{$homeworksCountStore}</span>{/if}
				</a>
				<a href="/journals" class="nav-item nav-item--active">
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
			<div class="topbar__left">
				<a href="/journals" class="back-btn">
					<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
					Ведомости
				</a>
				{#if journal}
					<div class="topbar__divider"></div>
					<div class="topbar__info">
						<span class="topbar__subject">{journal.subject.name}</span>
						<span class="topbar__meta">{journal.group.name} · {semLabel(journal.semester)} {journal.year}</span>
					</div>
				{/if}
			</div>
		</header>

		<div class="content">
			{#if loading}
				<div class="state-wrap">
					<div class="spinner-lg"></div>
					<p>Загружаем журнал...</p>
				</div>
			{:else if error}
				<div class="state-wrap">
					<div class="state-icon state-icon--error">
						<svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
					</div>
					<p>{error}</p>
					<button class="btn btn--ghost" onclick={loadJournal}>Попробовать снова</button>
				</div>
			{:else if journal}
				<!-- Навигация по месяцам -->
				<div class="month-nav">
					<span class="month-nav__label">Перейти к:</span>
					{#each semesterMonths as m}
						<button class="month-btn" onclick={() => scrollToMonth(m.month, m.year)}>
							{m.label}
						</button>
					{/each}
				</div>

				{#if canEdit}
					<div class="hint">
						<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
						Нажмите на ячейку чтобы выставить балл или пропуск · Колонки «РР» и «Экз» открываются кликом
					</div>
				{/if}

				<!-- Обёртка таблицы -->
				<div class="table-wrap" bind:this={tableRef}>
					<table class="journal-table">
						<thead>
						<!-- Строка месяцев -->
						<tr class="tr-months">
							<th class="th-name-spacer" rowspan="2"></th>
							{#each getMonthSpan(allDates) as span}
								<th class="th-month" colspan={span.count}>{span.label}</th>
							{/each}
							<th class="th-special-header" colspan="2">Итоговые</th>
							<th class="th-stat-header" colspan="3">Статистика</th>
						</tr>
						<!-- Строка дат -->
						<tr class="tr-dates">
							{#each allDates as date}
								{@const fd = fmtDate(date)}
								<th class="th-date" class:th-date--today={fd.isToday}>
									<div class="th-date__dow">{fd.dow}</div>
									<div class="th-date__day">{fd.day}</div>
								</th>
							{/each}
							<th class="th-special">РР<div class="th-sub">макс 30</div></th>
							<th class="th-special">Экз<div class="th-sub">макс 30</div></th>
							<th class="th-stat">Баллы<div class="th-sub">из 100</div></th>
							<th class="th-stat">Пр.<div class="th-sub">дни</div></th>
							<th class="th-stat">Пр.<div class="th-sub">часы</div></th>
						</tr>
						</thead>
						<tbody>
						{#each journal.students as student}
							{@const stats = getStats(student.id)}
							{@const rating = journal.ratings[student.id]}
							<tr>
								<td class="td-name">
									<div class="student-cell">
										<div class="student-avatar">
											{student.name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()}
										</div>
										<span class="student-name">{student.name}</span>
									</div>
								</td>

								{#each allDates as date}
									{@const entry = journal.entries[student.id]?.[date]}
									{@const isEditing = editingCell?.studentId === student.id && editingCell?.date === date}
									<td
										class="td-cell"
										class:td-cell--absent={entry?.is_absent && entry?.score == null}
										class:td-cell--score={entry?.score != null && !entry?.is_absent}
										class:td-cell--both={entry?.is_absent && entry?.score != null}
										class:td-cell--editing={isEditing}
										class:td-cell--editable={canEdit && !isEditing}
										class:td-cell--today={fmtDate(date).isToday}
										onclick={() => openCell(student.id, date)}
									>
										{#if isEditing}
											<div class="cell-editor" onclick={(e) => e.stopPropagation()}>
												<div class="cell-editor__row">
													<label class="absent-toggle" class:absent-toggle--on={editAbsent}>
														<input type="checkbox" bind:checked={editAbsent} />
														Н
													</label>
													<input
														class="score-input"
														type="number"
														min="0"
														max="100"
														placeholder="—"
														bind:value={editScore}
														autofocus
													/>
												</div>
												<div class="cell-editor__actions">
													<button class="ce-btn ce-btn--save" onclick={saveCell} disabled={saving}>
														{#if saving}
															<span class="spinner-xs"></span>
														{:else}
															<svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
															Сохр.
														{/if}
													</button>
													<button class="ce-btn ce-btn--cancel" onclick={() => editingCell = null}>
														Отмена
													</button>
												</div>
											</div>
										{:else if entry}
											<div class="cell-content">
												{#if entry.is_absent}
													<span class="cell-tag cell-tag--absent">Н</span>
												{/if}
												{#if entry.score != null}
													<span class="cell-tag cell-tag--score">{entry.score}</span>
												{/if}
											</div>
										{/if}
									</td>
								{/each}

								<!-- Рейтинговая работа -->
								<td
									class="td-special"
									class:td-special--editable={canEdit}
									onclick={() => openRatingModal(student.id)}
								>
										<span class:has-value={rating?.rating_score != null}>
											{rating?.rating_score ?? '—'}
										</span>
								</td>

								<!-- Экзамен -->
								<td
									class="td-special"
									class:td-special--editable={canEdit}
									onclick={() => openRatingModal(student.id)}
								>
										<span class:has-value={rating?.exam_score != null}>
											{rating?.exam_score ?? '—'}
										</span>
								</td>

								<!-- Итого -->
								<td class="td-stat">
									<div
										class="stat-total"
										class:stat-total--good={stats.grandTotal >= 60}
										class:stat-total--warn={stats.grandTotal >= 40 && stats.grandTotal < 60}
										class:stat-total--bad={stats.grandTotal > 0 && stats.grandTotal < 40}
									>
										{stats.grandTotal}
										{#if stats.totalScore > 40}
											<span class="stat-cap" title="Баллы за задания ограничены 40">*</span>
										{/if}
									</div>
								</td>

								<td class="td-stat">
									<span class:stat-warn={stats.absentDays > 0}>{stats.absentDays}</span>
								</td>

								<td class="td-stat">
									<span class:stat-warn={stats.absentHours > 0}>{stats.absentHours}</span>
								</td>
							</tr>
						{/each}
						</tbody>
					</table>
				</div>

				<!-- Легенда -->
				<div class="legend">
					<div class="legend__item">
						<span class="cell-tag cell-tag--absent">Н</span>
						Пропуск
					</div>
					<div class="legend__item">
						<span class="cell-tag cell-tag--score">8</span>
						Балл
					</div>
					<div class="legend__item">
						<span class="legend__both">
							<span class="cell-tag cell-tag--absent">Н</span>
							<span class="cell-tag cell-tag--score">5</span>
						</span>
						Пропуск + балл
					</div>
					{#if journal.students.some(s => getStats(s.id).totalScore > 40)}
						<div class="legend__item">
							<span class="stat-cap">*</span>
							Баллы за задания ограничены 40 при подсчёте итога
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</main>
</div>

<!-- МОДАЛКА РЕЙТИНГА -->
{#if editingRating !== null && editingStudent}
	<div class="modal-overlay" onclick={() => editingRating = null} role="dialog" aria-modal="true">
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<div>
					<div class="modal__sub">Итоговые оценки</div>
					<h2 class="modal__title">{editingStudent.name}</h2>
				</div>
				<button class="modal__close" onclick={() => editingRating = null}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
			<div class="modal__body">
				{#if ratingError}
					<div class="alert alert--error">{ratingError}</div>
				{/if}

				<div class="rating-fields">
					<div class="rating-field">
						<label class="rating-field__label">
							Рейтинговая работа
							<span class="rating-field__max">макс. 30</span>
						</label>
						<input
							class="rating-field__input"
							type="number"
							min="0"
							max="30"
							placeholder="Не выставлено"
							bind:value={editRatingScore}
						/>
					</div>
					<div class="rating-field">
						<label class="rating-field__label">
							Экзамен
							<span class="rating-field__max">макс. 30</span>
						</label>
						<input
							class="rating-field__input"
							type="number"
							min="0"
							max="30"
							placeholder="Не выставлено"
							bind:value={editExamScore}
						/>
					</div>
				</div>

				<!-- Текущая статистика -->
				{#if editingRating !== null}
					{@const stats = getStats(editingRating)}
					<div class="rating-preview">
						<div class="rating-preview__row">
							<span>Баллы за семестр</span>
							<span class="rating-preview__val">
        {stats.cappedScore}
								{#if stats.totalScore > 40}
          <span class="stat-cap" title="Ограничено 40"> (из {stats.totalScore})*</span>
        {/if}
      </span>
						</div>
						<div class="rating-preview__row">
							<span>Рейтинговая работа</span>
							<span class="rating-preview__val">{editRatingScore || '—'}</span>
						</div>
						<div class="rating-preview__row">
							<span>Экзамен</span>
							<span class="rating-preview__val">{editExamScore || '—'}</span>
						</div>
						<div class="rating-preview__divider"></div>
						<div class="rating-preview__row rating-preview__row--total">
							<span>Итого</span>
							<span class="rating-preview__total">
        {stats.cappedScore + Math.min(Number(editRatingScore) || 0, 30) + Math.min(Number(editExamScore) || 0, 30)} / 100
      </span>
						</div>
					</div>
				{/if}

				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={() => editingRating = null}>Отмена</button>
					<button class="btn btn--primary" onclick={saveRating} disabled={savingRating}>
						{#if savingRating}<span class="spinner"></span>{/if}
						Сохранить
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
