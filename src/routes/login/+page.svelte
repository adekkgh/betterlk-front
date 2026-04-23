<script lang="ts">
	import './login.scss';
	import { goto } from '$app/navigation';
	import { api } from '$lib/helpers/api';
	import { userStore } from '$lib/stores/user';

	// --- СОСТОЯНИЕ ---
	type Mode = 'login' | 'register' | 'forgot';
	let mode = $state<Mode>('login');

	// Поля формы
	let name       = $state('');
	let email      = $state('');
	let password   = $state('');
	let passwordConfirm = $state('');

	// UI состояния
	let loading     = $state(false);
	let showPass    = $state(false);
	let showPassConfirm = $state(false);
	let successMsg  = $state('');

	// Ошибки — общая и по полям
	let error       = $state('');
	let fieldErrors = $state<Record<string, string>>({});

	// 2FA состояние
	let requires2fa = $state(false);
	let twoFaCode   = $state('');
	let userId      = $state<number | null>(null);

	// Register состояние
	let registered = $state(false);

	// --- СБРОС ---
	function resetForm() {
		name             = '';
		email            = '';
		password         = '';
		passwordConfirm  = '';
		error            = '';
		fieldErrors      = {};
		successMsg       = '';
		showPass         = false;
		showPassConfirm  = false;
		requires2fa      = false;
		twoFaCode        = '';
		userId           = null;
	}

	function switchMode(newMode: Mode) {
		resetForm();
		mode = newMode;
	}

	// --- ВАЛИДАЦИЯ НА ФРОНТЕ ---
	function validateLogin(): boolean {
		fieldErrors = {};
		if (!email)    fieldErrors.email    = 'Введите email';
		if (!password) fieldErrors.password = 'Введите пароль';
		return Object.keys(fieldErrors).length === 0;
	}

	function validateRegister(): boolean {
		fieldErrors = {};
		if (!name)    fieldErrors.name = 'Введите имя';
		if (!email)   fieldErrors.email = 'Введите email';
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
			fieldErrors.email = 'Некорректный email';
		if (!password) {
			fieldErrors.password = 'Введите пароль';
		} else if (password.length < 8) {
			fieldErrors.password = 'Минимум 8 символов';
		} else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
			fieldErrors.password = 'Нужны заглавные и строчные буквы';
		} else if (!/[0-9]/.test(password)) {
			fieldErrors.password = 'Нужна хотя бы одна цифра';
		} else if (!/[^A-Za-z0-9]/.test(password)) {
			fieldErrors.password = 'Нужен хотя бы один спецсимвол';
		}
		if (password !== passwordConfirm)
			fieldErrors.passwordConfirm = 'Пароли не совпадают';
		return Object.keys(fieldErrors).length === 0;
	}

	// Парсим ошибки валидации Laravel (422)
	function handleLaravelErrors(data: any) {
		if (data?.errors) {
			const mapped: Record<string, string> = {};
			for (const [key, msgs] of Object.entries(data.errors)) {
				mapped[key] = (msgs as string[])[0];
			}
			fieldErrors = mapped;
		} else {
			error = data?.message ?? 'Произошла ошибка';
		}
	}

	// --- ВХОД ---
	async function handleLogin() {
		if (!validateLogin()) return;
		loading = true;
		error   = '';

		const { data, error: err, status } = await api<any>('/auth/login', {
			method: 'POST',
			body: { email, password },
		});

		loading = false;

		if (err) {
			if (status === 422 || status === 401) {
				error = data?.message ?? err;
			} else {
				error = err;
			}
			return;
		}

		// Admin/moderator — нужен 2FA
		if (data?.requires_2fa) {
			requires2fa = true;
			userId      = data.user_id;
			return;
		}

		// Обычный вход — сохраняем токен в cookie через server action
		await saveTokenAndRedirect(data.token, data.user);
	}

	// --- ПОДТВЕРЖДЕНИЕ 2FA ---
	async function handle2fa() {
		if (!twoFaCode || twoFaCode.length !== 6) {
			error = 'Введите 6-значный код';
			return;
		}
		loading = true;
		error   = '';

		const { data, error: err } = await api<any>('/auth/2fa/verify', {
			method: 'POST',
			body: { user_id: userId, code: twoFaCode },
		});

		loading = false;

		if (err) {
			error = data?.message ?? err;
			return;
		}

		await saveTokenAndRedirect(data.token, data.user);
	}

	// --- РЕГИСТРАЦИЯ ---
	async function handleRegister() {
		if (!validateRegister()) return;
		loading = true;
		error   = '';

		const { data, error: err, status } = await api<any>('/auth/register', {
			method: 'POST',
			body: {
				name,
				email,
				password,
				password_confirmation: passwordConfirm,
			},
		});

		loading = false;

		if (err) {
			if (status === 422) {
				handleLaravelErrors(data);
			} else {
				error = err;
			}
			return;
		}

		registered = true;

		// successMsg = data?.message ?? 'Проверьте почту для подтверждения регистрации.';
		// resetForm();
		// mode = 'login';
	}

	// --- ВОССТАНОВЛЕНИЕ ПАРОЛЯ ---
	async function handleForgot() {
		if (!email) {
			fieldErrors = { email: 'Введите email' };
			return;
		}
		loading = true;
		error   = '';

		const { data, error: err } = await api<any>('/auth/forgot-password', {
			method: 'POST',
			body: { email },
		});

		loading = false;

		if (err) {
			error = err;
			return;
		}

		successMsg = data?.message ?? 'Если email зарегистрирован, вы получите письмо.';
	}

	// --- СОХРАНЯЕМ ТОКЕН ЧЕРЕЗ SERVER ACTION ---
	// Токен кладём в HttpOnly cookie через POST на SvelteKit server action
	async function saveTokenAndRedirect(token: string, user: any) {
		const res = await fetch('/auth/set-cookie', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token }),
		});

		if (res.ok) {
			userStore.set(user);
			window.location.href = '/';
		} else {
			error = 'Не удалось сохранить сессию. Попробуйте ещё раз.';
		}
	}
</script>

<div class="auth-page">
	<!-- Левая декоративная панель (скрыта на мобиле) -->
	<div class="auth-side">
		<div class="auth-side__inner">
			<div class="auth-side__logo">
				<div class="logo-mark">
					<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 2L2 7l10 5 10-5-10-5z"/>
						<path d="M2 17l10 5 10-5"/>
						<path d="M2 12l10 5 10-5"/>
					</svg>
				</div>
				<span class="logo-text">BetterLK</span>
			</div>
			<div class="auth-side__content">
				<h2>Личный кабинет</h2>
				<p>Задания, журналы, оценки и всё необходимое для учёбы — в одном месте.</p>
			</div>
		</div>
	</div>

	<!-- Правая форма -->
	<div class="auth-form-wrap">
		<div class="auth-card">

			<!-- Логотип (только на мобиле) -->
			<div class="auth-card__mobile-logo">
				<div class="logo-mark logo-mark--sm">
					<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 2L2 7l10 5 10-5-10-5z"/>
						<path d="M2 17l10 5 10-5"/>
						<path d="M2 12l10 5 10-5"/>
					</svg>
				</div>
				<span class="logo-text">BetterLK</span>
			</div>

			<!-- 2FA форма -->
			{#if registered}
				<div class="form-header">
					<h1>Проверьте почту</h1>
					<p>Мы отправили письмо с подтверждением на <strong>{email}</strong></p>
				</div>

				<div class="registered-icon">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8"/>
						<rect x="2" y="4" width="20" height="16" rx="2"/>
					</svg>
				</div>

				<p class="form-note" style="text-align:left;font-size:13px;color:var(--text2);line-height:1.6;">
					Перейдите по ссылке в письме чтобы активировать аккаунт.
					Письмо может прийти в течение нескольких минут — проверьте папку «Спам» если не нашли.
				</p>

				<button class="btn btn--primary" onclick={() => { registered = false; switchMode('login'); }}>
					Перейти ко входу
				</button>

			{:else if requires2fa}
				<div class="form-header">
					<h1>Подтверждение входа</h1>
					<p>Введите 6-значный код из письма на <strong>{email}</strong></p>
				</div>

				{#if error}
					<div class="alert alert--error">{error}</div>
				{/if}

				<div class="form-group">
					<label class="form-label" for="twofa-code">Код подтверждения</label>
					<input
						id="twofa-code"
						class="form-input form-input--code"
						type="text"
						inputmode="numeric"
						maxlength="6"
						placeholder="000000"
						bind:value={twoFaCode}
						onkeydown={(e) => e.key === 'Enter' && handle2fa()}
					/>
				</div>

				<button class="btn btn--primary" onclick={handle2fa} disabled={loading}>
					{#if loading}
						<span class="spinner"></span> Проверяем...
					{:else}
						Подтвердить
					{/if}
				</button>

				<button class="btn-link" onclick={() => { requires2fa = false; }}>
					← Вернуться ко входу
				</button>

				<!-- Основные формы -->
			{:else}
				<!-- Табы -->
				{#if mode !== 'forgot'}
					<div class="auth-tabs">
						<button
							class="auth-tab"
							class:active={mode === 'login'}
							onclick={() => switchMode('login')}
						>Вход</button>
						<button
							class="auth-tab"
							class:active={mode === 'register'}
							onclick={() => switchMode('register')}
						>Регистрация</button>
						<div class="auth-tab__indicator" style:left={mode === 'login' ? '4px' : 'calc(50% + 4px)'}></div>
					</div>
				{/if}

				<!-- Заголовок -->
				<div class="form-header">
					{#if mode === 'login'}
						<h1>Добро пожаловать</h1>
						<p>Войдите в свой аккаунт чтобы продолжить</p>
					{:else if mode === 'register'}
						<h1>Создать аккаунт</h1>
						<p>Зарегистрируйтесь чтобы начать работу</p>
					{:else}
						<button class="back-btn" onclick={() => switchMode('login')}>
							<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
							</svg>
							Назад
						</button>
						<h1>Восстановление пароля</h1>
						<p>Введите email и мы отправим ссылку для сброса пароля</p>
					{/if}
				</div>

				<!-- Успешное сообщение -->
				{#if successMsg}
					<div class="alert alert--success">
						<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
						</svg>
						{successMsg}
					</div>
				{/if}

				<!-- Общая ошибка -->
				{#if error}
					<div class="alert alert--error">
						<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
						</svg>
						{error}
					</div>
				{/if}

				<!-- ФОРМА ВХОДА -->
				{#if mode === 'login'}
					<div class="form-group">
						<label class="form-label" for="login-email">Email</label>
						<input
							id="login-email"
							class="form-input"
							class:form-input--error={fieldErrors.email}
							type="email"
							placeholder="you@university.ru"
							autocomplete="email"
							bind:value={email}
							onkeydown={(e) => e.key === 'Enter' && handleLogin()}
						/>
						{#if fieldErrors.email}
							<span class="field-error">{fieldErrors.email}</span>
						{/if}
					</div>

					<div class="form-group">
						<div class="form-label-row">
							<label class="form-label" for="login-pass">Пароль</label>
							<button class="btn-link btn-link--sm" onclick={() => switchMode('forgot')}>
								Забыли пароль?
							</button>
						</div>
						<div class="input-wrap">
							<input
								id="login-pass"
								class="form-input"
								class:form-input--error={fieldErrors.password}
								type={showPass ? 'text' : 'password'}
								placeholder="••••••••"
								autocomplete="current-password"
								bind:value={password}
								onkeydown={(e) => e.key === 'Enter' && handleLogin()}
							/>
							<button class="input-eye" onclick={() => showPass = !showPass} type="button">
								{#if showPass}
									<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>
								{:else}
									<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/></svg>
								{/if}
							</button>
						</div>
						{#if fieldErrors.password}
							<span class="field-error">{fieldErrors.password}</span>
						{/if}
					</div>

					<button class="btn btn--primary" onclick={handleLogin} disabled={loading}>
						{#if loading}
							<span class="spinner"></span> Входим...
						{:else}
							Войти
						{/if}
					</button>

					<!-- ФОРМА РЕГИСТРАЦИИ -->
				{:else if mode === 'register'}
					<div class="form-group">
						<label class="form-label" for="reg-name">Имя и фамилия</label>
						<input
							id="reg-name"
							class="form-input"
							class:form-input--error={fieldErrors.name}
							type="text"
							placeholder="Иван Иванов"
							autocomplete="name"
							bind:value={name}
						/>
						{#if fieldErrors.name}
							<span class="field-error">{fieldErrors.name}</span>
						{/if}
					</div>

					<div class="form-group">
						<label class="form-label" for="reg-email">Email</label>
						<input
							id="reg-email"
							class="form-input"
							class:form-input--error={fieldErrors.email}
							type="email"
							placeholder="you@university.ru"
							autocomplete="email"
							bind:value={email}
						/>
						{#if fieldErrors.email}
							<span class="field-error">{fieldErrors.email}</span>
						{/if}
					</div>

					<div class="form-group">
						<label class="form-label" for="reg-pass">Пароль</label>
						<div class="input-wrap">
							<input
								id="reg-pass"
								class="form-input"
								class:form-input--error={fieldErrors.password}
								type={showPass ? 'text' : 'password'}
								placeholder="Минимум 8 символов"
								autocomplete="new-password"
								bind:value={password}
							/>
							<button class="input-eye" onclick={() => showPass = !showPass} type="button">
								{#if showPass}
									<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>
								{:else}
									<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/></svg>
								{/if}
							</button>
						</div>
						{#if fieldErrors.password}
							<span class="field-error">{fieldErrors.password}</span>
						{:else if password}
							<div class="password-hints">
								<span class:ok={password.length >= 8}>минимум 8 символов</span>
								<span class:ok={/[A-Z]/.test(password) && /[a-z]/.test(password)}>заглавные и строчные</span>
								<span class:ok={/[0-9]/.test(password)}>цифра</span>
								<span class:ok={/[^A-Za-z0-9]/.test(password)}>спецсимвол</span>
							</div>
						{/if}
					</div>

					<div class="form-group">
						<label class="form-label" for="reg-pass-confirm">Повторите пароль</label>
						<div class="input-wrap">
							<input
								id="reg-pass-confirm"
								class="form-input"
								class:form-input--error={fieldErrors.passwordConfirm}
								type={showPassConfirm ? 'text' : 'password'}
								placeholder="Повторите пароль"
								autocomplete="new-password"
								bind:value={passwordConfirm}
							/>
							<button class="input-eye" onclick={() => showPassConfirm = !showPassConfirm} type="button">
								{#if showPassConfirm}
									<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>
								{:else}
									<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/></svg>
								{/if}
							</button>
						</div>
						{#if fieldErrors.passwordConfirm}
							<span class="field-error">{fieldErrors.passwordConfirm}</span>
						{/if}
					</div>

					<button class="btn btn--primary" onclick={handleRegister} disabled={loading}>
						{#if loading}
							<span class="spinner"></span> Регистрируем...
						{:else}
							Зарегистрироваться
						{/if}
					</button>

					<p class="form-note">
						После регистрации вам придёт письмо с подтверждением на указанный email.
					</p>

					<!-- ФОРМА ВОССТАНОВЛЕНИЯ ПАРОЛЯ -->
				{:else}
					<div class="form-group">
						<label class="form-label" for="forgot-email">Email</label>
						<input
							id="forgot-email"
							class="form-input"
							class:form-input--error={fieldErrors.email}
							type="email"
							placeholder="you@university.ru"
							autocomplete="email"
							bind:value={email}
							onkeydown={(e) => e.key === 'Enter' && handleForgot()}
						/>
						{#if fieldErrors.email}
							<span class="field-error">{fieldErrors.email}</span>
						{/if}
					</div>

					<button class="btn btn--primary" onclick={handleForgot} disabled={loading}>
						{#if loading}
							<span class="spinner"></span> Отправляем...
						{:else}
							Отправить ссылку
						{/if}
					</button>
				{/if}
			{/if}
		</div>
	</div>
</div>
