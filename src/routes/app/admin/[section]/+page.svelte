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
	import { initials } from '$lib/status';
	import { getDrafts } from '$lib/ticket-draft.svelte';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	const roles = [
		{ value: 'requester', label: 'Requester' },
		{ value: 'agent', label: 'Agent' },
		{ value: 'admin', label: 'Administrator' }
	];
	const roleLabel = (role: string | null) =>
		roles.find((r) => r.value === role)?.label ?? 'Requester';
	const accountStates = [
		{ value: 'true', label: 'Enabled' },
		{ value: 'false', label: 'Disabled' }
	];
	const categoryStates = [
		{ value: 'true', label: 'Active' },
		{ value: 'false', label: 'Inactive' }
	];

	let filterText = $state('');
	let roleFilter = $state('');
	let stateFilter = $state('');
	// Never part of a draft, so a password can't end up in localStorage.
	let password = $state('');
	let promotedId = $state<string | null>(null);
	let addForm = $state<HTMLFormElement>();

	let isUsers = $derived(data.section === 'users');
	let recordNoun = $derived(isUsers ? 'user' : 'category');
	let listHref = $derived(page.url.pathname);
	// The URL holds the open record, so links and the back button work like tickets.
	let isAddingRecord = $derived(page.url.searchParams.has('new'));
	let selectedRecordId = $derived(page.url.searchParams.get('id'));
	let selectedUser = $derived(
		isUsers ? data.users.find((u) => u.id === selectedRecordId) : undefined
	);
	let selectedCategory = $derived(
		isUsers ? undefined : data.categories.find((c) => c.id === selectedRecordId)
	);
	let paneOpen = $derived(isAddingRecord || !!selectedUser || !!selectedCategory);

	const adminDrafts = getDrafts();
	// Shallow routing leaves page.url as it was, so the draft just added is tracked here.
	let draftId = $derived(page.url.searchParams.get('draft') ?? promotedId);
	let userDraft = $derived(adminDrafts.users.find(draftId) ?? adminDrafts.users.blank);
	let categoryDraft = $derived(
		adminDrafts.categories.find(draftId) ?? adminDrafts.categories.blank
	);
	$effect(() => {
		if (!isAddingRecord || navigating.to) return;
		const store = isUsers ? adminDrafts.users : adminDrafts.categories;
		const draft = isUsers ? userDraft : categoryDraft;
		if (draft !== store.blank || !draft.dirty) return;
		const url = new URL(page.url);
		url.searchParams.set('draft', draft.id);
		promotedId = draft.id;
		store.promote();
		replaceState(url, {});
	});
	afterNavigate(() => {
		promotedId = null;
		password = '';
	});

	const matches = (text: string) => text.toLowerCase().includes(filterText.trim().toLowerCase());
	let users = $derived(
		data.users.filter(
			(u) =>
				matches(`${u.name} ${u.email}`) &&
				(!roleFilter || u.role === roleFilter) &&
				(!stateFilter || String(!u.banned) === stateFilter)
		)
	);
	let categories = $derived(
		data.categories.filter(
			(c) => matches(c.name) && (!stateFilter || String(c.active) === stateFilter)
		)
	);

	type Result = { text: string; failed?: boolean; createdId?: string };

	/**
	 * Shared form behavior. Values stay put after submitting, and results become toasts, with
	 * failures staying until dismissed. Field errors show beside their input instead.
	 */
	const formOptions = (onCreated?: () => void) => ({
		resetForm: false,
		taintedMessage: false,
		onUpdated({ form }: { form: { message?: Result } }) {
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
		formOptions(() => adminDrafts.users.discard(userDraft.id))
	);
	const { enhance: enhanceCreateUser, submitting: creatingUser } = createUserForm;
	// svelte-ignore state_referenced_locally
	const createCategoryForm = superForm(
		data.createCategoryForm,
		formOptions(() => adminDrafts.categories.discard(categoryDraft.id))
	);
	const { enhance: enhanceCreateCategory, submitting: creatingCategory } = createCategoryForm;

	// svelte-ignore state_referenced_locally
	const userForm = superForm(data.userForm, { ...formOptions(), dataType: 'json' });
	const { form: userFields, enhance: enhanceUser, submitting: savingUser } = userForm;
	// svelte-ignore state_referenced_locally
	const categoryForm = superForm(data.categoryForm, { ...formOptions(), dataType: 'json' });
	const {
		form: categoryFields,
		enhance: enhanceCategory,
		submitting: savingCategory
	} = categoryForm;

	/** Loads the saved record into its form, for opening it and for Revert. */
	function revertUser() {
		if (!selectedUser) return;
		const { id, name, email, role, banned } = selectedUser;
		userForm.reset({
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
		categoryForm.reset({ data: { id, name, active } });
	}
	// Background invalidation can replace rows with identical objects. Only reset
	// the editor when saved values change, so it cannot erase an in-progress edit.
	const savedUser = $derived(JSON.stringify(selectedUser));
	const savedCategory = $derived(JSON.stringify(selectedCategory));
	$effect(() => {
		savedUser;
		savedCategory;
		untrack(() => {
			revertUser();
			revertCategory();
		});
	});

	const createFormHotkeys = createHotkeysAttachment(
		[
			{ hotkey: 'Mod+Enter', callback: () => addForm?.requestSubmit() },
			{
				hotkey: 'Escape',
				callback: () => {
					void goto(listHref);
				}
			}
		],
		() => ({ enabled: isAddingRecord && !$creatingUser && !$creatingCategory, ignoreInputs: false })
	);
</script>

{#snippet toolbar(title: string, subtitle: string)}
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

{#snippet footer(
	submitting: boolean,
	primary: string,
	working: string,
	secondary: { label: string; hint?: string; run: () => void }
)}
	<div class="composer-footer admin-actions">
		{#if secondary.hint}
			<span class="muted small compose-hint">{secondary.hint}</span>
		{/if}
		<Button variant="ghost" size="sm" class="rounded-full px-4" onclick={secondary.run}
			>{secondary.label}</Button
		>
		<Button type="submit" size="sm" class="rounded-full px-4" disabled={submitting}
			>{submitting ? working : primary}</Button
		>
	</div>
{/snippet}

<div class="workspace" class:has-ticket={paneOpen}>
	<section class="ticket-list" aria-label={isUsers ? 'User list' : 'Category list'}>
		<div class="list-top">
			<h1>
				{isUsers ? 'Users' : 'Categories'}
				<span>{isUsers ? users.length : categories.length}</span>
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
				aria-label={`Filter ${isUsers ? 'users' : 'categories'}`}
				placeholder="Filter"
				bind:value={filterText}
				class="h-8 min-h-8 min-w-0 flex-1 rounded-lg px-2 font-normal"
			/>
			{#if isUsers}
				<Combobox
					label="Filter by role"
					bind:value={roleFilter}
					options={[{ value: '', label: 'Any role' }, ...roles]}
				/>
				<Combobox
					label="Filter by account state"
					bind:value={stateFilter}
					options={[{ value: '', label: 'Any state' }, ...accountStates]}
				/>
			{:else}
				<Combobox
					label="Filter by state"
					bind:value={stateFilter}
					options={[{ value: '', label: 'Any state' }, ...categoryStates]}
				/>
			{/if}
		</div>
		<div class="rows">
			{#if isUsers}
				{#each users as u (u.id)}<a
						href={`?id=${u.id}`}
						class="ticket-row"
						class:selected={selectedUser?.id === u.id}
						><span class="avatar row-avatar">{initials(u.name)}</span>
						<div class="row-content">
							<div class="row-title">
								<strong>{u.name}</strong><time>{roleLabel(u.role)}</time>
							</div>
							<div class="row-meta">
								<span class="row-preview">{u.email}{u.banned ? ' · Disabled' : ''}</span>
							</div>
						</div></a
					>{:else}<div class="empty">
						<Inbox size={36} />
						<h2>No users here</h2>
						<p>Try another search or change your filters.</p>
					</div>{/each}
			{:else}
				{#each categories as c (c.id)}<a
						href={`?id=${c.id}`}
						class="ticket-row"
						class:selected={selectedCategory?.id === c.id}
						><div class="row-content">
							<div class="row-title"><strong>{c.name}</strong></div>
							<div class="row-meta">
								<span class="row-preview">{c.active ? 'Active' : 'Inactive'}</span>
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

	<section class="reading-pane" aria-label={isUsers ? 'User details' : 'Category details'}>
		{#if isAddingRecord && isUsers}
			{@render toolbar('Add user', 'Accounts are created here, not by public sign-up')}
			{#key userDraft.id}
				<form
					bind:this={addForm}
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
									options={roles}
								/>
							</div>
						</div>
					</div>
					{@render footer($creatingUser, 'Create account', 'Creating…', {
						label: 'Discard',
						hint: 'Esc to close · Ctrl/Cmd+Enter to create',
						run: () => {
							adminDrafts.users.discard(userDraft.id);
							void goto(listHref);
						}
					})}
				</form>
			{/key}
		{:else if isAddingRecord}
			{@render toolbar(
				'Add category',
				'New categories are active and available on new tickets straight away'
			)}
			{#key categoryDraft.id}
				<form
					bind:this={addForm}
					{@attach createFormHotkeys}
					class="compose"
					method="POST"
					action="?/category"
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
					{@render footer($creatingCategory, 'Add category', 'Adding…', {
						label: 'Discard',
						hint: 'Esc to close · Ctrl/Cmd+Enter to create',
						run: () => {
							adminDrafts.categories.discard(categoryDraft.id);
							void goto(listHref);
						}
					})}
				</form>
			{/key}
		{:else if selectedUser}
			{@render toolbar(
				selectedUser.name,
				`${selectedUser.email} · ${roleLabel(selectedUser.role)}`
			)}
			<form class="compose" method="POST" action="?/user" use:enhanceUser>
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
								options={roles}
							/>
						</div>
						<div class="metadata-control">
							<span>Account</span><Combobox
								name="enabled"
								label="Account"
								bind:value={
									() => String($userFields.enabled),
									(state) => ($userFields.enabled = state === 'true')
								}
								options={accountStates}
							/>
						</div>
					</div>
					<FormField
						form={userForm}
						name="name"
						label="Display name"
						bind:value={$userFields.name}
						required
						maxlength={100}
					/>
					<FormField
						form={userForm}
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
				{@render footer($savingUser, 'Save', 'Saving…', { label: 'Revert', run: revertUser })}
			</form>
		{:else if selectedCategory}
			{@render toolbar(selectedCategory.name, selectedCategory.active ? 'Active' : 'Inactive')}
			<form class="compose" method="POST" action="?/category" use:enhanceCategory>
				<input type="hidden" name="id" value={$categoryFields.id} />
				<div class="conversation-scroll admin-form">
					<div class="ticket-metadata">
						<div class="metadata-control">
							<span>State</span><Combobox
								name="active"
								label="State"
								bind:value={
									() => String($categoryFields.active),
									(state) => ($categoryFields.active = state === 'true')
								}
								options={categoryStates}
							/>
						</div>
					</div>
					<FormField
						form={categoryForm}
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
				{@render footer($savingCategory, 'Save', 'Saving…', {
					label: 'Revert',
					run: revertCategory
				})}
			</form>
		{:else}
			<div class="reading-empty">
				<span class="empty-icon"><Inbox size={35} /></span>
				<h2>{isUsers ? 'Choose a user' : 'Choose a category'}</h2>
				<p>Select one from the list to edit it,<br />or add a new one.</p>
			</div>
		{/if}
	</section>
</div>
