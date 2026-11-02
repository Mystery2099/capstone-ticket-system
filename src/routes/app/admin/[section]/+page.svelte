<script lang="ts">
	import { createHotkeysAttachment } from '@tanstack/svelte-hotkeys';
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { ArrowLeft, Inbox, Plus, X } from '@lucide/svelte';
	import Combobox from '$lib/components/Combobox.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { getInitials } from '$lib/status';
	import { getDrafts } from '$lib/ticket-draft.svelte';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	const roleOptions = [
		{ value: 'requester', label: 'Requester' },
		{ value: 'agent', label: 'Agent' },
		{ value: 'admin', label: 'Administrator' }
	];
	const roleLabel = (role: string | null) =>
		roleOptions.find((roleOption) => roleOption.value === role)?.label ?? 'Requester';
	const accountStateOptions = [
		{ value: 'true', label: 'Enabled' },
		{ value: 'false', label: 'Disabled' }
	];
	const categoryStateOptions = [
		{ value: 'true', label: 'Active' },
		{ value: 'false', label: 'Inactive' }
	];

	let filterText = $state('');
	let roleFilter = $state('');
	let stateFilter = $state('');
	// Never part of a draft, so a password can't end up in localStorage.
	let password = $state('');
	let promotedDraftId = $state<string | null>(null);
	let addFormElement = $state<HTMLFormElement>();

	let isUsersSection = $derived(data.section === 'users');
	let recordNoun = $derived(isUsersSection ? 'user' : 'category');
	let listHref = $derived(page.url.pathname);
	// The URL holds the open record, so links and the back button work like tickets.
	let isAddingRecord = $derived(page.url.searchParams.has('new'));
	let selectedRecordId = $derived(page.url.searchParams.get('id'));
	let selectedUser = $derived(
		isUsersSection ? data.users.find((user) => user.id === selectedRecordId) : undefined
	);
	let selectedCategory = $derived(
		isUsersSection
			? undefined
			: data.categories.find((category) => category.id === selectedRecordId)
	);
	let isPaneOpen = $derived(isAddingRecord || !!selectedUser || !!selectedCategory);

	const adminDrafts = getDrafts();
	// Shallow routing leaves page.url as it was, so the draft just added is tracked here.
	let draftId = $derived(page.url.searchParams.get('draft') ?? promotedDraftId);
	let userDraft = $derived(adminDrafts.users.findById(draftId) ?? adminDrafts.users.blankDraft);
	let categoryDraft = $derived(
		adminDrafts.categories.findById(draftId) ?? adminDrafts.categories.blankDraft
	);
	$effect(() => {
		if (!isAddingRecord || navigating.to) return;
		const store = isUsersSection ? adminDrafts.users : adminDrafts.categories;
		const draft = isUsersSection ? userDraft : categoryDraft;
		if (draft !== store.blankDraft || !draft.isDirty) return;
		const url = new URL(page.url);
		url.searchParams.set('draft', draft.id);
		promotedDraftId = draft.id;
		store.promoteBlankDraft();
		replaceState(url, {});
	});
	afterNavigate(() => {
		promotedDraftId = null;
		password = '';
	});

	const matchesFilterText = (text: string) =>
		text.toLowerCase().includes(filterText.trim().toLowerCase());
	let filteredUsers = $derived(
		data.users.filter(
			(user) =>
				matchesFilterText(`${user.name} ${user.email}`) &&
				(!roleFilter || user.role === roleFilter) &&
				(!stateFilter || String(!user.banned) === stateFilter)
		)
	);
	let filteredCategories = $derived(
		data.categories.filter(
			(category) =>
				matchesFilterText(category.name) &&
				(!stateFilter || String(category.active) === stateFilter)
		)
	);

	type FormResultMessage = { text: string; failed?: boolean; createdId?: string };

	/**
	 * Shared form behavior. Values stay put after submitting, and results become toasts, with
	 * failures staying until dismissed. Field errors show beside their input instead.
	 */
	const buildFormOptions = (onCreated?: () => void) => ({
		resetForm: false,
		taintedMessage: false,
		onUpdated({ form }: { form: { message?: FormResultMessage } }) {
			if (!form.message) return;
			const { text, failed, createdId } = form.message;
			if (failed) toast.error(text, { duration: Infinity });
			else toast.success(text);
			if (createdId) {
				onCreated?.();
				void goto(`?id=${createdId}`);
			}
		}
	});

	// Create forms are bound to their draft, so only their errors and status are used here.
	// svelte-ignore state_referenced_locally
	const createUserForm = superForm(
		data.createUserForm,
		buildFormOptions(() => adminDrafts.users.discardById(userDraft.id))
	);
	const { enhance: enhanceCreateUser, submitting: isCreatingUser } = createUserForm;
	// svelte-ignore state_referenced_locally
	const createCategoryForm = superForm(
		data.createCategoryForm,
		buildFormOptions(() => adminDrafts.categories.discardById(categoryDraft.id))
	);
	const { enhance: enhanceCreateCategory, submitting: isCreatingCategory } = createCategoryForm;

	// svelte-ignore state_referenced_locally
	const updateUserForm = superForm(data.updateUserForm, buildFormOptions());
	const { form: userFields, enhance: enhanceUpdateUser, submitting: isSavingUser } = updateUserForm;
	// svelte-ignore state_referenced_locally
	const updateCategoryForm = superForm(data.updateCategoryForm, buildFormOptions());
	const {
		form: categoryFields,
		enhance: enhanceUpdateCategory,
		submitting: isSavingCategory
	} = updateCategoryForm;

	/** Loads the saved record into its form, for opening it and for Revert. */
	function revertUser() {
		if (!selectedUser) return;
		const { id, name, email, role, banned } = selectedUser;
		updateUserForm.reset({
			data: {
				id,
				name,
				email,
				role: (role ?? 'requester') as typeof $userFields.role,
				enabled: !banned
			}
		});
	}
	function revertCategory() {
		if (!selectedCategory) return;
		const { id, name, active } = selectedCategory;
		updateCategoryForm.reset({ data: { id, name, active } });
	}
	$effect(() => {
		// Read these selections so the effect resets forms when either changes.
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		selectedUser;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		selectedCategory;
		untrack(() => {
			revertUser();
			revertCategory();
		});
	});

	const createFormHotkeys = createHotkeysAttachment(
		[
			{ hotkey: 'Mod+Enter', callback: () => addFormElement?.requestSubmit() },
			{
				hotkey: 'Escape',
				callback: () => {
					void goto(listHref);
				}
			}
		],
		() => ({
			enabled: isAddingRecord && !$isCreatingUser && !$isCreatingCategory,
			ignoreInputs: false
		})
	);
</script>

{#snippet detailsToolbar(title: string, subtitle: string)}
	<div class="reading-toolbar">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<a
						{...props}
						href={listHref}
						class="icon-button back"
						aria-label={`Back to ${recordNoun} list`}><ArrowLeft size={21} /></a
					>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={6}>{`Back to ${recordNoun} list`}</Tooltip.Content>
		</Tooltip.Root>
		<div class="ticket-title">
			<h1>{title}</h1>
			<p class="ticket-dates">{subtitle}</p>
		</div>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<a {...props} href={listHref} class="icon-button compose-close" aria-label="Close"
						><X size={20} /></a
					>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={6}>Close details</Tooltip.Content>
		</Tooltip.Root>
	</div>
{/snippet}

{#snippet formFooter(
	isSubmitting: boolean,
	primaryLabel: string,
	workingLabel: string,
	secondaryAction: { label: string; hint?: string; run: () => void }
)}
	<div class="composer-footer admin-actions">
		{#if secondaryAction.hint}
			<span class="muted small compose-hint">{secondaryAction.hint}</span>
		{/if}
		<Button variant="ghost" size="sm" class="rounded-full px-4" onclick={secondaryAction.run}
			>{secondaryAction.label}</Button
		>
		<Button type="submit" size="sm" class="rounded-full px-4" disabled={isSubmitting}
			>{isSubmitting ? workingLabel : primaryLabel}</Button
		>
	</div>
{/snippet}

<div class="workspace" class:has-ticket={isPaneOpen}>
	<section class="ticket-list" aria-label={isUsersSection ? 'User list' : 'Category list'}>
		<div class="list-top">
			<h1>
				{isUsersSection ? 'Users' : 'Categories'}
				<span>{isUsersSection ? filteredUsers.length : filteredCategories.length}</span>
			</h1>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<a {...props} href="?new" class="icon-button" aria-label={`Add ${recordNoun}`}
							><Plus size={20} /></a
						>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" sideOffset={6}>Add {recordNoun}</Tooltip.Content>
			</Tooltip.Root>
		</div>
		<div class="filters admin-filters">
			<Input
				aria-label={`Filter ${isUsersSection ? 'users' : 'categories'}`}
				placeholder="Filter"
				bind:value={filterText}
				class="h-8 min-h-8 min-w-0 flex-1 rounded-lg px-2 font-normal"
			/>
			{#if isUsersSection}
				<Combobox
					label="Filter by role"
					bind:value={roleFilter}
					options={[{ value: '', label: 'Any role' }, ...roleOptions]}
				/>
				<Combobox
					label="Filter by account state"
					bind:value={stateFilter}
					options={[{ value: '', label: 'Any state' }, ...accountStateOptions]}
				/>
			{:else}
				<Combobox
					label="Filter by state"
					bind:value={stateFilter}
					options={[{ value: '', label: 'Any state' }, ...categoryStateOptions]}
				/>
			{/if}
		</div>
		<div class="rows">
			{#if isUsersSection}
				{#each filteredUsers as user (user.id)}<a
						href={`?id=${user.id}`}
						class="ticket-row"
						class:selected={selectedUser?.id === user.id}
						><span class="avatar row-avatar">{getInitials(user.name)}</span>
						<div class="row-content">
							<div class="row-title">
								<strong>{user.name}</strong><time>{roleLabel(user.role)}</time>
							</div>
							<div class="row-meta">
								<span class="row-preview">{user.email}{user.banned ? ' · Disabled' : ''}</span>
							</div>
						</div></a
					>{:else}<div class="empty">
						<Inbox size={36} />
						<h2>No users here</h2>
						<p>Try another search or change your filters.</p>
					</div>{/each}
			{:else}
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
					>{:else}<div class="empty">
						<Inbox size={36} />
						<h2>No categories here</h2>
						<p>Try another search or change your filters.</p>
					</div>{/each}
			{/if}
		</div>
	</section>

	<section class="reading-pane" aria-label={isUsersSection ? 'User details' : 'Category details'}>
		{#if isAddingRecord && isUsersSection}
			{@render detailsToolbar('Add user', 'Accounts are created here, not by public sign-up')}
			{#key userDraft.id}
				<form
					bind:this={addFormElement}
					{@attach createFormHotkeys}
					class="compose"
					method="POST"
					action="?/createUser"
					use:enhanceCreateUser
				>
					<div class="conversation-scroll admin-form">
						<FormField
							form={createUserForm}
							name="name"
							label="Display name"
							autofocus
							bind:value={userDraft.name}
							required
							maxlength={100}
						/>
						<FormField
							form={createUserForm}
							name="email"
							label="Email"
							type="email"
							bind:value={userDraft.email}
							required
							maxlength={254}
						/>
						<FormField
							form={createUserForm}
							name="password"
							label="Initial password"
							type="password"
							bind:value={password}
							required
							minlength={12}
							maxlength={128}
							autocomplete="new-password"
							description="At least 12 characters. Share directly with the account holder. Passwords aren’t saved in drafts."
						/>
						<div class="ticket-metadata">
							<div class="metadata-control">
								<span>Role</span><Combobox
									name="role"
									label="Role"
									bind:value={userDraft.role}
									options={roleOptions}
								/>
							</div>
						</div>
					</div>
					{@render formFooter($isCreatingUser, 'Create account', 'Creating…', {
						label: 'Discard',
						hint: 'Esc to close · Ctrl/Cmd+Enter to create',
						run: () => {
							adminDrafts.users.discardById(userDraft.id);
							void goto(listHref);
						}
					})}
				</form>
			{/key}
		{:else if isAddingRecord}
			{@render detailsToolbar(
				'Add category',
				'New categories are active and available on new tickets straight away'
			)}
			{#key categoryDraft.id}
				<form
					bind:this={addFormElement}
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
					{@render formFooter($isCreatingCategory, 'Add category', 'Adding…', {
						label: 'Discard',
						hint: 'Esc to close · Ctrl/Cmd+Enter to create',
						run: () => {
							adminDrafts.categories.discardById(categoryDraft.id);
							void goto(listHref);
						}
					})}
				</form>
			{/key}
		{:else if selectedUser}
			{@render detailsToolbar(
				selectedUser.name,
				`${selectedUser.email} · ${roleLabel(selectedUser.role)}`
			)}
			<form class="compose" method="POST" action="?/updateUser" use:enhanceUpdateUser>
				<input type="hidden" name="id" value={$userFields.id} />
				<div class="conversation-scroll admin-form">
					<div class="ticket-metadata">
						<div class="metadata-control">
							<span>Role</span><Combobox
								name="role"
								label="Role"
								bind:value={
									() => $userFields.role,
									(role) => ($userFields.role = role as typeof $userFields.role)
								}
								options={roleOptions}
							/>
						</div>
						<div class="metadata-control">
							<span>Account</span><Combobox
								name="enabled"
								label="Account"
								bind:value={
									() => String($userFields.enabled),
									(selectedState) => ($userFields.enabled = selectedState === 'true')
								}
								options={accountStateOptions}
							/>
						</div>
					</div>
					<FormField
						form={updateUserForm}
						name="name"
						label="Display name"
						bind:value={$userFields.name}
						required
						maxlength={100}
					/>
					<FormField
						form={updateUserForm}
						name="email"
						label="Email"
						type="email"
						bind:value={$userFields.email}
						required
						maxlength={254}
					/>
					<p class="muted small">
						Disabled accounts can’t sign in. Their tickets and comments are kept.
					</p>
				</div>
				{@render formFooter($isSavingUser, 'Save', 'Saving…', { label: 'Revert', run: revertUser })}
			</form>
		{:else if selectedCategory}
			{@render detailsToolbar(
				selectedCategory.name,
				selectedCategory.active ? 'Active' : 'Inactive'
			)}
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
								options={categoryStateOptions}
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
				{@render formFooter($isSavingCategory, 'Save', 'Saving…', {
					label: 'Revert',
					run: revertCategory
				})}
			</form>
		{:else}
			<div class="reading-empty">
				<span class="empty-icon"><Inbox size={35} /></span>
				<h2>{isUsersSection ? 'Choose a user' : 'Choose a category'}</h2>
				<p>Select one from the list to edit it,<br />or add a new one.</p>
			</div>
		{/if}
	</section>
</div>
