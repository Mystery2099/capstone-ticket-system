<script lang="ts">
	import { untrack } from 'svelte';
	import { hasPermission } from '$lib/permissions';
	import { afterNavigate, goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { RefreshCw, SquarePen } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import Combobox from '$lib/components/Combobox.svelte';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ConversationSkeleton from '$lib/components/skeleton/ConversationSkeleton.svelte';
	import TicketRowsSkeleton from '$lib/components/skeleton/TicketRowsSkeleton.svelte';
	import VirtualTicketRows from '$lib/components/tickets/VirtualTicketRows.svelte';
	import { createDelayedFlag } from '$lib/delayed.svelte';
	import { DraftUrlBinding } from '$lib/draft-url.svelte';
	import { getDrafts } from '$lib/drafts.svelte';
	import { TICKET_STATUSES } from '$lib/status';
	import { TICKET_VIEW_TITLES, getDefaultTicketView } from '$lib/ticket-views';
	import DraftList from './DraftList.svelte';
	import TicketComposeForm from './TicketComposeForm.svelte';
	import TicketConversation from './TicketConversation.svelte';
	import TicketRow from './TicketRow.svelte';
	import { TicketDirectory } from './ticket-directory';
	import { createTicketCreateForm } from './ticket-forms';
	import { TicketListLoader } from './ticket-list-loader.svelte';
	import type { PersonSummary, SelectOption, TicketListRow } from './ticket-types';

	const STATUS_OPTIONS: SelectOption[] = Object.entries(TICKET_STATUSES).map(([value, status]) => ({
		value,
		label: status.label
	}));
	const PRIORITY_OPTIONS: SelectOption[] = [
		{ value: 'high', label: 'High' },
		{ value: 'normal', label: 'Normal' },
		{ value: 'low', label: 'Low' }
	];
	const SEARCH_SORT_OPTIONS: SelectOption[] = [
		{ value: 'relevance', label: 'Best match' },
		{ value: 'newest', label: 'Newest first' }
	];

	let { data, form } = $props();

	let isStaffUser = $derived(hasPermission(data.user.role, 'viewAllTickets'));
	let directory = $derived(new TicketDirectory(data.people, data.categories));

	// ---- Ticket list ----

	// svelte-ignore state_referenced_locally
	const listLoader = new TicketListLoader<TicketListRow>(data.tickets, data.nextPageHref);
	let isRefreshing = $state(false);
	// The list's URL params, without the draft that happens to be open.
	let listSearchParams = $derived.by(() => {
		const searchParams = new URLSearchParams(page.url.searchParams);
		searchParams.delete('draft');
		return searchParams;
	});
	let listKey = $derived.by(() => {
		const sortedSearchParams = new URLSearchParams(listSearchParams);
		sortedSearchParams.sort();
		return sortedSearchParams.toString();
	});
	let listQueryString = $derived(listSearchParams.size ? '?' + listSearchParams : '');
	let listHref = $derived('/app/tickets' + listQueryString);
	$effect(() => {
		const firstRows = data.tickets;
		const nextPageHref = data.nextPageHref;
		const currentListKey = listKey;
		const ticketRoute = data.isNewTicket ? 'new' : (data.selectedTicket?.id ?? '');
		untrack(() => listLoader.acceptPageData(firstRows, nextPageHref, currentListKey, ticketRoute));
	});
	$effect(() => () => listLoader.dispose());

	function buildTicketHref(ticketNumber: number): string {
		return `/app/tickets/${ticketNumber}${listQueryString}`;
	}
	async function applyListFilter(filterName: string, filterValue: string): Promise<void> {
		const searchParams = new URLSearchParams(listSearchParams);
		searchParams.delete('before');
		searchParams.delete('page');
		if (filterValue) searchParams.set(filterName, filterValue);
		else searchParams.delete(filterName);
		await goto('/app/tickets?' + searchParams);
	}
	async function refreshTickets(): Promise<void> {
		isRefreshing = true;
		try {
			await listLoader.refresh();
		} catch {
			toast.error('Couldn’t refresh tickets.');
		} finally {
			isRefreshing = false;
		}
	}

	// ---- Navigation ----

	// The list already holds every ticket field except its comments and events, so a
	// click can paint the real heading at once and leave only the rest as a skeleton.
	let navigationTarget = $derived(navigating.to?.route.id === page.route.id ? navigating.to : null);
	let targetTicketId = $derived(navigationTarget?.params?.id);
	let isOpeningNewTicket = $derived(targetTicketId === 'new');
	// Leaving the form takes effect at once, so the pane never lags behind a click.
	let isComposing = $derived(isOpeningNewTicket || (data.isNewTicket && !navigationTarget));
	let isListChanging = $derived(
		!!navigationTarget && !isOpeningNewTicket && navigationTarget.url.search !== page.url.search
	);
	let targetTicketRow = $derived(
		targetTicketId && !isListChanging
			? listLoader.rows.find((row) => String(row.ticketNumber) === targetTicketId)
			: undefined
	);
	let slowNavigation = createDelayedFlag(() => !!navigationTarget && !isOpeningNewTicket);
	let isListLoading = $derived(slowNavigation.current && isListChanging);
	let isPaneLoading = $derived(slowNavigation.current && !!targetTicketId);
	let ticket = $derived(isPaneLoading ? (targetTicketRow ?? null) : data.selectedTicket);
	let highlightedTicketId = $derived(
		isComposing ? undefined : navigationTarget ? targetTicketRow?.id : data.selectedTicket?.id
	);
	let hasTicket = $derived(
		isComposing || (navigationTarget && !targetTicketId ? false : !!ticket || isPaneLoading)
	);
	let ticketIndex = $derived(listLoader.rows.findIndex((row) => row.id === ticket?.id));

	// ---- Drafts ----

	const drafts = getDrafts();
	const ticketDraftBinding = new DraftUrlBinding(drafts.tickets, {
		isComposing: () => isComposing,
		isNavigating: () => !!navigationTarget,
		readPendingDraftId: () =>
			navigationTarget ? navigationTarget.url.searchParams.get('draft') : undefined
	});
	let activeDraft = $derived(ticketDraftBinding.activeDraft);
	// Lives here rather than in the form's markup, so a creation that finishes after the
	// form has closed still discards its draft.
	// svelte-ignore state_referenced_locally
	const createForm = createTicketCreateForm(
		data.createForm,
		() => activeDraft.id,
		(submittedDraftId) => {
			drafts.tickets.discardById(submittedDraftId);
			toast.success('Ticket created.');
		}
	);
	afterNavigate(() => createForm.reset());

	// ---- People and categories ----

	let requesters = $derived(
		data.people
			.filter((person) => !person.banned)
			.sort((firstPerson, secondPerson) => firstPerson.name.localeCompare(secondPerson.name))
	);
	let assignees = $derived(
		requesters.filter((person) => hasPermission(person.role, 'receiveAssignments'))
	);
	let categoryOptions = $derived(
		data.categories.map(({ id, name, active }) => ({ value: id, label: name, active }))
	);
	function toPersonOption(person: PersonSummary): SelectOption {
		return { value: person.id, label: person.name + (person.id === data.user.id ? ' (you)' : '') };
	}

	// ---- View heading ----

	let activeView = $derived(
		isListChanging
			? navigationTarget?.url.searchParams.get('view') || getDefaultTicketView(isStaffUser)
			: data.view
	);
	let isShowingDrafts = $derived(activeView === 'drafts');
	let targetSearchParams = $derived(
		(isListChanging ? navigationTarget?.url : page.url)?.searchParams
	);
	let activeCategory = $derived(
		activeView === 'open'
			? data.categories.find((category) => category.id === targetSearchParams?.get('category'))
			: undefined
	);
	let viewTitle = $derived(TICKET_VIEW_TITLES[activeView] || 'All tickets');
	let listHeading = $derived(activeCategory ? `Open · ${activeCategory.name}` : viewTitle);
	let loadedTicketCountLabel = $derived(
		`${listLoader.rows.length}${listLoader.nextPageHref ? '+' : ''}`
	);

	// Failures stay until dismissed, since they usually need something done about them.
	$effect(() => {
		if (form?.error) toast.error(form.error, { duration: Infinity });
		else if (form?.success) toast.success(form.success);
	});
</script>

<div class="workspace" class:has-ticket={hasTicket}>
	<section class="list-pane" aria-label="Ticket list">
		<div class="list-top">
			<h1>
				{data.searchText ? `Results for “${data.searchText}”` : listHeading}{#if !isListLoading}
					<span>{isShowingDrafts ? drafts.dirtyDraftCount : loadedTicketCountLabel}</span>{/if}
			</h1>
			{#if !isShowingDrafts}<TooltipIconButton
					label="Refresh tickets"
					onclick={refreshTickets}
					disabled={isRefreshing}><RefreshCw size={20} /></TooltipIconButton
				>{/if}
		</div>
		{#if data.searchText}<div class="filters" aria-label="Search result controls">
				<span>{loadedTicketCountLabel} results loaded</span>
				<Combobox
					label="Sort search results"
					variant="filter"
					value={data.searchSort ?? 'newest'}
					options={SEARCH_SORT_OPTIONS}
					onchange={(value) => applyListFilter('sort', value)}
				/>
				<button class="text-link" onclick={() => applyListFilter('q', '')}>Clear search</button>
			</div>{/if}
		{#if !isShowingDrafts}<div class="filters">
				<Combobox
					label="Filter by status"
					variant="filter"
					placeholder="Status"
					value={page.url.searchParams.get('status') || ''}
					options={[{ value: '', label: 'Any status' }, ...STATUS_OPTIONS]}
					onchange={(value) => applyListFilter('status', value)}
				/>
				<Combobox
					label="Filter by priority"
					variant="filter"
					placeholder="Priority"
					value={page.url.searchParams.get('priority') || ''}
					options={[{ value: '', label: 'Any priority' }, ...PRIORITY_OPTIONS]}
					onchange={(value) => applyListFilter('priority', value)}
				/>
				<Combobox
					label="Filter by category"
					variant="filter"
					placeholder="Category"
					value={page.url.searchParams.get('category') || ''}
					options={[{ value: '', label: 'Any category' }, ...categoryOptions]}
					onchange={(value) => applyListFilter('category', value)}
				/>
				{#if isStaffUser}<Combobox
						label="Filter by requester"
						class="max-w-[48%]"
						variant="filter"
						placeholder="Requester"
						value={page.url.searchParams.get('requester') || ''}
						options={[{ value: '', label: 'Any requester' }, ...requesters.map(toPersonOption)]}
						onchange={(value) => applyListFilter('requester', value)}
					/><Combobox
						label="Filter by assignee"
						class="max-w-[48%]"
						variant="filter"
						placeholder="Assignee"
						value={page.url.searchParams.get('assignee') || ''}
						options={[
							{ value: '', label: 'Any assignee' },
							{ value: 'none', label: 'Unassigned' },
							...assignees.map(toPersonOption)
						]}
						onchange={(value) => applyListFilter('assignee', value)}
					/>{/if}
			</div>{/if}
		{#if isShowingDrafts}<DraftList
				{drafts}
				{directory}
				selectedDraftId={isComposing ? activeDraft.id : null}
			/>{:else if isListLoading}<TicketRowsSkeleton
			/>{:else}{#key `${listKey}:${listLoader.resetVersion}`}<VirtualTicketRows
					rows={listLoader.rows}
					hasMore={!!listLoader.nextPageHref}
					loading={listLoader.isLoadingMore || isRefreshing}
					error={listLoader.loadMoreError}
					loadMore={() => listLoader.loadMore(page.url)}
				>
					{#snippet children(row)}<TicketRow
							{row}
							href={buildTicketHref(row.ticketNumber)}
							isSelected={highlightedTicketId === row.id}
							{directory}
						/>{/snippet}{#snippet empty()}<EmptyState
							title={data.searchText ? 'No matching tickets' : 'No tickets here'}
						>
							{#snippet description()}{data.searchText
									? 'Try fewer words, another spelling, or broader search options.'
									: 'Try another view or change your filters.'}{/snippet}
							<a href="/app/tickets" class="text-link">Clear filters</a>
						</EmptyState>{/snippet}
				</VirtualTicketRows>{/key}{/if}
	</section>
	<section class="reading-pane" aria-label="Ticket conversation">
		{#if isComposing}{#key activeDraft.id}<TicketComposeForm
					{createForm}
					draft={activeDraft}
					ticketDrafts={drafts.tickets}
					{listHref}
					userRole={data.user.role}
					requesterOptions={requesters.map(toPersonOption)}
					assigneeOptions={assignees.map(toPersonOption)}
					categoryOptions={categoryOptions.filter((option) => option.active)}
				/>{/key}{:else if isPaneLoading && !ticket}<div class="conversation-scroll">
				<ConversationSkeleton showHeading />
			</div>{:else if ticket}<TicketConversation
				{ticket}
				currentUser={data.user}
				comments={data.comments}
				events={data.events}
				categories={data.categories}
				{assignees}
				replyFormData={data.replyForm}
				{directory}
				isLoading={isPaneLoading}
				backHref={'/app/tickets' + page.url.search}
				listPosition={ticketIndex >= 0
					? { index: ticketIndex, total: listLoader.rows.length }
					: null}
				previousTicketHref={ticketIndex > 0
					? buildTicketHref(listLoader.rows[ticketIndex - 1].ticketNumber)
					: undefined}
				nextTicketHref={ticketIndex >= 0 && ticketIndex < listLoader.rows.length - 1
					? buildTicketHref(listLoader.rows[ticketIndex + 1].ticketNumber)
					: undefined}
			/>{:else}<EmptyState title="Your workspace, in order." isPane>
				{#snippet description()}Select a ticket to read the conversation<br />and keep things
					moving.{/snippet}
				{#if !isListLoading}<span class="small muted"
						>{activeCategory
							? `${listLoader.rows.length} open ${activeCategory.name} tickets`
							: isShowingDrafts
								? `${drafts.dirtyDraftCount} drafts`
								: `${listLoader.rows.length} tickets · ${viewTitle}`}</span
					>{/if}
			</EmptyState>{/if}
	</section>
</div>
<a
	class="new-ticket fixed right-4 bottom-[88px] z-10 m-0 hidden h-[52px] w-auto gap-3 rounded-[16px] px-5 text-[14px] max-md:flex [.has-ticket+&]:hidden"
	href="/app/tickets/new"><SquarePen size={23} /> New ticket</a
>
