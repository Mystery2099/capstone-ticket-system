<!-- One setting: its name and description on the left, its controls on the right. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type SettingRowProps = {
		title?: string;
		description?: string;
		/** Replaces the title and description, such as with loading placeholders. */
		heading?: Snippet;
		children: Snippet;
	};
	let { title, description, heading, children }: SettingRowProps = $props();
</script>

<section
	class="grid grid-cols-[200px_minmax(0,1fr)] gap-3 border-b border-border py-7 last:border-0 max-md:grid-cols-1 max-md:gap-5.5 max-md:py-6"
>
	<div>
		{#if heading}{@render heading()}{:else}
			<h2 class="mb-1.5 text-base">{title}</h2>
			<p class="text-[13px] leading-[1.6] text-muted-foreground max-md:text-xs">{description}</p>
		{/if}
	</div>
	{@render children()}
</section>
