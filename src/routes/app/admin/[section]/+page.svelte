<script lang="ts">
	import CategoryAdministration from './CategoryAdministration.svelte';
	import UserAdministration from './UserAdministration.svelte';

	let { data } = $props();
</script>

{#if data.section === 'users'}
	<UserAdministration {data} />
{:else}
	<CategoryAdministration {data} />
{/if}
