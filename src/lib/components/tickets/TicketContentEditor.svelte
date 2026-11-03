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
		Redo2,
		RemoveFormatting,
		SquareCode,
		Strikethrough,
		TextQuote,
		Undo2
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import TooltipWrapper from '$lib/components/TooltipWrapper.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { HotkeyChord } from '@tanstack/svelte-hotkeys';
	import { EditorHotkeys, formatHotkeyHint } from '$lib/hotkeys';
	import { normalizeLinkTarget } from '$lib/ticket-content/ticket-content-policy';
	import { cn } from '$lib/utils';

	type TicketContentEditorProps = {
		value: string;
		name: string;
		label: string;
		placeholder: string;
		isReadOnly?: boolean;
		isInvalid?: boolean;
		/** Tells assistive technology the box must be filled in, as a required textarea would. */
		isRequired?: boolean;
		/** The most characters the saved text may have. Formatting symbols count toward it. */
		maximumLength?: number;
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
		isRequired = false,
		maximumLength,
		describedBy,
		contentClass
	}: TicketContentEditorProps = $props();

	type ToolbarAction = {
		label: string;
		/** Left out for actions with no keyboard shortcut. */
		shortcut?: HotkeyChord;
		icon: Component;
		/** Only formatting that turns on and off has this, and shows as pressed while it's on. */
		isActive?: () => boolean;
		/** Left out for actions that are always available. */
		isAvailable?: () => boolean;
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
	let hasEditorLoadFailed = $state(false);
	/**
	 * How far the text is over its limit, shown while typing. A textarea would simply stop
	 * accepting characters, but formatting can push text over, so this says so instead.
	 */
	let overLimitCharacterCount = $derived(
		maximumLength ? Math.max(0, value.trim().length - maximumLength) : 0
	);
	let lengthErrorId = $derived(overLimitCharacterCount ? `${editorId}-length-error` : undefined);
	let isLinkPopoverOpen = $state(false);
	let isEditingExistingLink = $state(false);
	let linkTargetInput = $state('');
	let linkErrorMessage = $state('');

	const toolbarActions: ToolbarAction[] = [
		{
			label: 'Bold',
			shortcut: EditorHotkeys.BOLD,
			icon: Bold,
			isActive: () => !!editor?.isActive('bold'),
			run: () => editor?.chain().focus().toggleBold().run()
		},
		{
			label: 'Italic',
			shortcut: EditorHotkeys.ITALIC,
			icon: Italic,
			isActive: () => !!editor?.isActive('italic'),
			run: () => editor?.chain().focus().toggleItalic().run()
		},
		{
			label: 'Strikethrough',
			shortcut: EditorHotkeys.STRIKETHROUGH,
			icon: Strikethrough,
			isActive: () => !!editor?.isActive('strike'),
			run: () => editor?.chain().focus().toggleStrike().run()
		},
		{
			label: 'Heading',
			shortcut: EditorHotkeys.HEADING,
			icon: Heading,
			isActive: () => !!editor?.isActive('heading'),
			run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run()
		},
		{
			label: 'Bulleted list',
			shortcut: EditorHotkeys.BULLETED_LIST,
			icon: List,
			isActive: () => !!editor?.isActive('bulletList'),
			run: () => editor?.chain().focus().toggleBulletList().run()
		},
		{
			label: 'Numbered list',
			shortcut: EditorHotkeys.NUMBERED_LIST,
			icon: ListOrdered,
			isActive: () => !!editor?.isActive('orderedList'),
			run: () => editor?.chain().focus().toggleOrderedList().run()
		},
		{
			label: 'Quote',
			shortcut: EditorHotkeys.QUOTE,
			icon: TextQuote,
			isActive: () => !!editor?.isActive('blockquote'),
			run: () => editor?.chain().focus().toggleBlockquote().run()
		},
		{
			label: 'Inline code',
			shortcut: EditorHotkeys.INLINE_CODE,
			icon: Code,
			isActive: () => !!editor?.isActive('code'),
			run: () => editor?.chain().focus().toggleCode().run()
		},
		{
			label: 'Code block',
			shortcut: EditorHotkeys.CODE_BLOCK,
			icon: SquareCode,
			isActive: () => !!editor?.isActive('codeBlock'),
			run: () => editor?.chain().focus().toggleCodeBlock().run()
		}
	];

	/** Actions on the toolbar's right side, after the link button. */
	const editingActions: ToolbarAction[] = [
		{
			label: 'Clear formatting',
			icon: RemoveFormatting,
			// Turns lists, quotes, headings and code blocks back into plain paragraphs too.
			run: () => editor?.chain().focus().unsetAllMarks().clearNodes().run()
		},
		{
			label: 'Undo',
			shortcut: EditorHotkeys.UNDO,
			icon: Undo2,
			isAvailable: () => !!editor?.can().undo(),
			run: () => editor?.chain().focus().undo().run()
		},
		{
			label: 'Redo',
			shortcut: EditorHotkeys.REDO,
			icon: Redo2,
			isAvailable: () => !!editor?.can().redo(),
			run: () => editor?.chain().focus().redo().run()
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
			},
			() => {
				// Without the editor nothing can be typed, so say so instead of showing an empty box.
				if (!isUnmounted) hasEditorLoadFailed = true;
			}
		);
		return () => {
			isUnmounted = true;
			createdEditor?.destroy();
		};
	});

	// The form can change the text from outside, such as clearing it after a reply is sent or
	// restoring a draft. Only then is the editor reloaded, so typing keeps its cursor and undo.
	// Values that differ only in surrounding whitespace count as the same text, since the form's
	// validation trims what it holds. Reloading for that would delete the space just typed.
	$effect(() => {
		const activeEditor = editor;
		const nextValue = value;
		if (!activeEditor || nextValue.trim() === lastEmittedValue.trim()) return;
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
		editorSurface.setAttribute('aria-invalid', String(isInvalid || !!overLimitCharacterCount));
		editorSurface.setAttribute('aria-required', String(isRequired));
		const describingIds = [describedBy, lengthErrorId].filter(Boolean).join(' ');
		if (describingIds) editorSurface.setAttribute('aria-describedby', describingIds);
		else editorSurface.removeAttribute('aria-describedby');
	});

	/** Reads the revision first, so Svelte rechecks the state after every transaction. */
	function isFormattingActive(isActive: () => boolean): boolean {
		void editorRevision;
		return isActive();
	}

	function isToolbarActionDisabled(toolbarAction: ToolbarAction): boolean {
		if (isReadOnly || !editor) return true;
		return toolbarAction.isAvailable ? !isFormattingActive(toolbarAction.isAvailable) : false;
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

{#snippet toolbarButton(toolbarAction: ToolbarAction)}
	<TooltipWrapper
		content={toolbarAction.shortcut
			? `${toolbarAction.label} (${formatHotkeyHint(toolbarAction.shortcut)})`
			: toolbarAction.label}
	>
		{#snippet trigger(props)}
			<button
				{...props}
				type="button"
				class="editor-tool"
				aria-label={toolbarAction.label}
				aria-pressed={toolbarAction.isActive
					? isFormattingActive(toolbarAction.isActive)
					: undefined}
				disabled={isToolbarActionDisabled(toolbarAction)}
				onmousedown={(event) => event.preventDefault()}
				onclick={toolbarAction.run}><toolbarAction.icon size={16} /></button
			>
		{/snippet}
	</TooltipWrapper>
{/snippet}

<div class="flex flex-1 flex-col">
	<div
		class="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1"
		role="toolbar"
		aria-label="Formatting"
	>
		{#each toolbarActions as toolbarAction (toolbarAction.label)}
			{@render toolbarButton(toolbarAction)}
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
		<span class="ml-auto flex items-center gap-0.5">
			{#each editingActions as editingAction (editingAction.label)}
				{@render toolbarButton(editingAction)}
			{/each}
		</span>
	</div>
	<div bind:this={editorElement} class={cn('flex flex-1 flex-col', contentClass)}>
		{#if hasEditorLoadFailed}<p class="error p-3" role="alert">
				The text box couldn’t load. Check your connection, then reload the page.
			</p>{/if}
	</div>
	{#if overLimitCharacterCount}<p id={lengthErrorId} class="error px-3 pb-1" role="alert">
			This is {overLimitCharacterCount.toLocaleString()} characters over the limit of
			{maximumLength?.toLocaleString()}. Formatting counts toward the limit.
		</p>{/if}
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
