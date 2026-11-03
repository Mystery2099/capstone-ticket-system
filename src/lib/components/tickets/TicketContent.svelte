<!-- A saved message's text: a description, comment or internal note. -->
<script lang="ts">
	import { TicketContentFormat } from '$lib/ticket-content/ticket-content-format';
	import { renderTicketContent } from '$lib/ticket-content/ticket-content-renderer';
	import { cn } from '$lib/utils';

	type TicketContentProps = { content: string; format: TicketContentFormat; class?: string };
	let { content, format, class: className }: TicketContentProps = $props();
	let renderedContent = $derived(
		format === TicketContentFormat.MARKDOWN ? renderTicketContent(content) : ''
	);
</script>

{#if format === TicketContentFormat.MARKDOWN}
	<!-- The renderer escapes raw HTML and only keeps safe links, so this HTML can be trusted. -->
	<div class={cn('ticket-content', className)}>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html renderedContent}
	</div>
{:else}
	<!-- Written before rich text existed, so it shows exactly as it was typed. -->
	<p class={cn('whitespace-pre-wrap', className)}>{content}</p>
{/if}
