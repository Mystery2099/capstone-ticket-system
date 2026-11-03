<!--
	Lists every keyboard shortcut the app offers, read from the central hotkey definitions so
	the list never drifts from what the keys actually do.
-->
<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { HOTKEY_GROUPS, getHotkeyKeyLabels } from '$lib/hotkeys';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0"
		/>
		<DialogPrimitive.Content
			class="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[14px] border border-border bg-popover p-6 text-sm text-popover-foreground shadow-lg duration-150 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
		>
			<DialogPrimitive.Title class="text-base font-medium text-foreground"
				>Keyboard shortcuts</DialogPrimitive.Title
			>
			<DialogPrimitive.Description class="text-muted-foreground"
				>Ctrl/Cmd means Cmd on a Mac and Ctrl everywhere else.</DialogPrimitive.Description
			>
			{#each HOTKEY_GROUPS as hotkeyGroup (hotkeyGroup.title)}
				<section class="flex flex-col gap-1">
					<h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
						{hotkeyGroup.title}
					</h3>
					<dl class="flex flex-col">
						{#each hotkeyGroup.hotkeys as hotkeyDefinition (hotkeyDefinition.hotkey)}
							<div class="flex items-center justify-between gap-4 py-1.5">
								<dt>{hotkeyDefinition.description}</dt>
								<dd class="flex shrink-0 items-center gap-1">
									{#each getHotkeyKeyLabels(hotkeyDefinition.hotkey) as keyLabel, keyIndex (keyIndex)}
										<kbd
											class="min-w-6 rounded-sm border border-input px-1.5 py-0.5 text-center font-sans text-xs"
											>{keyLabel}</kbd
										>
									{/each}
								</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/each}
			<DialogPrimitive.Close>
				{#snippet child({ props })}
					<Button variant="ghost" class="absolute top-3 right-3" size="icon-sm" {...props}>
						<XIcon />
						<span class="sr-only">Close</span>
					</Button>
				{/snippet}
			</DialogPrimitive.Close>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
