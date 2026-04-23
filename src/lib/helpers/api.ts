import { API_BASE_URL } from '$lib/config';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

interface ApiOptions {
	method?: Method;
	body?: Record<string, unknown>;
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
	const { method = 'GET', body, token } = options;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'Accept': 'application/json',
	};

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	try {
		const response = await fetch(`${API_BASE_URL}${path}`, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
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