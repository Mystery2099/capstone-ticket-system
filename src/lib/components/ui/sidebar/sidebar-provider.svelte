<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { SIDEBAR_COOKIE_MAX_AGE, SIDEBAR_COOKIE_NAME } from './constants.js';
	import { setSidebar } from './context.svelte.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		open = $bindable(true),
		onOpenChange = () => {},
		class: className,
		style,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	} = $props();

	const sidebar = setSidebar({
		open: () => open,
		setOpen: (value: boolean) => {
			open = value;
			onOpenChange(value);

			// This sets the cookie to keep the sidebar state.
			document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
		}
	});
</script>

<svelte:window onkeydown={sidebar.handleShortcutKeydown} />

<!-- Sizes and layout come from .app-shell in app.css, which also places the top bar. -->
<div
	data-slot="sidebar-wrapper"
	{style}
	class={cn('group/sidebar-wrapper', className)}
	bind:this={ref}
	{...restProps}
>
	{@render children?.()}
</div>
