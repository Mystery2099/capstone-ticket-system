<!-- The list-and-pane layout shared by the user and category administration screens. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Inbox, Plus } from '@lucide/svelte';
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
		class="ticket-list"
		aria-label={`${recordNoun[0].toUpperCase()}${recordNoun.slice(1)} list`}
	>
		<div class="list-top">
			<h1>{title} <span>{recordCount}</span></h1>
			<TooltipIconButton label={`Add ${recordNoun}`} href="?new"
				><Plus size={20} /></TooltipIconButton
			>
		</div>
		<div class="filters admin-filters">
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
			<div class="reading-empty">
				<span class="empty-icon"><Inbox size={35} /></span>
				<h2>Choose a {recordNoun}</h2>
				<p>Select one from the list to edit it,<br />or add a new one.</p>
			</div>
		{/if}
	</section>
</div>
