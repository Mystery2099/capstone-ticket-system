<!--
	The comment and internal-note composer under a conversation. Owns the unsent text, so it
	also asks before leaving the page with text still in the box.
-->
<script lang="ts">
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { LockKeyhole, MessageSquare, Send } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { superForm } from 'sveltekit-superforms';
	import { Button } from '$lib/components/ui/button/index.js';
	import CommentMessage from './CommentMessage.svelte';
	import type { PageData } from './$types';

	type TicketReplyFormProps = {
		replyFormData: PageData['replyForm'];
		authorName: string;
		authorRoleLabel: string;
		isStaffUser: boolean;
	};
	let { replyFormData, authorName, authorRoleLabel, isStaffUser }: TicketReplyFormProps = $props();

	let isInternalNote = $state(false);

	// Keep text until the server confirms it; Superforms resets only successful replies.
	// svelte-ignore state_referenced_locally
	const replyForm = superForm(replyFormData, {
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

	afterNavigate(() => {
		replyForm.reset();
		isInternalNote = false;
	});
	beforeNavigate(({ cancel }) => {
		if (hasUnsentText && !confirm('Discard your unsent text and leave this page?')) cancel();
	});
</script>

<svelte:window
	onbeforeunload={(event) => {
		if (hasUnsentText) {
			event.preventDefault();
			event.returnValue = '';
		}
	}}
/>

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
