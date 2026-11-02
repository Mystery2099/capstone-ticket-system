<!--
	App navigation inside shadcn-svelte's Sidebar, which owns the phone sheet, the minimized
	state and its cookie. The markup and styling inside it are the app's own.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import { ChevronDown, Settings, SquarePen, Tags, Users, X } from '@lucide/svelte';
	import { mergeProps } from 'bits-ui';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	type Props = {
		navigationViews: { key: string; label: string; hint: string; icon: Component; count: number }[];
		openTicketCountsByCategory: { id: string; name: string; count: number }[];
		isAdmin: boolean;
		activeUrl: URL;
		activeView: string;
		activeCategoryId: string | null;
		newTicketHref: string;
	};
	let {
		navigationViews,
		openTicketCountsByCategory,
		isAdmin,
		activeUrl,
		activeView,
		activeCategoryId,
		newTicketHref
	}: Props = $props();

	const sidebar = useSidebar();
	const closeMobileSidebar = () => sidebar.setOpenMobile(false);
	let isCategoryListOpen = $state(true);
</script>

<Sidebar.Root
	collapsible="icon"
	class="top-16 h-[calc(100dvh-5rem)] border-0 bg-background duration-180 ease-out"
>
	<aside class="app-sidebar">
		<div class="drawer-brand">
			<span>Ticket System</span><button
				class="icon-button"
				aria-label="Close navigation"
				onclick={closeMobileSidebar}><X /></button
			>
		</div>
		<a class="new-ticket" href={newTicketHref} onclick={closeMobileSidebar}
			><SquarePen size={25} /><span>New ticket</span></a
		>
		<div class="sidebar-scroll">
			<nav aria-label="Tickets">
				{#each navigationViews as navigationView (navigationView.key)}
					{#snippet viewNavigationLink()}
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}<a
										{...mergeProps(props, { onclick: closeMobileSidebar })}
										class:active={activeUrl.pathname.startsWith('/app/tickets') &&
											activeView === navigationView.key &&
											!activeCategoryId}
										href={'/app/tickets?view=' + navigationView.key}
										aria-label={navigationView.label}
										><navigationView.icon size={23} /><span>{navigationView.label}</span><small
											>{navigationView.count}</small
										></a
									>{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="right" sideOffset={8}>{navigationView.hint}</Tooltip.Content>
						</Tooltip.Root>
					{/snippet}
					{#if navigationView.key === 'open' && openTicketCountsByCategory.length}
						<Collapsible.Root bind:open={isCategoryListOpen}>
							<div class="nav-row">
								{@render viewNavigationLink()}
								<Collapsible.Trigger
									class="nav-toggle"
									aria-label={isCategoryListOpen ? 'Hide categories' : 'Show categories'}
									><ChevronDown size={18} /></Collapsible.Trigger
								>
							</div>
							<Collapsible.Content class="category-nav">
								{#each openTicketCountsByCategory as categorySummary (categorySummary.id)}<a
										class:active={activeUrl.pathname.startsWith('/app/tickets') &&
											activeCategoryId === categorySummary.id}
										href={`/app/tickets?view=open&category=${categorySummary.id}`}
										onclick={closeMobileSidebar}
										><span>{categorySummary.name}</span><small>{categorySummary.count}</small></a
									>{/each}
							</Collapsible.Content>
						</Collapsible.Root>
					{:else}{@render viewNavigationLink()}{/if}
				{/each}
			</nav>
			{#if isAdmin}<p class="nav-section">Administration</p>
				<nav aria-label="Administration">
					<a
						class:active={activeUrl.pathname.endsWith('/users')}
						href="/app/admin/users"
						onclick={closeMobileSidebar}><Users size={23} /><span>Users</span></a
					><a
						class:active={activeUrl.pathname.endsWith('/categories')}
						href="/app/admin/categories"
						onclick={closeMobileSidebar}><Tags size={23} /><span>Categories</span></a
					>
				</nav>{/if}
		</div>
		<nav class="sidebar-bottom" aria-label="General">
			<a
				class:active={activeUrl.pathname === '/app/settings'}
				href="/app/settings"
				onclick={closeMobileSidebar}><Settings size={23} /><span>Settings</span></a
			>
		</nav>
	</aside>
</Sidebar.Root>
