import type { RequestEvent } from '@sveltejs/kit';

export const load = async (event: RequestEvent) => {
	return {
		user: event.locals.user ?? null,
		token: event.cookies.get('auth_token') ?? null,
		activeHomeworksCount: event.locals.activeHomeworksCount ?? 0,
	};
};