<!--
	Gives any control a tooltip. The `trigger` snippet renders the control and must spread the
	props it receives onto it; they carry the tooltip's handlers and attributes. Other props,
	such as `onclick`, are merged into those props by the tooltip trigger.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	type TooltipWrapperProps = {
		content: string;
		side?: 'top' | 'right' | 'bottom' | 'left';
		sideOffset?: number;
		trigger: Snippet<[Record<string, unknown>]>;
		[triggerProp: string]: unknown;
	};
	let {
		content,
		side = 'bottom',
		sideOffset = 6,
		trigger,
		...triggerProps
	}: TooltipWrapperProps = $props();
	// Touch screens have no hover, so a tooltip would only open on a tap or focus. An open tooltip
	// also absorbs the next outside tap, which kept the mobile navigation from closing.
	const canHover = new MediaQuery('(hover: hover)');
</script>

<Tooltip.Root disabled={!canHover.current}>
	<Tooltip.Trigger {...triggerProps}>
		{#snippet child({ props })}{@render trigger(props)}{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content {side} {sideOffset}>{content}</Tooltip.Content>
</Tooltip.Root>
