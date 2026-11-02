<script lang="ts">
	import { Menu } from '@lucide/svelte';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';

	const sidebar = useSidebar();
</script>

<TooltipIconButton
	label="Toggle navigation"
	class="icon-button max-md:absolute max-md:top-[19px] max-md:left-[26px] max-md:z-2"
	onclick={sidebar.toggle}><Menu /></TooltipIconButton
>
