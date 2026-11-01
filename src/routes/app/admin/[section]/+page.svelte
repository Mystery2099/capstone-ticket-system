<script lang="ts">
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { navigating, page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { ArrowLeft, Inbox, Plus, X } from '@lucide/svelte';
	import Combobox from '$lib/components/Combobox.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { initials } from '$lib/status';
	import { getDrafts } from '$lib/ticket-draft.svelte';

	let { data, form } = $props();

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

	let search = $state(''),
		roleFilter = $state(''),
		stateFilter = $state(''),
		revision = $state(0),
		busy = $state(''),
		// Never part of a draft, so a password can't end up in localStorage.
		password = $state(''),
		promotedId = $state<string | null>(null),
		addForm = $state<HTMLFormElement>();

	let isUsers = $derived(data.section === 'users');
	let noun = $derived(isUsers ? 'user' : 'category');
	let listHref = $derived(page.url.pathname);
	// The URL holds the open record, so links and the back button work like tickets.
	let adding = $derived(page.url.searchParams.has('new'));
	let openId = $derived(page.url.searchParams.get('id'));
	let selectedUser = $derived(isUsers ? data.users.find((u) => u.id === openId) : undefined);
	let selectedCategory = $derived(
		isUsers ? undefined : data.categories.find((c) => c.id === openId)
	);
	let paneOpen = $derived(adding || !!selectedUser || !!selectedCategory);

	const drafts = getDrafts();
	// Shallow routing leaves page.url as it was, so the draft just added is tracked here.
	let draftId = $derived(page.url.searchParams.get('draft') ?? promotedId);
	let userDraft = $derived(drafts.users.find(draftId) ?? drafts.users.blank);
	let categoryDraft = $derived(drafts.categories.find(draftId) ?? drafts.categories.blank);
	$effect(() => {
		if (!adding || navigating.to) return;
		const store = isUsers ? drafts.users : drafts.categories;
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

	const matches = (text: string) => text.toLowerCase().includes(search.trim().toLowerCase());
	let users = $derived(
		data.users.filter(
			(u) =>
				matches(`${u.name} ${u.email}`) &&
				(!roleFilter || u.role === roleFilter) &&
				(!stateFilter || String(u.enabled) === stateFilter)
		)
	);
	let categories = $derived(
		data.categories.filter(
			(c) => matches(c.name) && (!stateFilter || String(c.active) === stateFilter)
		)
	);

	/**
	 * Marks `key` busy while a form submits, then opens whatever it created. Edit forms keep
	 * their submitted values: the default reset restores HTML defaults, not saved data.
	 */
	const submit =
		(key: string, onCreated?: () => void): SubmitFunction =>
		() => {
			busy = key;
			return async ({ result, update }) => {
				await update({ reset: false });
				busy = '';
				if (result.type === 'success' && result.data?.createdId) {
					onCreated?.();
					await goto(`?id=${result.data.createdId}`);
				}
			};
		};
</script>

<svelte:window
	onkeydown={(e) => {
		if (!adding || !addForm?.contains(e.target as Node)) return;
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			addForm.requestSubmit();
		} else if (e.key === 'Escape') {
			void goto(listHref);
		}
	}}
/>

{#snippet toolbar(title: string, subtitle: string)}
	<div class="reading-toolbar">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<a {...props} href={listHref} class="icon-button back" aria-label={`Back to ${noun} list`}
						><ArrowLeft size={21} /></a
					>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" sideOffset={6}>{`Back to ${noun} list`}</Tooltip.Content>
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

{#snippet feedback()}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	{#if form?.success}<p class="success" role="status">{form.success}</p>{/if}
{/snippet}

{#snippet footer(key: string, primary: string, working: string, discard?: () => void)}
	<div class="composer-footer admin-actions">
		{#if discard}
			<span class="muted small compose-hint">Esc to close · Ctrl+Enter to create</span>
			<Button
				variant="ghost"
				size="sm"
				class="rounded-full px-4"
				onclick={() => {
					discard();
					void goto(listHref);
				}}>Discard</Button
			>
		{:else}
			<Button variant="ghost" size="sm" class="rounded-full px-4" onclick={() => revision++}
				>Revert</Button
			>
		{/if}
		<Button type="submit" size="sm" class="rounded-full px-4" disabled={busy === key}
			>{busy === key ? working : primary}</Button
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
						<a {...props} href="?new" class="icon-button" aria-label={`Add ${noun}`}
							><Plus size={20} /></a
						>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" sideOffset={6}>Add {noun}</Tooltip.Content>
			</Tooltip.Root>
		</div>
		<div class="filters admin-filters">
			<Input
				aria-label={`Filter ${isUsers ? 'users' : 'categories'}`}
				placeholder="Filter"
				bind:value={search}
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
								<span class="row-preview">{u.email}{u.enabled ? '' : ' · Disabled'}</span>
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
		{#if adding && isUsers}
			{@render toolbar('Add user', 'Accounts are created here, not by public sign-up')}
			{#key userDraft.id}
				<form
					bind:this={addForm}
					class="compose"
					method="POST"
					action="?/createUser"
					use:enhance={submit('create-user', () => drafts.users.discard(userDraft.id))}
				>
					<div class="conversation-scroll admin-form">
						<Label class="flex-col items-start gap-2">
							<!-- svelte-ignore a11y_autofocus -->
							Display name<Input
								autofocus
								name="name"
								bind:value={userDraft.name}
								required
								maxlength={100}
								class="h-9 font-normal"
							/>
						</Label>
						<Label class="flex-col items-start gap-2">
							Email<Input
								name="email"
								type="email"
								bind:value={userDraft.email}
								required
								maxlength={254}
								class="h-9 font-normal"
							/>
						</Label>
						<Label class="flex-col items-start gap-2">
							Initial password<Input
								name="password"
								type="password"
								bind:value={password}
								required
								minlength={12}
								maxlength={128}
								autocomplete="new-password"
								class="h-9 font-normal"
							/>
							<small>
								At least 12 characters. Share directly with the account holder. Passwords aren’t
								saved in drafts.
							</small>
						</Label>
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
						{@render feedback()}
					</div>
					{@render footer('create-user', 'Create account', 'Creating…', () =>
						drafts.users.discard(userDraft.id)
					)}
				</form>
			{/key}
		{:else if adding}
			{@render toolbar(
				'Add category',
				'New categories are active and available on new tickets straight away'
			)}
			{#key categoryDraft.id}
				<form
					bind:this={addForm}
					class="compose"
					method="POST"
					action="?/category"
					use:enhance={submit('create-category', () => drafts.categories.discard(categoryDraft.id))}
				>
					<div class="conversation-scroll admin-form">
						<Label class="flex-col items-start gap-2">
							<!-- svelte-ignore a11y_autofocus -->
							Category name<Input
								autofocus
								name="name"
								bind:value={categoryDraft.name}
								required
								maxlength={80}
								class="h-9 font-normal"
							/>
						</Label>
						{@render feedback()}
					</div>
					{@render footer('create-category', 'Add category', 'Adding…', () =>
						drafts.categories.discard(categoryDraft.id)
					)}
				</form>
			{/key}
		{:else if selectedUser}
			{@render toolbar(
				selectedUser.name,
				`${selectedUser.email} · ${roleLabel(selectedUser.role)}`
			)}
			{#key `${selectedUser.id}:${revision}`}
				<form class="compose" method="POST" action="?/user" use:enhance={submit('user')}>
					<input type="hidden" name="id" value={selectedUser.id} />
					<div class="conversation-scroll admin-form">
						<div class="ticket-metadata">
							<div class="metadata-control">
								<span>Role</span><Combobox
									name="role"
									label="Role"
									value={selectedUser.role ?? 'requester'}
									options={roles}
								/>
							</div>
							<div class="metadata-control">
								<span>Account</span><Combobox
									name="enabled"
									label="Account"
									value={String(selectedUser.enabled)}
									options={accountStates}
								/>
							</div>
						</div>
						<Label class="flex-col items-start gap-2">
							Display name<Input
								name="name"
								value={selectedUser.name}
								required
								maxlength={100}
								class="h-9 font-normal"
							/>
						</Label>
						<Label class="flex-col items-start gap-2">
							Email<Input
								name="email"
								type="email"
								value={selectedUser.email}
								required
								maxlength={254}
								class="h-9 font-normal"
							/>
						</Label>
						<p class="muted small">
							Disabled accounts can’t sign in. Their tickets and replies are kept.
						</p>
						{@render feedback()}
					</div>
					{@render footer('user', 'Save', 'Saving…')}
				</form>
			{/key}
		{:else if selectedCategory}
			{@render toolbar(selectedCategory.name, selectedCategory.active ? 'Active' : 'Inactive')}
			{#key `${selectedCategory.id}:${revision}`}
				<form class="compose" method="POST" action="?/category" use:enhance={submit('category')}>
					<input type="hidden" name="id" value={selectedCategory.id} />
					<div class="conversation-scroll admin-form">
						<div class="ticket-metadata">
							<div class="metadata-control">
								<span>State</span><Combobox
									name="active"
									label="State"
									value={String(selectedCategory.active)}
									options={categoryStates}
								/>
							</div>
						</div>
						<Label class="flex-col items-start gap-2">
							Category name<Input
								name="name"
								value={selectedCategory.name}
								required
								maxlength={80}
								class="h-9 font-normal"
							/>
						</Label>
						<p class="muted small">
							Inactive categories stay on existing tickets but can’t be chosen for new ones.
						</p>
						{@render feedback()}
					</div>
					{@render footer('category', 'Save', 'Saving…')}
				</form>
			{/key}
		{:else}
			<div class="reading-empty">
				<span class="empty-icon"><Inbox size={35} /></span>
				<h2>{isUsers ? 'Choose a user' : 'Choose a category'}</h2>
				<p>Select one from the list to edit it,<br />or add a new one.</p>
			</div>
		{/if}
	</section>
</div>
