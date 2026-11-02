<script lang="ts">
	import { Menu } from '@lucide/svelte';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';

	const sidebar = useSidebar();
</script>

<TooltipIconButton
	label="Toggle navigation"
	class="icon-button menu-button"
	onclick={sidebar.toggle}><Menu /></TooltipIconButton
>
