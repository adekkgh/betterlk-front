import { redirect } from '@sveltejs/kit';
import { api } from '$lib/helpers/api';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('auth_token');

	if (token) {
		// Инвалидируем токен на бэке
		await api('/auth/logout', {
			method: 'POST',
			token,
		});
	}

	// Удаляем cookie
	cookies.delete('auth_token', { path: '/' });

	throw redirect(302, '/login');
};