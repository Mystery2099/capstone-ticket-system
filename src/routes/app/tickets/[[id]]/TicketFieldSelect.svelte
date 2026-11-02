<!--
	A ticket field that saves as soon as a value is picked. The picked value shows straight
	away and stays until the server has answered.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Combobox from '$lib/components/Combobox.svelte';
	import type { SelectOption } from './ticket-types';

	type TicketFieldSelectProps = {
		field: string;
		label: string;
		value: string;
		options: SelectOption[];
		disabled: boolean;
	};
	let { field, label, value, options, disabled }: TicketFieldSelectProps = $props();
	let pendingValue = $state<string | null>(null);
	let displayedValue = $derived(pendingValue ?? value);
</script>

<form
	method="POST"
	action="?/update"
	use:enhance={({ formData }) => {
		pendingValue = String(formData.get('value'));
		return async ({ update }) => {
			await update({ reset: false });
			pendingValue = null;
		};
	}}
	class="metadata-control"
>
	<input type="hidden" name="field" value={field} /><span>{label}</span>
	<Combobox
		name="value"
		{label}
		{options}
		value={displayedValue}
		variant="inline"
		statusCode={field === 'statusCode' ? displayedValue : undefined}
		{disabled}
		submitOnSelect
	/>
</form>
