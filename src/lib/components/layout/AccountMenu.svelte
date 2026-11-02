<!-- The avatar button in the top bar and the small menu it opens. -->
<script lang="ts">
	import { LogOut } from '@lucide/svelte';
	import { scale } from 'svelte/transition';
	import { signOutSession } from '$lib/auth-client';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import { resolveMotionDuration } from '$lib/motion';
	import { getInitials } from '$lib/person';

	let { userName, userRole }: { userName: string; userRole: string | null } = $props();

	let isMenuOpen = $state(false);
	let isSigningOut = $state(false);

	async function signOut(): Promise<void> {
		isSigningOut = true;
		await signOutSession();
		isSigningOut = false;
	}
</script>

<div class="account-wrap">
	<TooltipIconButton label="Account menu" class="avatar" onclick={() => (isMenuOpen = !isMenuOpen)}
		>{getInitials(userName)}</TooltipIconButton
	>{#if isMenuOpen}<div
			class="account-menu"
			transition:scale={{ start: 0.96, duration: resolveMotionDuration(120) }}
		>
			<strong>{userName}</strong><small>{userRole}</small><a
				href="/app/settings"
				onclick={() => (isMenuOpen = false)}>Appearance & settings</a
			><button onclick={signOut} disabled={isSigningOut}
				><LogOut size={16} /> {isSigningOut ? 'Signing out…' : 'Sign out'}</button
			>
		</div>{/if}
</div>
