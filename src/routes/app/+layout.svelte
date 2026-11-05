<script lang="ts">
	import { hasPermission } from '$lib/permissions';
	import { createHotkey } from '@tanstack/svelte-hotkeys';
	import { AppHotkeys } from '$lib/hotkeys';
	import { onMount } from 'svelte';
	import { navigating, page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { prefersReducedMotion } from 'svelte/motion';
	import {
		Ticket,
		FilePen,
		FolderOpen,
		Send,
		UserRoundCheck,
		UserRoundPlus,
		Inbox,
		Layers,
		Settings
	} from '@lucide/svelte';
	import { TICKET_VIEW_TITLES, getDefaultTicketView } from '$lib/ticket-views';
	import { setTicketViewLinks, type TicketViewLink } from '$lib/ticket-view-links';
	import TicketSearchBar from '$lib/components/tickets/TicketSearchBar.svelte';
	import AccountMenu from '$lib/components/layout/AccountMenu.svelte';
	import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
	import SidebarToggle from '$lib/components/layout/SidebarToggle.svelte';
	import KeyboardShortcutsDialog from '$lib/components/layout/KeyboardShortcutsDialog.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { createDelayedFlag } from '$lib/delayed.svelte';
	import { cn } from '$lib/utils';
	import { Drafts, setDrafts } from '$lib/drafts.svelte';
	import RouteSkeleton, {
		type RouteSkeletonKind
	} from '$lib/components/skeleton/RouteSkeleton.svelte';
	const MOBILE_NAV_LINK_CLASS = 'flex min-w-[60px] flex-col items-center gap-1 text-[11px]';
	const MOBILE_NAV_ICON_CLASS = 'h-[29px] rounded-[24px] px-4 py-[3px]';

	let { data, children } = $props();
	let isHydrated = $state(false);
	onMount(() => {
		isHydrated = true;
	});
	// This layout remounts when the user changes, so reading the id once is correct.
	// svelte-ignore state_referenced_locally
	const drafts = setDrafts(
		new Drafts(data.user.id, hasPermission(data.user, 'manageAdministration'))
	);
	drafts.startBrowserPersistence();
	// Read from the cookie on the server, so a minimized sidebar never flashes open.
	// svelte-ignore state_referenced_locally
	let isSidebarOpen = $state(data.isSidebarOpen);
	let isShortcutsDialogOpen = $state(false);

	let isStaffUser = $derived(hasPermission(data.user, 'viewAllTickets'));
	// Navigation highlights follow the destination, so clicks register before data arrives.
	let activeUrl = $derived(navigating.to?.url ?? page.url);
	let activeView = $derived(
		activeUrl.searchParams.get('view') || getDefaultTicketView(isStaffUser)
	);
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
		label: TICKET_VIEW_TITLES.mine,
		hint: 'Tickets you opened, in any status',
		icon: Send,
		count: data.ticketCounts.mine
	});
	let draftsView = $derived({
		key: 'drafts',
		label: TICKET_VIEW_TITLES.drafts,
		hint: 'Unfinished work, saved in this browser',
		icon: FilePen,
		count: drafts.dirtyDraftCount
	});
	let ticketViews = $derived(
		isStaffUser
			? [
					{
						key: 'queue',
						label: TICKET_VIEW_TITLES.queue,
						hint: 'Unresolved tickets assigned to you',
						icon: UserRoundCheck,
						count: data.ticketCounts.queue
					},
					{
						key: 'unassigned',
						label: TICKET_VIEW_TITLES.unassigned,
						hint: 'Unresolved tickets with no assignee',
						icon: UserRoundPlus,
						count: data.ticketCounts.unassigned
					},
					{
						key: 'open',
						label: TICKET_VIEW_TITLES.open,
						hint: 'Every ticket that isn’t resolved or closed',
						icon: FolderOpen,
						count: data.ticketCounts.open
					},
					{
						key: 'all',
						label: TICKET_VIEW_TITLES.all,
						hint: 'Every ticket, including resolved and closed',
						icon: Layers,
						count: data.ticketCounts.all
					},
					myRequestsView
				]
			: [myRequestsView]
	);
	// Stays while its view is open, so emptying it doesn't pull the page out from under you.
	let navigationViews = $derived<TicketViewLink[]>(
		draftsView.count || activeView === 'drafts' ? [...ticketViews, draftsView] : ticketViews
	);
	setTicketViewLinks(() => navigationViews);
	// The phone Tickets tab returns to the last list view, rather than resetting to the default.
	let lastTicketListView = $state<string | null>(null);
	$effect(() => {
		if (page.url.pathname === '/app/tickets')
			lastTicketListView = page.url.searchParams.get('view');
	});
	let ticketListHref = $derived(
		lastTicketListView ? '/app/tickets?view=' + lastTicketListView : '/app/tickets'
	);
	let isInboxActive = $derived(activeUrl.pathname === '/app/inbox');
	let isTicketsActive = $derived(activeUrl.pathname.startsWith('/app/tickets'));
	let isSettingsActive = $derived(activeUrl.pathname === '/app/settings');
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

	createHotkey(
		AppHotkeys.FOCUS_SEARCH.hotkey,
		() => {
			document.querySelector<HTMLInputElement>('[aria-label="Search tickets"]')?.focus();
		},
		{ ignoreInputs: true }
	);

	createHotkey(
		AppHotkeys.SHOW_SHORTCUTS.hotkey,
		() => {
			isShortcutsDialogOpen = true;
		},
		{ ignoreInputs: true }
	);
</script>

<KeyboardShortcutsDialog bind:open={isShortcutsDialogOpen} />
<a class="skip-link" href="#main-content">Skip to main content</a>

<Sidebar.Provider
	bind:open={isSidebarOpen}
	data-hydrated={isHydrated}
	class={isSidebarOpen ? 'app-shell' : 'app-shell rail'}
>
	<header
		class="col-span-full flex items-center gap-3 py-2 pr-1 pl-4 max-md:relative max-md:h-[74px] max-md:shrink-0 max-md:gap-0 max-md:bg-card max-md:px-4 max-md:py-2.5"
	>
		<SidebarToggle /><a
			class="flex min-w-[168px] items-center gap-2.5 text-[18px] whitespace-nowrap max-md:hidden md:max-lg:min-w-0"
			href="/app/tickets"
			><span class="logo"><Ticket size={22} /></span><strong class="md:max-lg:hidden"
				>Ticket System</strong
			></a
		>
		<TicketSearchBar
			userId={data.user.id}
			people={data.searchPeople}
			categories={data.searchCategories}
		/>
		<AccountMenu
			userName={data.user.name}
			userRole={data.user.roleName ?? data.user.role}
			onShowShortcuts={() => (isShortcutsDialogOpen = true)}
		/>
	</header>
	<AppSidebar
		{navigationViews}
		openTicketCountsByCategory={data.openTicketCountsByCategory}
		isAdmin={hasPermission(data.user, 'manageAdministration')}
		{activeUrl}
		{activeView}
		{activeCategoryId}
		{newTicketHref}
		unreadNotificationCount={data.unreadNotificationCount}
	/>
	<main id="main-content" tabindex="-1">
		{#if slowRouteNavigation.current}<RouteSkeleton
				kind={targetRouteSkeleton ?? lastTargetRouteSkeleton}
			/>{/if}
		<!-- Stays mounted so a failed navigation returns to the page with its state intact. -->
		<div class={slowRouteNavigation.current ? 'hidden' : 'contents'}>{@render children()}</div>
	</main>
	<nav
		class="hidden h-[74px] shrink-0 items-center justify-around gap-0.5 bg-muted px-1.5 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] max-md:flex"
		aria-label="Mobile navigation"
	>
		<a
			class={cn(MOBILE_NAV_LINK_CLASS, isInboxActive && 'font-[650]')}
			href="/app/inbox"
			aria-current={isInboxActive ? 'page' : undefined}
			aria-label={data.unreadNotificationCount
				? `Inbox, ${data.unreadNotificationCount} unread`
				: 'Inbox'}
			><span
				class={cn(MOBILE_NAV_ICON_CLASS, 'relative', isInboxActive && 'bg-selected text-primary')}
				><Inbox size={23} />{#if data.unreadNotificationCount}<span
						class="absolute top-0 right-2 size-2 rounded-full bg-primary"
						aria-hidden="true"
					></span>{/if}</span
			>Inbox</a
		><a
			class={cn(MOBILE_NAV_LINK_CLASS, isTicketsActive && 'font-[650]')}
			href={ticketListHref}
			aria-current={isTicketsActive ? 'page' : undefined}
			><span class={cn(MOBILE_NAV_ICON_CLASS, isTicketsActive && 'bg-selected text-primary')}
				><Ticket size={23} /></span
			>Tickets</a
		><a
			class={cn(MOBILE_NAV_LINK_CLASS, isSettingsActive && 'font-[650]')}
			href="/app/settings"
			aria-current={isSettingsActive ? 'page' : undefined}
			><span class={cn(MOBILE_NAV_ICON_CLASS, isSettingsActive && 'bg-selected text-primary')}
				><Settings size={23} /></span
			>Settings</a
		>
	</nav>
</Sidebar.Provider>

<style>
	.skip-link {
		position: fixed;
		top: 8px;
		left: 8px;
		z-index: 100;
		padding: 12px 16px;
		background: var(--background);
		color: var(--foreground);
		transform: translateY(calc(-100% - 16px));
	}
	.skip-link:focus {
		transform: translateY(0);
	}
</style>
