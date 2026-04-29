<script lang="ts">
	import './styles.scss';
	import { homeworksCountStore, userStore } from '$lib/stores/user';
	import { theme } from '$lib/stores/theme';

	// Получаем инициалы пользователя
	function getInitials(name: string): string {
		return name
			.split(' ')
			.map(w => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	// Приветствие по времени суток
	function getGreeting(): string {
		const hour = new Date().getHours();
		if (hour < 6)  return 'Доброй ночи';
		if (hour < 12) return 'Доброе утро';
		if (hour < 18) return 'Добрый день';
		return 'Добрый вечер';
	}

	// Текущая дата
	function getDate(): string {
		return new Date().toLocaleDateString('ru-RU', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
		});
	}

	// Моковые данные (заменим на реальные когда будет API)
	const stats = [
		{ label: 'Активных заданий', value: '3', sub: '2 с дедлайном на этой неделе', color: 'accent' },
		{ label: 'Средний балл',     value: '82', sub: 'Из 100 возможных',             color: 'success' },
		{ label: 'Пропущено занятий', value: '4', sub: '8 академических часов',        color: 'danger' },
		{ label: 'Рейтинг. работ',   value: '2/3', sub: 'Сдано в срок',               color: 'text' },
	];

	const homeworks = [
		{ title: 'Лабораторная работа №4',   subject: 'Алгоритмы',  deadline: '25 мар', status: 'danger',  statusLabel: 'Срочно'    },
		{ title: 'Реферат по истории',        subject: 'История',    deadline: '28 мар', status: 'warning', statusLabel: 'В работе'  },
		{ title: 'Практическое задание №2',   subject: 'БД и SQL',   deadline: '2 апр',  status: 'neutral', statusLabel: 'Не начато' },
	];

	const activity = [
		{ text: 'Задание «Лаб. №3» проверено — <strong>78 баллов</strong>', time: 'сегодня, 10:24',  color: '#1DA562' },
		{ text: 'Новое задание по курсу «БД и SQL» от Петрова И.В.',         time: 'вчера, 15:41',   color: '#7C5CFC' },
		{ text: 'Дедлайн «Реферат по истории» через 4 дня',                  time: 'вчера, 09:00',   color: '#E08A00' },
		{ text: 'Вы вошли в систему с нового устройства',                    time: '22 мар, 19:12',  color: '#A8A7A3' },
	];

	// Навигация
	const navItems = [
		{ icon: 'dashboard', label: 'Главная',     href: '/',          active: true  },
		{ icon: 'homework',  label: 'Задания',      href: '/homework', badge: 3      },
		{ icon: 'journal',   label: 'Журнал',       href: '/journal'                  },
		{ icon: 'profile',   label: 'Профиль',      href: '/profile'                  },
	];
</script>

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
				<a href="/" class="nav-item nav-item--active">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor">
						<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
					</svg>
					Главная
				</a>
				<a href="/homework" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor">
						<path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
						<path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
					</svg>
					Задания
					{#if $homeworksCountStore > 0}
						<span class="nav-badge">{$homeworksCountStore}</span>
					{/if}
				</a>
				<a href="/journal" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
					</svg>
					Журнал
				</a>
				<a href="/groups" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
					</svg>
					Группы
				</a>
				<a href="/profile" class="nav-item">
					<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
					</svg>
					Профиль
				</a>
			</div>

			{#if $userStore?.role?.name === 'admin' || $userStore?.role?.name === 'moderator'}
				<div class="nav-section">
					<div class="nav-section__label">Управление</div>
					<a href="/users" class="nav-item">
						<svg class="nav-item__icon" viewBox="0 0 20 20" fill="currentColor">
							<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
						</svg>
						Пользователи
					</a>
				</div>
			{/if}
		</nav>

		<div class="sidebar__footer">
			<!-- Переключатель темы -->
			<button class="theme-toggle" onclick={() => theme.toggle()}>
				{#if $theme === 'light'}
					<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
						<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
					</svg>
					Тёмная тема
				{:else}
					<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
					</svg>
					Светлая тема
				{/if}
			</button>

			<form method="POST" action="/auth/logout">
				<button type="submit" class="logout-btn">
					<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/>
					</svg>
					Выйти
				</button>
			</form>

			<!-- Пользователь -->
			<a href="/profile" class="user-card">
				<div class="user-avatar">
					{$userStore ? getInitials($userStore.name) : '?'}
				</div>
				<div class="user-info">
					<div class="user-name">{$userStore?.name ?? 'Загрузка...'}</div>
					<div class="user-role">{$userStore?.role?.display_name ?? ''}</div>
				</div>
				<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style="color:var(--text3);flex-shrink:0;">
					<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
				</svg>
			</a>
		</div>
	</aside>

	<!-- MAIN -->
	<main class="main">
		<!-- TOPBAR -->
		<header class="topbar">
			<div class="topbar__title">Главная</div>
			<div class="topbar__actions">
				<button class="icon-btn notif-btn">
					<div class="notif-dot"></div>
					<svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor">
						<path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
					</svg>
				</button>
			</div>
		</header>

		<!-- CONTENT -->
		<div class="content">
			<!-- ПРИВЕТСТВИЕ -->
			<div class="greeting">
				<div class="greeting__text">
					<h1>{getGreeting()}, {$userStore?.name?.split(' ')[0] ?? ''}</h1>
					<p>{getDate()} · {$userStore?.role?.display_name ?? ''}</p>
				</div>
			</div>

			<!-- СТАТИСТИКА -->
			<div class="stats-grid">
				{#each stats as stat}
					<div class="stat-card">
						<div class="stat-card__label">{stat.label}</div>
						<div class="stat-card__value stat-card__value--{stat.color}">{stat.value}</div>
						<div class="stat-card__sub">{stat.sub}</div>
					</div>
				{/each}
			</div>

			<!-- НИЖНИЕ БЛОКИ -->
			<div class="bottom-grid">
				<!-- ЗАДАНИЯ -->
				<div class="block">
					<div class="block__header">
						<span class="block__title">Ближайшие задания</span>
						<a href="/homework" class="block__link">Все задания →</a>
					</div>
					<div class="card">
						<table class="table">
							<thead>
							<tr>
								<th>Задание</th>
								<th>Предмет</th>
								<th>Дедлайн</th>
								<th>Статус</th>
							</tr>
							</thead>
							<tbody>
							{#each homeworks as hw}
								<tr>
									<td class="table__main">{hw.title}</td>
									<td class="table__muted">{hw.subject}</td>
									<td class="table__mono">{hw.deadline}</td>
									<td><span class="badge badge--{hw.status}">{hw.statusLabel}</span></td>
								</tr>
							{/each}
							</tbody>
						</table>
					</div>
				</div>

				<!-- АКТИВНОСТЬ -->
				<div class="block">
					<div class="block__header">
						<span class="block__title">Последние события</span>
					</div>
					<div class="card card--pad">
						{#each activity as item, i}
							<div class="activity-item" class:activity-item--last={i === activity.length - 1}>
								<div class="activity-dot" style:background={item.color}></div>
								<div>
									<div class="activity-text">{@html item.text}</div>
									<div class="activity-time">{item.time}</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</main>
</div>
