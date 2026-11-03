<!--
	The new-ticket form's markup. Its values live in a browser draft, so nothing typed is lost
	when the form closes. The page owns the Superforms form that submits it.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { hasPermission, type PermissionSubject } from '$lib/permissions';
	import { TICKET_STATUSES } from '$lib/status';
	import { ArrowLeft, Send, X } from '@lucide/svelte';
	import Combobox from '$lib/components/Combobox.svelte';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import TicketContentEditor from '$lib/components/tickets/TicketContentEditor.svelte';
	import { createComposeFormHotkeys } from '$lib/compose-hotkeys';
	import type { DraftStore, TicketDraft, TicketDraftFields } from '$lib/drafts.svelte';
	import type { TicketCreateSuperForm } from './ticket-forms';
	import type { SelectOption } from './ticket-types';

	const SUBJECT_MAX_LENGTH = 180;
	const SUBJECT_COUNTER_FROM = 160;
	const DESCRIPTION_MAX_LENGTH = 4000;
	const DESCRIPTION_COUNTER_FROM = 3600;

	type TicketComposeFormProps = {
		createForm: TicketCreateSuperForm;
		draft: TicketDraft;
		ticketDrafts: DraftStore<TicketDraftFields, TicketDraft>;
		listHref: string;
		permissionSubject: PermissionSubject;
		requesterOptions: SelectOption[];
		assigneeOptions: SelectOption[];
		categoryOptions: SelectOption[];
	};
	let {
		createForm,
		draft,
		ticketDrafts,
		listHref,
		permissionSubject,
		requesterOptions,
		assigneeOptions,
		categoryOptions
	}: TicketComposeFormProps = $props();

	let formElement = $state<HTMLFormElement>();
	// The page creates the form once, so reading it at setup is correct.
	// svelte-ignore state_referenced_locally
	const {
		enhance: enhanceCreate,
		submitting: isCreatingTicket,
		delayed: isCreateDelayed,
		errors: createErrors
	} = createForm;

	let isDescriptionNearLimit = $derived(draft.description.length > DESCRIPTION_COUNTER_FROM);
	let footerHint = $derived(
		$isCreatingTicket
			? $isCreateDelayed
				? 'Still creating ticket…'
				: 'Creating ticket…'
			: isDescriptionNearLimit
				? `${draft.description.length} / ${DESCRIPTION_MAX_LENGTH}`
				: 'Esc to close · Ctrl/Cmd+Enter to create'
	);

	const createFormHotkeys = createComposeFormHotkeys(
		() => formElement,
		() => listHref,
		() => !$isCreatingTicket
	);

	function discardDraft(): void {
		ticketDrafts.discardById(draft.id);
		void goto(listHref);
	}
</script>

<form
	bind:this={formElement}
	{@attach createFormHotkeys}
	class="compose"
	method="POST"
	action="?/create"
	use:enhanceCreate
>
	<div class="reading-toolbar">
		<TooltipIconButton label="Back to tickets" href={listHref} class="icon-button back"
			><ArrowLeft size={21} /></TooltipIconButton
		>
		<div class="pane-title">
			<!-- SvelteKit clears focus when navigation lands unless an element has autofocus. -->
			<!-- svelte-ignore a11y_autofocus -->
			<input
				autofocus
				{@attach (input) => input.focus()}
				class="block min-h-7 w-full rounded-none border-0 bg-transparent p-0 text-[20px] leading-7 font-[650] focus:outline-none"
				name="subject"
				aria-invalid={!!$createErrors.subject}
				aria-describedby={$createErrors.subject ? 'subject-error' : undefined}
				aria-label="Subject"
				placeholder="Subject"
				bind:value={draft.subject}
				required
				maxlength={SUBJECT_MAX_LENGTH}
				readonly={$isCreatingTicket}
			/>
			{#if $createErrors.subject}<p id="subject-error" class="error" role="alert">
					{$createErrors.subject.join(' ')}
				</p>{/if}
			<p class="pane-subtitle">
				New ticket{draft.subject.length > SUBJECT_COUNTER_FROM
					? ` · ${draft.subject.length} / ${SUBJECT_MAX_LENGTH}`
					: ''}
			</p>
		</div>
		<TooltipIconButton label="Close new ticket" href={listHref} class="icon-button compose-close"
			><X size={20} /></TooltipIconButton
		>
	</div>
	<div class="conversation-scroll flex flex-col">
		<div class="ticket-heading">
			<div class="field-row">
				{#if hasPermission(permissionSubject, 'createTicketsForOthers')}
					<div class="metadata-control">
						<span>Requester</span><Combobox
							name="requesterId"
							label="Requester"
							variant="inline"
							bind:value={draft.requesterId}
							options={requesterOptions}
							disabled={$isCreatingTicket}
						/>
					</div>
				{/if}
				{#if hasPermission(permissionSubject, 'assignTickets')}
					<div class="metadata-control">
						<span>Assignee</span><Combobox
							name="assignedToUserId"
							label="Assignee"
							variant="inline"
							bind:value={draft.assignedToUserId}
							options={[{ value: '', label: 'Unassigned' }, ...assigneeOptions]}
							disabled={$isCreatingTicket}
						/>
					</div>
				{/if}
				{#if hasPermission(permissionSubject, 'setTicketPriority')}
					<div class="metadata-control">
						<span>Priority</span><Combobox
							name="priority"
							label="Priority"
							variant="inline"
							bind:value={draft.priority}
							options={[
								{ value: 'low', label: 'Low' },
								{ value: 'normal', label: 'Normal' },
								{ value: 'high', label: 'High' }
							]}
							disabled={$isCreatingTicket}
						/>
					</div>
				{/if}
				{#if hasPermission(permissionSubject, 'setTicketStatus')}
					<div class="metadata-control">
						<span>Status</span><Combobox
							name="statusCode"
							label="Status"
							variant="inline"
							bind:value={draft.statusCode}
							options={Object.entries(TICKET_STATUSES).map(([value, status]) => ({
								value,
								label: status.label
							}))}
							disabled={$isCreatingTicket}
						/>
					</div>
				{/if}
				<div class="metadata-control">
					<span>Category</span><Combobox
						name="categoryId"
						label="Category"
						variant="inline"
						placeholder="Choose"
						bind:value={draft.categoryId}
						options={categoryOptions}
						disabled={$isCreatingTicket}
						required
					/>
				</div>
			</div>
		</div>
		<!-- The body fills the pane like an email, instead of a fixed box above empty space. -->
		<div class="composer mt-3.5 flex min-h-[220px] flex-1 flex-col">
			<TicketContentEditor
				name="description"
				bind:value={draft.description}
				label="Description"
				placeholder="What happened? Include when it started and what you’ve tried."
				isInvalid={!!$createErrors.description}
				describedBy={$createErrors.description ? 'description-error' : undefined}
				isReadOnly={$isCreatingTicket}
				contentClass="min-h-[180px]"
			/>
			{#if $createErrors.description}<p id="description-error" class="error" role="alert">
					{$createErrors.description.join(' ')}
				</p>{/if}
			{#if $createErrors.categoryId}<p class="error" role="alert">
					{$createErrors.categoryId.join(' ')}
				</p>{/if}
			<div class="composer-footer">
				<span class="muted small" class:compose-hint={!$isCreatingTicket && !isDescriptionNearLimit}
					>{footerHint}</span
				>
				<span class="flex shrink-0 items-center gap-1.5 max-md:ml-auto">
					<Button variant="ghost" size="pill-sm" disabled={$isCreatingTicket} onclick={discardDraft}
						>Discard</Button
					>
					<Button type="submit" size="pill-sm" disabled={$isCreatingTicket}
						><Send size={15} />{$isCreatingTicket ? 'Creating…' : 'Create ticket'}</Button
					>
				</span>
			</div>
		</div>
	</div>
</form>
