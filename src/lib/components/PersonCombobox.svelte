<!--
	Searchable person picker that works like a form field: the choice is submitted through a
	hidden input named `name`. Set `submitOnSelect` to submit the surrounding form on change.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';

	type Props = {
		name: string;
		label: string;
		options: { value: string; label: string }[];
		value?: string;
		disabled?: boolean;
		submitOnSelect?: boolean;
	};
	let {
		name,
		label,
		options,
		value = $bindable(''),
		disabled = false,
		submitOnSelect = false
	}: Props = $props();

	let open = $state(false);
	let trigger = $state<HTMLButtonElement | null>(null);
	let selected = $derived(options.find((option) => option.value === value)?.label);

	async function choose(next: string) {
		open = false;
		if (next === value) return;
		value = next;
		// The hidden input has to hold the new value before the form submits.
		await tick();
		if (submitOnSelect) trigger?.form?.requestSubmit();
	}

	// Plain name matching. The default fuzzy score would also match against internal ids.
	const matchName = (_value: string, search: string, keywords?: string[]) =>
		keywords?.[0].toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0;
</script>

<input type="hidden" {name} {value} />
<Popover.Root bind:open>
	<Popover.Trigger bind:ref={trigger} class="combobox-trigger" aria-label={label} {disabled}>
		<span>{selected ?? label}</span><ChevronDown size={16} />
	</Popover.Trigger>
	<Popover.Content
		align="start"
		class="w-(--bits-popover-anchor-width) min-w-60 gap-0 p-0"
		onCloseAutoFocus={(event) => {
			event.preventDefault();
			trigger?.focus();
		}}
	>
		<Command.Root filter={matchName}>
			<Command.Input
				placeholder={`Search ${label.toLowerCase()}…`}
				aria-label={`Search ${label}`}
			/>
			<Command.List>
				<Command.Empty>No matches</Command.Empty>
				<Command.Group>
					{#each options as option (option.value)}
						<Command.Item
							value={option.value || option.label}
							keywords={[option.label]}
							data-checked={option.value === value}
							onSelect={() => choose(option.value)}>{option.label}</Command.Item
						>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
