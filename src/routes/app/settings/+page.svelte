<script lang="ts">
	import { signOutSession } from '$lib/auth-client';
	import { onMount } from 'svelte';
	import { LogOut } from '@lucide/svelte';
	import { getInitials } from '$lib/person';
	import {
		readPalettePreference,
		readThemePreference,
		savePalettePreference,
		saveThemePreference,
		type ThemePreference
	} from '$lib/theme';
	import { Button } from '$lib/components/ui/button/index.js';
	import SettingRow from '$lib/components/settings/SettingRow.svelte';
	import SettingsLayout from '$lib/components/settings/SettingsLayout.svelte';
	let { data } = $props();
	const THEME_OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
		{ value: 'system', label: 'Follow system', hint: '(default)' },
		{ value: 'light', label: 'Light', hint: '' },
		{ value: 'dark', label: 'Dark', hint: '' }
	];
	let themePreference = $state<ThemePreference>('system');
	let isClassicPalette = $state(false);
	let isSigningOut = $state(false);
	function selectThemePreference(selectedThemePreference: ThemePreference): void {
		themePreference = selectedThemePreference;
		saveThemePreference(selectedThemePreference);
	}
	function toggleClassicPalette(isEnabled: boolean): void {
		isClassicPalette = isEnabled;
		savePalettePreference(isEnabled ? 'classic' : 'plum');
	}
	onMount(() => {
		themePreference = readThemePreference();
		isClassicPalette = readPalettePreference() === 'classic';
	});
	async function signOut(): Promise<void> {
		isSigningOut = true;
		await signOutSession();
		isSigningOut = false;
	}
</script>

<SettingsLayout title="Settings">
	<SettingRow title="Appearance" description="Remembered in this browser.">
		<fieldset class="m-0 flex flex-col gap-1 border-0 p-0" aria-label="Appearance">
			{#each THEME_OPTIONS as option (option.value)}<label
					class="-mx-2.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] transition-colors hover:bg-muted has-focus-visible:bg-muted"
					><input
						type="radio"
						name="theme"
						value={option.value}
						checked={themePreference === option.value}
						onchange={() => selectThemePreference(option.value)}
						class="m-0 size-[19px] min-h-0 accent-primary"
					/>{option.label} <span class="muted small">{option.hint}</span></label
				>{/each}
		</fieldset>
	</SettingRow>
	<SettingRow title="Colors" description="Remembered in this browser.">
		<label
			class="-mx-2.5 flex cursor-pointer items-center gap-3 self-start rounded-lg px-2.5 py-2 text-[14px] transition-colors hover:bg-muted has-focus-visible:bg-muted"
			><input
				type="checkbox"
				role="switch"
				class="switch"
				checked={isClassicPalette}
				onchange={(event) => toggleClassicPalette(event.currentTarget.checked)}
			/><span
				>Classic colors <span class="muted small block"
					>Plain grays and blue instead of plum and apricot</span
				></span
			></label
		>
	</SettingRow>
	<SettingRow title="Account" description="Managed by an administrator.">
		<div>
			<div class="flex items-center gap-3.5">
				<span class="avatar size-12 text-base">{getInitials(data.user.name)}</span>
				<div>
					<strong class="text-[14px]">{data.user.name}</strong>
					<p class="text-[12px] leading-[1.6] wrap-anywhere text-muted-foreground">
						{data.user.email} ·
						{data.user.roleName ?? 'Unknown role'}
					</p>
				</div>
			</div>
			<Button variant="outline" size="pill" class="mt-5" onclick={signOut} disabled={isSigningOut}>
				<LogOut size={16} />
				{isSigningOut ? 'Signing out…' : 'Sign out'}
			</Button>
		</div>
	</SettingRow>
</SettingsLayout>
