<!--
	Who a new comment notifies, inside the reply form. It starts as one line naming the ticket's
	followers; "Change" opens checkboxes for everyone connected to the ticket, right in place.
	Support staff can also choose to follow the ticket. The server checks every choice again.
-->
<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { Bell } from '@lucide/svelte';
	import type { NotificationAudience, NotificationAudienceMember } from './ticket-types';

	type TicketNotifyRecipientsProps = {
		audience: NotificationAudience;
		currentUserId: string;
		isInternalNote: boolean;
		/** Support staff choose whether to follow; requesters always follow their own tickets. */
		canChooseToFollow: boolean;
		isDisabled: boolean;
	};
	let {
		audience,
		currentUserId,
		isInternalNote,
		canChooseToFollow,
		isDisabled
	}: TicketNotifyRecipientsProps = $props();

	let isChoosing = $state(false);
	let chosenRecipientIds = $state<string[]>([]);
	let isFollowRequested = $state(true);
	afterNavigate(() => {
		isChoosing = false;
		isFollowRequested = true;
	});

	/** People this comment may notify: never the commenter, and for notes only the team. */
	let eligibleRecipients = $derived(
		audience.members.filter(
			(member) => member.id !== currentUserId && (!isInternalNote || member.canReadInternalNotes)
		)
	);
	let defaultRecipients = $derived(eligibleRecipients.filter((member) => member.isFollower));
	let notifiedRecipients = $derived(
		isChoosing
			? eligibleRecipients.filter((member) => chosenRecipientIds.includes(member.id))
			: defaultRecipients
	);
	let isCurrentUserFollowing = $derived(
		audience.members.some((member) => member.id === currentUserId && member.isFollower)
	);

	/**
	 * The names this comment notifies. Followers the commenter may not know about are only
	 * mentioned as "the support team", and only until people are chosen by hand.
	 */
	let notifiedSummary = $derived.by(() => {
		const notifiedNames = notifiedRecipients.map(describeMember);
		if (!isChoosing && audience.hasHiddenFollowers) notifiedNames.push('the support team');
		if (!notifiedNames.length) return 'nobody';
		return notifiedNames.length === 1
			? notifiedNames[0]
			: `${notifiedNames.slice(0, -1).join(', ')} and ${notifiedNames.at(-1)}`;
	});

	function startChoosing(): void {
		chosenRecipientIds = defaultRecipients.map((member) => member.id);
		isChoosing = true;
	}

	function describeMember(member: NotificationAudienceMember): string {
		if (member.isRequester) return `${member.name} (requester)`;
		if (member.isAssignee) return `${member.name} (assignee)`;
		return member.name;
	}
</script>

<div class="border-t border-border px-3 py-2 text-[12px] text-muted-foreground">
	<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
		<Bell size={14} class="shrink-0" />
		<span>Notifies: <span class="text-foreground">{notifiedSummary}</span></span>
		{#if eligibleRecipients.length && !isChoosing}<button
				type="button"
				class="text-link"
				disabled={isDisabled}
				onclick={startChoosing}>Change</button
			>{/if}
	</div>
	{#if isChoosing}<input type="hidden" name="notifySelection" value="custom" />
		<fieldset class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5" disabled={isDisabled}>
			<legend class="sr-only">People to notify</legend>
			{#each eligibleRecipients as member (member.id)}<label
					class="flex items-center gap-1.5 text-foreground"
					><input
						type="checkbox"
						name="notifyRecipientId"
						value={member.id}
						bind:group={chosenRecipientIds}
					/>{describeMember(member)}</label
				>{/each}
		</fieldset>{/if}
	{#if canChooseToFollow && !isCurrentUserFollowing}<label
			class="mt-1.5 flex w-fit items-center gap-1.5 text-foreground"
			><input
				type="checkbox"
				name="follow"
				value="true"
				bind:checked={isFollowRequested}
				disabled={isDisabled}
			/>Add me to this ticket’s notifications</label
		>{/if}
</div>
