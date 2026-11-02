<script lang="ts">
	import { TICKET_STATUSES, type Status } from './status';
	let { status }: { status: string } = $props();
	let statusDefinition = $derived(TICKET_STATUSES[status as Status] || TICKET_STATUSES.open);
</script>

<span class="status {status}"
	><span aria-hidden="true">{statusDefinition.symbol}</span> {statusDefinition.label}</span
>
