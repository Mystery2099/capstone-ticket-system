<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Search, SlidersHorizontal, X } from '@lucide/svelte';
	import HighlightedText from './HighlightedText.svelte';
	import { TICKET_STATUSES } from '$lib/status';
	let {
		userId,
		people,
		categories
	}: {
		userId: string;
		people: { id: string; name: string }[];
		categories: { id: string; name: string }[];
	} = $props();
	type Segment = { text: string; isMatch: boolean };
	type Suggestion = {
		ticketNumber: number;
		subject: string;
		statusCode: string;
		subjectSegments?: Segment[];
		snippetSegments?: Segment[];
	};
	let searchText = $state('');
	let isFocused = $state(false);
	let showOptions = $state(false);
	let suggestions = $state<Suggestion[]>([]);
	let recentSearches = $state<string[]>([]);
	let activeIndex = $state(-1);
	let isLoading = $state(false);
	let suggestionError = $state(false);
	let searchInput: HTMLInputElement;
	const filterNames = [
		'status',
		'priority',
		'category',
		'requester',
		'assignee',
		'after',
		'beforeDate',
		'hasComments'
	];
	let filters = $state<Record<string, string>>({});
	let matchingPeople = $derived(
		searchText.trim().length >= 2
			? people
					.filter((person) => person.name.toLowerCase().includes(searchText.trim().toLowerCase()))
					.slice(0, 3)
			: []
	);
	const storageKey = $derived(`ticket-searches:${userId}`);
	$effect(() => {
		searchText = page.url.searchParams.get('q') ?? '';
		filters = Object.fromEntries(
			filterNames.map((name) => [name, page.url.searchParams.get(name) ?? ''])
		);
	});
	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
			if (Array.isArray(saved))
				recentSearches = saved.filter((item) => typeof item === 'string').slice(0, 5);
		} catch {
			/* Storage can be disabled. */
		}
	});
	function rememberSearch(value: string) {
		if (!value) return;
		recentSearches = [value, ...recentSearches.filter((item) => item !== value)].slice(0, 5);
		try {
			localStorage.setItem(storageKey, JSON.stringify(recentSearches));
		} catch {
			/* Search still works without storage. */
		}
	}
	$effect(() => {
		const query = searchText.trim();
		const focused = isFocused;
		const controller = new AbortController();
		suggestions = [];
		activeIndex = -1;
		suggestionError = false;
		const shouldSearch = focused && query.length >= 2;
		isLoading = shouldSearch;
		if (!shouldSearch) return;
		const timeout = setTimeout(async () => {
			try {
				const response = await fetch('/app/search/suggest?q=' + encodeURIComponent(query), {
					signal: controller.signal
				});
				if (!response.ok) throw new Error('Suggestion request failed');
				const result = await response.json();
				if (!controller.signal.aborted) suggestions = result.tickets;
			} catch {
				if (!controller.signal.aborted) suggestionError = true;
			} finally {
				if (!controller.signal.aborted) isLoading = false;
			}
		}, 200);
		return () => {
			clearTimeout(timeout);
			controller.abort();
		};
	});
	async function submitSearch(value = searchText) {
		const query = value.trim().slice(0, 200);
		rememberSearch(query);
		isFocused = false;
		showOptions = false;
		const parameters = new URLSearchParams();
		parameters.set('view', people.length ? 'all' : 'mine');
		if (query) parameters.set('q', query);
		for (const name of filterNames) if (filters[name]) parameters.set(name, filters[name]);
		await goto('/app/tickets?' + parameters);
	}
	async function openSuggestion(record: Suggestion) {
		rememberSearch(searchText.trim());
		isFocused = false;
		await goto('/app/tickets/' + record.ticketNumber);
	}
	async function searchPerson(personId: string) {
		filters.requester = personId;
		await submitSearch('');
	}
	function handleKeydown(event: KeyboardEvent) {
		const count = searchText.trim()
			? suggestions.length + matchingPeople.length
			: recentSearches.length;
		if (event.key === 'Escape') {
			event.preventDefault();
			searchText = '';
			isFocused = false;
			showOptions = false;
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			isFocused = true;
			activeIndex = count
				? (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
				: -1;
		}
		if (event.key === 'Enter' && activeIndex >= 0) {
			event.preventDefault();
			if (searchText.trim() && suggestions[activeIndex])
				void openSuggestion(suggestions[activeIndex]);
			else if (searchText.trim() && matchingPeople[activeIndex - suggestions.length])
				void searchPerson(matchingPeople[activeIndex - suggestions.length].id);
			else if (recentSearches[activeIndex]) void submitSearch(recentSearches[activeIndex]);
		}
	}
</script>

<div
	class="ticket-search"
	onfocusout={(event) => {
		if (!event.currentTarget.contains(event.relatedTarget as Node)) isFocused = false;
	}}
>
	<form
		class="search-bar"
		onsubmit={(event) => {
			event.preventDefault();
			void submitSearch();
		}}
	>
		<Search size={23} />
		<input
			bind:this={searchInput}
			bind:value={searchText}
			aria-label="Search tickets"
			placeholder="Search tickets, people, #number"
			maxlength="200"
			role="combobox"
			aria-autocomplete="list"
			aria-expanded={isFocused}
			aria-controls="ticket-suggestions"
			aria-activedescendant={activeIndex >= 0 ? `search-option-${activeIndex}` : undefined}
			onfocus={() => (isFocused = true)}
			onkeydown={handleKeydown}
		/>
		<button type="submit" class="icon-button" aria-label="Submit search"
			><Search size={18} /></button
		>
		<kbd>/</kbd>
		<button
			type="button"
			class="icon-button"
			aria-label="Search options"
			aria-expanded={showOptions}
			onclick={() => {
				showOptions = !showOptions;
				isFocused = false;
			}}><SlidersHorizontal size={21} /></button
		>
	</form>
	{#if isFocused}
		<div class="search-dropdown">
			<div id="ticket-suggestions" role="listbox" aria-label="Search suggestions">
				{#if !searchText.trim()}
					<small>Recent searches</small>
					{#each recentSearches as recent, index (recent)}<button
							type="button"
							id={`search-option-${index}`}
							role="option"
							aria-selected={activeIndex === index}
							class:active={activeIndex === index}
							onclick={() => submitSearch(recent)}>{recent}</button
						>{:else}<p>Search subjects, descriptions, comments, or a ticket number.</p>{/each}
				{:else}
					{#each suggestions as record, index (record.ticketNumber)}<button
							type="button"
							id={`search-option-${index}`}
							role="option"
							aria-selected={activeIndex === index}
							class:active={activeIndex === index}
							onclick={() => openSuggestion(record)}
							><strong
								>#{record.ticketNumber} · <HighlightedText
									segments={record.subjectSegments ?? null}
									fallbackText={record.subject}
								/></strong
							><small>{record.statusCode.replaceAll('_', ' ')}</small
							>{#if record.snippetSegments}<span
									><HighlightedText segments={record.snippetSegments} fallbackText="" /></span
								>{/if}</button
						>{/each}
					{#each matchingPeople as person, index (person.id)}<button
							type="button"
							id={`search-option-${suggestions.length + index}`}
							role="option"
							aria-selected={activeIndex === suggestions.length + index}
							class:active={activeIndex === suggestions.length + index}
							onclick={() => searchPerson(person.id)}>Requested by {person.name}</button
						>{/each}
				{/if}
			</div>
			{#if searchText.trim()}<p aria-live="polite">
					{isLoading
						? 'Searching…'
						: suggestionError
							? 'Suggestions unavailable. Press Enter to search.'
							: searchText.trim().length < 2
								? 'Type at least two characters for suggestions.'
								: !suggestions.length
									? 'No suggestions. Press Enter for full results.'
									: 'Use arrow keys to choose a ticket, or Enter to search all results.'}
				</p>{/if}
			{#if !searchText.trim() && recentSearches.length}<button
					type="button"
					onclick={() => {
						recentSearches = [];
						try {
							localStorage.removeItem(storageKey);
						} catch {
							/* Optional storage. */
						}
					}}>Clear recent searches</button
				>{/if}
		</div>
	{/if}
	{#if showOptions}
		<form
			class="search-dropdown search-options"
			onsubmit={(event) => {
				event.preventDefault();
				void submitSearch();
			}}
		>
			<div class="search-options-heading">
				<strong>Search options</strong><button
					type="button"
					class="icon-button"
					aria-label="Close search options"
					onclick={() => {
						showOptions = false;
						searchInput.focus();
					}}><X size={18} /></button
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
			{#if people.length}{#each ['requester', 'assignee'] as field (field)}<label
						>{field === 'requester' ? 'Requester' : 'Assignee'}<select bind:value={filters[field]}
							><option value="">Anyone</option>{#if field === 'assignee'}<option value="none"
									>Unassigned</option
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
	{/if}
</div>

<style>
	.ticket-search {
		position: relative;
		flex: 1;
		max-width: 740px;
		min-width: 0;
	}
	.search-bar {
		width: auto;
		max-width: none;
		margin-left: 0;
	}
	.search-dropdown {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		z-index: 60;
		background: var(--background, white);
		color: var(--foreground, #222);
		border: 1px solid var(--border, #ddd);
		border-radius: 12px;
		padding: 12px;
		box-shadow: 0 8px 30px #0002;
		max-height: 75vh;
		overflow: auto;
	}
	.search-dropdown p,
	.search-dropdown small {
		font-size: 12px;
		opacity: 0.75;
	}
	[role='option'] {
		display: flex;
		flex-direction: column;
		width: 100%;
		text-align: left;
		gap: 4px;
		padding: 10px;
		border-radius: 7px;
	}
	[role='option']:hover,
	[role='option'].active {
		background: var(--muted, #eee);
	}
	[role='option'] span {
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}
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
</style>
