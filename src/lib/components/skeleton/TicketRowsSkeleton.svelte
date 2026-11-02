<!-- Placeholder rows that share the real ticket row classes, so heights match and nothing jumps. -->
<script lang="ts">
	const widths = [72, 58, 80, 52, 66, 60, 74];
</script>

<p class="sr-only" role="status">Loading tickets</p>
<div class="rows skeleton-fade" aria-hidden="true">
	{#each widths as width, index (index)}
		<div class="list-row hover:bg-transparent">
			<span class="avatar row-avatar skeleton"></span>
			<div class="row-content">
				<div class="row-title">
					<span class="skeleton h-3.5" style:width="{width}%"></span>
					<span class="skeleton ml-auto h-3 w-10"></span>
				</div>
				<div class="row-meta">
					<span class="skeleton h-5 w-16 shrink-0"></span>
					<span class="skeleton h-3" style:width="{width - 12}%"></span>
				</div>
			</div>
		</div>
	{/each}
</div>
