<!--
	The inbox: everything on a ticket that needs the person's attention, newest first. Opening
	an item reads it; it can also be marked read here without opening the ticket.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { afterNavigate, invalidate } from '$app/navigation';
	import { Check, CheckCheck } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { NOTIFICATION_ACTION_LABELS, NotificationKind } from '$lib/notifications';
	import { TICKET_STATUSES, type Status } from '$lib/status';
	import { cn } from '$lib/utils';
	import { formatDateTime } from '../tickets/[[id]]/ticket-formatting';

	let { data } = $props();

	// The sidebar's unread count loads once for the whole app, so it's refreshed here, where a
	// person comes to see what's new.
	afterNavigate(({ from }) => {
		if (from) void invalidate('app:notifications');
	});

	const FILTER_LINK_CLASS = 'rounded-[18px] px-3 py-1.5 text-[13px] text-muted-foreground';

	type InboxNotification = (typeof data.notifications)[number];

	/** The end of the line, after the ticket, such as "to Resolved" for a status change. */
	function describeOutcome(inboxNotification: InboxNotification): string {
		if (inboxNotification.kind !== NotificationKind.STATUS) return '';
		const nextStatus = TICKET_STATUSES[inboxNotification.details.to as Status];
		return nextStatus ? ` to ${nextStatus.label}` : '';
	}
</script>

<svelte:head><title>Inbox · Ticket System</title></svelte:head>

<div class="flex h-full flex-col overflow-hidden">
	<header
		class="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b border-border px-6 py-3 max-md:px-4"
	>
		<h1 class="mr-auto">Inbox</h1>
		<nav class="flex gap-1" aria-label="Inbox filter">
			<a
				class={cn(FILTER_LINK_CLASS, data.isUnreadOnly && 'bg-selected font-[650] text-primary')}
				href="/app/inbox"
				aria-current={data.isUnreadOnly ? 'page' : undefined}>Unread</a
			><a
				class={cn(FILTER_LINK_CLASS, !data.isUnreadOnly && 'bg-selected font-[650] text-primary')}
				href="/app/inbox?show=all"
				aria-current={data.isUnreadOnly ? undefined : 'page'}>All</a
			>
		</nav>
		{#if data.notifications.some((inboxNotification) => !inboxNotification.readAt)}<form
				method="POST"
				action="?/markAllRead"
				use:enhance
			>
				<Button type="submit" variant="outline" size="pill-sm"
					><CheckCheck size={15} /> Mark all read</Button
				>
			</form>{/if}
	</header>
	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if data.notifications.length}<ul class="max-w-[860px]">
				{#each data.notifications as inboxNotification (inboxNotification.id)}<li
						class={cn(
							'flex items-center gap-3 border-b border-border px-6 py-3 max-md:px-4',
							!inboxNotification.readAt && 'bg-selected/40'
						)}
					>
						<span
							class={cn(
								'size-2 shrink-0 rounded-full',
								inboxNotification.readAt ? 'bg-transparent' : 'bg-primary'
							)}
							aria-hidden="true"
						></span>
						<a class="min-w-0 flex-1" href={`/app/tickets/${inboxNotification.ticketNumber}`}>
							<p class="text-[14px] leading-[1.5]">
								<strong class="font-[650]">{inboxNotification.actorName ?? 'Someone'}</strong>
								{NOTIFICATION_ACTION_LABELS[inboxNotification.kind]}
								<span class="font-[650]">#{inboxNotification.ticketNumber}</span>{describeOutcome(
									inboxNotification
								)}
							</p>
							<p class="truncate text-[13px] text-muted-foreground">
								{inboxNotification.ticketSubject} · {formatDateTime(inboxNotification.createdAt)}
								{#if !inboxNotification.readAt}<span class="sr-only"> · Unread</span>{/if}
							</p>
						</a>
						{#if !inboxNotification.readAt}<form method="POST" action="?/markRead" use:enhance>
								<input type="hidden" name="notificationId" value={inboxNotification.id} />
								<TooltipIconButton label="Mark read" type="submit"
									><Check size={18} /></TooltipIconButton
								>
							</form>{/if}
					</li>{/each}
			</ul>
			{#if data.olderPageHref || !data.isFirstPage}<nav
					class="flex max-w-[860px] gap-4 px-6 py-4 text-[13px] max-md:px-4"
					aria-label="Inbox pages"
				>
					{#if !data.isFirstPage}<a
							class="text-link"
							href={data.isUnreadOnly ? '/app/inbox' : '/app/inbox?show=all'}>Newest</a
						>{/if}
					{#if data.olderPageHref}<a class="text-link" href={data.olderPageHref}
							>Older notifications</a
						>{/if}
				</nav>{/if}{:else}<EmptyState
				title={data.isUnreadOnly ? 'You’re all caught up.' : 'Nothing here yet.'}
				isPane
			>
				{#snippet description()}New comments, assignments and status changes on your tickets show up
					here.{/snippet}
			</EmptyState>{/if}
	</div>
</div>
