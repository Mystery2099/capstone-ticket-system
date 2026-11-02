<!-- One message in a conversation: a comment, an internal note, or the ticket's description. -->
<script lang="ts">
	import { LockKeyhole } from '@lucide/svelte';
	import { getInitials } from '$lib/person';

	type CommentMessageProps = {
		authorName: string;
		roleLabel: string;
		timestampLabel: string;
		body: string;
		caption?: string;
		isInternal?: boolean;
		isSending?: boolean;
	};
	let {
		authorName,
		roleLabel,
		timestampLabel,
		body,
		caption,
		isInternal = false,
		isSending = false
	}: CommentMessageProps = $props();
</script>

<article class="message" class:internal-note={isInternal} class:sending={isSending}>
	<span class="avatar">{getInitials(authorName)}</span>
	<div class="message-content">
		<div class="message-heading">
			<strong>{authorName}</strong><span class="role-tag">{roleLabel}</span><time
				>{timestampLabel}</time
			>
		</div>
		{#if caption}<p class="message-caption">{caption}</p>{/if}
		{#if isInternal}<p class="private-label">
				<LockKeyhole size={13} /> Internal note · only visible to support team
			</p>{/if}
		<p class="message-body">{body}</p>
	</div>
</article>
