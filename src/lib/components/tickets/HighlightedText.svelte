<script lang="ts">
	let {
		segments,
		fallbackText
	}: { segments: { text: string; isMatch: boolean }[] | null; fallbackText: string } = $props();
</script>

{#if segments}{#each segments as segment, index (index)}{#if segment.isMatch}<mark
				class="rounded-[3px] bg-[color-mix(in_oklab,var(--primary)_18%,transparent)] text-inherit"
				>{segment.text}</mark
			>{:else}{segment.text}{/if}{/each}{:else}{fallbackText}{/if}
