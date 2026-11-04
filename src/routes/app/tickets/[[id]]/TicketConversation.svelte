<!-- The reading pane for one ticket: its toolbar, details, timeline, and reply composer. -->
<script lang="ts">
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { hasPermission } from '$lib/permissions';
	import { enhance } from '$app/forms';
	import { ArrowLeft, ChevronLeft, ChevronRight, Link, LockKeyhole } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import ConversationSkeleton from '$lib/components/skeleton/ConversationSkeleton.svelte';
	import StatusBadge from '$lib/components/tickets/StatusBadge.svelte';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import TooltipWrapper from '$lib/components/TooltipWrapper.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { TICKET_STATUSES, TicketEventType } from '$lib/status';
	import CommentMessage from './CommentMessage.svelte';
	import TicketActivityEntry from './TicketActivityEntry.svelte';
	import TicketDescription from './TicketDescription.svelte';
	import TicketFieldSelect from './TicketFieldSelect.svelte';
	import TicketReplyForm from './TicketReplyForm.svelte';
	import type { TicketDirectory } from './ticket-directory';
	import { formatDateTime } from './ticket-formatting';
	import { createTicketReplyForm } from './ticket-forms';
	import type {
		CategoryRecord,
		DisplayedTicket,
		PersonSummary,
		SelectOption,
		TicketCommentRecord,
		TicketEventRecord
	} from './ticket-types';
	import type { PageData } from './$types';

	/** Events the conversation already shows as a message, so the timeline skips them. */
	const CONVERSATION_EVENT_TYPES: string[] = [
		TicketEventType.CREATED,
		TicketEventType.REPLY,
		TicketEventType.INTERNAL_NOTE
	];
	/** How many of the latest timeline entries show before "Show all". */
	const RECENT_TIMELINE_LENGTH = 4;
	const METADATA_PILL_CLASS =
		'inline-flex min-h-[34px] max-w-full items-center gap-1.5 rounded-[24px] border border-border px-2.5 py-1 text-[12px] text-muted-foreground';
	const STATUS_OPTIONS: SelectOption[] = Object.entries(TICKET_STATUSES).map(([value, status]) => ({
		value,
		label: status.label
	}));
	const PRIORITY_OPTIONS: SelectOption[] = ['low', 'normal', 'high'].map((value) => ({
		value,
		label: (value === 'high' ? '⌃ ' : '') + value[0].toUpperCase() + value.slice(1)
	}));

	type TicketConversationProps = {
		ticket: DisplayedTicket;
		currentUser: PageData['user'];
		comments: TicketCommentRecord[];
		events: TicketEventRecord[];
		categories: CategoryRecord[];
		assignees: PersonSummary[];
		replyFormData: PageData['replyForm'];
		directory: TicketDirectory;
		/** The list row was used to paint the heading, and the rest is still loading. */
		isLoading: boolean;
		backHref: string;
		/** Where this ticket sits in the list, as 1 of N, when it's there at all. */
		listPosition: { index: number; total: number } | null;
		previousTicketHref: string | undefined;
		nextTicketHref: string | undefined;
	};
	let {
		ticket,
		currentUser,
		comments,
		events,
		categories,
		assignees,
		replyFormData,
		directory,
		isLoading,
		backHref,
		listPosition,
		previousTicketHref,
		nextTicketHref
	}: TicketConversationProps = $props();

	let showAllActivity = $state(false);
	let showTicketDetails = $state(false);
	let isReopening = $state(false);
	let isInternalNote = $state(false);
	// svelte-ignore state_referenced_locally
	const replyForm = createTicketReplyForm(replyFormData);
	const { form: replyFields } = replyForm;
	let hasUnsentReply = $derived(!!$replyFields.body.trim());
	afterNavigate(() => {
		replyForm.reset();
		isInternalNote = false;
		showAllActivity = false;
		showTicketDetails = false;
	});
	beforeNavigate(({ cancel }) => {
		if (hasUnsentReply && !confirm('Discard your unsent text and leave this page?')) cancel();
	});

	let canUseInternalNotes = $derived(hasPermission(currentUser, 'useInternalNotes'));
	let canReopenClosedTickets = $derived(hasPermission(currentUser, 'reopenClosedTickets'));
	let isTicketClosed = $derived(ticket.statusCode === 'closed');
	let canReopen = $derived(
		(ticket.statusCode === 'resolved' &&
			(hasPermission(currentUser, 'setTicketStatus') ||
				(ticket.requesterId === currentUser.id &&
					hasPermission(currentUser, 'reopenOwnResolvedTickets')))) ||
			(isTicketClosed && canReopenClosedTickets)
	);
	let categoryOptions = $derived(
		categories
			.filter((category) => category.active || category.id === ticket.categoryId)
			.map((category) => ({ value: category.id, label: category.name }))
	);
	let conversationTimeline = $derived(
		[
			...comments.map((comment) => ({ ...comment, kind: 'comment' as const })),
			...events
				.filter((event) => !CONVERSATION_EVENT_TYPES.includes(event.eventType))
				.map((event) => ({ ...event, kind: 'event' as const }))
		].sort(
			(firstEntry, secondEntry) =>
				+new Date(firstEntry.createdAt) - +new Date(secondEntry.createdAt)
		)
	);
	let hiddenEntryCount = $derived(
		showAllActivity ? 0 : Math.max(conversationTimeline.length - RECENT_TIMELINE_LENGTH, 0)
	);
	let visibleTimeline = $derived(conversationTimeline.slice(hiddenEntryCount));

	async function copyToClipboard(text: string, successMessage: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(successMessage);
		} catch {
			toast.error('Couldn’t copy.');
		}
	}
</script>

<svelte:window
	onbeforeunload={(event) => {
		if (hasUnsentReply) {
			event.preventDefault();
			event.returnValue = '';
		}
	}}
/>

<div class="reading-toolbar">
	<TooltipIconButton label="Back to tickets" href={backHref} class="icon-button back"
		><ArrowLeft size={21} /></TooltipIconButton
	>
	<div class="pane-title">
		<h1>{ticket.subject}</h1>
		<p class="pane-subtitle">
			<TooltipWrapper
				content="Copy ticket number"
				onclick={() => copyToClipboard(`#${ticket.ticketNumber}`, 'Ticket number copied')}
			>
				{#snippet trigger(props)}<button
						{...props}
						class="-ml-[5px] rounded-[5px] px-[5px] py-px font-semibold text-foreground hover:bg-muted hover:text-foreground"
						aria-label={`Copy ticket number #${ticket.ticketNumber}`}>#{ticket.ticketNumber}</button
					>{/snippet}
			</TooltipWrapper>
			· Opened by {directory.getPersonName(ticket.requesterId)} · {formatDateTime(ticket.createdAt)} ·
			Updated
			{formatDateTime(ticket.updatedAt)}
		</p>
	</div>
	{#if listPosition}<span class="muted small leading-9 whitespace-nowrap max-md:ml-auto"
			>{listPosition.index + 1} of {listPosition.total}</span
		>{/if}<TooltipIconButton
		label="Previous ticket"
		asLink
		href={previousTicketHref}
		aria-disabled={!previousTicketHref}><ChevronLeft size={20} /></TooltipIconButton
	><TooltipIconButton
		label="Next ticket"
		asLink
		href={nextTicketHref}
		aria-disabled={!nextTicketHref}><ChevronRight size={20} /></TooltipIconButton
	><TooltipIconButton
		label="Copy ticket link"
		onclick={() => copyToClipboard(window.location.href, 'Link copied')}
		><Link size={20} /></TooltipIconButton
	>
</div>
<div class="conversation-scroll">
	<div class="ticket-heading">
		<button
			class="text-link hidden max-md:inline-flex max-md:gap-1.5 max-md:px-0 max-md:py-0.5 max-md:text-[12px]"
			onclick={() => (showTicketDetails = !showTicketDetails)}
			>{showTicketDetails ? 'Hide details' : 'Show details'} <span>⌄</span></button
		>
		<div class="field-row" class:expanded={showTicketDetails}>
			{#if !isTicketClosed && hasPermission(currentUser, 'setTicketStatus')}
				<TicketFieldSelect
					field="statusCode"
					label="Status"
					value={ticket.statusCode}
					options={STATUS_OPTIONS}
					disabled={isLoading}
				/>
			{:else}<StatusBadge status={ticket.statusCode} />{/if}
			{#if !isTicketClosed && hasPermission(currentUser, 'setTicketPriority')}
				<TicketFieldSelect
					field="priority"
					label="Priority"
					value={ticket.priority}
					options={PRIORITY_OPTIONS}
					disabled={isLoading}
				/>
			{:else}<span class={METADATA_PILL_CLASS}
					>Priority <strong class="text-foreground capitalize">{ticket.priority}</strong></span
				>{/if}
			{#if !isTicketClosed && hasPermission(currentUser, 'assignTickets')}
				<TicketFieldSelect
					field="assignedToUserId"
					label="Assignee"
					value={ticket.assignedToUserId || ''}
					options={[
						{ value: '', label: 'Unassigned' },
						...assignees.map((person) => ({ value: person.id, label: person.name }))
					]}
					disabled={isLoading}
				/>
			{:else}<span class={METADATA_PILL_CLASS}
					>Assignee <strong class="text-foreground capitalize"
						>{isLoading
							? '…'
							: ticket.assignedToUserId
								? directory.getPersonName(ticket.assignedToUserId)
								: 'Unassigned'}</strong
					></span
				>{/if}
			{#if !isTicketClosed && hasPermission(currentUser, 'setTicketCategory')}
				<TicketFieldSelect
					field="categoryId"
					label="Category"
					value={ticket.categoryId}
					options={categoryOptions}
					disabled={isLoading}
				/>
			{:else}<span class={METADATA_PILL_CLASS}
					>Category <strong class="text-foreground capitalize"
						>{directory.getCategoryName(ticket.categoryId)}</strong
					></span
				>{/if}
		</div>
	</div>
	<TicketDescription
		description={'description' in ticket ? ticket.description : undefined}
		descriptionFormat={ticket.descriptionFormat}
	/>
	<h2 class="section-heading timeline-heading">
		Comments and activity{#if !isLoading && conversationTimeline.length}<span class="timeline-count"
				>{conversationTimeline.length}</span
			>{/if}
	</h2>
	{#if isLoading}<ConversationSkeleton />{:else}
		{#if !conversationTimeline.length}<p class="py-3 text-[13px] text-muted-foreground">
				No comments yet.
			</p>{/if}
		{#if hiddenEntryCount}<div
				class="flex items-center gap-3 border-b border-dashed border-input py-3 text-[13px] text-muted-foreground"
			>
				<span class="rounded-[16px] border border-input px-3 py-0.5 text-[12px]"
					>{hiddenEntryCount}</span
				><span>Earlier comments and activity hidden</span><button
					class="text-link ml-auto whitespace-nowrap"
					onclick={() => (showAllActivity = true)}>Show all</button
				>
			</div>{/if}
		{#each visibleTimeline as timelineEntry (`${timelineEntry.kind}-${timelineEntry.id}`)}{#if timelineEntry.kind === 'comment'}<CommentMessage
					authorName={directory.getPersonName(timelineEntry.authorId)}
					roleLabel={directory.getPersonRoleLabel(timelineEntry.authorId)}
					timestampLabel={formatDateTime(timelineEntry.createdAt)}
					body={timelineEntry.body}
					bodyFormat={timelineEntry.bodyFormat}
					isInternal={timelineEntry.isInternal}
				/>{:else}<TicketActivityEntry event={timelineEntry} {directory} />{/if}{/each}
		{#if !isTicketClosed}<TicketReplyForm
				{replyForm}
				bind:isInternalNote
				authorName={directory.getPersonName(currentUser.id)}
				authorRoleLabel={directory.getPersonRoleLabel(currentUser.id)}
				{canUseInternalNotes}
			/>{:else}<div class="mt-5 flex gap-3 rounded-[10px] bg-muted p-[18px]">
				<LockKeyhole size={18} />
				<div>
					<strong>This ticket is closed</strong>
					<p class="mt-[5px] text-[12px] text-muted-foreground">
						Closed tickets are read-only.{canReopenClosedTickets
							? ' You can reopen this ticket below.'
							: ''}
					</p>
				</div>
			</div>{/if}
		{#if canReopen}<form
				method="POST"
				action="?/update"
				use:enhance={() => {
					isReopening = true;
					return async ({ update }) => {
						await update({ reset: false });
						isReopening = false;
					};
				}}
				class="mt-4"
			>
				<input type="hidden" name="field" value="statusCode" /><input
					type="hidden"
					name="value"
					value="open"
				/><Button type="submit" variant="outline" size="pill" disabled={isReopening}
					>{isReopening ? 'Reopening…' : 'Reopen ticket'}</Button
				>
			</form>{/if}
	{/if}
</div>
