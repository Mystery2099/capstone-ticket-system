<script lang="ts">
	import { Menu } from '@lucide/svelte';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	const sidebar = useSidebar();
</script>

<Tooltip.Root>
	<Tooltip.Trigger onclick={sidebar.toggle}>
		{#snippet child({ props })}
			<button {...props} class="icon-button menu-button" aria-label="Toggle navigation"
				><Menu /></button
			>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content side="bottom" sideOffset={6}>Toggle navigation</Tooltip.Content>
</Tooltip.Root>
