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
		nav: { key: string; label: string; hint: string; icon: Component; count: number }[];
		openByCategory: { id: string; name: string; count: number }[];
		isAdmin: boolean;
		url: URL;
		view: string;
		openCategory: string | null;
		newTicketHref: string;
	};
	let { nav, openByCategory, isAdmin, url, view, openCategory, newTicketHref }: Props = $props();

	const sidebar = useSidebar();
	const close = () => sidebar.setOpenMobile(false);
	let categoriesOpen = $state(true);
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
				onclick={close}><X /></button
			>
		</div>
		<a class="new-ticket" href={newTicketHref} onclick={close}
			><SquarePen size={25} /><span>New ticket</span></a
		>
		<div class="sidebar-scroll">
			<nav aria-label="Tickets">
				{#each nav as n (n.key)}
					{#snippet viewLink()}
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}<a
										{...mergeProps(props, { onclick: close })}
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
					{#if n.key === 'open' && openByCategory.length}
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
								{#each openByCategory as c (c.id)}<a
										class:active={url.pathname.startsWith('/app/tickets') && openCategory === c.id}
										href={`/app/tickets?view=open&category=${c.id}`}
										onclick={close}><span>{c.name}</span><small>{c.count}</small></a
									>{/each}
							</Collapsible.Content>
						</Collapsible.Root>
					{:else}{@render viewLink()}{/if}
				{/each}
			</nav>
			{#if isAdmin}<p class="nav-section">Administration</p>
				<nav aria-label="Administration">
					<a class:active={url.pathname.endsWith('/users')} href="/app/admin/users" onclick={close}
						><Users size={23} /><span>Users</span></a
					><a
						class:active={url.pathname.endsWith('/categories')}
						href="/app/admin/categories"
						onclick={close}><Tags size={23} /><span>Categories</span></a
					>
				</nav>{/if}
		</div>
		<nav class="sidebar-bottom" aria-label="General">
			<a class:active={url.pathname === '/app/settings'} href="/app/settings" onclick={close}
				><Settings size={23} /><span>Settings</span></a
			>
		</nav>
	</aside>
</Sidebar.Root>
