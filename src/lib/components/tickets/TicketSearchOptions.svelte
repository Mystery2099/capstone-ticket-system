<!-- The advanced search filters under the search bar. The search bar owns the filter values. -->
<script lang="ts">
	import { X } from '@lucide/svelte';
	import { TICKET_STATUSES } from '$lib/status';

	type NamedRecord = { id: string; name: string };
	type TicketSearchOptionsProps = {
		filters: Record<string, string>;
		/** Everyone a staff member can filter by. Empty for requesters, who only see their own. */
		people: NamedRecord[];
		categories: NamedRecord[];
		onSearch: () => void;
		onClose: () => void;
	};
	let {
		filters = $bindable(),
		people,
		categories,
		onSearch,
		onClose
	}: TicketSearchOptionsProps = $props();

	const PERSON_FILTERS = [
		{ name: 'requester', label: 'Requester' },
		{ name: 'assignee', label: 'Assignee' }
	];
</script>

<form
	class="search-dropdown search-options"
	onsubmit={(event) => {
		event.preventDefault();
		onSearch();
	}}
>
	<div class="search-options-heading">
		<strong>Search options</strong><button
			type="button"
			class="icon-button"
			aria-label="Close search options"
			onclick={onClose}><X size={18} /></button
		>
	</div>
	<label
		>Status<select bind:value={filters.status}
			><option value="">Any status</option
			>{#each Object.entries(TICKET_STATUSES) as [code, status] (code)}<option value={code}
					>{status.label}</option
				>{/each}</select
		></label
	>
	<label
		>Priority<select bind:value={filters.priority}
			><option value="">Any priority</option
			>{#each ['low', 'normal', 'high'] as priority (priority)}<option value={priority}
					>{priority}</option
				>{/each}</select
		></label
	>
	<label
		>Category<select bind:value={filters.category}
			><option value="">Any category</option>{#each categories as category (category.id)}<option
					value={category.id}>{category.name}</option
				>{/each}</select
		></label
	>
	{#if people.length}{#each PERSON_FILTERS as personFilter (personFilter.name)}<label
				>{personFilter.label}<select bind:value={filters[personFilter.name]}
					><option value="">Anyone</option>{#if personFilter.name === 'assignee'}<option
							value="none">Unassigned</option
						>{/if}{#each people as person (person.id)}<option value={person.id}
							>{person.name}</option
						>{/each}</select
				></label
			>{/each}{/if}
	<label>Created on or after<input type="date" bind:value={filters.after} /></label><label
		>Created on or before<input type="date" bind:value={filters.beforeDate} /></label
	>
	<label class="search-checkbox"
		><input
			type="checkbox"
			checked={filters.hasComments === 'true'}
			onchange={(event) => (filters.hasComments = event.currentTarget.checked ? 'true' : '')}
		/>Has comments</label
	>
	<div class="search-options-heading">
		<button type="button" onclick={() => (filters = {})}>Reset filters</button><button
			type="submit"
			class="primary">Search</button
		>
	</div>
</form>

<style>
	.search-options {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.search-options label {
		display: flex;
		flex-direction: column;
		gap: 5px;
		font-size: 13px;
	}
	.search-options input,
	.search-options select {
		padding: 8px;
		border: 1px solid var(--border, #ddd);
		border-radius: 6px;
		background: inherit;
		color: inherit;
		min-width: 0;
	}
	.search-options-heading {
		grid-column: 1 / -1;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.search-options .search-checkbox {
		flex-direction: row;
		align-items: center;
	}
	@media (max-width: 767px) {
		.search-options {
			grid-template-columns: 1fr;
		}
	}
</style>
