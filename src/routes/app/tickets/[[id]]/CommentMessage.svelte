<!-- One message in a conversation: a comment, an internal note, or the ticket's description. -->
<script lang="ts">
	import { LockKeyhole } from '@lucide/svelte';
	import { getInitials } from '$lib/person';
	import { cn } from '$lib/utils';
	import TicketContent from '$lib/components/tickets/TicketContent.svelte';

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

<article
	class={cn(
		'message',
		// On phones the message's own padding still applies inside the note.
		isInternal &&
			'-mx-2.5 my-3 rounded-[8px] border border-note-border bg-note px-2.5 py-3.5 max-md:px-0 max-md:py-[18px]',
		isSending && 'sending animate-[rise-in_var(--motion-base)_ease-out] opacity-70'
	)}
>
	<span class="avatar">{getInitials(authorName)}</span>
	<div class="message-content">
		<div class="flex min-h-6 flex-wrap items-center gap-2 max-md:gap-1.5">
			<strong class="text-[15px] max-md:text-[14px]">{authorName}</strong><span
				class="rounded-[4px] bg-secondary px-1.5 py-px text-[11px] font-semibold text-muted-foreground max-md:text-[10px]"
				>{roleLabel}</span
			><time
				class="ml-auto text-[11px] text-muted-foreground max-lg:m-0 max-lg:w-full max-md:text-[10px]"
				>{timestampLabel}</time
			>
		</div>
		{#if caption}<p class="mb-2 text-[12px] text-muted-foreground">{caption}</p>{/if}
		{#if isInternal}<p class="mt-1 flex items-center gap-[5px] text-[11px] text-muted-foreground">
				<LockKeyhole size={13} /> Internal note · only visible to support team
			</p>{/if}
		<TicketContent
			content={body}
			class="message-body mt-1.5 text-[14px] leading-[1.65] wrap-anywhere wide:text-[15px]"
		/>
	</div>
</article>
