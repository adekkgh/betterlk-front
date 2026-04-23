import { writable } from 'svelte/store';

export interface Role {
	name: string;
	display_name: string;
}

export interface User {
	id: number;
	name: string;
	email: string;
	role: Role;
	email_verified_at: string | null;
}

export const userStore = writable<User | null>(null);
export const tokenStore = writable<string | null>(null);