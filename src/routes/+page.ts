import type { PageLoad } from './$types';
import { API_BASE_URL } from '$lib/config';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch(`${API_BASE_URL}/health-check`);
	const data = await res.json();

	return {
		health: data
	};
};
