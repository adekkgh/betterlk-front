<script lang="ts">
	import './styles.scss';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { userStore, homeworksCountStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';

	interface Student { id: number; name: string; }
	interface Entry { is_absent: boolean; score: number | null; }
	interface Rating { rating_score: number | null; exam_score: number | null; }
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
	let tableRef    = $state<HTMLDivElement | null>(null);

	// Локальные изменения — накапливаем до сохранения
	// Ключ: `${studentId}:${date}`
	let localChanges = $state<Map<string, Entry>>(new Map());
	let hasChanges   = $state(false);
	let saving       = $state(false);
	let saveError    = $state('');
	let saveSuccess  = $state('');

	// Активная ячейка для навигации
	let activeCell = $state<{ rowIdx: number; colIdx: number } | null>(null);

	// Редактирование рейтинга
	let editingRating   = $state<number | null>(null);
	let editRatingScore = $state<string>('');
	let editExamScore   = $state<string>('');
	let savingRating    = $state(false);
	let ratingError     = $state('');

	const canEdit   = $derived(['admin', 'moderator', 'professor'].includes($userStore?.role?.name ?? ''));
	const isStudent = $derived($userStore?.role?.name === 'student');

	// Все даты семестра
	const allDates = $derived((() => {
		if (!journal) return [];
		const dates: string[] = [];
		const sem  = journal.semester;
		const year = journal.year;
		const startDate = sem === 1 ? new Date(year, 8, 1)      : new Date(year, 1, 1);
		const endDate   = sem === 1 ? new Date(year + 1, 1, 0)  : new Date(year, 6, 0);
		const cur = new Date(startDate);
		while (cur <= endDate) {
			if (cur.getDay() !== 0 && cur.getDay() !== 6) {
				dates.push(cur.toLocaleDateString('sv-SE'));
			}
			cur.setDate(cur.getDate() + 1);
		}
		return dates;
	})());

	const semesterMonths = $derived((() => {
		if (!journal) return [];
		return journal.semester === 1
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
	})());

	function getMonthSpan(dates: string[]): { label: string; count: number }[] {
		const spans: { label: string; count: number }[] = [];
		const mons = ['','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
		let cur = ''; let count = 0;
		for (const d of dates) {
			const label = mons[Number(d.split('-')[1])];
			if (label !== cur) { if (cur) spans.push({ label: cur, count }); cur = label; count = 1; }
			else count++;
		}
		if (cur) spans.push({ label: cur, count });
		return spans;
	}

	function fmtDate(dateStr: string) {
		const d = new Date(dateStr + 'T00:00:00');
		const dows = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
		const today = new Date().toLocaleDateString('sv-SE');
		return { day: String(d.getDate()), dow: dows[d.getDay()], isToday: dateStr === today };
	}

	function semLabel(sem: 1 | 2) {
		return sem === 1 ? '1 семестр (сен–янв)' : '2 семестр (фев–июн)';
	}

	// Получить актуальное значение ячейки (с учётом локальных изменений)
	function getCell(studentId: number, date: string): Entry {
		const key = `${studentId}:${date}`;
		if (localChanges.has(key)) return localChanges.get(key)!;
		return journal?.entries[studentId]?.[date] ?? { is_absent: false, score: null };
	}

	function getStats(studentId: number) {
		const dates = allDates;
		let totalScore = 0; let absentDays = 0;
		for (const date of dates) {
			const e = getCell(studentId, date);
			if (e.score !== null) totalScore += e.score;
			if (e.is_absent) absentDays++;
		}
		const cappedScore = Math.min(totalScore, 40);
		const rating      = journal?.ratings[studentId];
		const rScore      = Math.min(rating?.rating_score ?? 0, 30);
		const eScore      = Math.min(rating?.exam_score   ?? 0, 30);
		return { totalScore, cappedScore, absentDays, absentHours: absentDays * 2, grandTotal: cappedScore + rScore + eScore };
	}

	async function loadJournal() {
		loading = true; error = '';
		const { data, error: err } = await api<{ data: JournalData }>(`/journals/${journalId}`);
		loading = false;
		if (err) { error = err; return; }
		journal = data?.data ?? null;
		localChanges = new Map();
		hasChanges   = false;
	}

	onMount(loadJournal);

	// Установить значение ячейки
	function setCell(studentId: number, date: string, entry: Entry) {
		const key = `${studentId}:${date}`;
		const orig = journal?.entries[studentId]?.[date] ?? { is_absent: false, score: null };
		// Если совпадает с оригиналом — убираем из изменений
		if (entry.is_absent === orig.is_absent && entry.score === orig.score) {
			localChanges.delete(key);
		} else {
			localChanges.set(key, entry);
		}
		localChanges = new Map(localChanges);
		hasChanges   = localChanges.size > 0;
		saveSuccess  = '';
	}

	// Сохранить все изменения
	async function saveChanges() {
		if (!journal || localChanges.size === 0) return;
		saving    = true;
		saveError = '';

		const entries = Array.from(localChanges.entries()).map(([key, entry]) => {
			const [studentId, date] = key.split(':');
			return {
				student_id: Number(studentId),
				date,
				is_absent:  entry.is_absent,
				score:      entry.score,
			};
		});

		const { error: err } = await api(`/journals/${journal.id}/entries/batch`, {
			method: 'POST',
			body: { entries },
		});

		saving = false;
		if (err) { saveError = err; return; }

		// Применяем изменения в журнал
		for (const [key, entry] of localChanges.entries()) {
			const [studentId, date] = key.split(':');
			const sid = Number(studentId);
			if (!journal.entries[sid]) journal.entries[sid] = {};
			if (!entry.is_absent && entry.score === null) {
				delete journal.entries[sid][date];
			} else {
				journal.entries[sid][date] = entry;
			}
		}
		journal      = { ...journal };
		localChanges = new Map();
		hasChanges   = false;
		saveSuccess  = 'Изменения сохранены';
		setTimeout(() => saveSuccess = '', 3000);
	}

	function discardChanges() {
		localChanges = new Map();
		hasChanges   = false;
		saveError    = '';
	}

	// Навигация стрелками
	function scrollToMonth(month: number, year: number) {
		if (!tableRef) return;
		const firstDate = allDates.find(d => d.startsWith(`${year}-${String(month).padStart(2, '0')}`));
		if (!firstDate) return;
		const idx = allDates.indexOf(firstDate);
		tableRef.scrollTo({ left: idx * 40, behavior: 'smooth' });
	}

	function activateCell(rowIdx: number, colIdx: number) {
		if (!canEdit || !journal) return;
		if (rowIdx < 0 || rowIdx >= journal.students.length) return;
		if (colIdx < 0 || colIdx >= allDates.length) return;
		activeCell = { rowIdx, colIdx };
		// Скролл к ячейке
		const cellEl = tableRef?.querySelector(`[data-row="${rowIdx}"][data-col="${colIdx}"]`) as HTMLElement;
		cellEl?.focus();
	}

	function handleCellKeydown(e: KeyboardEvent, rowIdx: number, colIdx: number) {
		if (!canEdit || !journal) return;
		const student = journal.students[rowIdx];
		const date    = allDates[colIdx];
		const current = getCell(student.id, date);

		switch (e.key) {
			case 'ArrowRight':
				e.preventDefault();
				activateCell(rowIdx, colIdx + 1);
				break;
			case 'ArrowLeft':
				e.preventDefault();
				activateCell(rowIdx, colIdx - 1);
				break;
			case 'ArrowDown':
				e.preventDefault();
				activateCell(rowIdx + 1, colIdx);
				break;
			case 'ArrowUp':
				e.preventDefault();
				activateCell(rowIdx - 1, colIdx);
				break;
			case 'Tab':
				e.preventDefault();
				if (e.shiftKey) {
					if (colIdx > 0) activateCell(rowIdx, colIdx - 1);
					else activateCell(rowIdx - 1, allDates.length - 1);
				} else {
					if (colIdx < allDates.length - 1) activateCell(rowIdx, colIdx + 1);
					else activateCell(rowIdx + 1, 0);
				}
				break;
			case 'Escape':
				activeCell = null;
				(e.target as HTMLElement).blur();
				break;
			case 'Backspace':
			case 'Delete':
				e.preventDefault();
				setCell(student.id, date, { is_absent: false, score: null });
				break;
			default:
				// Цифры 0-9
				if (e.key >= '0' && e.key <= '9') {
					e.preventDefault();
					const newScore = current.score === null
						? Number(e.key)
						: Math.min(Number(String(current.score) + e.key), 100);
					setCell(student.id, date, { ...current, score: newScore });
				}
				// Буква Н (русская) или n (латинская) — переключить пропуск
				if (e.key === 'н' || e.key === 'Н' || e.key === 'n' || e.key === 'N') {
					e.preventDefault();
					setCell(student.id, date, { ...current, is_absent: !current.is_absent });
				}
				break;
		}
	}

	// Рейтинг
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
		if (rScore !== null && (rScore < 0 || rScore > 30)) { ratingError = 'Рейтинговая работа: максимум 30'; return; }
		if (eScore !== null && (eScore < 0 || eScore > 30)) { ratingError = 'Экзамен: максимум 30'; return; }
		savingRating = true; ratingError = '';
		const { error: err } = await api(`/journals/${journal.id}/rating`, {
			method: 'POST',
			body: { student_id: editingRating, rating_score: rScore, exam_score: eScore },
		});
		savingRating = false;
		if (err) { ratingError = err; return; }
		if (!journal.ratings[editingRating]) journal.ratings[editingRating] = { rating_score: null, exam_score: null };
		journal.ratings[editingRating].rating_score = rScore;
		journal.ratings[editingRating].exam_score   = eScore;
		journal = { ...journal };
		editingRating = null;
	}

	const editingStudent = $derived(
		editingRating !== null ? journal?.students.find(s => s.id === editingRating) : null
	);

	function onGlobalKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') { editingRating = null; activeCell = null; }
		if (e.key === 'Enter' && editingRating !== null) saveRating();
	}
</script>

<svelte:window onkeydown={onGlobalKeydown} />

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
					<a href="/specializations" class="nav-item">
						<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/></svg>
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
					<p>Загружаем ведомость...</p>
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
						<button class="month-btn" onclick={() => scrollToMonth(m.month, m.year)}>{m.label}</button>
					{/each}
				</div>

				{#if canEdit}
					<div class="hint">
						<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
						Кликните на ячейку чтобы начать ввод · Стрелки — навигация · Цифры — балл · <strong>Н</strong> — пропуск · <strong>Delete</strong> — очистить
					</div>
				{/if}

				<!-- ТАБЛИЦА -->
				<div class="table-wrap" bind:this={tableRef}>
					<table class="journal-table">
						<thead>
						<tr class="tr-months">
							<th class="th-name-spacer" rowspan="2"></th>
							{#each getMonthSpan(allDates) as span}
								<th class="th-month" colspan={span.count}>{span.label}</th>
							{/each}
							<th class="th-special-header" colspan="2">Итоговые</th>
							<th class="th-stat-header" colspan="3">Статистика</th>
						</tr>
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
						{#each journal.students as student, rowIdx}
							{@const stats = getStats(student.id)}
							{@const rating = journal.ratings[student.id]}
							<tr>
								<td class="td-name">
									<div class="student-cell">
										<div class="student-avatar">{student.name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()}</div>
										<span class="student-name">{student.name}</span>
									</div>
								</td>

								{#each allDates as date, colIdx}
									{@const cell = getCell(student.id, date)}
									{@const isActive = activeCell?.rowIdx === rowIdx && activeCell?.colIdx === colIdx}
									{@const isChanged = localChanges.has(`${student.id}:${date}`)}
									{@const fd = fmtDate(date)}
									<td
										class="td-cell"
										class:td-cell--absent={cell.is_absent && cell.score == null}
										class:td-cell--score={cell.score != null && !cell.is_absent}
										class:td-cell--both={cell.is_absent && cell.score != null}
										class:td-cell--active={isActive}
										class:td-cell--changed={isChanged && !isActive}
										class:td-cell--editable={canEdit}
										class:td-cell--today={fd.isToday}
										data-row={rowIdx}
										data-col={colIdx}
										tabindex={canEdit ? 0 : -1}
										onclick={() => activateCell(rowIdx, colIdx)}
										onkeydown={(e) => handleCellKeydown(e, rowIdx, colIdx)}
									>
										<div class="cell-content">
											{#if cell.is_absent}
												<span class="cell-tag cell-tag--absent">Н</span>
											{/if}
											{#if cell.score != null}
												<span class="cell-tag cell-tag--score">{cell.score}</span>
											{/if}
										</div>
									</td>
								{/each}

								<td class="td-special td-special--editable" onclick={() => openRatingModal(student.id)}>
									<span class:has-value={rating?.rating_score != null}>{rating?.rating_score ?? '—'}</span>
								</td>
								<td class="td-special td-special--editable" onclick={() => openRatingModal(student.id)}>
									<span class:has-value={rating?.exam_score != null}>{rating?.exam_score ?? '—'}</span>
								</td>
								<td class="td-stat">
									<div class="stat-total"
											 class:stat-total--good={stats.grandTotal >= 60}
											 class:stat-total--warn={stats.grandTotal >= 40 && stats.grandTotal < 60}
											 class:stat-total--bad={stats.grandTotal > 0 && stats.grandTotal < 40}>
										{stats.grandTotal}
										{#if stats.totalScore > 40}<span class="stat-cap" title="Ограничено 40">*</span>{/if}
									</div>
								</td>
								<td class="td-stat"><span class:stat-warn={stats.absentDays > 0}>{stats.absentDays}</span></td>
								<td class="td-stat"><span class:stat-warn={stats.absentHours > 0}>{stats.absentHours}</span></td>
							</tr>
						{/each}
						</tbody>
					</table>
				</div>

				<!-- ПАНЕЛЬ СОХРАНЕНИЯ -->
				{#if canEdit}
					<div class="save-bar" class:save-bar--visible={hasChanges || saveSuccess || saveError}>
						{#if saveError}
							<span class="save-bar__error">{saveError}</span>
						{:else if saveSuccess}
							<span class="save-bar__success">
								<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
								{saveSuccess}
							</span>
						{:else}
							<span class="save-bar__count">
								Несохранённых изменений: <strong>{localChanges.size}</strong>
							</span>
						{/if}
						<div class="save-bar__actions">
							{#if hasChanges}
								<button class="btn btn--ghost btn--sm" onclick={discardChanges}>Отменить</button>
								<button class="btn btn--primary btn--sm" onclick={saveChanges} disabled={saving}>
									{#if saving}<span class="spinner"></span>{/if}
									Сохранить изменения
								</button>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Легенда -->
				<div class="legend">
					<div class="legend__item"><span class="cell-tag cell-tag--absent">Н</span> Пропуск</div>
					<div class="legend__item"><span class="cell-tag cell-tag--score">8</span> Балл</div>
					<div class="legend__item">
						<span style="display:flex;gap:2px;">
							<span class="cell-tag cell-tag--absent">Н</span>
							<span class="cell-tag cell-tag--score">5</span>
						</span>
						Пропуск + балл
					</div>
					<div class="legend__item"><span class="legend__changed"></span> Изменено, не сохранено</div>
					{#if journal.students.some(s => getStats(s.id).totalScore > 40)}
						<div class="legend__item"><span class="stat-cap">*</span> Баллы ограничены 40 при подсчёте</div>
					{/if}
				</div>
			{/if}
		</div>
	</main>
</div>

<!-- МОДАЛКА РЕЙТИНГА -->
{#if editingRating !== null && editingStudent}
	<div class="modal-overlay" role="dialog" aria-modal="true">
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
				{#if ratingError}<div class="alert alert--error">{ratingError}</div>{/if}
				<div class="rating-fields">
					<div class="rating-field">
						<label class="rating-field__label">Рейтинговая работа <span class="rating-field__max">макс. 30</span></label>
						<input class="rating-field__input" type="number" min="0" max="30" placeholder="Не выставлено" bind:value={editRatingScore} />
					</div>
					<div class="rating-field">
						<label class="rating-field__label">Экзамен <span class="rating-field__max">макс. 30</span></label>
						<input class="rating-field__input" type="number" min="0" max="30" placeholder="Не выставлено" bind:value={editExamScore} />
					</div>
				</div>
				{#if editingRating !== null}
					{@const stats = getStats(editingRating)}
					<div class="rating-preview">
						<div class="rating-preview__row"><span>Баллы за семестр</span><span class="rating-preview__val">{stats.cappedScore}{#if stats.totalScore > 40}<span class="stat-cap"> (из {stats.totalScore})*</span>{/if}</span></div>
						<div class="rating-preview__row"><span>Рейтинговая работа</span><span class="rating-preview__val">{editRatingScore || '—'}</span></div>
						<div class="rating-preview__row"><span>Экзамен</span><span class="rating-preview__val">{editExamScore || '—'}</span></div>
						<div class="rating-preview__divider"></div>
						<div class="rating-preview__row rating-preview__row--total">
							<span>Итого</span>
							<span class="rating-preview__total">{stats.cappedScore + Math.min(Number(editRatingScore)||0,30) + Math.min(Number(editExamScore)||0,30)} / 100</span>
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
