<script lang="ts">
	import { cn } from '$lib/utils';
	import type { TicketViewLink } from '$lib/ticket-view-links';

	const MAXIMUM_SHOWN_COUNT = 999;

	/**
	 * Phones only: the sidebar's ticket views as one row of chips that scrolls sideways. It takes
	 * the place of the list heading, so the active chip also names a chosen category.
	 */
	let {
		ticketViewLinks,
		activeView,
		activeCategoryName
	}: { ticketViewLinks: TicketViewLink[]; activeView: string; activeCategoryName?: string } =
		$props();

	let chipRowElement = $state<HTMLElement>();

	function formatViewCount(count: number): string {
		return count > MAXIMUM_SHOWN_COUNT ? `${MAXIMUM_SHOWN_COUNT}+` : String(count);
	}

	// A view further along the row would otherwise open with its own chip off screen.
	function scrollActiveChipIntoView(viewKey: string): void {
		chipRowElement
			?.querySelector(`a[href$="view=${viewKey}"]`)
			?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	$effect(() => scrollActiveChipIntoView(activeView));
</script>

<nav
	bind:this={chipRowElement}
	class="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] scroll-pr-8 pr-6 [scrollbar-width:none] md:hidden"
	aria-label="Ticket views"
>
	{#each ticketViewLinks as ticketViewLink (ticketViewLink.key)}{@const isActive =
			ticketViewLink.key === activeView}<a
			class={cn(
				'flex h-[30px] flex-none items-center gap-1.5 rounded-full border border-border px-3 text-[13px] whitespace-nowrap',
				isActive && 'border-transparent bg-selected font-[650] text-primary'
			)}
			href={'/app/tickets?view=' + ticketViewLink.key}
			aria-current={isActive ? 'page' : undefined}
			title={ticketViewLink.hint}
			>{isActive && activeCategoryName
				? `Open · ${activeCategoryName}`
				: ticketViewLink.label}{#if ticketViewLink.count}<span
					class={cn('text-[12px] font-normal', !isActive && 'text-muted-foreground')}
					>{formatViewCount(ticketViewLink.count)}</span
				>{/if}</a
		>{/each}
</nav>
