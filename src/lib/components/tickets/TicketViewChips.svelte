<script lang="ts">
	import { cn } from '$lib/utils';
	import type { TicketViewLink } from '$lib/ticket-view-links';

	/** Phones only: the sidebar's ticket views as one row of chips that scrolls sideways. */
	let { ticketViewLinks, activeView }: { ticketViewLinks: TicketViewLink[]; activeView: string } =
		$props();
</script>

<nav
	class="flex gap-2 overflow-x-auto px-4 pt-3 pb-1 [scrollbar-width:none] md:hidden"
	aria-label="Ticket views"
>
	{#each ticketViewLinks as ticketViewLink (ticketViewLink.key)}{@const isActive =
			ticketViewLink.key === activeView}<a
			class={cn(
				'flex h-8 flex-none items-center gap-1.5 rounded-full border border-border px-3 text-[13px] whitespace-nowrap',
				isActive && 'border-transparent bg-selected font-[650] text-primary'
			)}
			href={'/app/tickets?view=' + ticketViewLink.key}
			aria-current={isActive ? 'page' : undefined}
			title={ticketViewLink.hint}
			><ticketViewLink.icon size={15} />{ticketViewLink.label}{#if ticketViewLink.count}<span
					class={cn('text-[12px] font-normal', !isActive && 'text-muted-foreground')}
					>{ticketViewLink.count}</span
				>{/if}</a
		>{/each}
</nav>
