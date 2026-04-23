import { API_BASE_URL } from '$lib/config';
import { get } from 'svelte/store';
import { tokenStore } from '$lib/stores/user';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

interface ApiOptions {
	method?: Method;
	body?: Record<string, unknown> | FormData;
	token?: string;
}

interface ApiResponse<T> {
	data: T | null;
	error: string | null;
	status: number;
}

export async function api<T>(
	path: string,
	options: ApiOptions = {}
): Promise<ApiResponse<T>> {
	const { method = 'GET', body } = options;

	const token = options.token ?? get(tokenStore);

	const headers: Record<string, string> = {
		'Accept': 'application/json',
	};

	const isFormData = body instanceof FormData;

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	try {
		const response = await fetch(`${API_BASE_URL}${path}`, {
			method,
			headers: isFormData
				? headers  // без Content-Type
				: { ...headers, 'Content-Type': 'application/json' },
				body: isFormData ? body : body ? JSON.stringify(body) : undefined,
			credentials: 'include',
		});

		if (response.status === 204) {
			return {
				data: null,
				error: null,
				status: 204
			};
		}

		const json = await response.json();

		if (!response.ok) {
			return {
				data: null,
				error: json.message ?? 'Неизвестная ошибка',
				status: response.status,
			};
		}

		return {
			data: json,
			error: null,
			status: response.status,
		};
	} catch {
		return {
			data: null,
			error: 'Не удалось получить ответ от сервера',
			status: 0,
		};
	}
}