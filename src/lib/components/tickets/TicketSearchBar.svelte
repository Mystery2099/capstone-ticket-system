<script lang="ts">
	import { AppHotkeys, formatHotkeyHint } from '$lib/hotkeys';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Search, SlidersHorizontal } from '@lucide/svelte';
	import HighlightedText from './HighlightedText.svelte';
	import TooltipWrapper from '$lib/components/TooltipWrapper.svelte';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import TicketSearchOptions from './TicketSearchOptions.svelte';
	import { RecentSearchStore } from './recent-search-store.svelte';
	import {
		MIN_SUGGESTION_QUERY_LENGTH,
		TicketSuggestionLoader,
		type TicketSuggestion
	} from './ticket-suggestion-loader.svelte';

	type NamedRecord = { id: string; name: string };
	type TicketSearchBarProps = {
		userId: string;
		/** Everyone a staff member can search by. Empty for requesters. */
		people: NamedRecord[];
		categories: NamedRecord[];
	};
	let { userId, people, categories }: TicketSearchBarProps = $props();

	/** URL parameters the search options control. */
	const FILTER_NAMES = [
		'status',
		'priority',
		'category',
		'requester',
		'assignee',
		'after',
		'beforeDate',
		'hasComments'
	];
	const MAX_QUERY_LENGTH = 200;
	const MAX_MATCHING_PEOPLE = 3;

	let searchText = $state('');
	let isFocused = $state(false);
	let showOptions = $state(false);
	let activeIndex = $state(-1);
	let searchInput: HTMLInputElement;
	let searchContainerElement: HTMLDivElement | undefined = $state();
	let filters = $state<Record<string, string>>({});
	let trimmedSearchText = $derived(searchText.trim());
	let matchingPeople = $derived(
		trimmedSearchText.length >= MIN_SUGGESTION_QUERY_LENGTH
			? people
					.filter((person) => person.name.toLowerCase().includes(trimmedSearchText.toLowerCase()))
					.slice(0, MAX_MATCHING_PEOPLE)
			: []
	);

	// svelte-ignore state_referenced_locally
	const recentSearches = new RecentSearchStore(userId);
	onMount(() => recentSearches.load());
	const suggestionLoader = new TicketSuggestionLoader(
		() => trimmedSearchText,
		() => isFocused,
		() => (activeIndex = -1)
	);
	let suggestions = $derived(suggestionLoader.suggestions);
	let statusMessage = $derived(
		suggestionLoader.isLoading
			? 'Searching…'
			: suggestionLoader.hasFailed
				? 'Suggestions unavailable. Press Enter to search.'
				: trimmedSearchText.length < MIN_SUGGESTION_QUERY_LENGTH
					? 'Type at least two characters for suggestions.'
					: !suggestions.length
						? 'No suggestions. Press Enter for full results.'
						: 'Use arrow keys to choose a ticket, or Enter to search all results.'
	);

	// The search box reflects the current results page.
	$effect(() => {
		searchText = page.url.searchParams.get('q') ?? '';
		filters = Object.fromEntries(
			FILTER_NAMES.map((name) => [name, page.url.searchParams.get(name) ?? ''])
		);
	});

	async function submitSearch(value = searchText): Promise<void> {
		const query = value.trim().slice(0, MAX_QUERY_LENGTH);
		recentSearches.remember(query);
		isFocused = false;
		showOptions = false;
		const parameters = new URLSearchParams();
		parameters.set('view', people.length ? 'all' : 'mine');
		if (query) parameters.set('q', query);
		for (const name of FILTER_NAMES) if (filters[name]) parameters.set(name, filters[name]);
		await goto('/app/tickets?' + parameters);
	}
	async function openSuggestion(suggestion: TicketSuggestion): Promise<void> {
		recentSearches.remember(trimmedSearchText);
		isFocused = false;
		await goto('/app/tickets/' + suggestion.ticketNumber);
	}
	async function searchByRequester(personId: string): Promise<void> {
		filters.requester = personId;
		await submitSearch('');
	}

	/**
	 * Closes the search options when the user clicks anywhere outside the search area. Clicks in
	 * a dropdown list opened from the options are ignored, since those lists render outside it.
	 */
	function handleDocumentPointerDown(event: PointerEvent): void {
		if (!showOptions) return;
		const clickedElement = event.target as Element;
		const isInsideSearch = searchContainerElement?.contains(clickedElement) ?? false;
		const isInsidePopover = clickedElement.closest?.('[data-slot="popover-content"]') !== null;
		if (!isInsideSearch && !isInsidePopover) {
			showOptions = false;
		}
	}

	/**
	 * Arrow keys move through the options, which are the suggestions then matching people
	 * while typing, or recent searches when the box is empty.
	 */
	function handleKeydown(event: KeyboardEvent): void {
		const optionCount = trimmedSearchText
			? suggestions.length + matchingPeople.length
			: recentSearches.searches.length;
		if (event.key === 'Escape') {
			event.preventDefault();
			searchText = '';
			isFocused = false;
			showOptions = false;
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			isFocused = true;
			const step = event.key === 'ArrowDown' ? 1 : -1;
			activeIndex = optionCount ? (activeIndex + step + optionCount) % optionCount : -1;
		}
		if (event.key === 'Enter' && activeIndex >= 0) {
			event.preventDefault();
			const activePerson = matchingPeople[activeIndex - suggestions.length];
			if (trimmedSearchText && suggestions[activeIndex])
				void openSuggestion(suggestions[activeIndex]);
			else if (trimmedSearchText && activePerson) void searchByRequester(activePerson.id);
			else if (recentSearches.searches[activeIndex])
				void submitSearch(recentSearches.searches[activeIndex]);
		}
	}
</script>

<svelte:document onpointerdown={handleDocumentPointerDown} />

<div
	bind:this={searchContainerElement}
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
		<TooltipWrapper content="Search all matching tickets">
			{#snippet trigger(props)}
				<button {...props} type="submit" class="icon-button" aria-label="Submit search"
					><Search size={18} /></button
				>
			{/snippet}
		</TooltipWrapper>
		<kbd>{formatHotkeyHint(AppHotkeys.FOCUS_SEARCH.hotkey)}</kbd>
		<TooltipIconButton
			label="Search options"
			tooltip="Filter by status, priority, category, and more"
			aria-expanded={showOptions}
			onclick={() => {
				showOptions = !showOptions;
				isFocused = false;
			}}><SlidersHorizontal size={21} /></TooltipIconButton
		>
	</form>
	{#if isFocused}
		<div class="search-dropdown">
			<div id="ticket-suggestions" role="listbox" aria-label="Search suggestions">
				{#if !trimmedSearchText}
					<small>Recent searches</small>
					{#each recentSearches.searches as recent, index (recent)}<button
							type="button"
							id={`search-option-${index}`}
							role="option"
							aria-selected={activeIndex === index}
							class:active={activeIndex === index}
							onclick={() => submitSearch(recent)}>{recent}</button
						>{:else}<p>Search subjects, descriptions, comments, or a ticket number.</p>{/each}
				{:else}
					{#each suggestions as suggestion, index (suggestion.ticketNumber)}<button
							type="button"
							id={`search-option-${index}`}
							role="option"
							aria-selected={activeIndex === index}
							class:active={activeIndex === index}
							onclick={() => openSuggestion(suggestion)}
							><strong
								>#{suggestion.ticketNumber} · <HighlightedText
									segments={suggestion.subjectSegments ?? null}
									fallbackText={suggestion.subject}
								/></strong
							>{#each suggestion.metadataMatches ?? [] as match (match.label)}<span
									>{match.label} <HighlightedText segments={match.segments} fallbackText="" /></span
								>{/each}<small>{suggestion.statusCode.replaceAll('_', ' ')}</small
							>{#if suggestion.snippetSegments}<span
									><HighlightedText segments={suggestion.snippetSegments} fallbackText="" /></span
								>{/if}</button
						>{/each}
					{#each matchingPeople as person, index (person.id)}<button
							type="button"
							id={`search-option-${suggestions.length + index}`}
							role="option"
							aria-selected={activeIndex === suggestions.length + index}
							class:active={activeIndex === suggestions.length + index}
							onclick={() => searchByRequester(person.id)}>Requested by {person.name}</button
						>{/each}
				{/if}
			</div>
			{#if trimmedSearchText}<p aria-live="polite">{statusMessage}</p>{/if}
			{#if !trimmedSearchText && recentSearches.searches.length}<button
					type="button"
					class="mt-1 rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={() => recentSearches.clear()}>Clear recent searches</button
				>{/if}
		</div>
	{/if}
	{#if showOptions}
		<TicketSearchOptions
			bind:filters
			{people}
			{categories}
			onSearch={() => void submitSearch()}
			onClose={() => {
				showOptions = false;
				searchInput.focus();
			}}
		/>
	{/if}
</div>

<style>
	/*
	 * The bar's look, in the base layer like the rest of the app's CSS. The unlayered rules
	 * after it are this component's adjustments and win over it, as they did when the base
	 * rules lived in app.css. Margin, width and max-width come only from those adjustments.
	 */
	@layer base {
		.search-bar {
			background: var(--muted);
			height: 46px;
			border-radius: 28px;
			display: flex;
			align-items: center;
			padding: 0 12px 0 16px;
			gap: 12px;
			flex: 1;
			color: var(--muted-fg);
		}
		.search-bar input {
			border: 0;
			background: none;
			padding: 0;
			min-width: 0;
			flex: 1;
			font-size: 16px;
			outline: none;
		}
		.search-bar input:focus {
			outline: none;
		}
		.search-bar kbd {
			border: 1px solid var(--input);
			border-radius: 4px;
			font-size: 12px;
			min-width: 18px;
			text-align: center;
		}
		@media (max-width: 767px) {
			.search-bar {
				border-radius: 32px;
				height: 54px;
				padding: 0 58px 0 60px;
			}
			.search-bar > :global(svg),
			.search-bar kbd,
			.search-bar :global(button) {
				display: none;
			}
			.search-bar input::placeholder {
				font-size: 0;
			}
			.search-bar input:placeholder-shown {
				background: transparent;
			}
			.search-bar:has(input:placeholder-shown):after {
				content: 'Search tickets';
				position: absolute;
				left: 76px;
				font-size: 16px;
				pointer-events: none;
				color: var(--muted-fg);
			}
		}
	}
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
	/* The global icon-button hover matches the bar's own background, so darken it here. */
	.search-bar :global(.icon-button:hover),
	.search-bar :global(.icon-button[aria-expanded='true']) {
		background: color-mix(in oklch, var(--muted), var(--foreground) 10%);
		color: var(--foreground);
	}
	/* Global so the search options form, a child component, shares the dropdown look. */
	.ticket-search :global(.search-dropdown) {
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
	@media (max-width: 767px) {
		.ticket-search {
			max-width: none;
			width: 100%;
		}
		.search-bar {
			padding-right: 92px;
		}
		.search-bar :global(button[aria-label='Search options']) {
			display: inline-flex;
			position: absolute;
			right: 48px;
		}
	}
</style>
