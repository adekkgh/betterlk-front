<script lang="ts">
	import './style.scss';
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';
	import { API_BASE_URL } from '$lib/config';

	// --- ТИПЫ ---
	interface Group { id: number; name: string; course: number; }
	interface Creator { id: number; name: string; }
	interface SubmissionFile { id: number; original_name: string; file_type: string; file_size: number; url: string; }
	interface Submission {
		id: number;
		score: number | null;
		comment: string | null;
		is_checked: boolean;
		checked_at: string | null;
		files: SubmissionFile[];
	}
	interface Homework {
		id: number;
		title: string;
		description: string | null;
		type: 'written' | 'oral' | 'file' | 'link';
		max_score: number;
		deadline: string;
		deadline_extended: boolean;
		extended_deadline: string | null;
		is_expired: boolean;
		group: Group;
		creator: Creator;
		submission: Submission | null;
		submissions?: Submission[]; // для преподов
	}

	// --- СОСТОЯНИЕ ---
	let homeworks     = $state<Homework[]>([]);
	let loading       = $state(true);
	let error         = $state('');
	let filter        = $state<'all' | 'active' | 'checked' | 'expired'>('all');

	// Модалка задания
	let selectedHw    = $state<Homework | null>(null);
	let showModal     = $state(false);

	// Модалка создания/редактирования
	let showForm      = $state(false);
	let editingHw     = $state<Homework | null>(null);
	let groups        = $state<Group[]>([]);

	// Форма создания
	let formTitle       = $state('');
	let formDesc        = $state('');
	let formType        = $state<'written' | 'oral' | 'file' | 'link'>('file');
	let formMaxScore    = $state(100);
	let formDeadline    = $state('');
	let formGroupId     = $state<number | null>(null);
	let formLoading     = $state(false);
	let formError       = $state('');

	// Сдача задания
	let submitLoading   = $state(false);
	let submitError     = $state('');
	let selectedFiles   = $state<File[]>([]);
	let linkValue       = $state('');

	// Проверка задания (для преподов)
	let checkScore      = $state<number>(0);
	let checkComment    = $state('');
	let checkLoading    = $state(false);

	// Продление дедлайна
	let extendDeadline  = $state('');
	let extendLoading   = $state(false);

	// --- РОЛИ ---
	const isStudent   = $derived($userStore?.role?.name === 'student');
	const canManage   = $derived(['admin', 'moderator', 'professor'].includes($userStore?.role?.name ?? ''));

	// --- ФИЛЬТРАЦИЯ ---
	const filtered = $derived(homeworks.filter(hw => {
		if (filter === 'active')  return !hw.is_expired && !hw.submission?.is_checked;
		if (filter === 'checked') return hw.submission?.is_checked;
		if (filter === 'expired') return hw.is_expired && !hw.submission?.is_checked;
		return true;
	}));

	const counts = $derived({
		all:     homeworks.length,
		active:  homeworks.filter(h => !h.is_expired && !h.submission?.is_checked).length,
		checked: homeworks.filter(h => h.submission?.is_checked).length,
		expired: homeworks.filter(h => h.is_expired && !h.submission?.is_checked).length,
	});

	// --- ЗАГРУЗКА ---
	async function loadHomeworks() {
		loading = true;
		error   = '';
		const { data, error: err } = await api<{ data: Homework[] }>('/homeworks');
		loading = false;
		if (err) { error = err; return; }
		homeworks = data?.data ?? [];
	}

	async function loadGroups() {
		const { data } = await api<{ data: Group[] }>('/groups');
		groups = data?.data ?? [];
	}

	onMount(() => {
		loadHomeworks();
		if (canManage) loadGroups();
	});

	// --- ХЕЛПЕРЫ ---
	function formatDeadline(hw: Homework): string {
		const d = hw.deadline_extended && hw.extended_deadline
			? new Date(hw.extended_deadline)
			: new Date(hw.deadline);
		return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function daysLeft(hw: Homework): number {
		const d = hw.deadline_extended && hw.extended_deadline
			? new Date(hw.extended_deadline)
			: new Date(hw.deadline);
		return Math.ceil((d.getTime() - Date.now()) / 86400000);
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024)       return bytes + ' Б';
		if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' КБ';
		return (bytes / 1048576).toFixed(1) + ' МБ';
	}

	function getStatus(hw: Homework): { label: string; color: string } {
		if (hw.submission?.is_checked) return { label: `${hw.submission.score} / ${hw.max_score}`, color: 'success' };
		if (hw.is_expired)             return { label: 'Просрочено', color: 'danger' };
		const days = daysLeft(hw);
		if (days <= 2)                 return { label: 'Срочно', color: 'danger' };
		if (hw.submission)             return { label: 'Сдано', color: 'accent' };
		if (days <= 5)                 return { label: 'Скоро дедлайн', color: 'warning' };
		return { label: 'Не начато', color: 'neutral' };
	}

	function typeLabel(type: string): string {
		return { written: 'Письменное', oral: 'Устное', file: 'С файлом', link: 'Со ссылкой' }[type] ?? type;
	}

	// --- МОДАЛКА ПРОСМОТРА ---
	function openHw(hw: Homework) {
		selectedHw   = hw;
		checkScore   = hw.submission?.score ?? 0;
		checkComment = hw.submission?.comment ?? '';
		submitError  = '';
		selectedFiles = [];
		linkValue    = '';
		showModal    = true;
	}

	function closeModal() {
		showModal    = false;
		selectedHw   = null;
	}

	// --- СДАЧА ЗАДАНИЯ ---
	function onFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			selectedFiles = [...selectedFiles, ...Array.from(input.files)];
		}
		input.value = '';
	}

	function removeFile(i: number) {
		selectedFiles = selectedFiles.filter((_, idx) => idx !== i);
	}

	async function deleteSubmissionFile(submissionId: number, fileId: number) {
		const { error: err } = await api(`/submissions/${submissionId}/files/${fileId}`, { method: 'DELETE' });
		if (err) { submitError = err; return; }
		await loadHomeworks();
		if (selectedHw) {
			selectedHw = homeworks.find(h => h.id === selectedHw!.id) ?? null;
		}
	}

	async function handleSubmit() {
		if (!selectedHw) return;
		submitLoading = true;
		submitError   = '';

		const formData = new FormData();
		selectedFiles.forEach(f => formData.append('files[]', f));
		if (linkValue) formData.append('link', linkValue);

		const { error: err } = await api(`/homeworks/${selectedHw.id}/submit`, {
			method: 'POST',
			body: formData,
		});

		submitLoading = false;

		if (err) {
			submitError = err;
			return;
		}

		selectedFiles = [];
		linkValue     = '';
		await loadHomeworks();
		selectedHw = homeworks.find(h => h.id === selectedHw!.id) ?? null;
	}

	// --- ПРОВЕРКА ЗАДАНИЯ ---
	async function handleCheck(submissionId: number) {
		if (!selectedHw) return;
		checkLoading = true;

		const { error: err } = await api(`/submissions/${submissionId}/check`, {
			method: 'POST',
			body: { score: checkScore, comment: checkComment || null },
		});

		checkLoading = false;
		if (err) { submitError = err; return; }
		await loadHomeworks();
		selectedHw = homeworks.find(h => h.id === selectedHw!.id) ?? null;
	}

	// --- ПРОДЛЕНИЕ ДЕДЛАЙНА ---
	async function handleExtend() {
		if (!selectedHw || !extendDeadline) return;
		extendLoading = true;

		const { error: err } = await api(`/homeworks/${selectedHw.id}`, {
			method: 'PUT',
			body: { extended_deadline: extendDeadline },
		});

		extendLoading = false;
		if (err) { submitError = err; return; }
		extendDeadline = '';
		await loadHomeworks();
		selectedHw = homeworks.find(h => h.id === selectedHw!.id) ?? null;
	}

	// --- ФОРМА СОЗДАНИЯ/РЕДАКТИРОВАНИЯ ---
	function openForm(hw?: Homework) {
		editingHw      = hw ?? null;
		formTitle      = hw?.title ?? '';
		formDesc       = hw?.description ?? '';
		formType       = hw?.type ?? 'file';
		formMaxScore   = hw?.max_score ?? 100;
		formGroupId    = hw?.group?.id ?? null;
		formDeadline   = hw ? new Date(hw.deadline).toISOString().slice(0, 16) : '';
		formError      = '';
		showForm       = true;
	}

	async function handleFormSubmit() {
		if (!formTitle || !formDeadline || (!formGroupId && !editingHw)) {
			formError = 'Заполните все обязательные поля';
			return;
		}
		formLoading = true;
		formError   = '';

		const body: Record<string, unknown> = {
			title: formTitle, description: formDesc || null,
			type: formType, max_score: formMaxScore,
			deadline: formDeadline,
		};
		if (!editingHw) body.group_id = formGroupId;

		const { error: err } = await api(
			editingHw ? `/homeworks/${editingHw.id}` : '/homeworks',
			{ method: editingHw ? 'PUT' : 'POST', body }
		);

		formLoading = false;
		if (err) { formError = err; return; }
		showForm = false;
		await loadHomeworks();
	}

	async function handleDelete(id: number) {
		if (!confirm('Удалить задание? Это действие нельзя отменить.')) return;
		await api(`/homeworks/${id}`, { method: 'DELETE' });
		await loadHomeworks();
		closeModal();
	}

	// Закрытие по Escape
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') { showModal = false; showForm = false; }
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
				<a href="/homeworks" class="nav-item nav-item--active">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
					Задания
					{#if counts.active > 0}<span class="nav-badge">{counts.active}</span>{/if}
				</a>
				<a href="/journal" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
					Журнал
				</a>
				<a href="/profile" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
					Профиль
				</a>
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
			<div class="topbar__title">Задания</div>
			<div class="topbar__actions">
				{#if canManage}
					<button class="btn btn--primary" onclick={() => openForm()}>
						<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
						Создать задание
					</button>
				{/if}
			</div>
		</header>

		<div class="content">
			<!-- ФИЛЬТРЫ -->
			<div class="filters">
				{#each [
					{ key: 'all',     label: 'Все',        count: counts.all     },
					{ key: 'active',  label: 'Активные',   count: counts.active  },
					{ key: 'checked', label: 'Проверенные', count: counts.checked },
					{ key: 'expired', label: 'Просроченные', count: counts.expired },
				] as f}
					<button
						class="filter-btn"
						class:filter-btn--active={filter === f.key}
						onclick={() => filter = f.key as typeof filter}
					>
						{f.label}
						{#if f.count > 0}
							<span class="filter-count">{f.count}</span>
						{/if}
					</button>
				{/each}
			</div>

			<!-- КОНТЕНТ -->
			{#if loading}
				<div class="state-wrap">
					<div class="spinner-lg"></div>
					<p>Загружаем задания...</p>
				</div>

			{:else if error}
				<div class="state-wrap">
					<div class="state-icon state-icon--error">
						<svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
					</div>
					<p>{error}</p>
					<button class="btn btn--ghost" onclick={loadHomeworks}>Попробовать снова</button>
				</div>

			{:else if filtered.length === 0}
				<div class="state-wrap">
					<div class="state-icon">
						<svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
					</div>
					<p>Заданий нет</p>
				</div>

			{:else}
				<!-- АКТИВНЫЕ ЗАДАНИЯ -->
				{#if filter === 'all' || filter === 'active'}
					{@const active = filtered.filter(h => !h.is_expired && !h.submission?.is_checked)}
					{#if active.length > 0}
						<div class="section-header">
							<span class="section-title">Активные задания</span>
							<span class="section-count">{active.length}</span>
						</div>
						<div class="hw-grid">
							{#each active as hw}
								{@const status = getStatus(hw)}
								<button class="hw-card" onclick={() => openHw(hw)}>
									<div class="hw-card__top">
										<div class="hw-card__subject">{hw.group.name}</div>
										<span class="badge badge--{status.color}">{status.label}</span>
									</div>
									<div class="hw-card__title">{hw.title}</div>
									{#if hw.description}
										<div class="hw-card__desc">{hw.description}</div>
									{/if}
									<div class="hw-card__meta">
										<div class="hw-card__meta-item">
											<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
											{formatDeadline(hw)}
											{#if !hw.is_expired}
												· {daysLeft(hw)} дн.
											{/if}
										</div>
										<div class="hw-card__meta-item">
											<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
											{hw.creator.name}
										</div>
										<div class="hw-card__score">макс. {hw.max_score} б.</div>
									</div>
									{#if hw.deadline_extended}
										<div class="hw-card__extended">
											<svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
											Дедлайн продлён
										</div>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				{/if}

				<!-- ПРОВЕРЕННЫЕ -->
				{#if filter === 'all' || filter === 'checked'}
					{@const checked = filtered.filter(h => h.submission?.is_checked)}
					{#if checked.length > 0}
						<div class="section-header" style="margin-top: 28px;">
							<span class="section-title">Проверенные задания</span>
							<span class="section-count">{checked.length}</span>
						</div>
						<div class="card">
							<table class="table">
								<thead>
								<tr>
									<th>Задание</th>
									<th>Группа</th>
									<th>Дедлайн</th>
									<th>Балл</th>
									<th>Комментарий</th>
								</tr>
								</thead>
								<tbody>
								{#each checked as hw}
									<tr class="table__row--clickable" onclick={() => openHw(hw)}>
										<td class="table__main">{hw.title}</td>
										<td class="table__muted">{hw.group.name}</td>
										<td class="table__mono">{formatDeadline(hw)}</td>
										<td>
                        <span class="badge badge--{hw.submission!.score! >= hw.max_score * 0.7 ? 'success' : 'warning'}">
                          {hw.submission!.score} / {hw.max_score}
                        </span>
										</td>
										<td class="table__muted table__comment">{hw.submission?.comment ?? '—'}</td>
									</tr>
								{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}

				<!-- ПРОСРОЧЕННЫЕ -->
				{#if filter === 'all' || filter === 'expired'}
					{@const expired = filtered.filter(h => h.is_expired && !h.submission?.is_checked)}
					{#if expired.length > 0}
						<div class="section-header" style="margin-top: 28px;">
							<span class="section-title">Просроченные</span>
							<span class="section-count">{expired.length}</span>
						</div>
						<div class="card">
							<table class="table">
								<thead>
								<tr><th>Задание</th><th>Группа</th><th>Дедлайн</th><th>Статус</th></tr>
								</thead>
								<tbody>
								{#each expired as hw}
									<tr class="table__row--clickable" onclick={() => openHw(hw)}>
										<td class="table__main">{hw.title}</td>
										<td class="table__muted">{hw.group.name}</td>
										<td class="table__mono">{formatDeadline(hw)}</td>
										<td><span class="badge badge--danger">Просрочено</span></td>
									</tr>
								{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}
			{/if}
		</div>
	</main>
</div>

<!-- ================================ -->
<!-- МОДАЛКА ПРОСМОТРА ЗАДАНИЯ        -->
<!-- ================================ -->
{#if showModal && selectedHw}
	<div class="modal-overlay" onclick={closeModal} role="dialog" aria-modal="true">
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<div>
					<div class="modal__subject">{selectedHw.group.name} · {typeLabel(selectedHw.type)}</div>
					<h2 class="modal__title">{selectedHw.title}</h2>
				</div>
				<button class="modal__close" onclick={closeModal}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>

			<div class="modal__body">
				<!-- Метаданные -->
				<div class="modal__meta">
					<div class="modal__meta-item">
						<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
						Дедлайн: <strong>{formatDeadline(selectedHw)}</strong>
						{#if selectedHw.deadline_extended}<span class="badge badge--accent" style="font-size:10px;padding:1px 6px;">продлён</span>{/if}
					</div>
					<div class="modal__meta-item">
						<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
						{selectedHw.creator.name}
					</div>
					<div class="modal__meta-item">
						Максимальный балл: <strong>{selectedHw.max_score}</strong>
					</div>
				</div>

				<!-- Описание -->
				{#if selectedHw.description}
					<div class="modal__desc">{selectedHw.description}</div>
				{/if}

				<!-- БЛОК СТУДЕНТА -->
				{#if isStudent}
					<div class="modal__divider"></div>

					{#if selectedHw.submission?.is_checked}
						<!-- Результат проверки -->
						<div class="result-block">
							<div class="result-block__score">
								<div class="result-block__score-value">{selectedHw.submission.score}</div>
								<div class="result-block__score-max">/ {selectedHw.max_score}</div>
							</div>
							<div class="result-block__info">
								<div class="result-block__label">Задание проверено</div>
								{#if selectedHw.submission.comment}
									<div class="result-block__comment">💬 {selectedHw.submission.comment}</div>
								{/if}
							</div>
						</div>

					{:else if selectedHw.type === 'oral' || selectedHw.type === 'written'}
						<div class="info-note">
							<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
							Это {typeLabel(selectedHw.type).toLowerCase()} задание — файлы загружать не нужно. Ознакомьтесь с условием.
						</div>

					{:else if !selectedHw.is_expired}
						<!-- Форма сдачи -->
						<div class="submit-section">
							<div class="submit-section__title">Сдать задание</div>

							{#if submitError}
								<div class="alert alert--error">{submitError}</div>
							{/if}

							<!-- Уже загруженные файлы -->
							{#if selectedHw.submission?.files?.length}
								<div class="files-list">
									<div class="files-list__label">Загруженные файлы</div>
									{#each selectedHw.submission.files as file}
										<div class="file-item">
											<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
											<a href={file.url} target="_blank" class="file-item__name">{file.original_name}</a>
											<span class="file-item__size">{formatSize(file.file_size)}</span>
											<button class="file-item__delete" onclick={() => deleteSubmissionFile(selectedHw!.submission!.id, file.id)}>
												<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
											</button>
										</div>
									{/each}
								</div>
							{/if}

							{#if selectedHw.type === 'file'}
								<!-- Загрузка файлов -->
								<label class="upload-zone">
									<input type="file" multiple onchange={onFileChange} style="display:none" />
									<svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor" style="color:var(--text3)"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
									<span>Нажмите чтобы выбрать файлы</span>
									<span style="font-size:11px;color:var(--text3);">Максимум 5 файлов, до 20 МБ каждый</span>
								</label>

								{#if selectedFiles.length > 0}
									<div class="files-list" style="margin-top:10px;">
										{#each selectedFiles as file, i}
											<div class="file-item">
												<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
												<span class="file-item__name">{file.name}</span>
												<span class="file-item__size">{formatSize(file.size)}</span>
												<button class="file-item__delete" onclick={() => removeFile(i)}>
													<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
												</button>
											</div>
										{/each}
									</div>
								{/if}

							{:else if selectedHw.type === 'link'}
								<div class="form-group">
									<label class="form-label">Ссылка на решение</label>
									<input class="form-input" type="url" placeholder="https://..." bind:value={linkValue} />
								</div>
							{/if}

							{#if selectedFiles.length > 0 || linkValue}
								<button class="btn btn--primary" onclick={handleSubmit} disabled={submitLoading}>
									{#if submitLoading}<span class="spinner"></span> Отправляем...{:else}Сдать задание{/if}
								</button>
							{/if}
						</div>

					{:else if selectedHw.is_expired && !selectedHw.submission}
						<div class="alert alert--error">Дедлайн истёк. Задание нельзя сдать.</div>
					{/if}
				{/if}

				<!-- БЛОК ПРЕПОДАВАТЕЛЯ/АДМИНА -->
				{#if canManage}
					<div class="modal__divider"></div>

					<!-- Управление -->
					<div class="manage-row">
						<button class="btn btn--ghost btn--sm" onclick={() => { closeModal(); openForm(selectedHw!); }}>
							<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
							Редактировать
						</button>
						<button class="btn btn--danger btn--sm" onclick={() => handleDelete(selectedHw!.id)}>
							<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
							Удалить
						</button>

						<!-- Продление дедлайна -->
						<div class="extend-wrap">
							<input class="form-input form-input--sm" type="datetime-local" bind:value={extendDeadline} />
							<button class="btn btn--ghost btn--sm" onclick={handleExtend} disabled={!extendDeadline || extendLoading}>
								{extendLoading ? '...' : 'Продлить'}
							</button>
						</div>
					</div>

					<!-- Ответы студентов -->
					{#if selectedHw.submissions && selectedHw.submissions.length > 0}
						<div class="submissions-section">
							<div class="submissions-section__title">Ответы студентов ({selectedHw.submissions.length})</div>
							{#each selectedHw.submissions as sub}
								<div class="submission-item">
									<div class="submission-item__header">
										<div class="submission-item__student">
											<div class="mini-avatar">{(sub as any).student?.name?.split(' ').map((w: string) => w[0]).join('').slice(0,2) ?? '?'}</div>
											{(sub as any).student?.name ?? 'Студент'}
										</div>
										{#if sub.is_checked}
											<span class="badge badge--success">{sub.score} / {selectedHw!.max_score}</span>
										{:else}
											<span class="badge badge--accent">Ожидает проверки</span>
										{/if}
									</div>

									<!-- Файлы студента -->
									{#if sub.files?.length}
										<div class="files-list" style="margin-top:8px;">
											{#each sub.files as file}
												<div class="file-item">
													<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
													<a href={file.url} target="_blank" class="file-item__name">{file.original_name}</a>
													<span class="file-item__size">{formatSize(file.file_size)}</span>
												</div>
											{/each}
										</div>
									{/if}

									<!-- Форма проверки -->
									{#if !sub.is_checked}
										<div class="check-form">
											<div class="check-form__row">
												<div class="form-group" style="flex:1;">
													<label class="form-label">Балл (макс. {selectedHw!.max_score})</label>
													<input class="form-input" type="number" min="0" max={selectedHw!.max_score} bind:value={checkScore} />
												</div>
												<div class="form-group" style="flex:2;">
													<label class="form-label">Комментарий</label>
													<input class="form-input" type="text" placeholder="Необязательно" bind:value={checkComment} />
												</div>
											</div>
											<button class="btn btn--primary btn--sm" onclick={() => handleCheck(sub.id)} disabled={checkLoading}>
												{checkLoading ? '...' : 'Проверить'}
											</button>
										</div>
									{:else if sub.comment}
										<div class="submission-item__comment">💬 {sub.comment}</div>
									{/if}
								</div>
							{/each}
						</div>
					{:else if canManage}
						<div class="info-note" style="margin-top:16px;">Студенты ещё не сдали это задание.</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- ================================ -->
<!-- МОДАЛКА СОЗДАНИЯ/РЕДАКТИРОВАНИЯ  -->
<!-- ================================ -->
{#if showForm}
	<div class="modal-overlay" onclick={() => showForm = false} role="dialog">
		<div class="modal modal--sm" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<h2 class="modal__title">{editingHw ? 'Редактировать задание' : 'Новое задание'}</h2>
				<button class="modal__close" onclick={() => showForm = false}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
			<div class="modal__body">
				{#if formError}
					<div class="alert alert--error">{formError}</div>
				{/if}

				{#if !editingHw}
					<div class="form-group">
						<label class="form-label">Группа *</label>
						<select class="form-input" bind:value={formGroupId}>
							<option value={null}>Выберите группу</option>
							{#each groups as g}
								<option value={g.id}>{g.name}</option>
							{/each}
						</select>
					</div>
				{/if}

				<div class="form-group">
					<label class="form-label">Название *</label>
					<input class="form-input" type="text" placeholder="Название задания" bind:value={formTitle} />
				</div>

				<div class="form-group">
					<label class="form-label">Описание / условие</label>
					<textarea class="form-input form-textarea" placeholder="Подробное описание задания..." bind:value={formDesc} rows="4"></textarea>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label class="form-label">Тип задания *</label>
						<select class="form-input" bind:value={formType}>
							<option value="file">С загрузкой файла</option>
							<option value="link">Со ссылкой</option>
							<option value="written">Письменное</option>
							<option value="oral">Устное</option>
						</select>
					</div>
					<div class="form-group">
						<label class="form-label">Макс. балл *</label>
						<input class="form-input" type="number" min="1" max="1000" bind:value={formMaxScore} />
					</div>
				</div>

				<div class="form-group">
					<label class="form-label">Дедлайн *</label>
					<input class="form-input" type="datetime-local" bind:value={formDeadline} />
				</div>

				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={() => showForm = false}>Отмена</button>
					<button class="btn btn--primary" onclick={handleFormSubmit} disabled={formLoading}>
						{#if formLoading}<span class="spinner"></span>{/if}
						{editingHw ? 'Сохранить' : 'Создать задание'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
