<!--
	Shown where a list or the reading pane has nothing in it. The pane variant fills the pane
	and puts its icon in a circle; the list variant sits among the rows.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Inbox } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	type EmptyStateProps = {
		title: string;
		description: Snippet;
		isPane?: boolean;
		/** Anything below the description, such as a link or a count. */
		children?: Snippet;
	};
	let { title, description, isPane = false, children }: EmptyStateProps = $props();
</script>

<div
	class={cn(
		'flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground',
		isPane && 'flex-1'
	)}
>
	{#if isPane}
		<span class="mb-2 grid size-20 place-items-center rounded-full bg-muted text-primary"
			><Inbox size={35} /></span
		>
	{:else}
		<Inbox size={36} />
	{/if}
	<h2 class={cn(isPane && 'text-foreground')}>{title}</h2>
	<p class={cn(isPane && 'mb-2.5 text-[13px] leading-[1.7]')}>{@render description()}</p>
	{@render children?.()}
</div>
