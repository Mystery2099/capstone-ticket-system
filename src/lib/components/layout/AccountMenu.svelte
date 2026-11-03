<!-- The avatar button in the top bar and the small menu it opens. -->
<script lang="ts">
	import { Keyboard, LogOut } from '@lucide/svelte';
	import { scale } from 'svelte/transition';
	import { signOutSession } from '$lib/auth-client';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import { resolveMotionDuration } from '$lib/motion';
	import { getInitials } from '$lib/person';

	let {
		userName,
		userRole,
		onShowShortcuts
	}: { userName: string; userRole: string | null; onShowShortcuts: () => void } = $props();

	const MENU_ITEM_CLASS = 'flex gap-2.5 py-2 text-left';

	let isMenuOpen = $state(false);
	let isSigningOut = $state(false);

	async function signOut(): Promise<void> {
		isSigningOut = true;
		await signOutSession();
		isSigningOut = false;
	}
</script>

<div class="relative ml-auto max-md:absolute max-md:top-[19px] max-md:right-7">
	<TooltipIconButton label="Account menu" class="avatar" onclick={() => (isMenuOpen = !isMenuOpen)}
		>{getInitials(userName)}</TooltipIconButton
	>{#if isMenuOpen}<div
			class="absolute top-11 right-0 z-40 flex w-60 origin-top-right flex-col gap-3 rounded-[14px] border border-border bg-card p-[18px] shadow-[0_8px_30px_#211a1e22]"
			transition:scale={{ start: 0.96, duration: resolveMotionDuration(120) }}
		>
			<strong>{userName}</strong><small class="text-muted-foreground capitalize">{userRole}</small
			><a href="/app/settings" class={MENU_ITEM_CLASS} onclick={() => (isMenuOpen = false)}
				>Appearance & settings</a
			><button
				class={MENU_ITEM_CLASS}
				onclick={() => {
					isMenuOpen = false;
					onShowShortcuts();
				}}><Keyboard size={16} /> Keyboard shortcuts</button
			><button class={MENU_ITEM_CLASS} onclick={signOut} disabled={isSigningOut}
				><LogOut size={16} /> {isSigningOut ? 'Signing out…' : 'Sign out'}</button
			>
		</div>{/if}
</div>
