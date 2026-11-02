<!-- The advanced search filters under the search bar. The search bar owns the filter values. -->
<script lang="ts">
	import { X } from '@lucide/svelte';
	import { TICKET_STATUSES } from '$lib/status';
	import Combobox from '$lib/components/Combobox.svelte';

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

	const PRIORITY_OPTIONS = [
		{ value: '', label: 'Any priority' },
		{ value: 'low', label: 'Low' },
		{ value: 'normal', label: 'Normal' },
		{ value: 'high', label: 'High' }
	];

	const PERSON_FILTERS = [
		{ name: 'requester', label: 'Requester' },
		{ name: 'assignee', label: 'Assignee' }
	];

	const statusOptions = [
		{ value: '', label: 'Any status' },
		...Object.entries(TICKET_STATUSES).map(([code, status]) => ({
			value: code,
			label: status.label
		}))
	];
	let categoryOptions = $derived([
		{ value: '', label: 'Any category' },
		...categories.map((category) => ({ value: category.id, label: category.name }))
	]);
	let personOptions = $derived(people.map((person) => ({ value: person.id, label: person.name })));
	let requesterOptions = $derived([{ value: '', label: 'Anyone' }, ...personOptions]);
	let assigneeOptions = $derived([
		{ value: '', label: 'Anyone' },
		{ value: 'none', label: 'Unassigned' },
		...personOptions
	]);

	// Reset clears the filters to {}, so a missing filter reads as "any".
	const getFilter = (filterName: string) => () => filters[filterName] ?? '';
	const setFilter = (filterName: string) => (value: string) => (filters[filterName] = value);
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
		>Status<Combobox
			label="Status"
			bind:value={getFilter('status'), setFilter('status')}
			options={statusOptions}
		/></label
	>
	<label
		>Priority<Combobox
			label="Priority"
			bind:value={getFilter('priority'), setFilter('priority')}
			options={PRIORITY_OPTIONS}
		/></label
	>
	<label
		>Category<Combobox
			label="Category"
			bind:value={getFilter('category'), setFilter('category')}
			options={categoryOptions}
		/></label
	>
	{#if people.length}{#each PERSON_FILTERS as personFilter (personFilter.name)}<label
				>{personFilter.label}<Combobox
					label={personFilter.label}
					bind:value={getFilter(personFilter.name), setFilter(personFilter.name)}
					options={personFilter.name === 'assignee' ? assigneeOptions : requesterOptions}
				/></label
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
	.search-options input {
		padding: 8px;
		border: 1px solid var(--border, #ddd);
		border-radius: 6px;
		background: var(--card);
		color: var(--foreground);
		min-width: 0;
	}
	.search-options input:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
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
