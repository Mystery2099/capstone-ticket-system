<!-- A field change in a ticket's timeline, such as "changed status from Open to Resolved". -->
<script lang="ts">
	import { ArrowRightLeft } from '@lucide/svelte';
	import StatusBadge from '$lib/components/tickets/StatusBadge.svelte';
	import { TICKET_STATUSES, TicketEventType, type Status } from '$lib/status';
	import type { TicketDirectory } from './ticket-directory';
	import { formatDateTime } from './ticket-formatting';
	import type { TicketEventRecord } from './ticket-types';

	const FIELD_NAMES: Record<string, string> = {
		assignedToUserId: 'assignee',
		categoryId: 'category',
		priority: 'priority'
	};

	let { event, directory }: { event: TicketEventRecord; directory: TicketDirectory } = $props();
	let isStatusChange = $derived(event.eventType === TicketEventType.STATUS);

	/** How a field's old or new value reads in the timeline. */
	function describeFieldValue(value: unknown): string {
		switch (event.eventType) {
			case TicketEventType.STATUS:
				return TICKET_STATUSES[value as Status]?.label || String(value);
			case 'assignedToUserId':
				return value ? directory.getPersonName(value as string) : 'Unassigned';
			case 'categoryId':
				return directory.getCategoryName(value as string);
			default:
				return (value as string) || 'Unassigned';
		}
	}
</script>

<div
	class="flex items-center gap-3.5 border-b border-border px-2 py-2.5 text-[12px] leading-[1.8] text-muted-foreground max-md:gap-2.5 max-md:px-0 max-md:text-[11px]"
>
	<span class="grid size-7 shrink-0 place-items-center rounded-full bg-muted"
		><ArrowRightLeft size={15} /></span
	>
	<p>
		<strong class="font-semibold text-foreground">{directory.getPersonName(event.actorId)}</strong>
		changed {isStatusChange ? 'status' : FIELD_NAMES[event.eventType] || event.eventType}
		from
		<span>{describeFieldValue(event.details.from)}</span>
		to {#if isStatusChange}<StatusBadge
				status={String(event.details.to)}
				class="text-[11px]"
			/>{:else}<strong class="font-semibold text-foreground"
				>{describeFieldValue(event.details.to)}</strong
			>{/if}
		<span class="muted">· {formatDateTime(event.createdAt)}</span>
	</p>
</div>
