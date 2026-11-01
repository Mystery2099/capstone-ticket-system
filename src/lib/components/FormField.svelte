<!-- A labeled text input wired to a Superforms form, with its description and errors. -->
<script lang="ts" generics="T extends Record<string, unknown>, U extends FormPath<T>">
	import type { ComponentProps } from 'svelte';
	import type { FormPath, SuperForm } from 'sveltekit-superforms';
	import * as Form from '$lib/components/ui/form/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

	type Props = Omit<ComponentProps<typeof Input>, 'form' | 'name' | 'value' | 'files'> & {
		form: SuperForm<T>;
		name: U;
		label: string;
		value?: string;
		description?: string;
	};
	let { form, name, label, value = $bindable(), description, ...inputProps }: Props = $props();
</script>

<Form.Field {form} {name}>
	<Form.Control>
		{#snippet children({ props })}
			<Form.Label>{label}</Form.Label>
			<Input {...props} {...inputProps} bind:value class="h-9 font-normal" />
		{/snippet}
	</Form.Control>
	{#if description}<Form.Description>{description}</Form.Description>{/if}
	<Form.FieldErrors />
</Form.Field>
