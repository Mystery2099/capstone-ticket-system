<script lang="ts">
	import { createHotkeysAttachment } from '@tanstack/svelte-hotkeys';
	import { enhance } from '$app/forms';
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
	import { statuses, initials, TicketEventType } from '$lib/status';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import ConversationSkeleton from '$lib/components/skeleton/ConversationSkeleton.svelte';
	import TicketRowsSkeleton from '$lib/components/skeleton/TicketRowsSkeleton.svelte';
	import { toast } from 'svelte-sonner';
	import { delayed } from '$lib/delayed.svelte';
	import { getDrafts } from '$lib/ticket-draft.svelte';
	let { data, form } = $props();

	/** Events the conversation already shows as a message, so the timeline skips them. */
	const CONVERSATION_EVENTS: string[] = [
		TicketEventType.CREATED,
		TicketEventType.REPLY,
		TicketEventType.INTERNAL_NOTE
	];
	let commentBody = $state('');
	let isInternalNote = $state(false);
	let showAllActivity = $state(false);
	let showTicketDetails = $state(false);
	let isSendingComment = $state(false);
	let isRefreshing = $state(false);
	let isReopening = $state(false);
	// A comment awaiting the server, shown in the conversation right away.
	let sendingMessage = $state<{ body: string; isInternal: boolean } | null>(null);
	// Metadata values chosen but not yet confirmed, keyed by field.
	let pendingFieldValues = $state<Record<string, string>>({});
	const allDrafts = getDrafts();
	const ticketDrafts = allDrafts.tickets;
	let isCreatingTicket = $state(false);
	let composeForm = $state<HTMLFormElement>();
	let isStaffUser = $derived(data.user.role !== 'requester');

	// The list already holds every ticket field except its comments and events, so a
	// click can paint the real heading at once and leave only the rest as a skeleton.
	let navigationTarget = $derived(navigating.to?.route.id === page.route.id ? navigating.to : null);
	let targetTicketId = $derived(navigationTarget?.params?.id);
	let isOpeningNewTicket = $derived(targetTicketId === 'new');
	// Leaving the form takes effect at once, so the pane never lags behind a click.
	let isComposing = $derived(isOpeningNewTicket || (data.isNew && !navigationTarget));
	// Shallow routing leaves page.url as it was, so the draft just added to the URL is tracked here.
	let promotedId = $state<string | null>(null);
	let draftId = $derived(
		navigationTarget
			? navigationTarget.url.searchParams.get('draft')
			: (page.url.searchParams.get('draft') ?? promotedId)
	);
	let activeDraft = $derived(ticketDrafts.find(draftId) ?? ticketDrafts.blank);
	// The list's URL params, without the draft that happens to be open.
	let listParams = $derived.by(() => {
		const params = new URLSearchParams(page.url.searchParams);
		params.delete('draft');
		return params;
	});
	let listSearch = $derived(listParams.size ? '?' + listParams : '');
	// Waits for navigation to land, because that would replace the URL set here.
	$effect(() => {
		if (
			!isComposing ||
			navigationTarget ||
			activeDraft !== ticketDrafts.blank ||
			!activeDraft.dirty
		)
			return;
		const url = new URL(page.url);
		url.searchParams.set('draft', activeDraft.id);
		promotedId = activeDraft.id;
		ticketDrafts.promote();
		replaceState(url, {});
	});
	let isListChanging = $derived(
		!!navigationTarget && !isOpeningNewTicket && navigationTarget.url.search !== page.url.search
	);
	let targetTicketRow = $derived(
		targetTicketId && !isListChanging
			? data.tickets.find((row) => String(row.ticketNumber) === targetTicketId)
			: undefined
	);
	let slowNavigation = delayed(() => !!navigationTarget && !isOpeningNewTicket);
	let isListLoading = $derived(slowNavigation.current && isListChanging);
	let isPaneLoading = $derived(slowNavigation.current && !!targetTicketId);
	let ticket = $derived(isPaneLoading ? (targetTicketRow ?? null) : data.selected);
	let highlightedTicketId = $derived(
		isComposing ? undefined : navigationTarget ? targetTicketRow?.id : data.selected?.id
	);
	let hasTicket = $derived(
		isComposing || (navigationTarget && !targetTicketId ? false : !!ticket || isPaneLoading)
	);
	let listHref = $derived('/app/tickets' + listSearch);
	let isClosed = $derived(ticket?.statusCode === 'closed');
	let requesters = $derived(
		data.people
			.filter((candidate) => !candidate.banned)
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	let assignees = $derived(requesters.filter((candidate) => candidate.role !== 'requester'));
	const statusOptions = Object.entries(statuses).map(([value, status]) => ({
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
	const personOption = (p: (typeof requesters)[number]) => ({
		value: p.id,
		label: p.name + (p.id === data.user.id ? ' (you)' : '')
	});
	const personName = (id: string | null) =>
		data.people.find((candidate) => candidate.id === id)?.name || 'Support team';
	const personRole = (id: string) =>
		data.people.find((candidate) => candidate.id === id)?.role || 'agent';
	const categoryName = (id: string) =>
		data.categories.find((item) => item.id === id)?.name || 'Category';
	const date = (d: Date | string) =>
		new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	const time = (d: Date | string) =>
		new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	let activeView = $derived(
		isListChanging
			? navigationTarget?.url.searchParams.get('view') || (isStaffUser ? 'open' : 'mine')
			: data.view
	);
	let targetParams = $derived((isListChanging ? navigationTarget?.url : page.url)?.searchParams);
	let openCategory = $derived(
		activeView === 'open'
			? data.categories.find((item) => item.id === targetParams?.get('category'))
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
	let showingDrafts = $derived(activeView === 'drafts');
	// Every kind of draft lives in this one list, each opening back in its own form.
	let draftRows = $derived([
		...ticketDrafts.saved.map((item) => ({
			id: item.id,
			title: item.subject.trim() || 'No subject',
			preview: item.description.trim() || 'Nothing written yet',
			type: 'Ticket draft',
			avatar: initials(personName(item.requesterId)),
			href: `/app/tickets/new?view=drafts&draft=${item.id}`
		})),
		...allDrafts.users.saved.map((item) => ({
			id: item.id,
			title: item.name.trim() || 'No name',
			preview: item.email.trim() || 'No email yet',
			type: 'User draft',
			avatar: item.name.trim() ? initials(item.name.trim()) : '?',
			href: `/app/admin/users?new&draft=${item.id}`
		})),
		...allDrafts.categories.saved.map((item) => ({
			id: item.id,
			title: item.name.trim(),
			preview: 'New category',
			type: 'Category draft',
			avatar: '',
			href: `/app/admin/categories?new&draft=${item.id}`
		}))
	]);
	let listHeading = $derived(openCategory ? `Open · ${openCategory.name}` : viewTitle);
	let ticketIndex = $derived(data.tickets.findIndex((row) => row.id === ticket?.id));
	let conversationTimeline = $derived(
		[
			...data.comments.map((comment) => ({ ...comment, kind: 'comment' as const })),
			...data.events
				.filter((event) => !CONVERSATION_EVENTS.includes(event.eventType))
				.map((event) => ({ ...event, kind: 'event' as const }))
		].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
	);
	let visibleTimeline = $derived(
		showAllActivity ? conversationTimeline : conversationTimeline.slice(-4)
	);
	function ticketHref(n: number) {
		return `/app/tickets/${n}${listSearch}`;
	}
	async function applyListFilter(key: string, value: string) {
		const params = new URLSearchParams(listParams);
		params.delete('before');
		if (value) params.set(key, value);
		else params.delete(key);
		await goto('/app/tickets?' + params);
	}
	async function refreshTickets() {
		isRefreshing = true;
		await invalidateAll();
		isRefreshing = false;
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
		commentBody = '';
		isInternalNote = false;
		showAllActivity = false;
		showTicketDetails = false;
		isCreatingTicket = false;
		promotedId = null;
	});
	beforeNavigate(({ cancel }) => {
		// New-ticket drafts need no warning, because they're saved in this browser.
		if (commentBody.trim() && !confirm('Discard your unsent text and leave this page?')) cancel();
	});

	const createFormHotkeys = createHotkeysAttachment(
		[
			{ hotkey: 'Mod+Enter', callback: () => composeForm?.requestSubmit() },
			{
				hotkey: 'Escape',
				callback: () => {
					void goto(listHref);
				}
			}
		],
		() => ({ enabled: isComposing && !isCreatingTicket, ignoreInputs: false })
	);
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (commentBody.trim()) {
			e.preventDefault();
			e.returnValue = '';
		}
	}}
/>

{#snippet compose()}
	<form
		bind:this={composeForm}
		{@attach createFormHotkeys}
		class="compose"
		method="POST"
		action="?/create"
		use:enhance={() => {
			const submitted = activeDraft;
			isCreatingTicket = true;
			return async ({ result, update }) => {
				if (result.type === 'redirect') {
					ticketDrafts.discard(submitted.id);
					toast.success('Ticket created.');
				}
				await update({ reset: false });
				isCreatingTicket = false;
			};
		}}
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
					aria-label="Subject"
					placeholder="Subject"
					bind:value={activeDraft.subject}
					required
					maxlength={180}
					readonly={isCreatingTicket}
				/>
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
								options={requesters.map(personOption)}
								disabled={isCreatingTicket}
							/>
						</div>
						<div class="metadata-control">
							<span>Assignee</span><Combobox
								name="assignedToUserId"
								label="Assignee"
								bind:value={activeDraft.assignedToUserId}
								options={[{ value: '', label: 'Unassigned' }, ...assignees.map(personOption)]}
								disabled={isCreatingTicket}
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
							disabled={isCreatingTicket}
							required
						/>
					</div>
				</div>
			</div>
			<div class="composer">
				<textarea
					name="description"
					aria-label="Description"
					placeholder="What happened? Include when it started and what you’ve tried."
					bind:value={activeDraft.description}
					required
					maxlength={4000}
					rows={8}
					readonly={isCreatingTicket}></textarea>
				<div class="composer-footer">
					<span
						class="muted small"
						class:compose-hint={!isCreatingTicket && activeDraft.description.length <= 3600}
						>{isCreatingTicket
							? 'Creating ticket…'
							: activeDraft.description.length > 3600
								? `${activeDraft.description.length} / 4000`
								: 'Esc to close · Ctrl/Cmd+Enter to create'}</span
					>
					<span class="compose-actions">
						<Button
							variant="ghost"
							size="sm"
							class="rounded-full px-4"
							disabled={isCreatingTicket}
							onclick={() => {
								ticketDrafts.discard(activeDraft.id);
								void goto(listHref);
							}}>Discard</Button
						>
						<Button
							type="submit"
							size="sm"
							class="rounded-full px-4 whitespace-nowrap"
							disabled={isCreatingTicket}
							><Send size={15} />{isCreatingTicket ? 'Creating…' : 'Create ticket'}</Button
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
	when: string,
	text: string,
	isSending = false
)}
	<article class="message" class:internal-note={isInternal} class:sending={isSending}>
		<span class="avatar">{initials(personName(authorId))}</span>
		<div class="message-content">
			<div class="message-heading">
				<strong>{personName(authorId)}</strong><span class="role-tag"
					>{personRole(authorId) === 'requester'
						? 'Requester'
						: personRole(authorId) === 'admin'
							? 'Administrator'
							: 'Agent'}</span
				><time>{when}</time>
			</div>
			{#if isInternal}<p class="private-label">
					<LockKeyhole size={13} /> Internal note · only visible to support team
				</p>{/if}
			<p class="message-body">{text}</p>
		</div>
	</article>
{/snippet}
{#snippet updateSelect(
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
			disabled={isClosed || isPaneLoading}
			submitOnSelect
		/>
	</form>
{/snippet}
<div class="workspace" class:has-ticket={hasTicket}>
	<section class="ticket-list" aria-label="Ticket list">
		<div class="list-top">
			<h1>
				{listHeading}{#if !isListLoading}
					<span>{showingDrafts ? draftRows.length : data.tickets.length}</span>{/if}
			</h1>
			{#if !showingDrafts}<Tooltip.Root>
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
		{#if !showingDrafts}<div class="filters">
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
		{#if showingDrafts}<div class="rows">
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
			</div>{:else if isListLoading}<TicketRowsSkeleton />{:else}<div
				class="rows"
				aria-busy={isRefreshing}
			>
				{#each data.tickets as row}<a
						href={ticketHref(row.ticketNumber)}
						class="ticket-row"
						class:selected={highlightedTicketId === row.id}
						><span class="avatar row-avatar">{initials(personName(row.requesterId))}</span>
						<div class="row-content">
							<div class="row-title">
								{#if row.priority === 'high'}<ChevronsUp class="high" size={17} />{/if}<strong
									>{row.subject}</strong
								><time
									>{new Date(row.updatedAt).toDateString() === new Date().toDateString()
										? time(row.updatedAt)
										: date(row.updatedAt)}</time
								>
							</div>
							<div class="row-meta">
								<StatusBadge status={row.statusCode} /><span class="row-requester"
									>{personName(row.requesterId)} · #{row.ticketNumber}</span
								><span class="row-preview"
									>— {row.previewAuthor ? row.previewAuthor + ': ' : ''}{row.preview}</span
								>
							</div>
						</div></a
					>{:else}<div class="empty">
						<Inbox size={36} />
						<h2>No tickets here</h2>
						<p>Try another view or change your filters.</p>
						<a href="/app/tickets" class="text-link">Clear filters</a>
					</div>{/each}
				{#if data.firstPageHref || data.nextPageHref}
					<nav aria-label="Ticket list pages" class="flex items-center justify-between gap-4 p-4">
						{#if data.firstPageHref}<a class="text-link" href={data.firstPageHref}>Newest tickets</a
							>{/if}
						{#if data.nextPageHref}<a class="text-link" href={data.nextPageHref}>Older tickets</a
							>{/if}
					</nav>
				{/if}
			</div>{/if}
	</section>
	<section class="reading-pane" aria-label="Ticket conversation">
		{#if isComposing}{#key activeDraft.id}{@render compose()}{/key}{:else if isPaneLoading && !ticket}<div
				class="conversation-scroll"
			>
				<ConversationSkeleton heading />
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
						· Opened by {personName(ticket.requesterId)} · {date(ticket.createdAt)}, {time(
							ticket.createdAt
						)} · Updated
						{date(ticket.updatedAt)}, {time(ticket.updatedAt)}
					</p>
				</div>
				{#if ticketIndex >= 0}<span class="toolbar-position muted small"
						>{ticketIndex + 1} of {data.tickets.length}</span
					>{/if}<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<a
								{...props}
								class="icon-button"
								aria-label="Previous ticket"
								aria-disabled={ticketIndex <= 0}
								href={ticketIndex > 0
									? ticketHref(data.tickets[ticketIndex - 1].ticketNumber)
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
								aria-disabled={ticketIndex < 0 || ticketIndex >= data.tickets.length - 1}
								href={ticketIndex >= 0 && ticketIndex < data.tickets.length - 1
									? ticketHref(data.tickets[ticketIndex + 1].ticketNumber)
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
						{#if isStaffUser && !isClosed}{@render updateSelect(
								'statusCode',
								'Status',
								ticket.statusCode,
								Object.entries(statuses).map(([value, s]) => ({
									value,
									label: s.symbol + ' ' + s.label
								}))
							)}{@render updateSelect(
								'priority',
								'Priority',
								ticket.priority,
								['low', 'normal', 'high'].map((value) => ({
									value,
									label: (value === 'high' ? '⌃ ' : '') + value[0].toUpperCase() + value.slice(1)
								}))
							)}{@render updateSelect(
								'assignedToUserId',
								'Assignee',
								ticket.assignedToUserId || '',
								[
									{ value: '', label: 'Unassigned' },
									...assignees.map((person) => ({ value: person.id, label: person.name }))
								]
							)}{@render updateSelect(
								'categoryId',
								'Category',
								ticket.categoryId,
								data.categories
									.filter((item) => item.active || item.id === ticket.categoryId)
									.map((item) => ({ value: item.id, label: item.name }))
							)}{:else}<StatusBadge status={ticket.statusCode} /><span class="metadata-pill"
								>Priority <strong>{ticket.priority}</strong></span
							><span class="metadata-pill"
								>Assignee <strong
									>{isPaneLoading
										? '…'
										: ticket.assignedToUserId
											? personName(ticket.assignedToUserId)
											: 'Unassigned'}</strong
								></span
							><span class="metadata-pill"
								>Category <strong>{categoryName(ticket.categoryId)}</strong></span
							>{/if}
					</div>
				</div>
				<article class="message">
					<span class="avatar">{initials(personName(ticket.requesterId))}</span>
					<div class="message-content">
						<div class="message-heading">
							<strong>{personName(ticket.requesterId)}</strong><span class="role-tag"
								>Requester</span
							><time>{date(ticket.createdAt)}, {time(ticket.createdAt)}</time>
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
					{#each visibleTimeline as item}{#if item.kind === 'comment'}{@render commentMessage(
								item.authorId,
								item.isInternal,
								`${date(item.createdAt)}, ${time(item.createdAt)}`,
								item.body
							)}{:else}<div class="activity">
								<span class="activity-icon"><ArrowRightLeft size={15} /></span>
								<p>
									<strong>{personName(item.actorId)}</strong>
									{item.eventType === 'status'
										? 'changed status'
										: `changed ${{ assignedToUserId: 'assignee', categoryId: 'category', priority: 'priority' }[item.eventType] || item.eventType}`}
									from
									<span
										>{item.eventType === 'status'
											? statuses[item.details.from as keyof typeof statuses]?.label ||
												item.details.from
											: item.eventType === 'assignedToUserId'
												? item.details.from
													? personName(item.details.from as string)
													: 'Unassigned'
												: item.eventType === 'categoryId'
													? categoryName(item.details.from as string)
													: item.details.from || 'Unassigned'}</span
									>
									to {#if item.eventType === 'status'}<StatusBadge
											status={String(item.details.to)}
										/>{:else}<strong
											>{item.eventType === 'assignedToUserId'
												? item.details.to
													? personName(item.details.to as string)
													: 'Unassigned'
												: item.eventType === 'categoryId'
													? categoryName(item.details.to as string)
													: item.details.to || 'Unassigned'}</strong
										>{/if}
									<span class="muted">· {date(item.createdAt)}, {time(item.createdAt)}</span>
								</p>
							</div>{/if}{/each}
					{#if sendingMessage}{@render commentMessage(
							data.user.id,
							sendingMessage.isInternal,
							'Sending…',
							sendingMessage.body,
							true
						)}{/if}
					{#if !isClosed}<form
							class="composer"
							class:note-mode={isInternalNote}
							method="POST"
							action="?/reply"
							use:enhance={() => {
								const text = commentBody;
								sendingMessage = { body: text, isInternal: isInternalNote };
								isSendingComment = true;
								commentBody = '';
								return async ({ result, update }) => {
									// A transport error would otherwise replace the page and lose the text.
									if (result.type === 'error')
										toast.error('Couldn’t send. Your comment is back in the box below.');
									else await update({ reset: false });
									sendingMessage = null;
									isSendingComment = false;
									if (result.type !== 'success') commentBody = text;
								};
							}}
						>
							<div class="composer-tabs">
								<button
									type="button"
									class:chosen={!isInternalNote}
									onclick={() => (isInternalNote = false)}
									><MessageSquare size={16} /> Comment</button
								>{#if isStaffUser}<button
										type="button"
										class:chosen={isInternalNote}
										onclick={() => (isInternalNote = true)}
										><LockKeyhole size={16} /> Internal note</button
									>{/if}
							</div>
							<input type="hidden" name="internal" value={isInternalNote} /><textarea
								name="body"
								aria-label={isInternalNote ? 'Internal note' : 'Comment'}
								placeholder={isInternalNote
									? 'Add a private note for the support team…'
									: 'Write a comment…'}
								bind:value={commentBody}
								required
								maxlength={10000}
								rows={4}></textarea>
							<div class="composer-footer">
								<span class="muted small"
									>{isInternalNote
										? 'Only visible to agents and administrators'
										: 'Visible to the requester and support team'}</span
								><Button
									type="submit"
									size="sm"
									class="rounded-full px-4 whitespace-nowrap"
									disabled={isSendingComment || !commentBody.trim()}
									><Send size={15} />{isSendingComment
										? 'Sending…'
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
					{#if (ticket.statusCode === 'resolved' && (isStaffUser || ticket.requesterId === data.user.id)) || (isClosed && data.user.role === 'admin')}<form
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
						>{openCategory
							? `${data.tickets.length} open ${openCategory.name} tickets`
							: showingDrafts
								? `${draftRows.length} drafts`
								: `${data.tickets.length} tickets · ${viewTitle}`}</span
					>{/if}
			</div>{/if}
	</section>
</div>
<a class="mobile-new new-ticket" href="/app/tickets/new"><SquarePen size={23} /> New ticket</a>
