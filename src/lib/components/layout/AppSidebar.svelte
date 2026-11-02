<!--
	App navigation inside shadcn-svelte's Sidebar, which owns the phone sheet, the minimized
	state and its cookie. The markup and styling inside it are the app's own.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import { ChevronDown, Settings, SquarePen, Tags, Users, X } from '@lucide/svelte';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { cn } from '$lib/utils';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import TooltipWrapper from '$lib/components/TooltipWrapper.svelte';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';

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

	/** Hides labels and counts when the sidebar is icons only: on tablets, and in the rail. */
	const HIDDEN_WHEN_COMPACT = 'md:max-lg:hidden lg:in-[.rail]:hidden';
	const NAV_LINK_CLASS =
		'my-0.5 flex h-10 items-center gap-4 rounded-[24px] px-[18px] text-muted-foreground md:max-lg:h-11 md:max-lg:justify-center md:max-lg:p-0 lg:in-[.rail]:h-11 lg:in-[.rail]:justify-center lg:in-[.rail]:p-0';
	const CATEGORY_LINK_CLASS =
		'my-px flex h-8 items-center gap-2 rounded-[24px] pr-[18px] pl-3.5 text-[13px] text-muted-foreground';

	/** Active links are highlighted; the others highlight on hover instead. */
	function buildLinkClass(baseClass: string, isActive: boolean, extraClass = ''): string {
		return cn(
			baseClass,
			extraClass,
			isActive ? 'bg-selected font-[650] text-primary' : 'hover:bg-muted'
		);
	}

	const sidebar = useSidebar();
	/** All open lists its categories beneath it, behind a toggle, when there are any. */
	const hasCategoryToggle = (viewKey: string) =>
		viewKey === 'open' && openTicketCountsByCategory.length > 0;
	const closeMobileSidebar = () => sidebar.setOpenMobile(false);
	let isCategoryListOpen = $state(true);
</script>

<Sidebar.Root
	collapsible="icon"
	class="top-16 h-[calc(100dvh-5rem)] border-0 bg-background duration-180 ease-out"
>
	<aside
		class="relative flex h-full min-h-0 flex-col px-3 py-1 max-md:p-4 md:max-lg:px-2 lg:in-[.rail]:px-2"
	>
		<div class="mb-6 hidden items-center justify-between text-[18px] font-[650] max-md:flex">
			<span>Ticket System</span><TooltipIconButton
				label="Close navigation"
				onclick={closeMobileSidebar}><X /></TooltipIconButton
			>
		</div>
		<a class="new-ticket" href={newTicketHref} onclick={closeMobileSidebar}
			><SquarePen size={25} /><span>New ticket</span></a
		>
		<div class="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
			<nav aria-label="Tickets">
				{#each navigationViews as navigationView (navigationView.key)}
					{#snippet viewNavigationLink()}
						<TooltipWrapper
							content={navigationView.hint}
							side="right"
							sideOffset={8}
							onclick={closeMobileSidebar}
						>
							{#snippet trigger(props)}<a
									{...props}
									class={buildLinkClass(
										NAV_LINK_CLASS,
										activeUrl.pathname.startsWith('/app/tickets') &&
											activeView === navigationView.key &&
											!activeCategoryId,
										// Leaves room for the category toggle beside it.
										hasCategoryToggle(navigationView.key) ? 'pr-[42px]' : ''
									)}
									href={'/app/tickets?view=' + navigationView.key}
									aria-label={navigationView.label}
									><navigationView.icon size={23} /><span
										class={cn('text-foreground', HIDDEN_WHEN_COMPACT)}>{navigationView.label}</span
									><small class={cn('ml-auto text-[12px]', HIDDEN_WHEN_COMPACT)}
										>{navigationView.count}</small
									></a
								>{/snippet}
						</TooltipWrapper>
					{/snippet}
					{#if hasCategoryToggle(navigationView.key)}
						<Collapsible.Root bind:open={isCategoryListOpen}>
							<div class="relative">
								{@render viewNavigationLink()}
								<TooltipWrapper
									content={isCategoryListOpen ? 'Hide categories' : 'Show categories'}
								>
									{#snippet trigger(props)}
										<Collapsible.Trigger
											{...props}
											class={cn(
												'absolute top-1 right-2 grid size-8 place-items-center rounded-full text-muted-foreground transition-[rotate,background-color] duration-(--motion-fast) ease-out hover:bg-secondary data-[state=closed]:-rotate-90',
												HIDDEN_WHEN_COMPACT
											)}
											aria-label={isCategoryListOpen ? 'Hide categories' : 'Show categories'}
											><ChevronDown size={18} /></Collapsible.Trigger
										>
									{/snippet}
								</TooltipWrapper>
							</div>
							<Collapsible.Content
								class={cn(
									'mt-0.5 mb-1.5 ml-[29px] overflow-hidden border-l border-border pl-2 data-[state=closed]:animate-[collapsible-close_var(--motion-fast)_ease-in] data-[state=open]:animate-[collapsible-open_var(--motion-base)_ease-out]',
									HIDDEN_WHEN_COMPACT
								)}
							>
								{#each openTicketCountsByCategory as categorySummary (categorySummary.id)}<a
										class={buildLinkClass(
											CATEGORY_LINK_CLASS,
											activeUrl.pathname.startsWith('/app/tickets') &&
												activeCategoryId === categorySummary.id
										)}
										href={`/app/tickets?view=open&category=${categorySummary.id}`}
										onclick={closeMobileSidebar}
										><span class="min-w-0 truncate text-foreground">{categorySummary.name}</span
										><small class="ml-auto text-[12px]">{categorySummary.count}</small></a
									>{/each}
							</Collapsible.Content>
						</Collapsible.Root>
					{:else}{@render viewNavigationLink()}{/if}
				{/each}
			</nav>
			{#if isAdmin}<p
					class={cn(
						'px-[18px] pt-[22px] pb-2.5 text-[12px] font-[650] text-muted-foreground',
						HIDDEN_WHEN_COMPACT
					)}
				>
					Administration
				</p>
				<nav aria-label="Administration">
					<a
						class={buildLinkClass(NAV_LINK_CLASS, activeUrl.pathname.endsWith('/users'))}
						href="/app/admin/users"
						onclick={closeMobileSidebar}
						><Users size={23} /><span class={cn('text-foreground', HIDDEN_WHEN_COMPACT)}>Users</span
						></a
					><a
						class={buildLinkClass(NAV_LINK_CLASS, activeUrl.pathname.endsWith('/categories'))}
						href="/app/admin/categories"
						onclick={closeMobileSidebar}
						><Tags size={23} /><span class={cn('text-foreground', HIDDEN_WHEN_COMPACT)}
							>Categories</span
						></a
					>
				</nav>{/if}
		</div>
		<nav class="pt-2 pb-3" aria-label="General">
			<a
				class={buildLinkClass(NAV_LINK_CLASS, activeUrl.pathname === '/app/settings')}
				href="/app/settings"
				onclick={closeMobileSidebar}
				><Settings size={23} /><span class={cn('text-foreground', HIDDEN_WHEN_COMPACT)}
					>Settings</span
				></a
			>
		</nav>
	</aside>
</Sidebar.Root>
