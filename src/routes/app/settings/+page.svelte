<script lang="ts">
	import { onMount } from 'svelte';
	import { LogOut } from '@lucide/svelte';
	import { initials } from '$lib/status';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	let { data } = $props();
	let theme = $state('system'),
		signingOut = $state(false);
	function applyTheme(value: string) {
		theme = value;
		localStorage.setItem('ticket-theme', value);
		document.documentElement.dataset.theme =
			value === 'system'
				? matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light'
				: value;
	}
	onMount(() => {
		theme = localStorage.getItem('ticket-theme') || 'system';
	});
	async function signOut() {
		signingOut = true;
		await fetch('/api/auth/sign-out', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}'
		});
		await invalidateAll();
		await goto('/login');
	}
</script>

<div class="settings-design">
	<header class="admin-header"><h1>Settings</h1></header>
	<div class="settings-content">
		<section class="setting-row">
			<div>
				<h2>Appearance</h2>
				<p>Remembered in this browser.</p>
			</div>
			<fieldset class="appearance-radios" aria-label="Appearance">
				{#each [{ value: 'system', label: 'Follow system', hint: '(default)' }, { value: 'light', label: 'Light', hint: '' }, { value: 'dark', label: 'Dark', hint: '' }] as option}<label
						><input
							type="radio"
							name="theme"
							value={option.value}
							checked={theme === option.value}
							onchange={() => applyTheme(option.value)}
						/>{option.label} <span class="muted small">{option.hint}</span></label
					>{/each}
			</fieldset>
		</section>
		<section class="setting-row">
			<div>
				<h2>Account</h2>
				<p>Managed by an administrator.</p>
			</div>
			<div>
				<div class="settings-account">
					<span class="avatar">{initials(data.user.name)}</span>
					<div>
						<strong>{data.user.name}</strong>
						<p>
							{data.user.email} ·
							<span style="text-transform:capitalize"
								>{data.user.role === 'admin' ? 'Administrator' : data.user.role}</span
							>
						</p>
					</div>
				</div>
				<Button
					variant="outline"
					class="rounded-full h-9 px-5 mt-5"
					onclick={signOut}
					disabled={signingOut}
				>
					<LogOut size={16} />
					{signingOut ? 'Signing out…' : 'Sign out'}
				</Button>
			</div>
		</section>
	</div>
</div>
