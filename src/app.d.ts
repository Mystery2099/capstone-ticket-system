import type { user } from '$lib/server/schema';
declare global {
	namespace App {
		interface Locals {
			user: typeof user.$inferSelect | null;
		}
	}
}
export {};
