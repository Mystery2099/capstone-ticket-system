<!-- The settings screen's frame: a title bar over a scrolling column of setting rows. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type SettingsLayoutProps = { title: string; contentClass?: string; children: Snippet };
	let { title, contentClass, children }: SettingsLayoutProps = $props();
</script>

<div class="flex h-full flex-col overflow-hidden">
	<header
		class="flex min-h-16 shrink-0 items-center gap-3.5 border-b border-border px-6 py-3 max-md:flex-wrap max-md:gap-2.5 max-md:px-4"
	>
		<h1 class="mr-auto">{title}</h1>
	</header>
	<div
		class={cn(
			'max-w-[760px] overflow-auto px-6 pt-1.5 pb-6 max-md:px-5 max-md:pt-0 max-md:pb-5',
			contentClass
		)}
	>
		{@render children()}
	</div>
</div>
