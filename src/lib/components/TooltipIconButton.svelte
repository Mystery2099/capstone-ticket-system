<!--
	A round icon control with a tooltip. The label is both the accessible name and the
	tooltip text unless a separate tooltip is given. Renders a link when an href is given
	or asLink is set (a link with no href and aria-disabled shows as unavailable).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { mergeProps } from 'bits-ui';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

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
		side = 'bottom',
		class: className = 'icon-button',
		href,
		children,
		...restProps
	}: TooltipIconButtonProps = $props();
	let rendersAsLink = $derived(asLink || href !== undefined);
	// bits-ui merges event handlers so the tooltip still closes when the control is clicked.
	let elementProps = $derived(restProps as Record<string, unknown>);
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			{#if rendersAsLink}
				<a {...mergeProps(props, elementProps)} {href} class={className} aria-label={label}
					>{@render children()}</a
				>
			{:else}
				<button
					{...mergeProps(props, elementProps)}
					type="button"
					class={className}
					aria-label={label}>{@render children()}</button
				>
			{/if}
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content {side} sideOffset={6}>{tooltip}</Tooltip.Content>
</Tooltip.Root>
