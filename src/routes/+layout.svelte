<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	onMount(() => {
		const apply = () => {
			const theme = localStorage.getItem('ticket-theme') || 'system';
			document.documentElement.dataset.theme =
				theme === 'system'
					? matchMedia('(prefers-color-scheme: dark)').matches
						? 'dark'
						: 'light'
					: theme;
		};
		apply();
		const media = matchMedia('(prefers-color-scheme: dark)');
		media.addEventListener('change', apply);
		return () => media.removeEventListener('change', apply);
	});
	let { children } = $props();
</script>

<svelte:head
	><title>Ticket System</title><meta
		name="description"
		content="Capstone support ticket workspace"
	/></svelte:head
>
{@render children()}
