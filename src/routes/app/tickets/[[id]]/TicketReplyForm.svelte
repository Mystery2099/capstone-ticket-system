<!-- The comment and internal-note editor. The conversation owns the form and its text. -->
<script lang="ts">
	import { LockKeyhole, MessageSquare, Send } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import CommentMessage from './CommentMessage.svelte';
	import type { TicketReplySuperForm } from './ticket-forms';

	type TicketReplyFormProps = {
		replyForm: TicketReplySuperForm;
		isInternalNote: boolean;
		authorName: string;
		authorRoleLabel: string;
		isStaffUser: boolean;
	};
	let {
		replyForm,
		isInternalNote = $bindable(),
		authorName,
		authorRoleLabel,
		isStaffUser
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
	let hasUnsentText = $derived(!!$replyFields.body.trim());
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
		isInternal={isInternalNote}
		isSending
	/>{/if}
<form
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
			onclick={() => (isInternalNote = false)}><MessageSquare size={16} /> Comment</button
		>{#if isStaffUser}<button
				type="button"
				class:chosen={isInternalNote}
				disabled={$isSendingComment}
				onclick={() => (isInternalNote = true)}><LockKeyhole size={16} /> Internal note</button
			>{/if}
	</div>
	<input type="hidden" name="internal" value={isInternalNote} /><textarea
		name="body"
		aria-invalid={!!$replyErrors.body}
		aria-describedby={$replyErrors.body ? 'reply-error' : undefined}
		aria-label={isInternalNote ? 'Internal note' : 'Comment'}
		placeholder={isInternalNote ? 'Add a private note for the support team…' : 'Write a comment…'}
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
		><Button type="submit" size="pill-sm" disabled={$isSendingComment || !hasUnsentText}
			><Send size={15} />{submitLabel}</Button
		>
	</div>
</form>
