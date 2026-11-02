<script lang="ts" generics="T extends { id: string }">
	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import { untrack, type Snippet } from 'svelte';

	let {
		rows,
		hasMore,
		loading,
		error,
		loadMore,
		children,
		empty
	}: {
		rows: T[];
		hasMore: boolean;
		loading: boolean;
		error: string;
		loadMore: () => void;
		children: Snippet<[T]>;
		empty: Snippet;
	} = $props();
	let scrollElement = $state<HTMLDivElement>();
	const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
		// svelte-ignore state_referenced_locally
		count: rows.length,
		getScrollElement: () => scrollElement ?? null,
		estimateSize: () => 80,
		overscan: 8,
		initialRect: { width: 800, height: 640 }
	});
	$effect(() => {
		const currentRows = rows;
		const element = scrollElement;
		untrack(() =>
			$virtualizer.setOptions({
				count: currentRows.length,
				getScrollElement: () => element ?? null,
				getItemKey: (index) => currentRows[index].id
			})
		);
	});
	let virtualRows = $derived($virtualizer.getVirtualItems());
	$effect(() => {
		if (
			hasMore &&
			!loading &&
			!error &&
			(!rows.length || (virtualRows.at(-1)?.index ?? -1) >= rows.length - 8)
		) {
			untrack(loadMore);
		}
	});
	function measureRow(element: HTMLDivElement) {
		$virtualizer.measureElement(element);
		return { destroy: () => $virtualizer.measureElement(null) };
	}
</script>

<div class="rows" bind:this={scrollElement} aria-busy={loading}>
	<div style:height="{$virtualizer.getTotalSize()}px" style:position="relative">
		{#each virtualRows as virtualRow (virtualRow.key)}
			<div
				data-index={virtualRow.index}
				use:measureRow
				style:position="absolute"
				style:top="0"
				style:left="0"
				style:width="100%"
				style:transform="translateY({virtualRow.start}px)"
			>
				{#if rows[virtualRow.index]}{@render children(rows[virtualRow.index])}{/if}
			</div>
		{/each}
	</div>
	{#if !rows.length && !loading}{@render empty()}{/if}
	{#if hasMore}
		<div class="list-load-status">
			{#if error}<p role="alert">{error}</p>{/if}
			{#if loading}<p role="status">Loading more tickets…</p>
			{:else}<button class="text-link" onclick={loadMore}
					>{error ? 'Try again' : 'Load more tickets'}</button
				>{/if}
		</div>
	{/if}
</div>

<style>
	.rows {
		min-height: 0;
		overflow-anchor: none;
	}
	.list-load-status {
		padding: 16px;
		text-align: center;
	}
</style>
