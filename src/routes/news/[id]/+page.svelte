<script lang="ts">
	import './styles.scss';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { userStore, homeworksCountStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';
	import { api } from '$lib/helpers/api';

	interface NewsPhoto { id: number; url: string; file_name: string; file_size: number | null; }
	interface NewsPost {
		id: number;
		title: string;
		body: string;
		author: { id: number; name: string } | null;
		photos: NewsPhoto[];
		created_at: string;
	}

	const postId = $derived(Number($page.params.id));

	let post      = $state<NewsPost | null>(null);
	let loading   = $state(true);
	let error     = $state('');
	let lightbox  = $state('');
	let lightboxIdx = $state(0);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('ru-RU', {
			day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
		});
	}

	// Markdown → safe HTML
	function mdToHtml(text: string): string {
		return text
			.replace(/&/g,  '&amp;')
			.replace(/</g,  '&lt;')
			.replace(/>/g,  '&gt;')
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.+?)\*/g,     '<em>$1</em>')
			.replace(/\[(.+?)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
			.replace(/^#{3}\s(.+)$/gm,  '<h3>$1</h3>')
			.replace(/^#{2}\s(.+)$/gm,  '<h2>$1</h2>')
			.replace(/^#{1}\s(.+)$/gm,  '<h1>$1</h1>')
			.replace(/\n\n/g, '</p><p>')
			.replace(/\n/g, '<br>');
	}

	function openLightbox(idx: number) {
		if (!post) return;
		lightboxIdx = idx;
		lightbox = post.photos[idx].url;
	}

	function closeLightbox() { lightbox = ''; }

	function prevPhoto() {
		if (!post) return;
		lightboxIdx = (lightboxIdx - 1 + post.photos.length) % post.photos.length;
		lightbox = post.photos[lightboxIdx].url;
	}
	function nextPhoto() {
		if (!post) return;
		lightboxIdx = (lightboxIdx + 1) % post.photos.length;
		lightbox = post.photos[lightboxIdx].url;
	}

	async function loadPost() {
		loading = true; error = '';
		const { data, error: err } = await api<{ data: NewsPost }>(`/news/${postId}`);
		loading = false;
		if (err) { error = err; return; }
		post = data?.data ?? null;
	}

	onMount(loadPost);

	function onKeydown(e: KeyboardEvent) {
		if (!lightbox) return;
		if (e.key === 'Escape')     closeLightbox();
		if (e.key === 'ArrowRight') nextPhoto();
		if (e.key === 'ArrowLeft')  prevPhoto();
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
				<a href="/" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>Главная</a>
				<a href="/news" class="nav-item nav-item--active"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"/><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/></svg>Новости</a>
				<a href="/homework" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clip-rule="evenodd"/></svg>Задания{#if $homeworksCountStore > 0}<span class="nav-badge">{$homeworksCountStore}</span>{/if}</a>
				<a href="/journals" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>Ведомости</a>
			</div>
			{#if $userStore?.role?.name === 'admin' || $userStore?.role?.name === 'moderator'}
				<div class="nav-section">
					<div class="nav-section__label">Управление</div>
					<a href="/users" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>Пользователи</a>
					<a href="/groups" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>Группы</a>
					<a href="/subjects" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>Предметы</a>
					<a href="/specializations" class="nav-item"><svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/></svg>Специальности</a>
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
			<a href="/news" class="back-btn">
				<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
				Все новости
			</a>
		</header>

		<div class="content">
			{#if loading}
				<div class="state-wrap">
					<div class="spinner-lg"></div>
					<p>Загружаем новость...</p>
				</div>
			{:else if error || !post}
				<div class="state-wrap">
					<p style="color:var(--danger)">{error || 'Новость не найдена'}</p>
					<a href="/news" class="btn btn--ghost">Вернуться к новостям</a>
				</div>
			{:else}
				<!-- Полный пост — HTML-теги оптимизированы для парсинга -->
				<article
					class="post-full"
					data-post-id={post.id}
					data-post-date={post.created_at}
					itemscope
					itemtype="https://schema.org/NewsArticle"
				>
					<!-- ЗАГОЛОВОК -->
					<header class="post-full__header">
						<h1
							class="post-full__title"
							data-post-title={post.title}
							itemprop="headline"
						>{post.title}</h1>

						<div class="post-full__meta">
							<time
								class="post-full__date"
								datetime={post.created_at}
								data-post-date={post.created_at}
								itemprop="datePublished"
							>{formatDate(post.created_at)}</time>

							{#if post.author}
								<span class="post-full__sep">·</span>
								<span
									class="post-full__author"
									data-author-id={post.author.id}
									data-author-name={post.author.name}
									itemprop="author"
								>{post.author.name}</span>
							{/if}
						</div>
					</header>

					<!-- ФОТО -->
					{#if post.photos.length > 0}
						<figure
							class="post-full__gallery"
							data-photos-count={post.photos.length}
							aria-label="Фотографии к новости"
						>
							{#if post.photos.length === 1}
								<!-- Одно фото — на всю ширину -->
								<div class="gallery-single">
									<img
										src={post.photos[0].url}
										alt={post.photos[0].file_name}
										class="gallery-single__img"
										loading="lazy"
										data-photo-id={post.photos[0].id}
										itemprop="image"
										onclick={() => openLightbox(0)}
										role="button"
										tabindex="0"
										onkeydown={(e) => e.key === 'Enter' && openLightbox(0)}
									/>
								</div>
							{:else}
								<!-- Несколько фото — сетка -->
								<div
									class="gallery-grid"
									class:gallery-grid--2={post.photos.length === 2}
									class:gallery-grid--3={post.photos.length === 3}
									class:gallery-grid--4={post.photos.length >= 4}
								>
									{#each post.photos as photo, i}
										<div class="gallery-grid__item" data-photo-index={i}>
											<img
												src={photo.url}
												alt={photo.file_name}
												class="gallery-grid__img"
												loading="lazy"
												data-photo-id={photo.id}
												itemprop="image"
												onclick={() => openLightbox(i)}
												role="button"
												tabindex="0"
												onkeydown={(e) => e.key === 'Enter' && openLightbox(i)}
											/>
										</div>
									{/each}
								</div>
							{/if}
						</figure>
					{/if}

					<!-- ТЕКСТ -->
					<section
						class="post-full__body"
						data-post-body
						itemprop="articleBody"
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						<p>{@html mdToHtml(post.body)}</p>
					</section>

				</article>
			{/if}
		</div>
	</main>
</div>

<!-- ЛАЙТБОКС -->
{#if lightbox && post}
	<div class="lightbox" onclick={closeLightbox} role="dialog" aria-modal="true" aria-label="Просмотр фото">
		<button class="lightbox__close" onclick={closeLightbox} aria-label="Закрыть">
			<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
		</button>

		{#if post.photos.length > 1}
			<button class="lightbox__nav lightbox__nav--prev" onclick={(e) => { e.stopPropagation(); prevPhoto(); }} aria-label="Предыдущее фото">
				<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
			</button>
		{/if}

		<img
			src={lightbox}
			alt={post.photos[lightboxIdx]?.file_name}
			class="lightbox__img"
			onclick={(e) => e.stopPropagation()}
		/>

		{#if post.photos.length > 1}
			<button class="lightbox__nav lightbox__nav--next" onclick={(e) => { e.stopPropagation(); nextPhoto(); }} aria-label="Следующее фото">
				<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
			</button>
			<div class="lightbox__counter">{lightboxIdx + 1} / {post.photos.length}</div>
		{/if}
	</div>
{/if}
