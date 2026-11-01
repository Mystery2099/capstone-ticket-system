<script lang="ts">
	import { statuses, type Status } from './status';
	let { status }: { status: string } = $props();
	let item = $derived(statuses[status as Status] || statuses.open);
</script>

<span class="status {status}"><span aria-hidden="true">{item.symbol}</span> {item.label}</span>
