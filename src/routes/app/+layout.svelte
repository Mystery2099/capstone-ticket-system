<script lang="ts">
	import { onMount } from 'svelte';
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
	import { navigating, page } from '$app/state';
	import { goto, invalidateAll, onNavigate } from '$app/navigation';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade, scale } from 'svelte/transition';
	import {
		Ticket,
		ChevronDown,
		FilePen,
		Menu,
		Search,
		SlidersHorizontal,
		SquarePen,
		UserRound,
		UserRoundPlus,
		Inbox,
		Layers,
		Settings,
		Users,
		Tags,
		X,
		LogOut
	} from '@lucide/svelte';
	import { initials } from '$lib/status';
	import { mergeProps } from 'bits-ui';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { delayed } from '$lib/delayed.svelte';
	import { motionMs } from '$lib/motion';
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
		const saved = drafts.stores.map((store) => store.serialize());
		const timer = setTimeout(() => drafts.stores.forEach((s, i) => s.save(saved[i])), 300);
		return () => clearTimeout(timer);
	});
	// The phone drawer and the desktop rail are separate: links close the drawer, and a
	// minimized rail has to stay minimized while moving around the app.
	let drawer = $state(false),
		railed = $state(false),
		query = $state(''),
		account = $state(false),
		signingOut = $state(false),
		categoriesOpen = $state(true);
	let staff = $derived(data.user.role !== 'requester');
	// Navigation highlights follow the destination, so clicks register before data arrives.
	let url = $derived(navigating.to?.url ?? page.url);
	let view = $derived(url.searchParams.get('view') || (staff ? 'open' : 'mine'));
	// A sidebar category is a narrowed All open, so only one of the two is highlighted.
	let openCategory = $derived(view === 'open' ? url.searchParams.get('category') : null);
	// Moves within the ticket screen are handled by that page, which can reuse its list data.
	let routeTarget = $derived.by((): RouteSkeletonKind | null => {
		const to = navigating.to;
		if (!to || to.url.pathname === page.url.pathname) return null;
		const path = to.url.pathname;
		if (path.startsWith('/app/tickets'))
			return page.route.id === to.route.id
				? null
				: /\/(\d+|new)$/.test(path)
					? 'ticket'
					: 'tickets';
		if (path === '/app/admin/users') return 'users';
		if (path === '/app/admin/categories') return 'categories';
		return path === '/app/settings' ? 'settings' : null;
	});
	// Stays on the current list, and always starts a fresh ticket rather than an open draft.
	let newTicketHref = $derived.by(() => {
		if (!page.url.pathname.startsWith('/app/tickets')) return '/app/tickets/new';
		const params = new URLSearchParams(page.url.searchParams);
		params.delete('draft');
		return `/app/tickets/new${params.size ? '?' + params : ''}`;
	});
	let routeLoading = delayed(() => routeTarget !== null);
	let lastRouteTarget = $state<RouteSkeletonKind>('tickets');
	$effect(() => {
		if (routeTarget) lastRouteTarget = routeTarget;
	});
	let requests = $derived({
		key: 'mine',
		label: 'My requests',
		hint: 'Tickets you opened, in any status',
		count: data.counts.mine
	});
	let draftsLink = $derived({
		key: 'drafts',
		label: 'Drafts',
		hint: 'Unfinished work, saved in this browser',
		icon: FilePen,
		count: drafts.count
	});
	let ticketViews = $derived(
		staff
			? [
					{
						key: 'queue',
						label: 'Assigned to me',
						hint: 'Unresolved tickets assigned to you',
						icon: UserRound,
						count: data.counts.queue
					},
					{
						key: 'unassigned',
						label: 'Unassigned',
						hint: 'Unresolved tickets with no assignee',
						icon: UserRoundPlus,
						count: data.counts.unassigned
					},
					{
						key: 'open',
						label: 'All open',
						hint: 'Every ticket that isn’t resolved or closed',
						icon: Inbox,
						count: data.counts.open
					},
					{
						key: 'all',
						label: 'All tickets',
						hint: 'Every ticket, including resolved and closed',
						icon: Layers,
						count: data.counts.all
					},
					{ ...requests, icon: UserRound }
				]
			: [{ ...requests, icon: Inbox }]
	);
	// Stays while its view is open, so emptying it doesn't pull the page out from under you.
	let nav = $derived(
		draftsLink.count || view === 'drafts' ? [...ticketViews, draftsLink] : ticketViews
	);
	$effect(() => {
		query = page.url.searchParams.get('q') || '';
	});
	// Crossfades the main pane once a page's data is ready. Opening a new ticket is left out
	// because its form is already on screen and being typed in. The layer is only named
	// while transitioning, since a view-transition-name also creates a stacking context.
	onNavigate(({ from, to, complete }) => {
		const sameUrl = from?.url.href === to?.url.href;
		const writing = to?.params?.id === 'new';
		if (!document.startViewTransition || prefersReducedMotion.current || sameUrl || writing) return;
		const root = document.documentElement;
		root.classList.add('page-transition');
		return new Promise<void>((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await complete.catch(() => {});
			});
			transition.finished.finally(() => root.classList.remove('page-transition'));
		});
	});
	function toggleNavigation() {
		if (matchMedia('(max-width: 767px)').matches) drawer = !drawer;
		else railed = !railed;
	}
	async function search(e: SubmitEvent) {
		e.preventDefault();
		const p = new URLSearchParams(page.url.searchParams);
		p.delete('draft');
		if (p.get('view') === 'drafts') p.delete('view');
		query.trim() ? p.set('q', query.trim()) : p.delete('q');
		await goto('/app/tickets?' + p);
	}
	async function signOut() {
		signingOut = true;
		await fetch('/api/auth/sign-out', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}'
		});
		await invalidateAll();
		await goto('/login');
	}
</script>

<svelte:window
	onpagehide={() => drafts.stores.forEach((store) => store.save())}
	onstorage={(e) => drafts.stores.find((store) => store.key === e.key)?.load()}
	onkeydown={(e) => {
		if (
			e.key === '/' &&
			!['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
		) {
			e.preventDefault();
			document.querySelector<HTMLInputElement>('[aria-label="Search tickets"]')?.focus();
		}
	}}
/>

<div data-hydrated={hydrated} class="app-shell" class:rail={railed}>
	<header class="topbar">
		<Tooltip.Root>
			<Tooltip.Trigger onclick={toggleNavigation}>
				{#snippet child({ props })}
					<button {...props} class="icon-button menu-button" aria-label="Toggle navigation"
						><Menu /></button
					>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={6}>Toggle navigation</Tooltip.Content>
		</Tooltip.Root><a class="brand" href="/app/tickets"
			><span class="logo"><Ticket size={22} /></span><strong>Ticket System</strong></a
		>
		<form class="search-bar" onsubmit={search}>
			<Search size={23} /><input
				aria-label="Search tickets"
				placeholder="Search tickets, people, #number"
				bind:value={query}
			/><kbd>/</kbd><Tooltip.Root>
				<Tooltip.Trigger
					onclick={() => {
						const field = document.querySelector<HTMLSelectElement>(
							'[aria-label="Filter by status"]'
						);
						if (field) field.focus();
						else goto('/app/tickets?view=' + view);
					}}
				>
					{#snippet child({ props })}
						<button {...props} class="icon-button" aria-label="Filter tickets" type="button"
							><SlidersHorizontal size={21} /></button
						>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" sideOffset={6}>Filter tickets</Tooltip.Content>
			</Tooltip.Root>
		</form>
		<div class="account-wrap">
			<Tooltip.Root>
				<Tooltip.Trigger onclick={() => (account = !account)}>
					{#snippet child({ props })}
						<button {...props} class="avatar" aria-label="Account menu"
							>{initials(data.user.name)}</button
						>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" sideOffset={6}>Account menu</Tooltip.Content>
			</Tooltip.Root>{#if account}<div
					class="account-menu"
					transition:scale={{ start: 0.96, duration: motionMs(120) }}
				>
					<strong>{data.user.name}</strong><small>{data.user.role}</small><a
						href="/app/settings"
						onclick={() => (account = false)}>Appearance & settings</a
					><button onclick={signOut} disabled={signingOut}
						><LogOut size={16} /> {signingOut ? 'Signing out…' : 'Sign out'}</button
					>
				</div>{/if}
		</div>
	</header>
	{#if drawer}<button
			transition:fade={{ duration: motionMs(180) }}
			class="drawer-scrim"
			aria-label="Close navigation"
			onclick={() => (drawer = false)}
		></button>{/if}
	<aside class:drawer-open={drawer}>
		<div class="drawer-brand">
			<span>Ticket System</span><Tooltip.Root>
				<Tooltip.Trigger onclick={() => (drawer = false)}>
					{#snippet child({ props })}
						<button {...props} class="icon-button" aria-label="Close navigation"><X /></button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" sideOffset={6}>Close navigation</Tooltip.Content>
			</Tooltip.Root>
		</div>
		<a class="new-ticket" href={newTicketHref} onclick={() => (drawer = false)}
			><SquarePen size={25} /><span>New ticket</span></a
		>
		<div class="sidebar-scroll">
			<nav aria-label="Tickets">
				{#each nav as n}
					{#snippet viewLink()}
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}<a
										{...mergeProps(props, { onclick: () => (drawer = false) })}
										class:active={url.pathname.startsWith('/app/tickets') &&
											view === n.key &&
											!openCategory}
										href={'/app/tickets?view=' + n.key}
										aria-label={n.label}
										><n.icon size={23} /><span>{n.label}</span><small>{n.count}</small></a
									>{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="right" sideOffset={8}>{n.hint}</Tooltip.Content>
						</Tooltip.Root>
					{/snippet}
					{#if n.key === 'open' && data.openByCategory.length}
						<Collapsible.Root bind:open={categoriesOpen}>
							<div class="nav-row">
								{@render viewLink()}
								<Collapsible.Trigger
									class="nav-toggle"
									aria-label={categoriesOpen ? 'Hide categories' : 'Show categories'}
									><ChevronDown size={18} /></Collapsible.Trigger
								>
							</div>
							<Collapsible.Content class="category-nav">
								{#each data.openByCategory as c (c.id)}<a
										class:active={url.pathname.startsWith('/app/tickets') && openCategory === c.id}
										href={`/app/tickets?view=open&category=${c.id}`}
										onclick={() => (drawer = false)}
										><span>{c.name}</span><small>{c.count}</small></a
									>{/each}
							</Collapsible.Content>
						</Collapsible.Root>
					{:else}{@render viewLink()}{/if}
				{/each}
			</nav>
			{#if data.user.role === 'admin'}<p class="nav-section">Administration</p>
				<nav aria-label="Administration">
					<a
						class:active={url.pathname.endsWith('/users')}
						href="/app/admin/users"
						onclick={() => (drawer = false)}><Users size={23} /><span>Users</span></a
					><a
						class:active={url.pathname.endsWith('/categories')}
						href="/app/admin/categories"
						onclick={() => (drawer = false)}><Tags size={23} /><span>Categories</span></a
					>
				</nav>{/if}
		</div>
		<nav class="sidebar-bottom" aria-label="General">
			<a
				class:active={url.pathname === '/app/settings'}
				href="/app/settings"
				onclick={() => (drawer = false)}><Settings size={23} /><span>Settings</span></a
			>
		</nav>
	</aside>
	<main>
		{#if routeLoading.current}<RouteSkeleton kind={routeTarget ?? lastRouteTarget} />{/if}
		<!-- Stays mounted so a failed navigation returns to the page with its state intact. -->
		<div class={routeLoading.current ? 'hidden' : 'contents'}>{@render children()}</div>
	</main>
	<nav class="mobile-nav" aria-label="Mobile navigation">
		{#each nav.slice(0, 3) as n}<a
				class:active={view === n.key && url.pathname.startsWith('/app/tickets')}
				href={'/app/tickets?view=' + n.key}><span><n.icon size={23} /></span>{n.label}</a
			>{/each}<a href="/app/settings"><span><Settings size={23} /></span>Settings</a>
	</nav>
</div>
