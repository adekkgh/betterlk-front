import { redirect, type Handle } from '@sveltejs/kit';
import { api } from '$lib/helpers/api';

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/reset-password'];
const PUBLIC_PAGES = ['/auth/set-cookie']; // наш внутренний endpoint

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Пропускаем служебные запросы браузера и внутренние endpoints
	if (
		path.startsWith('/.well-known') ||
		path.startsWith('/auth/set-cookie') ||
		path.startsWith('/favicon')
	) {
		return resolve(event);
	}

	const token = event.cookies.get('auth_token');
	const isAuthPage = AUTH_PAGES.some(p => path.startsWith(p));

	if (!token) {
		if (!isAuthPage) throw redirect(302, '/login');
		return resolve(event);
	}

	const { data: user, error } = await api('/auth/me', { token });

	if (error || !user) {
		event.cookies.delete('auth_token', { path: '/' });
		if (!isAuthPage) throw redirect(302, '/login');
		return resolve(event);
	}

	event.locals.user = user as any;

	if (isAuthPage) throw redirect(302, '/');

	return resolve(event);
};