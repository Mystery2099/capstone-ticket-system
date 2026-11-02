<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import Combobox from '$lib/components/Combobox.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import { createComposeFormHotkeys } from '$lib/compose-hotkeys';
	import { DraftUrlBinding } from '$lib/draft-url.svelte';
	import { getDrafts } from '$lib/drafts.svelte';
	import { getInitials } from '$lib/person';
	import AdminDetailsToolbar from './AdminDetailsToolbar.svelte';
	import AdminFormFooter from './AdminFormFooter.svelte';
	import AdminWorkspace from './AdminWorkspace.svelte';
	import {
		CREATE_FORM_HINT,
		ENABLED_STATE_OPTIONS,
		buildAdminFormOptions,
		matchesFilterText
	} from './administration';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let roleOptions = $derived(data.roles.map((role) => ({ value: role.id, label: role.name })));
	const roleLabel = (roleId: string | null) =>
		data.roles.find((role) => role.id === roleId)?.name ?? 'Unknown role';
	let filterText = $state('');
	let roleFilter = $state('');
	let enabledFilter = $state('');
	// Never part of a draft, so a password can't end up in localStorage.
	let password = $state('');
	let createFormElement = $state<HTMLFormElement>();

	let listHref = $derived(page.url.pathname);
	// The URL holds the open record, so links and the back button work like tickets.
	let isCreateUserPaneOpen = $derived(page.url.searchParams.has('new'));
	let selectedUser = $derived(
		data.users.find((user) => user.id === page.url.searchParams.get('id'))
	);
	let filteredUsers = $derived(
		data.users.filter(
			(user) =>
				matchesFilterText(`${user.name} ${user.email}`, filterText) &&
				(!roleFilter || user.role === roleFilter) &&
				(!enabledFilter || String(!user.banned) === enabledFilter)
		)
	);

	const userDrafts = getDrafts().users;
	const draftBinding = new DraftUrlBinding(userDrafts, {
		isComposing: () => isCreateUserPaneOpen,
		isNavigating: () => !!navigating.to
	});
	let userDraft = $derived(draftBinding.activeDraft);
	$effect(() => {
		if (userDraft.role && !data.roles.some((role) => role.id === userDraft.role))
			userDraft.role = '';
	});
	afterNavigate(() => {
		password = '';
	});

	// The create form is bound to its draft, so only its errors and status are used here.
	// svelte-ignore state_referenced_locally
	const createUserForm = superForm(
		data.createUserForm,
		buildAdminFormOptions(() => userDrafts.discardById(userDraft.id))
	);
	const { enhance: enhanceCreateUser, submitting: isCreatingUser } = createUserForm;
	// svelte-ignore state_referenced_locally
	const updateUserForm = superForm(data.updateUserForm, buildAdminFormOptions());
	const { form: userFields, enhance: enhanceUpdateUser, submitting: isSavingUser } = updateUserForm;

	/** Loads the saved user into the form, for opening it and for Revert. */
	function revertUser(): void {
		if (!selectedUser) return;
		const { id, name, email, role, banned } = selectedUser;
		updateUserForm.reset({
			data: { id, name, email, role: (role ?? 'requester') as string, enabled: !banned }
		});
	}
	$effect(() => {
		// Read the selection so the form resets whenever it changes.
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		selectedUser;
		untrack(revertUser);
	});

	const createFormHotkeys = createComposeFormHotkeys(
		() => createFormElement,
		() => listHref,
		() => isCreateUserPaneOpen && !$isCreatingUser
	);
</script>

<AdminWorkspace
	title="Users"
	recordNoun="user"
	recordCount={filteredUsers.length}
	isPaneOpen={isCreateUserPaneOpen || !!selectedUser}
	bind:filterText
>
	{#snippet filters()}
		<Combobox
			label="Filter by role"
			variant="filter"
			class="shrink-0"
			bind:value={roleFilter}
			options={[{ value: '', label: 'Any role' }, ...roleOptions]}
		/>
		<Combobox
			label="Filter by account state"
			variant="filter"
			class="shrink-0"
			bind:value={enabledFilter}
			options={[{ value: '', label: 'Any state' }, ...ENABLED_STATE_OPTIONS]}
		/>
	{/snippet}
	{#snippet rows()}
		{#each filteredUsers as user (user.id)}<a
				href={`?id=${user.id}`}
				class="list-row"
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
			>{:else}<EmptyState title="No users here"
				>{#snippet description()}Try another search or change your filters.{/snippet}</EmptyState
			>{/each}
	{/snippet}
	{#snippet pane()}
		{#if isCreateUserPaneOpen}
			<AdminDetailsToolbar
				title="Add user"
				subtitle="Accounts are created here, not by public sign-up"
				recordNoun="user"
				{listHref}
			/>
			{#key userDraft.id}
				<form
					bind:this={createFormElement}
					{@attach createFormHotkeys}
					class="compose"
					method="POST"
					action="?/createUser"
					use:enhanceCreateUser
				>
					<div class="conversation-scroll flex max-w-[560px] flex-col gap-4">
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
						<div class="field-row">
							<div class="metadata-control">
								<span>Role</span><Combobox
									name="role"
									label="Role"
									variant="inline"
									bind:value={userDraft.role}
									options={roleOptions}
								/>
							</div>
						</div>
					</div>
					<AdminFormFooter
						isSubmitting={$isCreatingUser}
						submitLabel="Create account"
						submittingLabel="Creating…"
						secondaryLabel="Discard"
						hint={CREATE_FORM_HINT}
						onSecondaryAction={() => {
							userDrafts.discardById(userDraft.id);
							void goto(listHref);
						}}
					/>
				</form>
			{/key}
		{:else if selectedUser}
			<AdminDetailsToolbar
				title={selectedUser.name}
				subtitle={`${selectedUser.email} · ${roleLabel(selectedUser.role)}`}
				recordNoun="user"
				{listHref}
			/>
			<form class="compose" method="POST" action="?/updateUser" use:enhanceUpdateUser>
				<input type="hidden" name="id" value={$userFields.id} />
				<div class="conversation-scroll flex max-w-[560px] flex-col gap-4">
					<div class="field-row">
						<div class="metadata-control">
							<span>Role</span><Combobox
								name="role"
								label="Role"
								variant="inline"
								bind:value={() => $userFields.role, (role) => ($userFields.role = role as string)}
								options={roleOptions}
							/>
						</div>
						<div class="metadata-control">
							<span>Account</span><Combobox
								name="enabled"
								label="Account"
								variant="inline"
								bind:value={
									() => String($userFields.enabled),
									(selectedState) => ($userFields.enabled = selectedState === 'true')
								}
								options={ENABLED_STATE_OPTIONS}
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
				<AdminFormFooter
					isSubmitting={$isSavingUser}
					submitLabel="Save"
					submittingLabel="Saving…"
					secondaryLabel="Revert"
					onSecondaryAction={revertUser}
				/>
			</form>
		{/if}
	{/snippet}
</AdminWorkspace>
