<!--
	The new-ticket form's markup. Its values live in a browser draft, so nothing typed is lost
	when the form closes. The page owns the Superforms form that submits it.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Send, X } from '@lucide/svelte';
	import Combobox from '$lib/components/Combobox.svelte';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
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
		isStaffUser: boolean;
		requesterOptions: SelectOption[];
		assigneeOptions: SelectOption[];
		categoryOptions: SelectOption[];
	};
	let {
		createForm,
		draft,
		ticketDrafts,
		listHref,
		isStaffUser,
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
				bind:value={draft.subject}
				required
				maxlength={SUBJECT_MAX_LENGTH}
				readonly={$isCreatingTicket}
			/>
			{#if $createErrors.subject}<p id="subject-error" class="error" role="alert">
					{$createErrors.subject.join(' ')}
				</p>{/if}
			<p class="ticket-dates">
				New ticket{draft.subject.length > SUBJECT_COUNTER_FROM
					? ` · ${draft.subject.length} / ${SUBJECT_MAX_LENGTH}`
					: ''}
			</p>
		</div>
		<TooltipIconButton label="Close new ticket" href={listHref} class="icon-button compose-close"
			><X size={20} /></TooltipIconButton
		>
	</div>
	<div class="conversation-scroll compose-body">
		<div class="ticket-heading">
			<div class="ticket-metadata">
				{#if isStaffUser}
					<div class="metadata-control">
						<span>Requester</span><Combobox
							name="requesterId"
							label="Requester"
							bind:value={draft.requesterId}
							options={requesterOptions}
							disabled={$isCreatingTicket}
						/>
					</div>
					<div class="metadata-control">
						<span>Assignee</span><Combobox
							name="assignedToUserId"
							label="Assignee"
							bind:value={draft.assignedToUserId}
							options={[{ value: '', label: 'Unassigned' }, ...assigneeOptions]}
							disabled={$isCreatingTicket}
						/>
					</div>
				{/if}
				<div class="metadata-control">
					<span>Category</span><Combobox
						name="categoryId"
						label="Category"
						placeholder="Choose"
						bind:value={draft.categoryId}
						options={categoryOptions}
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
				bind:value={draft.description}
				required
				maxlength={DESCRIPTION_MAX_LENGTH}
				rows={8}
				readonly={$isCreatingTicket}></textarea>
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
				<span class="compose-actions">
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
