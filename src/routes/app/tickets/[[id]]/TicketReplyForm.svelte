<!-- The comment and internal-note editor. The conversation owns the form and its text. -->
<script lang="ts">
	import { LockKeyhole, MessageSquare, Send } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils';
	import TooltipWrapper from '$lib/components/TooltipWrapper.svelte';
	import TicketContentEditor from '$lib/components/tickets/TicketContentEditor.svelte';
	import { TicketContentFormat } from '$lib/ticket-content/ticket-content-format';
	import { createHotkeysAttachment } from '@tanstack/svelte-hotkeys';
	import { AppHotkeys } from '$lib/hotkeys';
	import CommentMessage from './CommentMessage.svelte';
	import TicketNotifyRecipients from './TicketNotifyRecipients.svelte';
	import type { TicketReplySuperForm } from './ticket-forms';
	import type { NotificationAudienceMember } from './ticket-types';

	/** Matches the comment schema's limit. */
	const REPLY_MAX_LENGTH = 10000;

	type TicketReplyFormProps = {
		replyForm: TicketReplySuperForm;
		isInternalNote: boolean;
		authorName: string;
		authorRoleLabel: string;
		canUseInternalNotes: boolean;
		notificationAudience: NotificationAudienceMember[];
		currentUserId: string;
		/** Support staff choose whether to follow the ticket when they comment. */
		canChooseToFollow: boolean;
	};
	let {
		replyForm,
		isInternalNote = $bindable(),
		authorName,
		authorRoleLabel,
		canUseInternalNotes,
		notificationAudience,
		currentUserId,
		canChooseToFollow
	}: TicketReplyFormProps = $props();

	// The conversation creates the form once, so reading it at setup is correct.
	// svelte-ignore state_referenced_locally
	const {
		form: replyFields,
		enhance: enhanceReply,
		submitting: isSendingComment,
		delayed: isReplyDelayed,
		errors: replyErrors
	} = replyForm;
	function buildTabClass(isChosen: boolean): string {
		return cn(
			'flex items-center gap-[7px] rounded-[18px] px-2.5 py-1.5 text-[12px] text-muted-foreground',
			isChosen && 'bg-selected font-[650] text-primary'
		);
	}
	let hasUnsentText = $derived(!!$replyFields.body.trim());
	let formElement = $state<HTMLFormElement>();
	const replyFormHotkeys = createHotkeysAttachment(
		[{ hotkey: AppHotkeys.SUBMIT_FORM.hotkey, callback: () => formElement?.requestSubmit() }],
		() => ({ enabled: !$isSendingComment && hasUnsentText, ignoreInputs: false })
	);
	let submitLabel = $derived(
		$isSendingComment
			? $isReplyDelayed
				? 'Still sending…'
				: 'Sending…'
			: isInternalNote
				? 'Add note'
				: 'Send comment'
	);
</script>

<!-- The editor is read-only while posting, so the optimistic message can use its values. -->
{#if $isSendingComment && hasUnsentText}<CommentMessage
		{authorName}
		roleLabel={authorRoleLabel}
		timestampLabel="Sending…"
		body={$replyFields.body}
		bodyFormat={TicketContentFormat.MARKDOWN}
		isInternal={isInternalNote}
		isSending
	/>{/if}
<form
	bind:this={formElement}
	{@attach replyFormHotkeys}
	class={cn('composer', isInternalNote && 'border-note-border bg-note')}
	aria-busy={$isSendingComment}
	method="POST"
	action="?/reply"
	use:enhanceReply
>
	<div class="flex gap-1.5 px-2.5 py-2">
		<TooltipWrapper
			content="Visible to the requester and support team"
			onclick={() => (isInternalNote = false)}
		>
			{#snippet trigger(props)}
				<button
					{...props}
					type="button"
					class={buildTabClass(!isInternalNote)}
					disabled={$isSendingComment}><MessageSquare size={16} /> Comment</button
				>
			{/snippet}
		</TooltipWrapper>
		{#if canUseInternalNotes}
			<TooltipWrapper
				content="Only visible to the support team; hidden from the requester"
				onclick={() => (isInternalNote = true)}
			>
				{#snippet trigger(props)}
					<button
						{...props}
						type="button"
						class={buildTabClass(isInternalNote)}
						disabled={$isSendingComment}><LockKeyhole size={16} /> Internal note</button
					>
				{/snippet}
			</TooltipWrapper>
		{/if}
	</div>
	<input type="hidden" name="internal" value={isInternalNote} />
	<TicketContentEditor
		name="body"
		bind:value={$replyFields.body}
		label={isInternalNote ? 'Internal note' : 'Comment'}
		placeholder={isInternalNote ? 'Add a private note for the support team…' : 'Write a comment…'}
		isInvalid={!!$replyErrors.body}
		isRequired
		maximumLength={REPLY_MAX_LENGTH}
		describedBy={$replyErrors.body ? 'reply-error' : undefined}
		isReadOnly={$isSendingComment}
		contentClass="min-h-[110px]"
	/>
	{#if $replyErrors.body}<p id="reply-error" class="error" role="alert">
			{$replyErrors.body.join(' ')}
		</p>{/if}
	<TicketNotifyRecipients
		audience={notificationAudience}
		{currentUserId}
		{isInternalNote}
		{canChooseToFollow}
		isDisabled={$isSendingComment}
	/>
	<div class="composer-footer">
		<span class="muted small"
			>{isInternalNote
				? 'Only visible to agents and administrators'
				: 'Visible to the requester and support team'}</span
		><Button type="submit" size="pill-sm" disabled={$isSendingComment || !hasUnsentText}
			><Send size={15} />{submitLabel}</Button
		>
	</div>
</form>
