declare global {
	namespace App {
		interface Locals {
			user?: Record<string, any>;
			activeHomeworksCount?: number;
		}
	}
}

export {};