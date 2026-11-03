<!-- The avatar button in the top bar and the small menu it opens. -->
<script lang="ts">
	import { Keyboard, LogOut } from '@lucide/svelte';
	import { scale } from 'svelte/transition';
	import { signOutSession } from '$lib/auth-client';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import { resolveMotionDuration } from '$lib/motion';
	import { getInitials } from '$lib/person';
	import { AppHotkeys, formatHotkeyHint } from '$lib/hotkeys';

	let {
		userName,
		userRole,
		onShowShortcuts
	}: { userName: string; userRole: string | null; onShowShortcuts: () => void } = $props();

	const MENU_ITEM_CLASS =
		'-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-60';

	let isMenuOpen = $state(false);
	let isSigningOut = $state(false);
	let accountMenuElement = $state<HTMLDivElement>();

	/** Clicking anywhere outside the account area closes the menu. */
	function handleDocumentPointerDown(event: PointerEvent): void {
		if (isMenuOpen && !accountMenuElement?.contains(event.target as Node)) {
			isMenuOpen = false;
		}
	}

	function handleDocumentKeyDown(event: KeyboardEvent): void {
		if (isMenuOpen && event.key === 'Escape') {
			isMenuOpen = false;
		}
	}

	/**
	 * Closing the menu removes the item that was clicked, so focus moves to the Account menu
	 * button first. The dialog then has a control that still exists to return focus to.
	 */
	function showShortcutsFromMenu(): void {
		accountMenuElement?.querySelector<HTMLButtonElement>('[aria-label="Account menu"]')?.focus();
		isMenuOpen = false;
		onShowShortcuts();
	}

	async function signOut(): Promise<void> {
		isSigningOut = true;
		await signOutSession();
		isSigningOut = false;
	}
</script>

<svelte:document onpointerdown={handleDocumentPointerDown} onkeydown={handleDocumentKeyDown} />

<div
	bind:this={accountMenuElement}
	class="relative ml-auto flex items-center gap-1 max-md:absolute max-md:top-[19px] max-md:right-7"
>
	<TooltipIconButton
		label="Keyboard shortcuts"
		tooltip={`Keyboard shortcuts (${formatHotkeyHint(AppHotkeys.SHOW_SHORTCUTS.hotkey)})`}
		class="icon-button max-md:hidden"
		onclick={onShowShortcuts}><Keyboard size={20} /></TooltipIconButton
	><TooltipIconButton label="Account menu" class="avatar" onclick={() => (isMenuOpen = !isMenuOpen)}
		>{getInitials(userName)}</TooltipIconButton
	>{#if isMenuOpen}<div
			class="absolute top-11 right-0 z-40 flex w-60 origin-top-right flex-col gap-3 rounded-[14px] border border-border bg-card p-[18px] shadow-[0_8px_30px_#211a1e22]"
			transition:scale={{ start: 0.96, duration: resolveMotionDuration(120) }}
		>
			<strong>{userName}</strong><small class="text-muted-foreground capitalize">{userRole}</small
			><a href="/app/settings" class={MENU_ITEM_CLASS} onclick={() => (isMenuOpen = false)}
				>Appearance & settings</a
			><button class={MENU_ITEM_CLASS} onclick={showShortcutsFromMenu}
				><Keyboard size={16} /> Keyboard shortcuts</button
			><button class={MENU_ITEM_CLASS} onclick={signOut} disabled={isSigningOut}
				><LogOut size={16} /> {isSigningOut ? 'Signing out…' : 'Sign out'}</button
			>
		</div>{/if}
</div>
