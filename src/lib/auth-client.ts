import { goto, invalidateAll } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { createAuthClient } from 'better-auth/svelte';
import { twoFactorClient } from 'better-auth/client/plugins';

/** Same-origin browser client. Permissions remain enforced by the server. */
export const authClient = createAuthClient({ plugins: [twoFactorClient()] });

/** Both sign-out buttons share navigation and friendly failure handling. */
export async function signOutSession(): Promise<void> {
	try {
		const { error } = await authClient.signOut();
		if (error) {
			toast.error('Could not sign out. Please try again.');
			return;
		}
		await invalidateAll();
		await goto('/login');
	} catch {
		toast.error('Could not connect. Please try again.');
	}
}
