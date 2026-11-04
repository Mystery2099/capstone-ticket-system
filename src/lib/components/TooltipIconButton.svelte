<!--
	A round icon control with a tooltip. The label is both the accessible name and the
	tooltip text unless a separate tooltip is given. Renders a link when an href is given
	or asLink is set (a link with no href and aria-disabled shows as unavailable).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import TooltipWrapper from './TooltipWrapper.svelte';

	type TooltipIconButtonProps = Omit<HTMLButtonAttributes & HTMLAnchorAttributes, 'children'> & {
		label: string;
		tooltip?: string;
		asLink?: boolean;
		side?: 'top' | 'right' | 'bottom' | 'left';
		children: Snippet;
	};

	let {
		label,
		tooltip = label,
		asLink = false,
		type = 'button',
		side = 'bottom',
		class: className = 'icon-button',
		href,
		disabled,
		children,
		...elementProps
	}: TooltipIconButtonProps = $props();
	let rendersAsLink = $derived(asLink || href !== undefined);
	// Disabling stays on the element. The tooltip trigger's own disabled prop works differently.
</script>

<TooltipWrapper content={tooltip} {side} {...elementProps}>
	{#snippet trigger(props)}
		{#if rendersAsLink}
			<a {...props} {href} class={className} aria-label={label}>{@render children()}</a>
		{:else}
			<button {...props} {type} class={className} {disabled} aria-label={label}
				>{@render children()}</button
			>
		{/if}
	{/snippet}
</TooltipWrapper>
