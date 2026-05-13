<script lang="ts">
	import './styles.scss';
	import { onMount, onDestroy } from 'svelte';
	import { userStore, homeworksCountStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';

	interface NewsPhoto { id: number; url: string; file_name: string; }
	interface NewsItem {
		id: number;
		title: string;
		body: string;
		author: { id: number; name: string } | null;
		photos: NewsPhoto[];
		created_at: string;
	}

	let posts        = $state<NewsItem[]>([]);
	let loading      = $state(true);
	let loadingMore  = $state(false);
	let error        = $state('');
	let currentPage  = $state(1);
	let hasMore      = $state(true);
	let sentinel     = $state<HTMLDivElement | null>(null);
	let observer: IntersectionObserver | null = null;

	// Форма создания
	let showForm     = $state(false);
	let formTitle    = $state('');
	let formBody     = $state('');
	let formPhotos   = $state<File[]>([]);
	let formLoading  = $state(false);
	let formError    = $state('');
	let fileInput    = $state<HTMLInputElement | null>(null);

	// Удаление
	let deletingId   = $state<number | null>(null);
	let deleteLoading = $state(false);

	// Лайтбокс
	let lightboxUrl  = $state('');

	const canManage = $derived(['admin', 'moderator'].includes($userStore?.role?.name ?? ''));

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('ru-RU', {
			day: 'numeric', month: 'long', year: 'numeric',
		});
	}

	// Простой markdown → html (bold, italic, links, newlines)
	function mdToHtml(text: string): string {
		return text
			.replace(/&/g,  '&amp;')
			.replace(/</g,  '&lt;')
			.replace(/>/g,  '&gt;')
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.+?)\*/g,     '<em>$1</em>')
			.replace(/\[(.+?)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
			.replace(/\n/g, '<br>');
	}

	async function loadPage(page: number) {
		if (page === 1) loading = true;
		else loadingMore = true;
		error = '';

		const { data, error: err } = await api<any>(`/news?page=${page}&per_page=10`);

		loading = loadingMore = false;
		if (err) { error = err; return; }

		const newPosts: NewsItem[] = data?.data ?? [];
		posts = page === 1 ? newPosts : [...posts, ...newPosts];
		currentPage = data?.meta?.current_page ?? page;
		hasMore     = data?.meta?.has_more ?? false;
	}

	function setupObserver() {
		if (observer) observer.disconnect();
		observer = new IntersectionObserver(entries => {
			if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
				loadPage(currentPage + 1);
			}
		}, { rootMargin: '200px' });
		if (sentinel) observer.observe(sentinel);
	}

	onMount(() => {
		loadPage(1);
		setupObserver();
	});

	onDestroy(() => observer?.disconnect());

	$effect(() => {
		if (sentinel) setupObserver();
	});

	function handleFileChange(e: Event) {
		const files = Array.from((e.target as HTMLInputElement).files ?? []);
		const tooBig = files.filter(f => f.size > 40 * 1024 * 1024);
		if (tooBig.length) { formError = `Файлы превышают 40 МБ: ${tooBig.map(f => f.name).join(', ')}`; return; }
		formPhotos = [...formPhotos, ...files].slice(0, 10);
	}

	function removePhoto(i: number) { formPhotos = formPhotos.filter((_, idx) => idx !== i); }

	async function handleSubmit() {
		if (!formTitle.trim()) { formError = 'Введите заголовок'; return; }
		if (!formBody.trim())  { formError = 'Введите текст новости'; return; }
		formLoading = true; formError = '';

		const fd = new FormData();
		fd.append('title', formTitle.trim());
		fd.append('body',  formBody.trim());
		formPhotos.forEach(f => fd.append('photos[]', f));

		const { error: err } = await api('/news', { method: 'POST', body: fd, formData: true });
		formLoading = false;
		if (err) { formError = err; return; }

		showForm = false;
		formTitle = ''; formBody = ''; formPhotos = [];
		await loadPage(1);
	}

	async function handleDelete(id: number) {
		deleteLoading = true;
		await api(`/news/${id}`, { method: 'DELETE' });
		deleteLoading = false;
		deletingId = null;
		posts = posts.filter(p => p.id !== id);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') { showForm = false; deletingId = null; lightboxUrl = ''; }
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="layout">
	<aside class="sidebar">
		<div class="sidebar__logo">
			<div class="logo-mark">
				<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
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
						<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/></svg>
						Специальности
					</a>
				</div>
			{/if}
			{#if $userStore?.role?.name === 'professor'}
				<div class="nav-section">
					<div class="nav-section__label">Управление</div>
					<a href="/groups" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>Группы</a>
					<a href="/subjects" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>Предметы</a>
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
			<div class="topbar__title">Новости</div>
			{#if canManage}
				<button class="btn btn--primary" onclick={() => { showForm = true; formError = ''; }}>
					<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
					Написать новость
				</button>
			{/if}
		</header>

		<div class="content">
			{#if loading && posts.length === 0}
				<div class="state-wrap">
					<div class="spinner-lg"></div>
					<p>Загружаем новости...</p>
				</div>
			{:else if error && posts.length === 0}
				<div class="state-wrap">
					<p style="color:var(--danger)">{error}</p>
					<button class="btn btn--ghost" onclick={() => loadPage(1)}>Повторить</button>
				</div>
			{:else if posts.length === 0}
				<div class="state-wrap">
					<div class="state-icon">
						<svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"/><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/></svg>
					</div>
					<p>Новостей пока нет</p>
				</div>
			{:else}
				<!-- Лента новостей -->
				<div class="feed" role="feed" aria-label="Лента новостей">
					{#each posts as post (post.id)}
						<!-- Карточка-превью -->
						<article
							class="post-card"
							data-post-id={post.id}
							data-post-date={post.created_at}
							aria-labelledby="post-title-{post.id}"
						>
							<!-- Фото (если есть) — первое как обложка -->
							{#if post.photos.length > 0}
								<a href="/news/{post.id}" class="post-card__cover-link" aria-label="Открыть новость">
									<figure class="post-card__cover" data-photos-count={post.photos.length}>
										<img
											src={post.photos[0].url}
											alt={post.photos[0].file_name}
											class="post-card__img"
											loading="lazy"
											data-photo-id={post.photos[0].id}
										/>
										{#if post.photos.length > 1}
											<div class="post-card__photo-count">+{post.photos.length - 1}</div>
										{/if}
									</figure>
								</a>
							{/if}

							<div class="post-card__body">
								<!-- Мета -->
								<div class="post-card__meta">
									<time
										class="post-card__date"
										datetime={post.created_at}
										data-post-date={post.created_at}
									>{formatDate(post.created_at)}</time>
									{#if post.author}
										<span class="post-card__sep">·</span>
										<span class="post-card__author" data-author-id={post.author.id}>{post.author.name}</span>
									{/if}
								</div>

								<!-- Заголовок -->
								<h2 class="post-card__title" id="post-title-{post.id}" data-post-title={post.title}>
									<a href="/news/{post.id}">{post.title}</a>
								</h2>

								<!-- Превью текста (первые ~200 символов) -->
								<p class="post-card__preview" data-post-preview>
									{post.body.replace(/[*_\[\]#]/g, '').slice(0, 200)}{post.body.length > 200 ? '...' : ''}
								</p>

								<!-- Футер -->
								<div class="post-card__footer">
									<a href="/news/{post.id}" class="post-card__read-more">
										Читать полностью
										<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
									</a>
									{#if canManage}
										<button class="icon-btn icon-btn--danger" title="Удалить" onclick={() => deletingId = post.id}>
											<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
										</button>
									{/if}
								</div>
							</div>
						</article>
					{/each}

					<!-- Sentinel для IntersectionObserver -->
					<div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>

					{#if loadingMore}
						<div class="load-more-spinner">
							<div class="spinner-lg"></div>
						</div>
					{/if}

					{#if !hasMore && posts.length > 0}
						<p class="feed-end">Вы просмотрели все новости</p>
					{/if}
				</div>
			{/if}
		</div>
	</main>
</div>

<!-- ФОРМА СОЗДАНИЯ -->
{#if showForm}
	<div class="modal-overlay" onclick={() => showForm = false} role="dialog" aria-modal="true">
		<div class="modal modal--wide" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<h2 class="modal__title">Написать новость</h2>
				<button class="modal__close" onclick={() => showForm = false}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
			<div class="modal__body">
				{#if formError}
					<div class="alert alert--error">{formError}</div>
				{/if}

				<div class="form-group">
					<label class="form-label">Заголовок *</label>
					<input class="form-input" type="text" placeholder="Введите заголовок новости" bind:value={formTitle} />
				</div>

				<div class="form-group">
					<label class="form-label">
						Текст *
						<span class="form-label__hint">поддерживается **жирный**, *курсив*, [ссылка](url)</span>
					</label>
					<textarea class="form-input form-textarea" placeholder="Текст новости..." bind:value={formBody} rows="8"></textarea>
				</div>

				<!-- Фото -->
				<div class="form-group">
					<label class="form-label">Фотографии <span class="form-label__hint">до 10 файлов, макс. 40 МБ каждый</span></label>
					<div
						class="photo-drop"
						role="button"
						tabindex="0"
						onclick={() => fileInput?.click()}
						onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
						ondragover={(e) => e.preventDefault()}
						ondrop={(e) => { e.preventDefault(); const files = Array.from(e.dataTransfer?.files ?? []); handleFileChange({ target: { files } } as any); }}
					>
						<svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor" style="color:var(--text3)"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/></svg>
						<p>Нажмите или перетащите фото сюда</p>
						<p style="font-size:12px;color:var(--text3)">JPG, PNG, GIF, WebP · до 40 МБ</p>
					</div>
					<input
						bind:this={fileInput}
						type="file" accept="image/*" multiple style="display:none"
						onchange={handleFileChange}
					/>
					{#if formPhotos.length > 0}
						<div class="photo-preview-grid">
							{#each formPhotos as photo, i}
								<div class="photo-preview-item">
									<img src={URL.createObjectURL(photo)} alt={photo.name} class="photo-preview-img" />
									<button class="photo-preview-remove" onclick={() => removePhoto(i)}>
										<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
									</button>
									<span class="photo-preview-name">{photo.name}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="modal__footer">
					<button class="btn btn--ghost" onclick={() => showForm = false}>Отмена</button>
					<button class="btn btn--primary" onclick={handleSubmit} disabled={formLoading}>
						{#if formLoading}<span class="spinner"></span>{/if}
						Опубликовать
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ -->
{#if deletingId !== null}
	<div class="modal-overlay" onclick={() => deletingId = null} role="dialog">
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal__header">
				<h2 class="modal__title">Удалить новость?</h2>
				<button class="modal__close" onclick={() => deletingId = null}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
			<div class="modal__body">
				<p style="font-size:14px;color:var(--text2);line-height:1.6;">Новость и все прикреплённые фото будут удалены безвозвратно.</p>
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
