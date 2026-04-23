import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { token } = await request.json();

	cookies.set('auth_token', token, {
		path: '/',
		httpOnly: true,
		secure: false,
		sameSite: 'strict',
		maxAge: 60 * 60 * 24 * 7,
	});

	return json({ ok: true });
};