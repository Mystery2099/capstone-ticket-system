<!--
	The rich-text box for descriptions, comments and internal notes. People format text with
	the toolbar or the usual shortcuts and never see Markdown. The bound value is the Markdown
	that gets saved, and a hidden input submits it with the form under the given name.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Editor } from '@tiptap/core';
	import {
		Bold,
		Code,
		Heading,
		Italic,
		Link,
		List,
		ListOrdered,
		SquareCode,
		TextQuote
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import TooltipWrapper from '$lib/components/TooltipWrapper.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { normalizeLinkTarget } from '$lib/ticket-content/ticket-content-policy';
	import { cn } from '$lib/utils';

	type TicketContentEditorProps = {
		value: string;
		name: string;
		label: string;
		placeholder: string;
		isReadOnly?: boolean;
		isInvalid?: boolean;
		describedBy?: string;
		/** Classes for the writing area, such as a minimum height. */
		contentClass?: string;
	};
	let {
		value = $bindable(),
		name,
		label,
		placeholder,
		isReadOnly = false,
		isInvalid = false,
		describedBy,
		contentClass
	}: TicketContentEditorProps = $props();

	type ToolbarAction = {
		label: string;
		shortcut: string;
		icon: Component;
		isActive: () => boolean;
		run: () => void;
	};

	let editorElement = $state<HTMLDivElement>();
	let linkButtonElement = $state<HTMLButtonElement>();
	let editor = $state.raw<Editor>();
	/** Changes on every editor transaction, so the toolbar's pressed states stay current. */
	let editorRevision = $state(0);
	/** The Markdown this editor last produced, so its own updates aren't loaded back in. */
	let lastEmittedValue = value;
	const editorId = $props.id();
	let isLinkPopoverOpen = $state(false);
	let isEditingExistingLink = $state(false);
	let linkTargetInput = $state('');
	let linkErrorMessage = $state('');

	const toolbarActions: ToolbarAction[] = [
		{
			label: 'Bold',
			shortcut: 'Ctrl/Cmd+B',
			icon: Bold,
			isActive: () => !!editor?.isActive('bold'),
			run: () => editor?.chain().focus().toggleBold().run()
		},
		{
			label: 'Italic',
			shortcut: 'Ctrl/Cmd+I',
			icon: Italic,
			isActive: () => !!editor?.isActive('italic'),
			run: () => editor?.chain().focus().toggleItalic().run()
		},
		{
			label: 'Heading',
			shortcut: 'Ctrl/Cmd+Alt+1',
			icon: Heading,
			isActive: () => !!editor?.isActive('heading'),
			run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run()
		},
		{
			label: 'Bulleted list',
			shortcut: 'Ctrl/Cmd+Shift+8',
			icon: List,
			isActive: () => !!editor?.isActive('bulletList'),
			run: () => editor?.chain().focus().toggleBulletList().run()
		},
		{
			label: 'Numbered list',
			shortcut: 'Ctrl/Cmd+Shift+7',
			icon: ListOrdered,
			isActive: () => !!editor?.isActive('orderedList'),
			run: () => editor?.chain().focus().toggleOrderedList().run()
		},
		{
			label: 'Quote',
			shortcut: 'Ctrl/Cmd+Shift+B',
			icon: TextQuote,
			isActive: () => !!editor?.isActive('blockquote'),
			run: () => editor?.chain().focus().toggleBlockquote().run()
		},
		{
			label: 'Inline code',
			shortcut: 'Ctrl/Cmd+E',
			icon: Code,
			isActive: () => !!editor?.isActive('code'),
			run: () => editor?.chain().focus().toggleCode().run()
		},
		{
			label: 'Code block',
			shortcut: 'Ctrl/Cmd+Alt+C',
			icon: SquareCode,
			isActive: () => !!editor?.isActive('codeBlock'),
			run: () => editor?.chain().focus().toggleCodeBlock().run()
		}
	];

	onMount(() => {
		let isUnmounted = false;
		let createdEditor: Editor | undefined;
		void import('$lib/ticket-content/ticket-content-editor-factory').then(
			({ createTicketContentEditor }) => {
				if (isUnmounted || !editorElement) return;
				// Read now rather than at mount, in case a draft was restored while loading.
				lastEmittedValue = value;
				createdEditor = createTicketContentEditor({
					mountElement: editorElement,
					initialValue: value,
					isEditable: !isReadOnly,
					label,
					readPlaceholderText: () => placeholder,
					// Transactions can run inside the effects below, so this must never become one of
					// their dependencies, or every transaction would trigger another one.
					onTransaction: () => {
						editorRevision = untrack(() => editorRevision) + 1;
					},
					onValueChange: (changedValue) => {
						lastEmittedValue = changedValue;
						value = changedValue;
					}
				});
				editor = createdEditor;
			}
		);
		return () => {
			isUnmounted = true;
			createdEditor?.destroy();
		};
	});

	// The form can change the text from outside, such as clearing it after a reply is sent or
	// restoring a draft. Only then is the editor reloaded, so typing keeps its cursor and undo.
	$effect(() => {
		const activeEditor = editor;
		const nextValue = value;
		if (!activeEditor || nextValue === lastEmittedValue) return;
		console.log('SCRATCH reload', JSON.stringify(lastEmittedValue), '->', JSON.stringify(nextValue), new Error().stack);
		lastEmittedValue = nextValue;
		untrack(() =>
			activeEditor.commands.setContent(nextValue, { contentType: 'markdown', emitUpdate: false })
		);
	});
	$effect(() => {
		const activeEditor = editor;
		const isEditable = !isReadOnly;
		untrack(() => activeEditor?.setEditable(isEditable, false));
	});
	// The hint follows the Comment and Internal note tabs, so redraw it when it changes.
	$effect(() => {
		const activeEditor = editor;
		void placeholder;
		untrack(() => activeEditor?.view.dispatch(activeEditor.state.tr));
	});
	$effect(() => {
		const editorSurface = editor?.view.dom;
		if (!editorSurface) return;
		editorSurface.setAttribute('aria-label', label);
		editorSurface.setAttribute('aria-invalid', String(isInvalid));
		if (describedBy) editorSurface.setAttribute('aria-describedby', describedBy);
		else editorSurface.removeAttribute('aria-describedby');
	});

	/** Reads the revision first, so Svelte rechecks the state after every transaction. */
	function isFormattingActive(isActive: () => boolean): boolean {
		void editorRevision;
		return isActive();
	}

	function isLinkActive(): boolean {
		return !!editor?.isActive('link');
	}

	function openLinkPopover(): void {
		if (!editor) return;
		isEditingExistingLink = isLinkActive();
		linkTargetInput = editor.getAttributes('link').href ?? '';
		linkErrorMessage = '';
		isLinkPopoverOpen = true;
	}

	function applyLink(event: SubmitEvent): void {
		event.preventDefault();
		if (!editor) return;
		const linkTarget = normalizeLinkTarget(linkTargetInput);
		if (!linkTarget) {
			linkErrorMessage = 'Enter a web address or an email link (mailto:).';
			return;
		}
		const linkChain = editor.chain().focus().extendMarkRange('link');
		// With nothing selected, the address itself becomes the link's text.
		if (editor.state.selection.empty && !isEditingExistingLink)
			linkChain.insertContent({
				type: 'text',
				text: linkTarget.replace(/^mailto:/i, ''),
				marks: [{ type: 'link', attrs: { href: linkTarget } }]
			});
		else linkChain.setLink({ href: linkTarget });
		linkChain.run();
		isLinkPopoverOpen = false;
	}

	function removeLink(): void {
		editor?.chain().focus().extendMarkRange('link').unsetLink().run();
		isLinkPopoverOpen = false;
	}
</script>

<div class="flex flex-1 flex-col">
	<div
		class="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1"
		role="toolbar"
		aria-label="Formatting"
	>
		{#each toolbarActions as toolbarAction (toolbarAction.label)}
			<TooltipWrapper content={`${toolbarAction.label} (${toolbarAction.shortcut})`}>
				{#snippet trigger(props)}
					<button
						{...props}
						type="button"
						class="editor-tool"
						aria-label={toolbarAction.label}
						aria-pressed={isFormattingActive(toolbarAction.isActive)}
						disabled={isReadOnly || !editor}
						onmousedown={(event) => event.preventDefault()}
						onclick={toolbarAction.run}><toolbarAction.icon size={16} /></button
					>
				{/snippet}
			</TooltipWrapper>
		{/each}
		<TooltipWrapper content="Link">
			{#snippet trigger(props)}
				<button
					{...props}
					bind:this={linkButtonElement}
					type="button"
					class="editor-tool"
					aria-label="Link"
					aria-haspopup="dialog"
					aria-pressed={isFormattingActive(isLinkActive)}
					disabled={isReadOnly || !editor}
					onmousedown={(event) => event.preventDefault()}
					onclick={openLinkPopover}><Link size={16} /></button
				>
			{/snippet}
		</TooltipWrapper>
	</div>
	<div bind:this={editorElement} class={cn('flex flex-1 flex-col', contentClass)}></div>
	<input type="hidden" {name} {value} />
</div>

<Popover.Root bind:open={isLinkPopoverOpen}>
	<Popover.Content customAnchor={linkButtonElement} align="start" aria-label="Link">
		<!-- The popover renders outside the message form, so Enter here only applies the link. -->
		<form class="flex flex-col gap-2" onsubmit={applyLink}>
			<label class="text-[12px] font-semibold" for={`${editorId}-link-target`}>Web address</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id={`${editorId}-link-target`}
				autofocus
				type="text"
				inputmode="url"
				autocomplete="url"
				placeholder="example.com"
				aria-invalid={!!linkErrorMessage}
				aria-describedby={linkErrorMessage ? `${editorId}-link-error` : undefined}
				bind:value={linkTargetInput}
			/>
			{#if linkErrorMessage}<p id={`${editorId}-link-error`} class="error" role="alert">
					{linkErrorMessage}
				</p>{/if}
			<div class="flex justify-end gap-1.5">
				{#if isEditingExistingLink}<Button variant="ghost" size="pill-sm" onclick={removeLink}
						>Remove link</Button
					>{/if}
				<Button type="submit" size="pill-sm">Apply</Button>
			</div>
		</form>
	</Popover.Content>
</Popover.Root>
