<script lang="ts">
	import { signOutSession } from '$lib/auth-client';
	import { createHotkey } from '@tanstack/svelte-hotkeys';
	import { onMount } from 'svelte';
	let isHydrated = $state(false);
	onMount(() => {
		isHydrated = true;
	});
	import { navigating, page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { prefersReducedMotion } from 'svelte/motion';
	import { scale } from 'svelte/transition';
	import {
		Ticket,
		FilePen,
		UserRound,
		UserRoundPlus,
		Inbox,
		Layers,
		Settings,
		LogOut
	} from '@lucide/svelte';
	import { getInitials } from '$lib/person';
	import TicketSearchBar from '$lib/components/tickets/TicketSearchBar.svelte';
	import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
	import SidebarToggle from '$lib/components/layout/SidebarToggle.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import { createDelayedFlag } from '$lib/delayed.svelte';
	import { resolveMotionDuration } from '$lib/motion';
	import { Drafts, setDrafts } from '$lib/ticket-draft.svelte';
	import RouteSkeleton, {
		type RouteSkeletonKind
	} from '$lib/components/skeleton/RouteSkeleton.svelte';
	let { data, children } = $props();
	// This layout remounts when the user changes, so reading the id once is correct.
	// svelte-ignore state_referenced_locally
	const drafts = setDrafts(new Drafts(data.user.id, data.user.role === 'admin'));
	onMount(() => drafts.stores.forEach((store) => store.load()));
	// Debounced so typing costs one write after a pause, not one per keystroke.
	$effect(() => {
		const serializedDrafts = drafts.stores.map((store) => store.serialize());
		const saveTimeout = setTimeout(
			() => drafts.stores.forEach((store, index) => store.save(serializedDrafts[index])),
			300
		);
		return () => clearTimeout(saveTimeout);
	});
	// Read from the cookie on the server, so a minimized sidebar never flashes open.
	// svelte-ignore state_referenced_locally
	let isSidebarOpen = $state(data.isSidebarOpen);

	let isAccountMenuOpen = $state(false);
	let isSigningOut = $state(false);
	let isStaffUser = $derived(data.user.role !== 'requester');
	// Navigation highlights follow the destination, so clicks register before data arrives.
	let activeUrl = $derived(navigating.to?.url ?? page.url);
	let activeView = $derived(activeUrl.searchParams.get('view') || (isStaffUser ? 'open' : 'mine'));
	// A sidebar category is a narrowed All open, so only one of the two is highlighted.
	let activeCategoryId = $derived(
		activeView === 'open' ? activeUrl.searchParams.get('category') : null
	);
	// Moves within the ticket screen are handled by that page, which can reuse its list data.
	let targetRouteSkeleton = $derived.by((): RouteSkeletonKind | null => {
		const destination = navigating.to;
		if (!destination || destination.url.pathname === page.url.pathname) return null;
		const targetPath = destination.url.pathname;
		if (targetPath.startsWith('/app/tickets'))
			return page.route.id === destination.route.id
				? null
				: /\/(\d+|new)$/.test(targetPath)
					? 'ticket'
					: 'tickets';
		if (targetPath === '/app/admin/users') return 'users';
		if (targetPath === '/app/admin/categories') return 'categories';
		return targetPath === '/app/settings' ? 'settings' : null;
	});
	// Stays on the current list, and always starts a fresh ticket rather than an open draft.
	let newTicketHref = $derived.by(() => {
		if (!page.url.pathname.startsWith('/app/tickets')) return '/app/tickets/new';
		const params = new URLSearchParams(page.url.searchParams);
		params.delete('draft');
		return `/app/tickets/new${params.size ? '?' + params : ''}`;
	});
	let slowRouteNavigation = createDelayedFlag(() => targetRouteSkeleton !== null);
	let lastTargetRouteSkeleton = $state<RouteSkeletonKind>('tickets');
	$effect(() => {
		if (targetRouteSkeleton) lastTargetRouteSkeleton = targetRouteSkeleton;
	});
	let myRequestsView = $derived({
		key: 'mine',
		label: 'My requests',
		hint: 'Tickets you opened, in any status',
		count: data.ticketCounts.mine
	});
	let draftsView = $derived({
		key: 'drafts',
		label: 'Drafts',
		hint: 'Unfinished work, saved in this browser',
		icon: FilePen,
		count: drafts.dirtyDraftCount
	});
	let ticketViews = $derived(
		isStaffUser
			? [
					{
						key: 'queue',
						label: 'Assigned to me',
						hint: 'Unresolved tickets assigned to you',
						icon: UserRound,
						count: data.ticketCounts.queue
					},
					{
						key: 'unassigned',
						label: 'Unassigned',
						hint: 'Unresolved tickets with no assignee',
						icon: UserRoundPlus,
						count: data.ticketCounts.unassigned
					},
					{
						key: 'open',
						label: 'All open',
						hint: 'Every ticket that isn’t resolved or closed',
						icon: Inbox,
						count: data.ticketCounts.open
					},
					{
						key: 'all',
						label: 'All tickets',
						hint: 'Every ticket, including resolved and closed',
						icon: Layers,
						count: data.ticketCounts.all
					},
					{ ...myRequestsView, icon: UserRound }
				]
			: [{ ...myRequestsView, icon: Inbox }]
	);
	// Stays while its view is open, so emptying it doesn't pull the page out from under you.
	let navigationViews = $derived(
		draftsView.count || activeView === 'drafts' ? [...ticketViews, draftsView] : ticketViews
	);
	// Crossfades the main pane once a page's data is ready. Opening a new ticket is left out
	// because its form is already on screen and being typed in. The layer is only named
	// while transitioning, since a view-transition-name also creates a stacking context.
	onNavigate(({ from, to, complete }) => {
		const isSameUrl = from?.url.href === to?.url.href;
		const isOpeningNewTicket = to?.params?.id === 'new';
		if (
			!document.startViewTransition ||
			prefersReducedMotion.current ||
			isSameUrl ||
			isOpeningNewTicket
		)
			return;
		const rootElement = document.documentElement;
		rootElement.classList.add('page-transition');
		return new Promise<void>((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await complete.catch(() => {});
			});
			transition.finished.finally(() => rootElement.classList.remove('page-transition'));
		});
	});
	async function signOut(): Promise<void> {
		isSigningOut = true;
		await signOutSession();
		isSigningOut = false;
	}

	createHotkey(
		'/',
		() => {
			document.querySelector<HTMLInputElement>('[aria-label="Search tickets"]')?.focus();
		},
		{ ignoreInputs: true }
	);
</script>

<svelte:window
	onpagehide={() => drafts.stores.forEach((store) => store.save())}
	onstorage={(event) => drafts.stores.find((store) => store.storageKey === event.key)?.load()}
/>

<Sidebar.Provider
	bind:open={isSidebarOpen}
	data-hydrated={isHydrated}
	class={isSidebarOpen ? 'app-shell' : 'app-shell rail'}
>
	<header class="topbar">
		<SidebarToggle /><a class="brand" href="/app/tickets"
			><span class="logo"><Ticket size={22} /></span><strong>Ticket System</strong></a
		>
		<TicketSearchBar
			userId={data.user.id}
			people={data.searchPeople}
			categories={data.searchCategories}
		/>
		<div class="account-wrap">
			<TooltipIconButton
				label="Account menu"
				class="avatar"
				onclick={() => (isAccountMenuOpen = !isAccountMenuOpen)}
				>{getInitials(data.user.name)}</TooltipIconButton
			>{#if isAccountMenuOpen}<div
					class="account-menu"
					transition:scale={{ start: 0.96, duration: resolveMotionDuration(120) }}
				>
					<strong>{data.user.name}</strong><small>{data.user.role}</small><a
						href="/app/settings"
						onclick={() => (isAccountMenuOpen = false)}>Appearance & settings</a
					><button onclick={signOut} disabled={isSigningOut}
						><LogOut size={16} /> {isSigningOut ? 'Signing out…' : 'Sign out'}</button
					>
				</div>{/if}
		</div>
	</header>
	<AppSidebar
		{navigationViews}
		openTicketCountsByCategory={data.openTicketCountsByCategory}
		isAdmin={data.user.role === 'admin'}
		{activeUrl}
		{activeView}
		{activeCategoryId}
		{newTicketHref}
	/>
	<main>
		{#if slowRouteNavigation.current}<RouteSkeleton
				kind={targetRouteSkeleton ?? lastTargetRouteSkeleton}
			/>{/if}
		<!-- Stays mounted so a failed navigation returns to the page with its state intact. -->
		<div class={slowRouteNavigation.current ? 'hidden' : 'contents'}>{@render children()}</div>
	</main>
	<nav class="mobile-nav" aria-label="Mobile navigation">
		{#each navigationViews.slice(0, 3) as navigationView (navigationView.key)}<a
				class:active={activeView === navigationView.key &&
					activeUrl.pathname.startsWith('/app/tickets')}
				href={'/app/tickets?view=' + navigationView.key}
				><span><navigationView.icon size={23} /></span>{navigationView.label}</a
			>{/each}<a href="/app/settings"><span><Settings size={23} /></span>Settings</a>
	</nav>
</Sidebar.Provider>
