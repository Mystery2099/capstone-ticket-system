import type { user } from '$lib/server/schema';
declare global {
	namespace App {
		namespace Superforms {
			interface Message {
				text: string;
				failed?: boolean;
				createdId?: string;
			}
		}
		interface Locals {
			user: typeof user.$inferSelect | null;
		}
	}
}
export {};
