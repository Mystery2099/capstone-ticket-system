<script lang="ts">
	import { TICKET_STATUSES, type Status } from '$lib/status';
	import { cn } from '$lib/utils';
	let { status, class: className }: { status: string; class?: string } = $props();
	let statusDefinition = $derived(TICKET_STATUSES[status as Status] || TICKET_STATUSES.open);
</script>

<span class={cn('status', status, className)}
	><span aria-hidden="true">{statusDefinition.symbol}</span> {statusDefinition.label}</span
>
