<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import Combobox from '$lib/components/Combobox.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import { createComposeFormHotkeys } from '$lib/compose-hotkeys';
	import { DraftUrlBinding } from '$lib/draft-url.svelte';
	import { getDrafts } from '$lib/drafts.svelte';
	import AdminDetailsToolbar from './AdminDetailsToolbar.svelte';
	import AdminEmptyList from './AdminEmptyList.svelte';
	import AdminFormFooter from './AdminFormFooter.svelte';
	import AdminWorkspace from './AdminWorkspace.svelte';
	import {
		ACTIVE_STATE_OPTIONS,
		CREATE_FORM_HINT,
		buildAdminFormOptions,
		matchesFilterText
	} from './administration';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let filterText = $state('');
	let activeFilter = $state('');
	let createFormElement = $state<HTMLFormElement>();

	let listHref = $derived(page.url.pathname);
	// The URL holds the open record, so links and the back button work like tickets.
	let isCreateCategoryPaneOpen = $derived(page.url.searchParams.has('new'));
	let selectedCategory = $derived(
		data.categories.find((category) => category.id === page.url.searchParams.get('id'))
	);
	let filteredCategories = $derived(
		data.categories.filter(
			(category) =>
				matchesFilterText(category.name, filterText) &&
				(!activeFilter || String(category.active) === activeFilter)
		)
	);

	const categoryDrafts = getDrafts().categories;
	const draftBinding = new DraftUrlBinding(categoryDrafts, {
		isComposing: () => isCreateCategoryPaneOpen,
		isNavigating: () => !!navigating.to
	});
	let categoryDraft = $derived(draftBinding.activeDraft);

	// The create form is bound to its draft, so only its errors and status are used here.
	// svelte-ignore state_referenced_locally
	const createCategoryForm = superForm(
		data.createCategoryForm,
		buildAdminFormOptions(() => categoryDrafts.discardById(categoryDraft.id))
	);
	const { enhance: enhanceCreateCategory, submitting: isCreatingCategory } = createCategoryForm;
	// svelte-ignore state_referenced_locally
	const updateCategoryForm = superForm(data.updateCategoryForm, buildAdminFormOptions());
	const {
		form: categoryFields,
		enhance: enhanceUpdateCategory,
		submitting: isSavingCategory
	} = updateCategoryForm;

	/** Loads the saved category into the form, for opening it and for Revert. */
	function revertCategory(): void {
		if (!selectedCategory) return;
		const { id, name, active } = selectedCategory;
		updateCategoryForm.reset({ data: { id, name, active } });
	}
	$effect(() => {
		// Read the selection so the form resets whenever it changes.
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		selectedCategory;
		untrack(revertCategory);
	});

	const createFormHotkeys = createComposeFormHotkeys(
		() => createFormElement,
		() => listHref,
		() => isCreateCategoryPaneOpen && !$isCreatingCategory
	);
</script>

<AdminWorkspace
	title="Categories"
	recordNoun="category"
	recordCount={filteredCategories.length}
	isPaneOpen={isCreateCategoryPaneOpen || !!selectedCategory}
	bind:filterText
>
	{#snippet filters()}
		<Combobox
			label="Filter by state"
			bind:value={activeFilter}
			options={[{ value: '', label: 'Any state' }, ...ACTIVE_STATE_OPTIONS]}
		/>
	{/snippet}
	{#snippet rows()}
		{#each filteredCategories as category (category.id)}<a
				href={`?id=${category.id}`}
				class="ticket-row"
				class:selected={selectedCategory?.id === category.id}
				><div class="row-content">
					<div class="row-title"><strong>{category.name}</strong></div>
					<div class="row-meta">
						<span class="row-preview">{category.active ? 'Active' : 'Inactive'}</span>
					</div>
				</div></a
			>{:else}<AdminEmptyList pluralNoun="categories" />{/each}
	{/snippet}
	{#snippet pane()}
		{#if isCreateCategoryPaneOpen}
			<AdminDetailsToolbar
				title="Add category"
				subtitle="New categories are active and available on new tickets straight away"
				recordNoun="category"
				{listHref}
			/>
			{#key categoryDraft.id}
				<form
					bind:this={createFormElement}
					{@attach createFormHotkeys}
					class="compose"
					method="POST"
					action="?/saveCategory"
					use:enhanceCreateCategory
				>
					<input type="hidden" name="id" value="" />
					<input type="hidden" name="active" value="true" />
					<div class="conversation-scroll admin-form">
						<FormField
							form={createCategoryForm}
							name="name"
							label="Category name"
							autofocus
							bind:value={categoryDraft.name}
							required
							maxlength={80}
						/>
					</div>
					<AdminFormFooter
						isSubmitting={$isCreatingCategory}
						submitLabel="Add category"
						submittingLabel="Adding…"
						secondaryLabel="Discard"
						hint={CREATE_FORM_HINT}
						onSecondaryAction={() => {
							categoryDrafts.discardById(categoryDraft.id);
							void goto(listHref);
						}}
					/>
				</form>
			{/key}
		{:else if selectedCategory}
			<AdminDetailsToolbar
				title={selectedCategory.name}
				subtitle={selectedCategory.active ? 'Active' : 'Inactive'}
				recordNoun="category"
				{listHref}
			/>
			<form class="compose" method="POST" action="?/saveCategory" use:enhanceUpdateCategory>
				<input type="hidden" name="id" value={$categoryFields.id} />
				<div class="conversation-scroll admin-form">
					<div class="ticket-metadata">
						<div class="metadata-control">
							<span>State</span><Combobox
								name="active"
								label="State"
								bind:value={
									() => String($categoryFields.active),
									(selectedState) => ($categoryFields.active = selectedState === 'true')
								}
								options={ACTIVE_STATE_OPTIONS}
							/>
						</div>
					</div>
					<FormField
						form={updateCategoryForm}
						name="name"
						label="Category name"
						bind:value={$categoryFields.name}
						required
						maxlength={80}
					/>
					<p class="muted small">
						Inactive categories stay on existing tickets but can’t be chosen for new ones.
					</p>
				</div>
				<AdminFormFooter
					isSubmitting={$isSavingCategory}
					submitLabel="Save"
					submittingLabel="Saving…"
					secondaryLabel="Revert"
					onSecondaryAction={revertCategory}
				/>
			</form>
		{/if}
	{/snippet}
</AdminWorkspace>
