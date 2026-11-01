<script lang="ts">
	import { onMount } from 'svelte';
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
	import { navigating, page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import {
		Ticket,
		ChevronDown,
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
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { delayed } from '$lib/delayed.svelte';
	import RouteSkeleton, {
		type RouteSkeletonKind
	} from '$lib/components/skeleton/RouteSkeleton.svelte';
	let { data, children } = $props();
	let drawer = $state(false),
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
			return page.route.id === to.route.id ? null : /\/\d+$/.test(path) ? 'ticket' : 'tickets';
		if (path === '/app/admin/users') return 'users';
		if (path === '/app/admin/categories') return 'categories';
		return path === '/app/settings' ? 'settings' : null;
	});
	let routeLoading = delayed(() => routeTarget !== null);
	let lastRouteTarget = $state<RouteSkeletonKind>('tickets');
	$effect(() => {
		if (routeTarget) lastRouteTarget = routeTarget;
	});
	let nav = $derived([
		...(staff
			? [
					{ key: 'queue', label: 'My queue', icon: UserRound, count: data.counts.queue },
					{
						key: 'unassigned',
						label: 'Unassigned',
						icon: UserRoundPlus,
						count: data.counts.unassigned
					},
					{ key: 'open', label: 'All open', icon: Inbox, count: data.counts.open },
					{ key: 'all', label: 'All tickets', icon: Layers, count: data.counts.all }
				]
			: [{ key: 'mine', label: 'My tickets', icon: Inbox, count: data.counts.mine }])
	]);
	$effect(() => {
		query = page.url.searchParams.get('q') || '';
	});
	async function search(e: SubmitEvent) {
		e.preventDefault();
		const p = new URLSearchParams(page.url.searchParams);
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
<div data-hydrated={hydrated} class="app-shell" class:rail={drawer}>
	<header class="topbar">
		<button
			class="icon-button menu-button"
			aria-label="Toggle navigation"
			onclick={() => (drawer = !drawer)}><Menu /></button
		><a class="brand" href="/app/tickets"
			><span class="logo"><Ticket size={22} /></span><strong>Ticket System</strong></a
		>
		<form class="search-bar" onsubmit={search}>
			<Search size={23} /><input
				aria-label="Search tickets"
				placeholder="Search tickets, people, #number"
				bind:value={query}
			/><kbd>/</kbd><button
				class="icon-button"
				aria-label="Filter tickets"
				type="button"
				onclick={() => {
					const field = document.querySelector<HTMLSelectElement>(
						'[aria-label="Filter by status"]'
					);
					if (field) field.focus();
					else goto('/app/tickets?view=' + view);
				}}><SlidersHorizontal size={21} /></button
			>
		</form>
		<div class="account-wrap">
			<button class="avatar" aria-label="Account menu" onclick={() => (account = !account)}
				>{initials(data.user.name)}</button
			>{#if account}<div class="account-menu">
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
			class="drawer-scrim"
			aria-label="Close navigation"
			onclick={() => (drawer = false)}
		></button>{/if}
	<aside class:drawer-open={drawer}>
		<div class="drawer-brand">
			<span>Ticket System</span><button
				class="icon-button"
				aria-label="Close navigation"
				onclick={() => (drawer = false)}><X /></button
			>
		</div>
		<a class="new-ticket" href="/app/tickets/new" onclick={() => (drawer = false)}
			><SquarePen size={25} /><span>New ticket</span></a
		>
		<div class="sidebar-scroll">
			<nav aria-label="Tickets">
				{#each nav as n}
					{#snippet viewLink()}<a
							class:active={url.pathname.startsWith('/app/tickets') &&
								view === n.key &&
								!openCategory}
							href={'/app/tickets?view=' + n.key}
							onclick={() => (drawer = false)}
							><n.icon size={23} /><span>{n.label}</span><small>{n.count}</small></a
						>{/snippet}
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
				{/each}{#if staff}<a
						class:active={url.pathname.startsWith('/app/tickets') && view === 'mine'}
						href="/app/tickets?view=mine"
						onclick={() => (drawer = false)}
						><UserRound size={23} /><span>My tickets</span><small>{data.counts.mine}</small></a
					>{/if}
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
