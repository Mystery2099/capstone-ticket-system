<!-- The list-and-pane layout shared by the user and category administration screens. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Plus } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import { Input } from '$lib/components/ui/input/index.js';

	type AdminWorkspaceProps = {
		title: string;
		recordNoun: string;
		recordCount: number;
		isPaneOpen: boolean;
		filterText: string;
		filters: Snippet;
		rows: Snippet;
		pane: Snippet;
	};
	let {
		title,
		recordNoun,
		recordCount,
		isPaneOpen,
		filterText = $bindable(),
		filters,
		rows,
		pane
	}: AdminWorkspaceProps = $props();
</script>

<div class="workspace" class:has-ticket={isPaneOpen}>
	<section
		class="list-pane"
		aria-label={`${recordNoun[0].toUpperCase()}${recordNoun.slice(1)} list`}
	>
		<div class="list-top">
			<h1>{title} <span>{recordCount}</span></h1>
			<!-- Phones add records from the floating quick action instead. -->
			<TooltipIconButton label={`Add ${recordNoun}`} href="?new" class="icon-button max-md:hidden"
				><Plus size={20} /></TooltipIconButton
			>
		</div>
		<div class="filters">
			<Input
				aria-label={`Filter ${title.toLowerCase()}`}
				placeholder="Filter"
				bind:value={filterText}
				class="h-8 min-h-8 min-w-0 flex-1 rounded-lg px-2 font-normal"
			/>
			{@render filters()}
		</div>
		<div class="rows">
			{@render rows()}
		</div>
	</section>

	<section
		class="reading-pane"
		aria-label={`${recordNoun[0].toUpperCase()}${recordNoun.slice(1)} details`}
	>
		{#if isPaneOpen}
			{@render pane()}
		{:else}
			<EmptyState title={`Choose a ${recordNoun}`} isPane>
				{#snippet description()}Select one from the list to edit it,<br />or add a new one.{/snippet}
			</EmptyState>
		{/if}
	</section>
</div>
