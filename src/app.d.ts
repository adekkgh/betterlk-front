declare global {
	namespace App {
		interface Locals {
			user?: {
				id: number;
				name: string;
				email: string;
				role: { name: string; display_name: string };
			};
		}
	}
}

export {};