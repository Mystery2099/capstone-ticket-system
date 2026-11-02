<script lang="ts">
	import { parse } from 'devalue';
	import { untrack } from 'svelte';
	import VirtualTicketRows from '$lib/components/VirtualTicketRows.svelte';
	import { createHotkeysAttachment } from '@tanstack/svelte-hotkeys';
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import { navigating, page } from '$app/state';
	import {
		goto,
		invalidateAll,
		beforeNavigate,
		afterNavigate,
		replaceState
	} from '$app/navigation';
	import {
		RefreshCw,
		ChevronLeft,
		ChevronRight,
		Link,
		ChevronsUp,
		ArrowLeft,
		Send,
		LockKeyhole,
		MessageSquare,
		ArrowRightLeft,
		X,
		SquarePen,
		Inbox
	} from '@lucide/svelte';
	import Combobox from '$lib/components/Combobox.svelte';
	import StatusBadge from '$lib/StatusBadge.svelte';
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import { TICKET_STATUSES, getInitials, TicketEventType } from '$lib/status';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import ConversationSkeleton from '$lib/components/skeleton/ConversationSkeleton.svelte';
	import TicketRowsSkeleton from '$lib/components/skeleton/TicketRowsSkeleton.svelte';
	import { toast } from 'svelte-sonner';
	import { createDelayedFlag } from '$lib/delayed.svelte';
	import { getDrafts } from '$lib/ticket-draft.svelte';
	let { data, form } = $props();

	// svelte-ignore state_referenced_locally
	let ticketRows = $state<typeof data.tickets>(data.tickets);
	// svelte-ignore state_referenced_locally
	let nextPageHref = $state<string | null>(data.nextPageHref);
	let isLoadingMore = $state(false);
	let loadMoreError = $state('');
	let loadedListKey = '';
	let listRequestVersion = 0;
	let listRequestController: AbortController | undefined;
	let listKey = $derived.by(() => {
		const parameters = new URLSearchParams(page.url.searchParams);
		parameters.delete('draft');
		parameters.sort();
		return parameters.toString();
	});
	$effect(() => {
		const initialRows = data.tickets;
		const initialNextPageHref = data.nextPageHref;
		const currentListKey = listKey;
		untrack(() => {
			listRequestController?.abort();
			listRequestVersion++;
			isLoadingMore = false;
			loadMoreError = '';
			if (loadedListKey !== currentListKey || !ticketRows.length) {
				ticketRows = initialRows;
				nextPageHref = initialNextPageHref;
			} else {
				const updatedRows = new Map(initialRows.map((row) => [row.id, row]));
				ticketRows = [...initialRows, ...ticketRows.filter((row) => !updatedRows.has(row.id))];
			}
			loadedListKey = currentListKey;
		});
	});
	async function loadMoreTickets() {
		if (!nextPageHref || isLoadingMore) return;
		const requestVersion = listRequestVersion;
		const controller = new AbortController();
		listRequestController = controller;
		isLoadingMore = true;
		loadMoreError = '';
		try {
			const url = new URL(nextPageHref, page.url);
			url.pathname = '/app/tickets/list';
			const response = await fetch(url, { signal: controller.signal });
			if (!response.ok) throw new Error('Ticket list request failed');
			const batch = parse(await response.text()) as {
				tickets: typeof data.tickets;
				nextPageHref: string | null;
			};
			if (requestVersion !== listRequestVersion) return;
			const existingIds = new Set(ticketRows.map((row) => row.id));
			ticketRows = [...ticketRows, ...batch.tickets.filter((row) => !existingIds.has(row.id))];
			nextPageHref = batch.nextPageHref;
		} catch {
			if (requestVersion === listRequestVersion && !controller.signal.aborted)
				loadMoreError = 'Couldn’t load more tickets.';
		} finally {
			if (requestVersion === listRequestVersion) isLoadingMore = false;
		}
	}
	$effect(() => () => listRequestController?.abort());

	/** Events the conversation already shows as a message, so the timeline skips them. */
	const CONVERSATION_EVENT_TYPES: string[] = [
		TicketEventType.CREATED,
		TicketEventType.REPLY,
		TicketEventType.INTERNAL_NOTE
	];
	let isInternalNote = $state(false);
	let showAllActivity = $state(false);
	let showTicketDetails = $state(false);
	let isRefreshing = $state(false);
	let isReopening = $state(false);
	// Metadata values chosen but not yet confirmed, keyed by field.
	let pendingFieldValues = $state<Record<string, string>>({});
	let submittedDraftId: string | null = null;
	// Draft values remain in the browser store. Superforms owns their submission lifecycle.
	// svelte-ignore state_referenced_locally
	const createForm = superForm(data.createForm, {
		resetForm: false,
		taintedMessage: false,
		applyAction: 'never',
		multipleSubmits: 'prevent',
		onSubmit() {
			submittedDraftId = activeDraft.id;
		},
		onResult({ result }) {
			if (result.type === 'redirect' && submittedDraftId) {
				ticketDrafts.discardById(submittedDraftId);
				toast.success('Ticket created.');
			}
		},
		onUpdated({ form }) {
			if (form.message) toast.error(form.message.text, { duration: Infinity });
		},
		onError() {
			toast.error('Couldn’t create the ticket. Your draft is still saved.', { duration: Infinity });
		}
	});
	const {
		enhance: enhanceCreate,
		submitting: isCreatingTicket,
		delayed: isCreateDelayed,
		errors: createErrors
	} = createForm;

	// Keep text until the server confirms it; Superforms resets only successful replies.
	// svelte-ignore state_referenced_locally
	const replyForm = superForm(data.replyForm, {
		taintedMessage: false,
		applyAction: 'never',
		multipleSubmits: 'prevent',
		onUpdated({ form }) {
			if (!form.message) return;
			if (form.message.failed) toast.error(form.message.text, { duration: Infinity });
			else toast.success(form.message.text);
		},
		onError() {
			toast.error('Couldn’t send. Your comment is still in the box below.', { duration: Infinity });
		}
	});
	const {
		form: replyFields,
		enhance: enhanceReply,
		submitting: isSendingComment,
		delayed: isReplyDelayed,
		errors: replyErrors
	} = replyForm;
	// The editor is read-only while posting, so the optimistic message can use its values.
	let optimisticMessage = $derived(
		$isSendingComment && $replyFields.body.trim()
			? { body: $replyFields.body, isInternal: isInternalNote }
			: null
	);
	const allDrafts = getDrafts();
	const ticketDrafts = allDrafts.tickets;
	let composeFormElement = $state<HTMLFormElement>();
	let isStaffUser = $derived(data.user.role !== 'requester');

	// The list already holds every ticket field except its comments and events, so a
	// click can paint the real heading at once and leave only the rest as a skeleton.
	let navigationTarget = $derived(navigating.to?.route.id === page.route.id ? navigating.to : null);
	let targetTicketId = $derived(navigationTarget?.params?.id);
	let isOpeningNewTicket = $derived(targetTicketId === 'new');
	// Leaving the form takes effect at once, so the pane never lags behind a click.
	let isComposing = $derived(isOpeningNewTicket || (data.isNewTicket && !navigationTarget));
	// Shallow routing leaves page.url as it was, so the draft just added to the URL is tracked here.
	let promotedDraftId = $state<string | null>(null);
	let draftId = $derived(
		navigationTarget
			? navigationTarget.url.searchParams.get('draft')
			: (page.url.searchParams.get('draft') ?? promotedDraftId)
	);
	let activeDraft = $derived(ticketDrafts.findById(draftId) ?? ticketDrafts.blankDraft);
	// The list's URL params, without the draft that happens to be open.
	let listSearchParams = $derived.by(() => {
		const searchParams = new URLSearchParams(page.url.searchParams);
		searchParams.delete('draft');
		return searchParams;
	});
	let listQueryString = $derived(listSearchParams.size ? '?' + listSearchParams : '');
	// Waits for navigation to land, because that would replace the URL set here.
	$effect(() => {
		if (
			!isComposing ||
			navigationTarget ||
			activeDraft !== ticketDrafts.blankDraft ||
			!activeDraft.isDirty
		)
			return;
		const url = new URL(page.url);
		url.searchParams.set('draft', activeDraft.id);
		promotedDraftId = activeDraft.id;
		ticketDrafts.promoteBlankDraft();
		replaceState(url, {});
	});
	let isListChanging = $derived(
		!!navigationTarget && !isOpeningNewTicket && navigationTarget.url.search !== page.url.search
	);
	let targetTicketRow = $derived(
		targetTicketId && !isListChanging
			? ticketRows.find((row) => String(row.ticketNumber) === targetTicketId)
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
	let listHref = $derived('/app/tickets' + listQueryString);
	let isTicketClosed = $derived(ticket?.statusCode === 'closed');
	let requesters = $derived(
		data.people
			.filter((candidate) => !candidate.banned)
			.sort((firstPerson, secondPerson) => firstPerson.name.localeCompare(secondPerson.name))
	);
	let assignees = $derived(requesters.filter((candidate) => candidate.role !== 'requester'));
	const statusOptions = Object.entries(TICKET_STATUSES).map(([value, status]) => ({
		value,
		label: status.label
	}));
	const priorityOptions = [
		{ value: 'high', label: 'High' },
		{ value: 'normal', label: 'Normal' },
		{ value: 'low', label: 'Low' }
	];
	let categoryOptions = $derived(
		data.categories.map(({ id, name, active }) => ({ value: id, label: name, active }))
	);
	const toPersonOption = (person: (typeof requesters)[number]) => ({
		value: person.id,
		label: person.name + (person.id === data.user.id ? ' (you)' : '')
	});
	const getPersonName = (id: string | null) =>
		data.people.find((candidate) => candidate.id === id)?.name || 'Support team';
	const getPersonRole = (id: string) =>
		data.people.find((candidate) => candidate.id === id)?.role || 'agent';
	const getCategoryName = (id: string) =>
		data.categories.find((category) => category.id === id)?.name || 'Category';
	const formatDate = (timestamp: Date | string) =>
		new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	const formatTime = (timestamp: Date | string) =>
		new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	let activeView = $derived(
		isListChanging
			? navigationTarget?.url.searchParams.get('view') || (isStaffUser ? 'open' : 'mine')
			: data.view
	);
	let targetSearchParams = $derived(
		(isListChanging ? navigationTarget?.url : page.url)?.searchParams
	);
	let activeCategory = $derived(
		activeView === 'open'
			? data.categories.find((category) => category.id === targetSearchParams?.get('category'))
			: undefined
	);
	let viewTitle = $derived(
		(
			{
				open: 'All open',
				queue: 'Assigned to me',
				unassigned: 'Unassigned',
				all: 'All tickets',
				mine: 'My requests',
				drafts: 'Drafts'
			} as Record<string, string>
		)[activeView] || 'All tickets'
	);
	let isShowingDrafts = $derived(activeView === 'drafts');
	// Every kind of draft lives in this one list, each opening back in its own form.
	let draftRows = $derived([
		...ticketDrafts.dirtyDrafts.map((draft) => ({
			id: draft.id,
			title: draft.subject.trim() || 'No subject',
			preview: draft.description.trim() || 'Nothing written yet',
			type: 'Ticket draft',
			avatar: getInitials(getPersonName(draft.requesterId)),
			href: `/app/tickets/new?view=drafts&draft=${draft.id}`
		})),
		...allDrafts.users.dirtyDrafts.map((draft) => ({
			id: draft.id,
			title: draft.name.trim() || 'No name',
			preview: draft.email.trim() || 'No email yet',
			type: 'User draft',
			avatar: draft.name.trim() ? getInitials(draft.name.trim()) : '?',
			href: `/app/admin/users?new&draft=${draft.id}`
		})),
		...allDrafts.categories.dirtyDrafts.map((draft) => ({
			id: draft.id,
			title: draft.name.trim(),
			preview: 'New category',
			type: 'Category draft',
			avatar: '',
			href: `/app/admin/categories?new&draft=${draft.id}`
		}))
	]);
	let listHeading = $derived(activeCategory ? `Open · ${activeCategory.name}` : viewTitle);
	let ticketIndex = $derived(ticketRows.findIndex((row) => row.id === ticket?.id));
	let conversationTimeline = $derived(
		[
			...data.comments.map((comment) => ({ ...comment, kind: 'comment' as const })),
			...data.events
				.filter((event) => !CONVERSATION_EVENT_TYPES.includes(event.eventType))
				.map((event) => ({ ...event, kind: 'event' as const }))
		].sort(
			(firstEntry, secondEntry) =>
				+new Date(firstEntry.createdAt) - +new Date(secondEntry.createdAt)
		)
	);
	let visibleTimeline = $derived(
		showAllActivity ? conversationTimeline : conversationTimeline.slice(-4)
	);
	function buildTicketHref(ticketNumber: number) {
		return `/app/tickets/${ticketNumber}${listQueryString}`;
	}
	async function applyListFilter(filterName: string, filterValue: string) {
		const searchParams = new URLSearchParams(listSearchParams);
		searchParams.delete('before');
		searchParams.delete('page');
		if (filterValue) searchParams.set(filterName, filterValue);
		else searchParams.delete(filterName);
		await goto('/app/tickets?' + searchParams);
	}
	async function refreshTickets() {
		isRefreshing = true;
		listRequestController?.abort();
		listRequestVersion++;
		ticketRows = [];
		nextPageHref = null;
		try {
			await invalidateAll();
		} finally {
			isRefreshing = false;
		}
	}
	async function copyToClipboard(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(label);
		} catch {
			toast.error('Couldn’t copy.');
		}
	}
	// Failures stay until dismissed, since they usually need something done about them.
	$effect(() => {
		if (form?.error) toast.error(form.error, { duration: Infinity });
		else if (form?.success) toast.success(form.success);
	});
	afterNavigate(() => {
		createForm.reset();
		replyForm.reset();
		isInternalNote = false;
		showAllActivity = false;
		showTicketDetails = false;
		promotedDraftId = null;
	});
	beforeNavigate(({ cancel }) => {
		// New-ticket drafts need no warning, because they're saved in this browser.
		if ($replyFields.body.trim() && !confirm('Discard your unsent text and leave this page?'))
			cancel();
	});

	const createFormHotkeys = createHotkeysAttachment(
		[
			{ hotkey: 'Mod+Enter', callback: () => composeFormElement?.requestSubmit() },
			{
				hotkey: 'Escape',
				callback: () => {
					void goto(listHref);
				}
			}
		],
		() => ({ enabled: isComposing && !$isCreatingTicket, ignoreInputs: false })
	);
</script>

<svelte:window
	onbeforeunload={(event) => {
		if ($replyFields.body.trim()) {
			event.preventDefault();
			event.returnValue = '';
		}
	}}
/>

{#snippet composeTicketForm()}
	<form
		bind:this={composeFormElement}
		{@attach createFormHotkeys}
		class="compose"
		method="POST"
		action="?/create"
		use:enhanceCreate
	>
		<div class="reading-toolbar">
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<a {...props} href={listHref} class="icon-button back" aria-label="Back to tickets"
							><ArrowLeft size={21} /></a
						>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" sideOffset={6}>Back to tickets</Tooltip.Content>
			</Tooltip.Root>
			<div class="ticket-title">
				<!-- SvelteKit clears focus when navigation lands unless an element has autofocus. -->
				<!-- svelte-ignore a11y_autofocus -->
				<input
					autofocus
					{@attach (input) => input.focus()}
					class="compose-subject"
					name="subject"
					aria-invalid={!!$createErrors.subject}
					aria-describedby={$createErrors.subject ? 'subject-error' : undefined}
					aria-label="Subject"
					placeholder="Subject"
					bind:value={activeDraft.subject}
					required
					maxlength={180}
					readonly={$isCreatingTicket}
				/>
				{#if $createErrors.subject}<p id="subject-error" class="error" role="alert">
						{$createErrors.subject.join(' ')}
					</p>{/if}
				<p class="ticket-dates">
					New ticket{activeDraft.subject.length > 160
						? ` · ${activeDraft.subject.length} / 180`
						: ''}
				</p>
			</div>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<a
							{...props}
							href={listHref}
							class="icon-button compose-close"
							aria-label="Close new ticket"><X size={20} /></a
						>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" sideOffset={6}>Close new ticket</Tooltip.Content>
			</Tooltip.Root>
		</div>
		<div class="conversation-scroll compose-body">
			<div class="ticket-heading">
				<div class="ticket-metadata">
					{#if isStaffUser}
						<div class="metadata-control">
							<span>Requester</span><Combobox
								name="requesterId"
								label="Requester"
								bind:value={activeDraft.requesterId}
								options={requesters.map(toPersonOption)}
								disabled={$isCreatingTicket}
							/>
						</div>
						<div class="metadata-control">
							<span>Assignee</span><Combobox
								name="assignedToUserId"
								label="Assignee"
								bind:value={activeDraft.assignedToUserId}
								options={[{ value: '', label: 'Unassigned' }, ...assignees.map(toPersonOption)]}
								disabled={$isCreatingTicket}
							/>
						</div>
					{/if}
					<div class="metadata-control">
						<span>Category</span><Combobox
							name="categoryId"
							label="Category"
							placeholder="Choose"
							bind:value={activeDraft.categoryId}
							options={categoryOptions.filter((option) => option.active)}
							disabled={$isCreatingTicket}
							required
						/>
					</div>
				</div>
			</div>
			<div class="composer">
				<textarea
					name="description"
					aria-invalid={!!$createErrors.description}
					aria-describedby={$createErrors.description ? 'description-error' : undefined}
					aria-label="Description"
					placeholder="What happened? Include when it started and what you’ve tried."
					bind:value={activeDraft.description}
					required
					maxlength={4000}
					rows={8}
					readonly={$isCreatingTicket}></textarea>
				{#if $createErrors.description}<p id="description-error" class="error" role="alert">
						{$createErrors.description.join(' ')}
					</p>{/if}
				{#if $createErrors.categoryId}<p class="error" role="alert">
						{$createErrors.categoryId.join(' ')}
					</p>{/if}
				<div class="composer-footer">
					<span
						class="muted small"
						class:compose-hint={!$isCreatingTicket && activeDraft.description.length <= 3600}
						>{$isCreatingTicket
							? $isCreateDelayed
								? 'Still creating ticket…'
								: 'Creating ticket…'
							: activeDraft.description.length > 3600
								? `${activeDraft.description.length} / 4000`
								: 'Esc to close · Ctrl/Cmd+Enter to create'}</span
					>
					<span class="compose-actions">
						<Button
							variant="ghost"
							size="sm"
							class="rounded-full px-4"
							disabled={$isCreatingTicket}
							onclick={() => {
								ticketDrafts.discardById(activeDraft.id);
								void goto(listHref);
							}}>Discard</Button
						>
						<Button
							type="submit"
							size="sm"
							class="rounded-full px-4 whitespace-nowrap"
							disabled={$isCreatingTicket}
							><Send size={15} />{$isCreatingTicket ? 'Creating…' : 'Create ticket'}</Button
						>
					</span>
				</div>
			</div>
		</div>
	</form>
{/snippet}
{#snippet commentMessage(
	authorId: string,
	isInternal: boolean,
	timestampLabel: string,
	messageText: string,
	isSending = false
)}
	<article class="message" class:internal-note={isInternal} class:sending={isSending}>
		<span class="avatar">{getInitials(getPersonName(authorId))}</span>
		<div class="message-content">
			<div class="message-heading">
				<strong>{getPersonName(authorId)}</strong><span class="role-tag"
					>{getPersonRole(authorId) === 'requester'
						? 'Requester'
						: getPersonRole(authorId) === 'admin'
							? 'Administrator'
							: 'Agent'}</span
				><time>{timestampLabel}</time>
			</div>
			{#if isInternal}<p class="private-label">
					<LockKeyhole size={13} /> Internal note · only visible to support team
				</p>{/if}
			<p class="message-body">{messageText}</p>
		</div>
	</article>
{/snippet}
{#snippet ticketFieldSelect(
	field: string,
	label: string,
	value: string,
	options: { value: string; label: string }[]
)}
	<form
		method="POST"
		action="?/update"
		use:enhance={({ formData }) => {
			pendingFieldValues[field] = String(formData.get('value'));
			return async ({ update }) => {
				await update({ reset: false });
				delete pendingFieldValues[field];
			};
		}}
		class="metadata-control"
	>
		<input type="hidden" name="field" value={field} /><span>{label}</span>
		<Combobox
			name="value"
			{label}
			{options}
			value={pendingFieldValues[field] ?? value}
			class={field === 'statusCode' ? 'status ' + (pendingFieldValues[field] ?? value) : ''}
			disabled={isTicketClosed || isPaneLoading}
			submitOnSelect
		/>
	</form>
{/snippet}
<div class="workspace" class:has-ticket={hasTicket}>
	<section class="ticket-list" aria-label="Ticket list">
		<div class="list-top">
			<h1>
				{data.searchText ? `Results for “${data.searchText}”` : listHeading}{#if !isListLoading}
					<span
						>{isShowingDrafts ? draftRows.length : ticketRows.length}{!isShowingDrafts &&
						nextPageHref
							? '+'
							: ''}</span
					>{/if}
			</h1>
			{#if !isShowingDrafts}<Tooltip.Root>
					<Tooltip.Trigger onclick={refreshTickets}>
						{#snippet child({ props })}
							<button
								{...props}
								class="icon-button"
								aria-label="Refresh tickets"
								disabled={isRefreshing}><RefreshCw size={20} /></button
							>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="bottom" sideOffset={6}>Refresh tickets</Tooltip.Content>
				</Tooltip.Root>{/if}
		</div>
		{#if data.searchText}<div class="filters" aria-label="Search result controls">
				<span>{ticketRows.length}{nextPageHref ? '+' : ''} results loaded</span>
				<Combobox
					label="Sort search results"
					value={data.searchSort ?? 'newest'}
					options={[
						{ value: 'relevance', label: 'Best match' },
						{ value: 'newest', label: 'Newest first' }
					]}
					onchange={(value) => applyListFilter('sort', value)}
				/>
				<button class="text-link" onclick={() => applyListFilter('q', '')}>Clear search</button>
			</div>{/if}
		{#if !isShowingDrafts}<div class="filters">
				<Combobox
					label="Filter by status"
					placeholder="Status"
					value={page.url.searchParams.get('status') || ''}
					options={[{ value: '', label: 'Any status' }, ...statusOptions]}
					onchange={(value) => applyListFilter('status', value)}
				/>
				<Combobox
					label="Filter by priority"
					placeholder="Priority"
					value={page.url.searchParams.get('priority') || ''}
					options={[{ value: '', label: 'Any priority' }, ...priorityOptions]}
					onchange={(value) => applyListFilter('priority', value)}
				/>
				<Combobox
					label="Filter by category"
					placeholder="Category"
					value={page.url.searchParams.get('category') || ''}
					options={[{ value: '', label: 'Any category' }, ...categoryOptions]}
					onchange={(value) => applyListFilter('category', value)}
				/>
			</div>{/if}
		{#if isShowingDrafts}<div class="rows">
				{#each draftRows as row (row.id)}<a
						href={row.href}
						class="ticket-row"
						class:selected={isComposing && row.id === activeDraft.id}
						>{#if row.avatar}<span class="avatar row-avatar">{row.avatar}</span>{/if}
						<div class="row-content">
							<div class="row-title">
								<strong>{row.title}</strong><time>{row.type}</time>
							</div>
							<div class="row-meta">
								<span class="row-preview">{row.preview}</span>
							</div>
						</div></a
					>{:else}<div class="empty">
						<Inbox size={36} />
						<h2>No drafts</h2>
						<p>Anything you start but don’t finish is saved here.</p>
						<a href="/app/tickets" class="text-link">Back to tickets</a>
					</div>{/each}
			</div>{:else if isListLoading}<TicketRowsSkeleton />{:else}{#key listKey}<VirtualTicketRows
					rows={ticketRows}
					hasMore={!!nextPageHref}
					loading={isLoadingMore || isRefreshing}
					error={loadMoreError}
					loadMore={loadMoreTickets}
				>
					{#snippet children(row)}<a
							href={buildTicketHref(row.ticketNumber)}
							class="ticket-row"
							class:selected={highlightedTicketId === row.id}
							><span class="avatar row-avatar">{getInitials(getPersonName(row.requesterId))}</span>
							<div class="row-content">
								<div class="row-title">
									{#if row.priority === 'high'}<ChevronsUp class="high" size={17} />{/if}<strong
										><HighlightedText
											segments={row.subjectHighlight}
											fallbackText={row.subject}
										/></strong
									><time
										>{new Date(row.updatedAt).toDateString() === new Date().toDateString()
											? formatTime(row.updatedAt)
											: formatDate(row.updatedAt)}</time
									>
								</div>
								{#if row.searchMetadataMatches.length}<div class="search-match-reasons">
										{#each row.searchMetadataMatches as match (match.label)}<span
												>{match.label}
												<HighlightedText segments={match.segments} fallbackText="" /></span
											>{/each}
									</div>{/if}
								<div class="row-meta">
									<StatusBadge status={row.statusCode} /><span class="row-requester"
										>{getPersonName(row.requesterId)} · #{row.ticketNumber}</span
									><span class="row-preview"
										>— {row.previewAuthor ? row.previewAuthor + ': ' : ''}<HighlightedText
											segments={row.previewHighlight}
											fallbackText={row.preview}
										/></span
									>
								</div>
							</div></a
						>{/snippet}{#snippet empty()}<div class="empty">
							<Inbox size={36} />
							<h2>{data.searchText ? 'No matching tickets' : 'No tickets here'}</h2>
							<p>
								{data.searchText
									? 'Try fewer words, another spelling, or broader search options.'
									: 'Try another view or change your filters.'}
							</p>
							<a href="/app/tickets" class="text-link">Clear filters</a>
						</div>{/snippet}
				</VirtualTicketRows>{/key}{/if}
	</section>
	<section class="reading-pane" aria-label="Ticket conversation">
		{#if isComposing}{#key activeDraft.id}{@render composeTicketForm()}{/key}{:else if isPaneLoading && !ticket}<div
				class="conversation-scroll"
			>
				<ConversationSkeleton showHeading />
			</div>{:else if ticket}<div class="reading-toolbar">
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<a
								{...props}
								href={'/app/tickets' + page.url.search}
								class="icon-button back"
								aria-label="Back to tickets"><ArrowLeft size={21} /></a
							>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="bottom" sideOffset={6}>Back to tickets</Tooltip.Content>
				</Tooltip.Root>
				<div class="ticket-title">
					<h1>{ticket.subject}</h1>
					<p class="ticket-dates">
						<Tooltip.Root>
							<Tooltip.Trigger
								class="ticket-number"
								aria-label={`Copy ticket number #${ticket.ticketNumber}`}
								onclick={() => copyToClipboard(`#${ticket?.ticketNumber}`, 'Ticket number copied')}
								>#{ticket.ticketNumber}</Tooltip.Trigger
							>
							<Tooltip.Content side="bottom" sideOffset={6}>Copy ticket number</Tooltip.Content>
						</Tooltip.Root>
						· Opened by {getPersonName(ticket.requesterId)} · {formatDate(ticket.createdAt)}, {formatTime(
							ticket.createdAt
						)} · Updated
						{formatDate(ticket.updatedAt)}, {formatTime(ticket.updatedAt)}
					</p>
				</div>
				{#if ticketIndex >= 0}<span class="toolbar-position muted small"
						>{ticketIndex + 1} of {ticketRows.length}</span
					>{/if}<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<a
								{...props}
								class="icon-button"
								aria-label="Previous ticket"
								aria-disabled={ticketIndex <= 0}
								href={ticketIndex > 0
									? buildTicketHref(ticketRows[ticketIndex - 1].ticketNumber)
									: undefined}><ChevronLeft size={20} /></a
							>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="bottom" sideOffset={6}>Previous ticket</Tooltip.Content>
				</Tooltip.Root><Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<a
								{...props}
								class="icon-button"
								aria-label="Next ticket"
								aria-disabled={ticketIndex < 0 || ticketIndex >= ticketRows.length - 1}
								href={ticketIndex >= 0 && ticketIndex < ticketRows.length - 1
									? buildTicketHref(ticketRows[ticketIndex + 1].ticketNumber)
									: undefined}><ChevronRight size={20} /></a
							>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="bottom" sideOffset={6}>Next ticket</Tooltip.Content>
				</Tooltip.Root><Tooltip.Root>
					<Tooltip.Trigger onclick={() => copyToClipboard(window.location.href, 'Link copied')}>
						{#snippet child({ props })}
							<button {...props} class="icon-button" aria-label="Copy ticket link"
								><Link size={20} /></button
							>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="bottom" sideOffset={6}>Copy ticket link</Tooltip.Content>
				</Tooltip.Root>
			</div>
			<div class="conversation-scroll">
				<div class="ticket-heading">
					<button
						class="mobile-details text-link"
						onclick={() => (showTicketDetails = !showTicketDetails)}
						>{showTicketDetails ? 'Hide details' : 'Show details'} <span>⌄</span></button
					>
					<div class="ticket-metadata" class:expanded={showTicketDetails}>
						{#if isStaffUser && !isTicketClosed}{@render ticketFieldSelect(
								'statusCode',
								'Status',
								ticket.statusCode,
								Object.entries(TICKET_STATUSES).map(([value, status]) => ({
									value,
									label: status.symbol + ' ' + status.label
								}))
							)}{@render ticketFieldSelect(
								'priority',
								'Priority',
								ticket.priority,
								['low', 'normal', 'high'].map((value) => ({
									value,
									label: (value === 'high' ? '⌃ ' : '') + value[0].toUpperCase() + value.slice(1)
								}))
							)}{@render ticketFieldSelect(
								'assignedToUserId',
								'Assignee',
								ticket.assignedToUserId || '',
								[
									{ value: '', label: 'Unassigned' },
									...assignees.map((person) => ({ value: person.id, label: person.name }))
								]
							)}{@render ticketFieldSelect(
								'categoryId',
								'Category',
								ticket.categoryId,
								data.categories
									.filter((category) => category.active || category.id === ticket.categoryId)
									.map((category) => ({ value: category.id, label: category.name }))
							)}{:else}<StatusBadge status={ticket.statusCode} /><span class="metadata-pill"
								>Priority <strong>{ticket.priority}</strong></span
							><span class="metadata-pill"
								>Assignee <strong
									>{isPaneLoading
										? '…'
										: ticket.assignedToUserId
											? getPersonName(ticket.assignedToUserId)
											: 'Unassigned'}</strong
								></span
							><span class="metadata-pill"
								>Category <strong>{getCategoryName(ticket.categoryId)}</strong></span
							>{/if}
					</div>
				</div>
				<article class="message">
					<span class="avatar">{getInitials(getPersonName(ticket.requesterId))}</span>
					<div class="message-content">
						<div class="message-heading">
							<strong>{getPersonName(ticket.requesterId)}</strong><span class="role-tag"
								>Requester</span
							><time>{formatDate(ticket.createdAt)}, {formatTime(ticket.createdAt)}</time>
						</div>
						<p class="message-caption">Opened this ticket</p>
						<p class="message-body">{ticket.description}</p>
					</div>
				</article>
				{#if isPaneLoading}<ConversationSkeleton />{:else}
					{#if conversationTimeline.length > 4 && !showAllActivity}<div class="hidden-messages">
							<span class="count-pill">{conversationTimeline.length - 4}</span><span
								>Earlier comments and activity hidden</span
							><button class="text-link" onclick={() => (showAllActivity = true)}>Show all</button>
						</div>{/if}
					{#each visibleTimeline as timelineEntry (`${timelineEntry.kind}-${timelineEntry.id}`)}{#if timelineEntry.kind === 'comment'}{@render commentMessage(
								timelineEntry.authorId,
								timelineEntry.isInternal,
								`${formatDate(timelineEntry.createdAt)}, ${formatTime(timelineEntry.createdAt)}`,
								timelineEntry.body
							)}{:else}<div class="activity">
								<span class="activity-icon"><ArrowRightLeft size={15} /></span>
								<p>
									<strong>{getPersonName(timelineEntry.actorId)}</strong>
									{timelineEntry.eventType === 'status'
										? 'changed status'
										: `changed ${{ assignedToUserId: 'assignee', categoryId: 'category', priority: 'priority' }[timelineEntry.eventType] || timelineEntry.eventType}`}
									from
									<span
										>{timelineEntry.eventType === 'status'
											? TICKET_STATUSES[timelineEntry.details.from as keyof typeof TICKET_STATUSES]
													?.label || timelineEntry.details.from
											: timelineEntry.eventType === 'assignedToUserId'
												? timelineEntry.details.from
													? getPersonName(timelineEntry.details.from as string)
													: 'Unassigned'
												: timelineEntry.eventType === 'categoryId'
													? getCategoryName(timelineEntry.details.from as string)
													: timelineEntry.details.from || 'Unassigned'}</span
									>
									to {#if timelineEntry.eventType === 'status'}<StatusBadge
											status={String(timelineEntry.details.to)}
										/>{:else}<strong
											>{timelineEntry.eventType === 'assignedToUserId'
												? timelineEntry.details.to
													? getPersonName(timelineEntry.details.to as string)
													: 'Unassigned'
												: timelineEntry.eventType === 'categoryId'
													? getCategoryName(timelineEntry.details.to as string)
													: timelineEntry.details.to || 'Unassigned'}</strong
										>{/if}
									<span class="muted"
										>· {formatDate(timelineEntry.createdAt)}, {formatTime(
											timelineEntry.createdAt
										)}</span
									>
								</p>
							</div>{/if}{/each}
					{#if optimisticMessage}{@render commentMessage(
							data.user.id,
							optimisticMessage.isInternal,
							'Sending…',
							optimisticMessage.body,
							true
						)}{/if}
					{#if !isTicketClosed}<form
							class="composer"
							class:note-mode={isInternalNote}
							aria-busy={$isSendingComment}
							method="POST"
							action="?/reply"
							use:enhanceReply
						>
							<div class="composer-tabs">
								<button
									type="button"
									class:chosen={!isInternalNote}
									disabled={$isSendingComment}
									onclick={() => (isInternalNote = false)}
									><MessageSquare size={16} /> Comment</button
								>{#if isStaffUser}<button
										type="button"
										class:chosen={isInternalNote}
										disabled={$isSendingComment}
										onclick={() => (isInternalNote = true)}
										><LockKeyhole size={16} /> Internal note</button
									>{/if}
							</div>
							<input type="hidden" name="internal" value={isInternalNote} /><textarea
								name="body"
								aria-invalid={!!$replyErrors.body}
								aria-describedby={$replyErrors.body ? 'reply-error' : undefined}
								aria-label={isInternalNote ? 'Internal note' : 'Comment'}
								placeholder={isInternalNote
									? 'Add a private note for the support team…'
									: 'Write a comment…'}
								bind:value={$replyFields.body}
								required
								maxlength={10000}
								rows={4}
								readonly={$isSendingComment}></textarea>
							{#if $replyErrors.body}<p id="reply-error" class="error" role="alert">
									{$replyErrors.body.join(' ')}
								</p>{/if}
							<div class="composer-footer">
								<span class="muted small"
									>{isInternalNote
										? 'Only visible to agents and administrators'
										: 'Visible to the requester and support team'}</span
								><Button
									type="submit"
									size="sm"
									class="rounded-full px-4 whitespace-nowrap"
									disabled={$isSendingComment || !$replyFields.body.trim()}
									><Send size={15} />{$isSendingComment
										? $isReplyDelayed
											? 'Still sending…'
											: 'Sending…'
										: isInternalNote
											? 'Add note'
											: 'Send comment'}</Button
								>
							</div>
						</form>{:else}<div class="closed-banner">
							<LockKeyhole size={18} />
							<div>
								<strong>This ticket is closed</strong>
								<p>
									Closed tickets are read-only.{data.user.role === 'admin'
										? ' You can reopen this ticket below.'
										: ''}
								</p>
							</div>
						</div>{/if}
					{#if (ticket.statusCode === 'resolved' && (isStaffUser || ticket.requesterId === data.user.id)) || (isTicketClosed && data.user.role === 'admin')}<form
							method="POST"
							action="?/update"
							use:enhance={() => {
								isReopening = true;
								return async ({ update }) => {
									await update({ reset: false });
									isReopening = false;
								};
							}}
							class="reopen"
						>
							<input type="hidden" name="field" value="statusCode" /><input
								type="hidden"
								name="value"
								value="open"
							/><Button
								type="submit"
								variant="outline"
								class="rounded-full h-9 px-5"
								disabled={isReopening}>{isReopening ? 'Reopening…' : 'Reopen ticket'}</Button
							>
						</form>{/if}
				{/if}
			</div>{:else}<div class="reading-empty">
				<span class="empty-icon"><Inbox size={35} /></span>
				<h2>Your workspace, in order.</h2>
				<p>Select a ticket to read the conversation<br />and keep things moving.</p>
				{#if !isListLoading}<span class="small muted"
						>{activeCategory
							? `${ticketRows.length} open ${activeCategory.name} tickets`
							: isShowingDrafts
								? `${draftRows.length} drafts`
								: `${ticketRows.length} tickets · ${viewTitle}`}</span
					>{/if}
			</div>{/if}
	</section>
</div>
<a class="mobile-new new-ticket" href="/app/tickets/new"><SquarePen size={23} /> New ticket</a>

<style>
	.search-match-reasons {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin-top: 4px;
		color: var(--muted-fg);
		font-size: 12px;
	}
</style>
