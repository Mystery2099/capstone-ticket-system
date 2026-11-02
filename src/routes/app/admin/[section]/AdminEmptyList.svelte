<script lang="ts">
	import { Inbox } from '@lucide/svelte';

	let { pluralNoun }: { pluralNoun: string } = $props();
</script>

<div class="empty">
	<Inbox size={36} />
	<h2>No {pluralNoun} here</h2>
	<p>Try another search or change your filters.</p>
</div>
