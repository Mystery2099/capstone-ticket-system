<script lang="ts">
	import RoleAdministration from './RoleAdministration.svelte';
	import CategoryAdministration from './CategoryAdministration.svelte';
	import UserAdministration from './UserAdministration.svelte';

	let { data, form } = $props();
</script>

{#if data.section === 'users'}
	<UserAdministration {data} />
{:else if data.section === 'roles'}
	<RoleAdministration {data} {form} />
{:else}
	<CategoryAdministration {data} />
{/if}
