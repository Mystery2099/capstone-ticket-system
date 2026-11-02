<script lang="ts">
	import '../app.css';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { onMount } from 'svelte';
	import { watchThemePreference } from '$lib/theme';
	onMount(watchThemePreference);
	let { children } = $props();
</script>

<svelte:head
	><title>Ticket System</title><meta
		name="description"
		content="Capstone support ticket workspace"
	/></svelte:head
>
<Toaster position="bottom-right" closeButton mobileOffset={{ bottom: '84px' }} />
<Tooltip.Provider delayDuration={400}>
	{@render children()}
</Tooltip.Provider>
