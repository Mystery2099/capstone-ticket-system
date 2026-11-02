<!--
	Dropdown that behaves like a form field: with a `name`, its value is submitted through an
	input of that name. Lists of five or more options get a search box. The list is only
	rendered while open, so a screen full of these stays cheap however long the options are.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils';

	type Props = {
		label: string;
		options: { value: string; label: string }[];
		name?: string;
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		required?: boolean;
		submitOnSelect?: boolean;
		class?: string;
		onchange?: (value: string) => void;
	};
	let {
		label,
		options,
		name,
		value = $bindable(''),
		placeholder = label,
		disabled = false,
		required = false,
		submitOnSelect = false,
		class: className,
		onchange
	}: Props = $props();

	let isOpen = $state(false);
	let triggerElement = $state<HTMLButtonElement | null>(null);
	let listElement = $state<HTMLElement | null>(null);
	let isSearchVisible = $derived(options.length >= 5);
	let selectedLabel = $derived(options.find((option) => option.value === value)?.label);

	async function selectOption(nextValue: string) {
		isOpen = false;
		if (nextValue === value) return;
		value = nextValue;
		onchange?.(nextValue);
		// The form input has to hold the new value before the form submits.
		await tick();
		if (submitOnSelect) triggerElement?.form?.requestSubmit();
	}

	// Plain label matching. The default fuzzy score would also match against internal ids.
	const matchOptionLabel = (_value: string, searchText: string, keywords?: string[]) =>
		keywords?.[0].toLowerCase().includes(searchText.trim().toLowerCase()) ? 1 : 0;
</script>

{#if name}
	<!-- Hidden inputs skip validation, so a required field uses a clipped text input instead. -->
	<input
		class={required ? 'sr-only' : undefined}
		type={required ? 'text' : 'hidden'}
		tabindex={required ? -1 : undefined}
		aria-hidden={required ? 'true' : undefined}
		{name}
		{value}
		{required}
		oninput={(event) => (event.currentTarget.value = value)}
	/>
{/if}
<Popover.Root bind:open={isOpen}>
	<Popover.Trigger
		bind:ref={triggerElement}
		class={cn('combobox-trigger', className)}
		aria-label={label}
		{disabled}
	>
		<span>{selectedLabel ?? placeholder}</span><ChevronDown size={16} />
	</Popover.Trigger>
	<Popover.Content
		align="start"
		class="w-(--bits-popover-anchor-width) min-w-52 gap-0 p-0"
		onOpenAutoFocus={(event) => {
			// Without a search box, the list needs focus for the arrow keys to reach it.
			if (isSearchVisible) return;
			event.preventDefault();
			listElement?.focus();
		}}
		onCloseAutoFocus={(event) => {
			event.preventDefault();
			triggerElement?.focus();
		}}
	>
		<Command.Root bind:ref={listElement} filter={matchOptionLabel} tabindex={-1}>
			{#if isSearchVisible}
				<Command.Input
					placeholder={`Search ${label.toLowerCase()}…`}
					aria-label={`Search ${label}`}
				/>
			{/if}
			<Command.List>
				<Command.Empty>No matches</Command.Empty>
				<Command.Group>
					{#each options as option (option.value)}
						<Command.Item
							value={option.value || option.label}
							keywords={[option.label]}
							data-checked={option.value === value}
							onSelect={() => selectOption(option.value)}>{option.label}</Command.Item
						>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
