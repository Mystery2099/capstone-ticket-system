<script lang="ts">
	import { ChevronsUp } from '@lucide/svelte';
	import HighlightedText from '$lib/components/tickets/HighlightedText.svelte';
	import StatusBadge from '$lib/components/tickets/StatusBadge.svelte';
	import { getInitials } from '$lib/person';
	import type { TicketDirectory } from './ticket-directory';
	import { formatRecentTimestamp } from './ticket-formatting';
	import type { TicketListRow } from './ticket-types';

	type TicketRowProps = {
		row: TicketListRow;
		href: string;
		isSelected: boolean;
		directory: TicketDirectory;
	};
	let { row, href, isSelected, directory }: TicketRowProps = $props();
	let requesterName = $derived(directory.getPersonName(row.requesterId));
</script>

<a {href} class="list-row" class:selected={isSelected}
	><span class="avatar row-avatar">{getInitials(requesterName)}</span>
	<div class="row-content">
		<div class="row-title">
			{#if row.priority === 'high'}<ChevronsUp
					class="shrink-0 text-[#b3261e] max-md:mt-[3px]"
					size={17}
				/>{/if}<strong
				><HighlightedText segments={row.subjectHighlight} fallbackText={row.subject} /></strong
			><time>{formatRecentTimestamp(row.updatedAt)}</time>
		</div>
		{#if row.searchMetadataMatches.length}<div class="search-match-reasons">
				{#each row.searchMetadataMatches as match (match.label)}<span
						>{match.label}
						<HighlightedText segments={match.segments} fallbackText="" /></span
					>{/each}
			</div>{/if}
		<div class="row-meta">
			<StatusBadge status={row.statusCode} /><span
				class="shrink-0 max-md:-order-1 max-md:w-full max-md:text-[13px] max-md:text-muted-foreground"
				>{requesterName} · #{row.ticketNumber}</span
			><span class="row-preview"
				>— {row.previewAuthor ? row.previewAuthor + ': ' : ''}<HighlightedText
					segments={row.previewHighlight}
					fallbackText={row.preview}
				/></span
			>
		</div>
	</div></a
>

<style>
	.search-match-reasons {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin-top: 4px;
		color: var(--muted-fg);
		font-size: 12px;
	}
</style>
