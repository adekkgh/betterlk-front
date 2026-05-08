<script lang="ts">
	import './style.scss';
	import { onMount } from 'svelte';
	import { homeworksCountStore, userStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';
	import { page } from '$app/stores';

	interface Group { id: number; name: string; course: number; }
	interface Creator { id: number; name: string; }
	interface SubmissionFile { id: number; original_name: string; file_type: string; file_size: number; url: string; }
	interface Submission {
		id: number;
		score: number | null;
		comment: string | null;
		student_comment: string | null;
		links: string[] | null;
		is_checked: boolean;
		checked_at: string | null;
		files: SubmissionFile[];
	}
	interface Homework {
		id: number;
		title: string;
		description: string | null;
		max_score: number;
		deadline: string;
		deadline_extended: boolean;
		extended_deadline: string | null;
		is_expired: boolean;
		group: Group;
		creator: Creator;
		submission: Submission | null;
		submissions?: Submission[];
		subject: { id: number; name: string } | null;
	}

	let homeworks     = $state<Homework[]>([]);
	let loading       = $state(true);
	let error         = $state('');
	let filter        = $state<'all' | 'active' | 'checked' | 'expired'>('all');
	let selectedHw    = $state<Homework | null>(null);
	let showModal     = $state(false);
	let showForm      = $state(false);
	let editingHw     = $state<Homework | null>(null);
	let groups        = $state<Group[]>([]);
	let formTitle     = $state('');
	let formDesc      = $state('');
	let formMaxScore  = $state(100);
	let formDeadline  = $state('');
	let formGroupId   = $state<number | null>(null);
	let formLoading   = $state(false);
	let formError     = $state('');
	let submitLoading  = $state(false);
	let submitError    = $state('');
	let selectedFiles  = $state<File[]>([]);
	let linkValues     = $state<string[]>(['']);
	let studentComment = $state('');
	let checkScore    = $state<number>(0);
	let checkComment  = $state('');
	let checkLoading  = $state(false);
	let extendDeadline = $state('');
	let extendLoading  = $state(false);
	let expandedSubmissionId = $state<number | null>(null);
	let lightboxUrl  = $state<string | null>(null);
	let lightboxName = $state<string>('');
	let formSubjectId = $state<number | null>(null);
	let mySubjects    = $state<{ id: number; name: string }[]>([]);
	let checkEntryDate = $state(new Date().toISOString().split('T')[0]); // сегодня по умолчанию

	const isStudent = $derived($userStore?.role?.name === 'student');
	const canManage = $derived(['admin', 'moderator', 'professor'].includes($userStore?.role?.name ?? ''));

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

	async function loadHomeworks() {
		loading = true;
		error   = '';
		const { data, error: err } = await api<{ data: Homework[] }>('/homeworks');
		loading = false;
		if (err) { error = err; return; }
		homeworks = data?.data ?? [];
		homeworksCountStore.set(homeworks.filter(h => !h.is_expired && !h.submission?.is_checked).length);

		// Открываем задание если передан параметр ?open=ID
		const openId = Number($page.url.searchParams.get('open'));
		if (openId) {
			const hw = homeworks.find(h => h.id === openId);
			if (hw) openHw(hw);
		}
	}

	async function loadGroups() {
		const [groupsRes, subjectsRes] = await Promise.all([
			api<{ data: any[] }>('/groups'),
			api<{ data: any[] }>('/me/subjects'),
		]);
		groups     = groupsRes.data?.data ?? [];
		mySubjects = subjectsRes.data?.data ?? [];
	}

	onMount(() => {
		loadHomeworks();
		if (canManage) loadGroups();
	});

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
		if (bytes < 1024)    return bytes + ' Б';
		if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' КБ';
		return (bytes / 1048576).toFixed(1) + ' МБ';
	}

	function getStatus(hw: Homework): { label: string; color: string } {
		if (hw.submission?.is_checked) return { label: `${hw.submission.score} / ${hw.max_score}`, color: 'success' };
		if (hw.is_expired)             return { label: 'Просрочено', color: 'danger' };
		const days = daysLeft(hw);
		if (days <= 2)                 return { label: 'Срочно', color: 'danger' };
		if (hw.submission)             return { label: 'Ожидает проверки', color: 'accent' };
		if (days <= 5)                 return { label: 'Скоро дедлайн', color: 'warning' };
		return { label: 'Не начато', color: 'neutral' };
	}

	function isImage(fileType: string): boolean {
		return fileType.startsWith('image/');
	}

	function getFileIcon(fileType: string): string {
		if (fileType.startsWith('image/'))     return '🖼️';
		if (fileType.includes('pdf'))          return '📄';
		if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('gzip')) return '🗜️';
		if (fileType.includes('word') || fileType.includes('document')) return '📝';
		if (fileType.includes('sheet') || fileType.includes('excel'))   return '📊';
		if (fileType.includes('presentation')) return '📑';
		return '💾';
	}

	function getFilePreviewUrl(file: File): string {
		return URL.createObjectURL(file);
	}

	function openLightbox(url: string, name: string) {
		lightboxUrl  = url;
		lightboxName = name;
	}

	function openHw(hw: Homework) {
		selectedHw     = hw;
		checkScore     = hw.submission?.score ?? 0;
		checkComment   = hw.submission?.comment ?? '';
		submitError    = '';
		selectedFiles  = [];
		studentComment = hw.submission?.student_comment ?? '';
		linkValues     = hw.submission?.links?.length ? [...hw.submission.links, ''] : [''];
		showModal      = true;
		checkEntryDate = new Date().toISOString().split('T')[0];
		showModal = true;
	}

	function closeModal() {
		showModal  = false;
		selectedHw = null;
	}

	function onFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) selectedFiles = [...selectedFiles, ...Array.from(input.files)];
		input.value = '';
	}

	function removeFile(i: number) {
		selectedFiles = selectedFiles.filter((_, idx) => idx !== i);
	}

	async function deleteSubmissionFile(submissionId: number, fileId: number) {
		const { error: err } = await api(`/submissions/${submissionId}/files/${fileId}`, { method: 'DELETE' });
		if (err) { submitError = err; return; }
		await loadHomeworks();
		if (selectedHw) selectedHw = homeworks.find(h => h.id === selectedHw!.id) ?? null;
	}

	async function handleSubmit() {
		if (!selectedHw) return;
		submitLoading = true;
		submitError   = '';

		const formData = new FormData();
		if (studentComment) formData.append('student_comment', studentComment);

		const validLinks = linkValues.filter(l => l.trim());
		validLinks.forEach(l => formData.append('links[]', l));

		selectedFiles.forEach(f => formData.append('files[]', f));

		const { error: err } = await api(`/homeworks/${selectedHw.id}/submit`, {
			method: 'POST',
			body: formData,
		});

		submitLoading = false;
		if (err) { submitError = err; return; }

		selectedFiles = [];
		await loadHomeworks();
		selectedHw = homeworks.find(h => h.id === selectedHw!.id) ?? null;
		studentComment = selectedHw?.submission?.student_comment ?? '';
		linkValues     = selectedHw?.submission?.links?.length
			? [...selectedHw.submission.links, '']
			: [''];

		closeModal();
	}

	async function handleCheck(submissionId: number) {
		if (!selectedHw) return;
		checkLoading = true;

		const { error: err } = await api(`/submissions/${submissionId}/check`, {
			method: 'POST',
			body: {
				score: checkScore,
				comment: checkComment || null,
				entry_date: selectedHw.subject ? checkEntryDate : null,
			},
		});

		checkLoading = false;
		if (err) { submitError = err; return; }
		await loadHomeworks();
		selectedHw = homeworks.find(h => h.id === selectedHw!.id) ?? null;
	}

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

	function openForm(hw?: Homework) {
		editingHw    = hw ?? null;
		formTitle    = hw?.title ?? '';
		formDesc     = hw?.description ?? '';
		formMaxScore = hw?.max_score ?? 100;
		formGroupId  = hw?.group?.id ?? null;
		formSubjectId  = hw?.subject?.id ?? null;
		formDeadline = hw
			? (() => {
				const d = new Date(hw.deadline_extended && hw.extended_deadline
					? hw.extended_deadline
					: hw.deadline);
				const offset = d.getTimezoneOffset() * 60000;
				return new Date(d.getTime() - offset).toISOString().slice(0, 16);
			})()
			: '';
		formError    = '';
		showForm     = true;
	}

	async function handleFormSubmit() {
		if (!formTitle || !formSubjectId || !formDeadline || (!formGroupId && !editingHw)) {
			formError = 'Заполните все обязательные поля';
			return;
		}
		formLoading = true;
		formError   = '';

		const body: Record<string, unknown> = {
			title: formTitle, description: formDesc || null,
			max_score: formMaxScore, deadline: formDeadline,
			subject_id:  formSubjectId,
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

	async function handleRecheck(submissionId: number) {
		if (!selectedHw) return;
		checkLoading = true;

		const { error: err } = await api(`/submissions/${submissionId}/recheck`, {
			method: 'POST',
		});

		checkLoading = false;
		if (err) { submitError = err; return; }

		await loadHomeworks();
		selectedHw = homeworks.find(h => h.id === selectedHw!.id) ?? null;
		// Сбрасываем expandedSubmissionId чтобы карточка обновилась
		expandedSubmissionId = null;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (lightboxUrl) { lightboxUrl = null; return; }
			showModal = false;
			showForm  = false;
		}
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
				<a href="/homework" class="nav-item nav-item--active">
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
			<div class="filters">
				{#each [
					{ key: 'all',     label: 'Все',          count: counts.all     },
					{ key: 'active',  label: 'Активные',     count: counts.active  },
					{ key: 'checked', label: 'Проверенные',  count: counts.checked },
					{ key: 'expired', label: 'Просроченные', count: counts.expired },
				] as f}
					<button
						class="filter-btn"
						class:filter-btn--active={filter === f.key}
						onclick={() => filter = f.key as typeof filter}
					>
						{f.label}
						{#if f.count > 0}<span class="filter-count">{f.count}</span>{/if}
					</button>
				{/each}
			</div>

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
										<div class="hw-card__subject">
											{#if hw.subject}
												{hw.subject.name} · {hw.group.name}
											{:else}
												{hw.group.name}
											{/if}
										</div>
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
											{#if !hw.is_expired} · {daysLeft(hw)} дн.{/if}
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

				{#if filter === 'all' || filter === 'checked'}
					{@const checked = filtered.filter(h => h.submission?.is_checked)}
					{#if checked.length > 0}
						<div class="section-header" style="margin-top:28px;">
							<span class="section-title">Проверенные задания</span>
							<span class="section-count">{checked.length}</span>
						</div>
						<div class="card">
							<table class="table">
								<thead><tr><th>Задание</th><th>Группа</th><th>Дедлайн</th><th>Балл</th><th>Комментарий</th></tr></thead>
								<tbody>
								{#each checked as hw}
									<tr class="table__row--clickable" onclick={() => openHw(hw)}>
										<td class="table__main">{hw.title}</td>
										<td class="table__muted">{hw.group.name}</td>
										<td class="table__mono">{formatDeadline(hw)}</td>
										<td><span class="badge badge--{hw.submission!.score! >= hw.max_score * 0.7 ? 'success' : 'warning'}">{hw.submission!.score} / {hw.max_score}</span></td>
										<td class="table__muted table__comment">{hw.submission?.comment ?? '—'}</td>
									</tr>
								{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}

				{#if filter === 'all' || filter === 'expired'}
					{@const expired = filtered.filter(h => h.is_expired && !h.submission?.is_checked)}
					{#if expired.length > 0}
						<div class="section-header" style="margin-top:28px;">
							<span class="section-title">Просроченные</span>
							<span class="section-count">{expired.length}</span>
						</div>
						<div class="card">
							<table class="table">
								<thead><tr><th>Задание</th><th>Группа</th><th>Дедлайн</th><th>Статус</th></tr></thead>
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

<!-- МОДАЛКА ПРОСМОТРА -->
{#if showModal && selectedHw}
	<div class="modal-overlay" role="dialog" aria-modal="true">
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<div>
					<div class="modal__subject">
						{#if selectedHw.subject}
							{selectedHw.subject.name} · {selectedHw.group.name}
						{:else}
							{selectedHw.group.name}
						{/if}
					</div>
					<h2 class="modal__title">{selectedHw.title}</h2>
				</div>
				<button class="modal__close" onclick={closeModal}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>

			<div class="modal__body">
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
					<div class="modal__meta-item">Максимальный балл: <strong>{selectedHw.max_score}</strong></div>
				</div>

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

						<!-- Что сдавал студент -->
						<div class="submission-view">
							{#if selectedHw.submission.student_comment}
								<div class="submission-view__section">
									<div class="submission-view__label">Ваш комментарий</div>
									<div class="submission-view__text">{selectedHw.submission.student_comment}</div>
								</div>
							{/if}

							<!-- Ссылки (множественное число) -->
							{#if selectedHw.submission.links?.filter(l => l).length}
								<div class="submission-view__section">
									<div class="submission-view__label">Ссылки</div>
									{#each selectedHw.submission.links.filter(l => l) as link}
										<a href={link} target="_blank" class="submission-view__link">
											<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd"/></svg>
											{link}
										</a>
									{/each}
								</div>
							{/if}

							{#if selectedHw.submission.files?.length}
								<div class="submission-view__section">
									<div class="submission-view__label">Загруженные файлы</div>
									<div class="files-grid">
										{#each selectedHw.submission.files as file}
											{#if isImage(file.file_type)}
												<div class="file-preview">
													<img
														src={file.url}
														alt={file.original_name}
														class="file-preview__img file-preview__img--clickable"
														onclick={() => openLightbox(file.url, file.original_name)}
													/>
													<div class="file-preview__name">{file.original_name}</div>
												</div>
											{:else}
												<a href={file.url} target="_blank" class="file-download">
													<span class="file-download__icon">{getFileIcon(file.file_type)}</span>
													<div class="file-download__info">
														<span class="file-download__name">{file.original_name}</span>
														<span class="file-download__size">{formatSize(file.file_size)}</span>
													</div>
													<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style="color:var(--text3);flex-shrink:0;"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
												</a>
											{/if}
										{/each}
									</div>
								</div>
							{/if}
						</div>

					{:else if !selectedHw.is_expired}
						<!-- Форма сдачи / редактирования -->
						<div class="submit-section">
							<div class="submit-section__title">
								{selectedHw.submission ? 'Ваш ответ' : 'Сдать задание'}
							</div>

							{#if submitError}
								<div class="alert alert--error">{submitError}</div>
							{/if}

							<!-- Комментарий -->
							<div class="form-group">
								<label class="form-label">Комментарий к ответу</label>
								<textarea
									class="form-input form-textarea"
									placeholder="Напишите пояснение к решению..."
									rows="3"
									bind:value={studentComment}
								></textarea>
							</div>

							<!-- Динамические ссылки -->
							<div class="form-group">
								<label class="form-label">Ссылки на решение</label>
								{#each linkValues as link, i}
									<div class="link-row">
										<input
											class="form-input"
											type="url"
											placeholder="https://github.com/..."
											bind:value={linkValues[i]}
											oninput={() => {
												if (i === linkValues.length - 1 && linkValues[i].trim()) {
													linkValues = [...linkValues, ''];
												}
											}}
										/>
										{#if linkValues.length > 1}
											<button
												class="link-row__remove"
												onclick={() => linkValues = linkValues.filter((_, idx) => idx !== i)}
												title="Удалить ссылку"
											>
												<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
											</button>
										{/if}
									</div>
								{/each}
							</div>

							<!-- Уже загруженные файлы -->
							{#if selectedHw.submission?.files?.length}
								<div class="submission-view__section">
									<div class="submission-view__label">Загруженные файлы</div>
									<div class="files-grid">
										{#each selectedHw.submission.files as file}
											{#if isImage(file.file_type)}
												<div class="file-preview">
													<img
														src={file.url}
														alt={file.original_name}
														class="file-preview__img file-preview__img--clickable"
														onclick={() => openLightbox(file.url, file.original_name)}
													/>
													<div class="file-preview__name">{file.original_name}</div>
													<button class="file-preview__delete" onclick={() => deleteSubmissionFile(selectedHw!.submission!.id, file.id)}>
														<svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
													</button>
												</div>
											{:else}
												<div class="file-download" style="cursor:default;">
													<span class="file-download__icon">{getFileIcon(file.file_type)}</span>
													<div class="file-download__info">
														<span class="file-download__name">{file.original_name}</span>
														<span class="file-download__size">{formatSize(file.file_size)}</span>
													</div>
													<button class="file-item__delete" onclick={() => deleteSubmissionFile(selectedHw!.submission!.id, file.id)}>
														<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
													</button>
												</div>
											{/if}
										{/each}
									</div>
								</div>
							{/if}

							<!-- Добавить новые файлы -->
							<div class="form-group">
								<label class="form-label">Добавить файлы</label>
								<label class="upload-zone">
									<input type="file" multiple onchange={onFileChange} style="display:none" />
									<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" style="color:var(--text3)"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
									<span>Нажмите чтобы выбрать файлы</span>
									<span style="font-size:11px;color:var(--text3);">PDF, DOCX, изображения, архивы, код — до 20 МБ каждый</span>
								</label>

								{#if selectedFiles.length > 0}
									<div class="files-grid" style="margin-top:10px;">
										{#each selectedFiles as file, i}
											{#if file.type.startsWith('image/')}
												<div class="file-preview">
													<img
														src={getFilePreviewUrl(file)}
														alt={file.name}
														class="file-preview__img file-preview__img--clickable"
														onclick={() => openLightbox(getFilePreviewUrl(file), file.name)}
													/>
													<div class="file-preview__name">{file.name}</div>
													<button class="file-preview__delete" onclick={() => removeFile(i)}>
														<svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
													</button>
												</div>
											{:else}
												<div class="file-download" style="cursor:default;">
													<span class="file-download__icon">{getFileIcon(file.type)}</span>
													<div class="file-download__info">
														<span class="file-download__name">{file.name}</span>
														<span class="file-download__size">{formatSize(file.size)}</span>
													</div>
													<button class="file-item__delete" onclick={() => removeFile(i)}>
														<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
													</button>
												</div>
											{/if}
										{/each}
									</div>
								{/if}
							</div>

							<button
								class="btn btn--primary"
								onclick={handleSubmit}
								disabled={submitLoading || (
									!studentComment.trim() &&
									!linkValues.some(l => l.trim()) &&
									selectedFiles.length === 0 &&
									!(selectedHw.submission?.files?.length)
								)}
							>
								{#if submitLoading}<span class="spinner"></span>{/if}
								{selectedHw.submission ? 'Сохранить изменения' : 'Сдать задание'}
							</button>
						</div>

					{:else if selectedHw.is_expired && !selectedHw.submission}
						<div class="alert alert--error">Дедлайн истёк. Задание нельзя сдать.</div>
					{/if}
				{/if}

				<!-- БЛОК ПРЕПОДА/АДМИНА -->
				{#if canManage}
					<div class="modal__divider"></div>

					<div class="manage-row">
						<button class="btn btn--ghost btn--sm" onclick={() => openForm(selectedHw!)}>
							<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
							Редактировать
						</button>
						<button class="btn btn--danger btn--sm" onclick={() => handleDelete(selectedHw!.id)}>
							<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
							Удалить
						</button>
						<div class="extend-wrap">
							<input class="form-input form-input--sm" type="datetime-local" bind:value={extendDeadline} />
							<button class="btn btn--ghost btn--sm" onclick={handleExtend} disabled={!extendDeadline || extendLoading}>
								{extendLoading ? '...' : 'Изменить'}
							</button>
						</div>
					</div>

					{#if selectedHw.submissions && selectedHw.submissions.length > 0}
						<div class="submissions-section">
							<div class="submissions-section__title">Ответы студентов ({selectedHw.submissions.length})</div>
							{#each selectedHw.submissions as sub}
								<div class="submission-item">
									<button
										class="submission-item__header submission-item__header--btn"
										onclick={() => expandedSubmissionId = expandedSubmissionId === sub.id ? null : sub.id}
									>
										<div class="submission-item__student">
											<div class="mini-avatar">{(sub as any).student?.name?.split(' ').map((w: string) => w[0]).join('').slice(0,2) ?? '?'}</div>
											{(sub as any).student?.name ?? 'Студент'}
										</div>
										<div style="display:flex;align-items:center;gap:8px;">
											{#if sub.is_checked}
												<span class="badge badge--success">{sub.score} / {selectedHw!.max_score}</span>
											{:else}
												<span class="badge badge--accent">Ожидает проверки</span>
											{/if}
											<svg
												width="14" height="14" viewBox="0 0 20 20" fill="currentColor"
												style="color:var(--text3);transition:transform 0.2s;transform:{expandedSubmissionId === sub.id ? 'rotate(180deg)' : 'rotate(0)'}"
											>
												<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
											</svg>
										</div>
									</button>

									{#if expandedSubmissionId === sub.id}
										<div class="submission-item__body">
											{#if (sub as any).student_comment}
												<div class="sub-section">
													<div class="sub-section__label">Комментарий студента</div>
													<div class="sub-section__text">{(sub as any).student_comment}</div>
												</div>
											{/if}

											<!-- Ссылки студента (множественное число) -->
											{#if (sub as any).links?.filter((l: string) => l).length}
												<div class="sub-section">
													<div class="sub-section__label">Ссылки</div>
													{#each (sub as any).links.filter((l: string) => l) as link}
														<a href={link} target="_blank" class="submission-view__link" style="display:block;margin-bottom:4px;">
															<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd"/></svg>
															{link}
														</a>
													{/each}
												</div>
											{/if}

											{#if sub.files?.length}
												<div class="sub-section">
													<div class="sub-section__label">Файлы</div>
													<div class="files-grid">
														{#each sub.files as file}
															{#if isImage(file.file_type)}
																<div class="file-preview">
																	<img
																		src={file.url}
																		alt={file.original_name}
																		class="file-preview__img file-preview__img--clickable"
																		onclick={() => openLightbox(file.url, file.original_name)}
																	/>
																	<div class="file-preview__name">{file.original_name}</div>
																</div>
															{:else}
																<a href={file.url} target="_blank" class="file-download">
																	<span class="file-download__icon">{getFileIcon(file.file_type)}</span>
																	<div class="file-download__info">
																		<span class="file-download__name">{file.original_name}</span>
																		<span class="file-download__size">{formatSize(file.file_size)}</span>
																	</div>
																	<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style="color:var(--text3);flex-shrink:0;"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
																</a>
															{/if}
														{/each}
													</div>
												</div>
											{/if}

											{#if !sub.is_checked}
												<div class="check-form">
													<div class="check-form__row">
														<div class="form-group" style="flex:1;">
															<label class="form-label">Балл (макс. {selectedHw!.max_score})</label>
															<input class="form-input" type="number" min="0" max={selectedHw!.max_score} bind:value={checkScore} />
														</div>
														<div class="form-group" style="flex:2;">
															<label class="form-label">Комментарий преподавателя</label>
															<input class="form-input" type="text" placeholder="Необязательно" bind:value={checkComment} />
														</div>
													</div>

													<!-- Дата записи в журнал — только если у задания есть предмет -->
													{#if selectedHw!.subject}
														<div class="form-group" style="margin-top:8px;">
															<label class="form-label">
																Дата в журнале
																<span style="font-size:11px;color:var(--text3);font-weight:400;margin-left:4px;">
                        					(балл запишется в ведомость на эту дату)
                    						</span>
															</label>
															<input
																class="form-input form-input--sm"
																type="date"
																bind:value={checkEntryDate}
															/>
														</div>
													{/if}

													<button class="btn btn--primary btn--sm" onclick={() => handleCheck(sub.id)} disabled={checkLoading}>
														{checkLoading ? '...' : 'Проверить'}
													</button>
												</div>
											{:else}
												<div class="checked-result">
													<div class="checked-result__info">
														<span class="checked-result__score">{sub.score} / {selectedHw!.max_score}</span>
														{#if sub.comment}
															<span class="checked-result__comment">💬 {sub.comment}</span>
														{/if}
													</div>
													<button
														class="btn btn--ghost btn--sm"
														onclick={() => handleRecheck(sub.id)}
														disabled={checkLoading}
														title="Сбросить проверку и дать возможность студенту обновить ответ"
													>
														<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
															<path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
														</svg>
														Перепроверить
													</button>
												</div>
											{/if}
										</div>
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

<!-- МОДАЛКА СОЗДАНИЯ/РЕДАКТИРОВАНИЯ -->
{#if showForm}
	<div class="modal-overlay" role="dialog">
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
							{#each groups as g}<option value={g.id}>{g.name}</option>{/each}
						</select>
					</div>
				{/if}

				<div class="form-group">
					<label class="form-label">Предмет *</label>
					<select class="form-input" bind:value={formSubjectId}>
						<option value={null}>Выберите предмет</option>
						{#each mySubjects as s}
							<option value={s.id}>{s.name}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label class="form-label">Название *</label>
					<input class="form-input" type="text" placeholder="Название задания" bind:value={formTitle} />
				</div>

				<div class="form-group">
					<label class="form-label">Описание / условие</label>
					<textarea class="form-input form-textarea" placeholder="Подробное описание задания..." bind:value={formDesc} rows="4"></textarea>
				</div>

				<div class="form-group">
					<label class="form-label">Макс. балл *</label>
					<input class="form-input" type="number" min="1" max="1000" bind:value={formMaxScore} />
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

<!-- ЛАЙТБОКС -->
{#if lightboxUrl}
	<div
		class="lightbox-overlay"
		onclick={() => lightboxUrl = null}
		role="dialog"
		aria-modal="true"
	>
		<div class="lightbox" onclick={(e) => e.stopPropagation()}>
			<button class="lightbox__close" onclick={() => lightboxUrl = null}>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
			</button>
			<img src={lightboxUrl} alt={lightboxName} class="lightbox__img" />
			<div class="lightbox__name">{lightboxName}</div>
		</div>
	</div>
{/if}