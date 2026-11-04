<!--
	The ticket's description, shown on its own between the details and the conversation, so
	what the ticket is about reads at a glance instead of looking like the first reply.
-->
<script lang="ts">
	import TicketContent from '$lib/components/tickets/TicketContent.svelte';
	import type { TicketContentFormat } from '$lib/ticket-content/ticket-content-format';

	type TicketDescriptionProps = {
		/** Left out while the ticket is still loading, which shows placeholder lines instead. */
		description?: string;
		descriptionFormat: TicketContentFormat;
	};
	let { description, descriptionFormat }: TicketDescriptionProps = $props();
</script>

<section class="ticket-description" aria-labelledby="ticket-description-heading">
	<h2 id="ticket-description-heading" class="section-heading">Description</h2>
	<div class="ticket-description-body">
		{#if description === undefined}<p class="sr-only" role="status">Loading description</p>
			<div class="skeleton-fade grid gap-2 py-1" aria-hidden="true">
				<span class="skeleton h-3 w-[92%]"></span><span class="skeleton h-3 w-[78%]"></span><span
					class="skeleton h-3 w-[46%]"
				></span>
			</div>{:else}<TicketContent
				content={description}
				format={descriptionFormat}
				class="message-body text-[14px] leading-[1.65] wrap-anywhere wide:text-[15px]"
			/>{/if}
	</div>
</section>
