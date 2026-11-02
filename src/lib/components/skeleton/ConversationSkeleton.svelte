<!--
	Placeholder for a ticket's comments and composer. Set `heading` when the ticket
	isn't in the current list, so even its subject and details are still unknown.
-->
<script lang="ts">
	let { heading = false }: { heading?: boolean } = $props();
	const messages = [
		[92, 78, 46],
		[84, 60]
	];
</script>

<p class="sr-only" role="status">Loading conversation</p>
<div class="skeleton-fade" aria-hidden="true">
	{#if heading}
		<div class="ticket-heading">
			<span class="skeleton mb-3 h-6 w-3/4"></span>
			<span class="skeleton mb-3 h-3.5 w-14"></span>
			<span class="skeleton mb-4 h-3 w-1/2"></span>
			<div class="flex flex-wrap gap-2">
				<span class="skeleton h-8 w-28 rounded-full"></span>
				<span class="skeleton h-8 w-24 rounded-full"></span>
				<span class="skeleton h-8 w-32 rounded-full"></span>
			</div>
		</div>
	{/if}
	{#each messages as lines, index (index)}
		<div class="message">
			<span class="avatar skeleton"></span>
			<div class="message-content">
				<span class="skeleton mb-3 h-3.5 w-32"></span>
				{#each lines as width, index (index)}
					<span class="skeleton mb-2 h-3" style:width="{width}%"></span>
				{/each}
			</div>
		</div>
	{/each}
	<span class="skeleton mt-5 h-28 rounded-2xl"></span>
</div>
