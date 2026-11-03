<!-- A saved message's formatted text: a description, comment or internal note. -->
<script lang="ts">
	import { renderTicketContent } from '$lib/ticket-content/ticket-content-renderer';
	import { cn } from '$lib/utils';

	type TicketContentProps = { content: string; class?: string };
	let { content, class: className }: TicketContentProps = $props();
	let renderedContent = $derived(renderTicketContent(content));
</script>

<!-- The renderer escapes raw HTML and only keeps safe links, so this HTML can be trusted. -->
<div class={cn('ticket-content', className)}>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html renderedContent}
</div>
