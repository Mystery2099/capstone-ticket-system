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
			user: import('$lib/server/access').Person | null;
		}
	}
}
export {};
