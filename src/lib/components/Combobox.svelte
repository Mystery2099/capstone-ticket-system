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

	let open = $state(false);
	let trigger = $state<HTMLButtonElement | null>(null);
	let list = $state<HTMLElement | null>(null);
	let showSearch = $derived(options.length >= 5);
	let selected = $derived(options.find((option) => option.value === value)?.label);

	async function choose(next: string) {
		open = false;
		if (next === value) return;
		value = next;
		onchange?.(next);
		// The form input has to hold the new value before the form submits.
		await tick();
		if (submitOnSelect) trigger?.form?.requestSubmit();
	}

	// Plain label matching. The default fuzzy score would also match against internal ids.
	const matchLabel = (_value: string, search: string, keywords?: string[]) =>
		keywords?.[0].toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0;
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
<Popover.Root bind:open>
	<Popover.Trigger
		bind:ref={trigger}
		class={cn('combobox-trigger', className)}
		aria-label={label}
		{disabled}
	>
		<span>{selected ?? placeholder}</span><ChevronDown size={16} />
	</Popover.Trigger>
	<Popover.Content
		align="start"
		class="w-(--bits-popover-anchor-width) min-w-52 gap-0 p-0"
		onOpenAutoFocus={(event) => {
			// Without a search box, the list needs focus for the arrow keys to reach it.
			if (showSearch) return;
			event.preventDefault();
			list?.focus();
		}}
		onCloseAutoFocus={(event) => {
			event.preventDefault();
			trigger?.focus();
		}}
	>
		<Command.Root bind:ref={list} filter={matchLabel} tabindex={-1}>
			{#if showSearch}
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
							onSelect={() => choose(option.value)}>{option.label}</Command.Item
						>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
