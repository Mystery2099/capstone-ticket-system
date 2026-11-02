<script lang="ts">
	let {
		segments,
		fallbackText
	}: { segments: { text: string; isMatch: boolean }[] | null; fallbackText: string } = $props();
</script>

{#if segments}{#each segments as segment, index (index)}{#if segment.isMatch}<mark
				class="search-match">{segment.text}</mark
			>{:else}{segment.text}{/if}{/each}{:else}{fallbackText}{/if}
