<script lang="ts">
	import { signOutSession } from '$lib/auth-client';
	import { onMount } from 'svelte';
	import { LogOut } from '@lucide/svelte';
	import { getInitials, getRoleLabel } from '$lib/person';
	import { readThemePreference, saveThemePreference, type ThemePreference } from '$lib/theme';
	import { Button } from '$lib/components/ui/button/index.js';
	let { data } = $props();
	const THEME_OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
		{ value: 'system', label: 'Follow system', hint: '(default)' },
		{ value: 'light', label: 'Light', hint: '' },
		{ value: 'dark', label: 'Dark', hint: '' }
	];
	let themePreference = $state<ThemePreference>('system');
	let isSigningOut = $state(false);
	function selectThemePreference(selectedThemePreference: ThemePreference): void {
		themePreference = selectedThemePreference;
		saveThemePreference(selectedThemePreference);
	}
	onMount(() => {
		themePreference = readThemePreference();
	});
	async function signOut(): Promise<void> {
		isSigningOut = true;
		await signOutSession();
		isSigningOut = false;
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
				{#each THEME_OPTIONS as option (option.value)}<label
						><input
							type="radio"
							name="theme"
							value={option.value}
							checked={themePreference === option.value}
							onchange={() => selectThemePreference(option.value)}
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
					<span class="avatar">{getInitials(data.user.name)}</span>
					<div>
						<strong>{data.user.name}</strong>
						<p>
							{data.user.email} ·
							{getRoleLabel(data.user.role)}
						</p>
					</div>
				</div>
				<Button
					variant="outline"
					size="pill"
					class="mt-5"
					onclick={signOut}
					disabled={isSigningOut}
				>
					<LogOut size={16} />
					{isSigningOut ? 'Signing out…' : 'Sign out'}
				</Button>
			</div>
		</section>
	</div>
</div>
