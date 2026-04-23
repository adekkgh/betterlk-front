<script lang="ts">
	import './styles.scss';
	import { api } from '$lib/helpers/api';
	import { page } from '$app/stores';

	const token = $derived($page.url.searchParams.get('token') ?? '');

	let password        = $state('');
	let passwordConfirm = $state('');
	let showPass        = $state(false);
	let showPassConfirm = $state(false);
	let loading         = $state(false);
	let error           = $state('');
	let fieldErrors     = $state<Record<string, string>>({});
	let success         = $state(false);
	let countdown       = $state(5);

	function validate(): boolean {
		fieldErrors = {};
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
		if (password !== passwordConfirm) {
			fieldErrors.passwordConfirm = 'Пароли не совпадают';
		}
		return Object.keys(fieldErrors).length === 0;
	}

	async function handleReset() {
		if (!token) {
			error = 'Токен сброса пароля не найден. Запросите новую ссылку.';
			return;
		}
		if (!validate()) return;

		loading = true;
		error   = '';

		const { data, error: err, status } = await api<any>('/auth/reset-password', {
			method: 'POST',
			body: {
				token,
				password,
				password_confirmation: passwordConfirm,
			},
		});

		loading = false;

		if (err) {
			if (status === 422) {
				if (data?.errors) {
					const mapped: Record<string, string> = {};
					for (const [key, msgs] of Object.entries(data.errors)) {
						mapped[key] = (msgs as string[])[0];
					}
					fieldErrors = mapped;
				} else {
					error = data?.message ?? err;
				}
			} else {
				error = err;
			}
			return;
		}

		success = true;

		// Обратный отсчёт и редирект
		const interval = setInterval(() => {
			countdown -= 1;
			if (countdown <= 0) {
				clearInterval(interval);
				window.location.href = '/login';
			}
		}, 1000);
	}
</script>

<div class="reset-page">
	<div class="reset-card">
		<div class="logo-wrap">
			<div class="logo-mark">
				<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2L2 7l10 5 10-5-10-5z"/>
					<path d="M2 17l10 5 10-5"/>
					<path d="M2 12l10 5 10-5"/>
				</svg>
			</div>
			<span class="logo-text">BetterLK</span>
		</div>

		{#if !token}
			<div class="state-wrap">
				<div class="state-icon state-icon--error">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</div>
				<h2>Ссылка недействительна</h2>
				<p>Токен сброса пароля не найден. Запросите новую ссылку для сброса.</p>
				<a href="/login" class="btn btn--primary" style="text-decoration:none;margin-top:8px;">
					Вернуться ко входу
				</a>
			</div>

		{:else if success}
			<div class="state-wrap">
				<div class="state-icon state-icon--success">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
				</div>
				<h2>Пароль изменён!</h2>
				<p>Ваш пароль успешно обновлён. Теперь вы можете войти с новым паролем.</p>
				<div class="countdown">
					Переход ко входу через <strong>{countdown}</strong> сек.
				</div>
				<a href="/login" class="btn-link-styled">Войти сейчас →</a>
			</div>

		{:else}
			<div class="form-header">
				<h2>Новый пароль</h2>
				<p>Придумайте надёжный пароль для вашего аккаунта</p>
			</div>

			{#if error}
				<div class="alert alert--error">
					<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
					</svg>
					{error}
				</div>
			{/if}

			<div class="form-group">
				<label class="form-label" for="new-pass">Новый пароль</label>
				<div class="input-wrap">
					<input
						id="new-pass"
						class="form-input"
						class:form-input--error={fieldErrors.password}
						type={showPass ? 'text' : 'password'}
						placeholder="Минимум 8 символов"
						autocomplete="new-password"
						bind:value={password}
					/>
					<button class="input-eye" type="button" onclick={() => showPass = !showPass}>
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
				<label class="form-label" for="confirm-pass">Повторите пароль</label>
				<div class="input-wrap">
					<input
						id="confirm-pass"
						class="form-input"
						class:form-input--error={fieldErrors.passwordConfirm}
						type={showPassConfirm ? 'text' : 'password'}
						placeholder="Повторите пароль"
						autocomplete="new-password"
						bind:value={passwordConfirm}
						onkeydown={(e) => e.key === 'Enter' && handleReset()}
					/>
					<button class="input-eye" type="button" onclick={() => showPassConfirm = !showPassConfirm}>
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

			<button class="btn btn--primary" onclick={handleReset} disabled={loading}>
				{#if loading}
					<span class="spinner"></span> Сохраняем...
				{:else}
					Сохранить пароль
				{/if}
			</button>

			<a href="/login" class="btn-link-styled" style="margin-top:14px;display:block;text-align:center;">
				Вернуться ко входу
			</a>
		{/if}
	</div>
</div>
