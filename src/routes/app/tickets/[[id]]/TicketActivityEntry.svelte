<!--
	One line in a ticket's timeline for a change, such as "changed status from Open to Resolved"
	or "edited the description". Changes the same person made one after another arrive together
	and share the line, as "changed status Open → Resolved · priority Normal → High".
-->
<script lang="ts">
	import { ArrowRightLeft, Pencil } from '@lucide/svelte';
	import StatusBadge from '$lib/components/tickets/StatusBadge.svelte';
	import { TICKET_STATUSES, TicketEventType, type Status } from '$lib/status';
	import type { TicketDirectory } from './ticket-directory';
	import { formatDateTime } from './ticket-formatting';
	import type { TicketEventRecord } from './ticket-types';

	const FIELD_NAMES: Record<string, string> = {
		[TicketEventType.STATUS]: 'status',
		assignedToUserId: 'assignee',
		categoryId: 'category',
		priority: 'priority',
		[TicketEventType.SUBJECT]: 'subject'
	};

	let { events, directory }: { events: TicketEventRecord[]; directory: TicketDirectory } = $props();
	let firstEvent = $derived(events[0]);
	let lastEvent = $derived(events[events.length - 1]);
	let isGrouped = $derived(events.length > 1);
	let isOnlyContentEdits = $derived(events.every(isContentEdit));

	function isContentEdit(event: TicketEventRecord): boolean {
		return (
			event.eventType === TicketEventType.SUBJECT || event.eventType === TicketEventType.DESCRIPTION
		);
	}

	/** How a field's old or new value reads in the timeline. */
	function describeFieldValue(eventType: string, value: unknown): string {
		switch (eventType) {
			case TicketEventType.STATUS:
				return TICKET_STATUSES[value as Status]?.label || String(value);
			case 'assignedToUserId':
				return value ? directory.getPersonName(value as string) : 'Unassigned';
			case 'categoryId':
				return directory.getCategoryName(value as string);
			case 'priority':
				return String(value).charAt(0).toUpperCase() + String(value).slice(1);
			default:
				return (value as string) || 'Unassigned';
		}
	}
</script>

<div
	class="flex items-center gap-3.5 border-b border-border px-2 py-2.5 text-[12px] leading-[1.8] text-muted-foreground max-md:gap-2.5 max-md:px-0 max-md:text-[11px]"
>
	<span class="grid size-7 shrink-0 place-items-center rounded-full bg-muted"
		>{#if isOnlyContentEdits}<Pencil size={14} />{:else}<ArrowRightLeft size={15} />{/if}</span
	>
	{#if !isGrouped && firstEvent.eventType === TicketEventType.DESCRIPTION}<p>
			<strong class="font-semibold text-foreground"
				>{directory.getPersonName(firstEvent.actorId)}</strong
			>
			edited the description
			<span class="muted">· {formatDateTime(firstEvent.createdAt)}</span>
		</p>{:else if !isGrouped}<p>
			<strong class="font-semibold text-foreground"
				>{directory.getPersonName(firstEvent.actorId)}</strong
			>
			changed {FIELD_NAMES[firstEvent.eventType] || firstEvent.eventType}
			from
			<span>{describeFieldValue(firstEvent.eventType, firstEvent.details.from)}</span>
			to {#if firstEvent.eventType === TicketEventType.STATUS}<StatusBadge
					status={String(firstEvent.details.to)}
					class="text-[11px]"
				/>{:else}<strong class="font-semibold text-foreground"
					>{describeFieldValue(firstEvent.eventType, firstEvent.details.to)}</strong
				>{/if}
			<span class="muted">· {formatDateTime(firstEvent.createdAt)}</span>
		</p>{:else}<div class="min-w-0">
			<p>
				<strong class="font-semibold text-foreground"
					>{directory.getPersonName(firstEvent.actorId)}</strong
				>
				made {events.length} changes
				<span class="muted">· {formatDateTime(lastEvent.createdAt)}</span>
			</p>
			<ul class="flex flex-wrap gap-x-4 gap-y-0.5">
				{#each events as event (event.id)}<li
						class="inline-flex min-w-0 flex-wrap items-center gap-x-1"
					>
						{#if event.eventType === TicketEventType.DESCRIPTION}edited the description{:else}<span
								>{FIELD_NAMES[event.eventType] || event.eventType}</span
							>
							<span>{describeFieldValue(event.eventType, event.details.from)}</span>
							<span aria-label="to">→</span>
							{#if event.eventType === TicketEventType.STATUS}<StatusBadge
									status={String(event.details.to)}
									class="text-[11px]"
								/>{:else}<strong class="font-semibold wrap-anywhere text-foreground"
									>{describeFieldValue(event.eventType, event.details.to)}</strong
								>{/if}{/if}
					</li>{/each}
			</ul>
		</div>{/if}
</div>
