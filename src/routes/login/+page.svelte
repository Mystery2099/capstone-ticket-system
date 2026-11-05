<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import TooltipWrapper from '$lib/components/TooltipWrapper.svelte';
	import { onMount } from 'svelte';
	let isHydrated = $state(false);
	onMount(() => {
		isHydrated = true;
	});
	import { Ticket, Eye, EyeOff } from '@lucide/svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	let email = $state('');
	let password = $state('');
	let isPasswordVisible = $state(false);
	let loginError = $state('');
	let isSigningIn = $state(false);
	let passwordToggleLabel = $derived(isPasswordVisible ? 'Hide password' : 'Show password');
	async function signIn(event: SubmitEvent) {
		event.preventDefault();
		isSigningIn = true;
		loginError = '';
		try {
			const { data, error } = await authClient.signIn.email({ email, password });
			if (error) {
				loginError =
					error.status === 429
						? 'Too many sign-in attempts. Please wait a minute and try again.'
						: error.status >= 500
							? 'Sign-in is temporarily unavailable. Please try again.'
							: error.status === 0
								? 'Could not connect. Please try again.'
								: 'Email or password is incorrect, or this account is unavailable.';
				return;
			}
			password = '';
			if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
				await goto('/account-security');
				return;
			}
			await invalidateAll();
			await goto('/app/tickets');
		} catch {
			loginError = 'Could not connect. Please try again.';
		} finally {
			isSigningIn = false;
		}
	}
</script>

<svelte:head><title>Sign in · Ticket System</title></svelte:head>

<main class="login-page">
	<div>
		<section class="login-card">
			<div class="login-heading">
				<span class="logo"><Ticket size={24} /></span>
				<div>
					<h1>Sign in</h1>
					<p>Ticket System help desk</p>
				</div>
			</div>
			<form onsubmit={signIn} inert={!isHydrated} aria-busy={isSigningIn}>
				<Label class="flex-col items-start gap-2">
					Email
					<Input
						disabled={!isHydrated}
						type="email"
						bind:value={email}
						autocomplete="username"
						required
						class="h-11 md:text-base font-normal"
					/>
				</Label>
				<Label class="flex-col items-start gap-2">
					Password
					<span class="password-field">
						<Input
							disabled={!isHydrated}
							type={isPasswordVisible ? 'text' : 'password'}
							bind:value={password}
							autocomplete="current-password"
							required
							class="h-11 md:text-base font-normal pr-11"
						/>
						<TooltipWrapper
							content={passwordToggleLabel}
							onclick={() => (isPasswordVisible = !isPasswordVisible)}
						>
							{#snippet trigger(props)}
								<Button
									{...props}
									variant="ghost"
									size="icon-sm"
									type="button"
									class="absolute right-1 top-1"
									aria-label={passwordToggleLabel}
								>
									{#if isPasswordVisible}<EyeOff size={19} />{:else}<Eye size={19} />{/if}
								</Button>
							{/snippet}
						</TooltipWrapper>
					</span>
				</Label>
				{#if loginError}<p class="error" role="alert">{loginError}</p>{/if}
				<Button
					type="submit"
					class="login-submit w-full h-11 rounded-full text-[15px]"
					disabled={isSigningIn || !isHydrated}
				>
					{isSigningIn ? 'Signing in…' : 'Sign in'}
				</Button>
			</form>
			<p class="login-help">Accounts are created by an administrator.</p>
		</section>
	</div>
</main>

<style>
	/* In the base layer like the rest of the app's CSS, so Tailwind utilities still win. */
	@layer base {
		.login-page {
			min-height: 100dvh;
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			place-items: center;
			padding: 32px 16px;
		}
		.login-page > div {
			justify-self: center;
			min-width: 0;
			max-width: 100%;
			width: min(440px, 100%);
		}
		.login-card {
			min-width: 0;
			padding: 32px 36px;
			background: var(--card);
			border: 1px solid var(--border);
			border-radius: 18px;
		}
		.login-heading {
			display: flex;
			align-items: center;
			gap: 14px;
			margin-bottom: 24px;
		}
		.login-heading .logo {
			width: 36px;
			height: 36px;
		}
		.login-heading h1 {
			font-size: 20px;
		}
		.login-heading p {
			color: var(--muted-fg);
			margin-top: 2px;
		}
		.login-card :global(label) {
			display: flex;
			flex-direction: column;
			gap: 8px;
			font-weight: 550;
			color: var(--muted-fg);
			margin-top: 20px;
		}
		.login-card :global(input) {
			width: 100%;
			min-width: 0;
			height: 44px;
			font-weight: 400;
			font-size: 16px;
		}
		.password-field {
			position: relative;
			display: block;
		}
		.password-field :global(input) {
			padding-right: 44px;
		}
		.password-field :global(button) {
			position: absolute;
			right: 5px;
			top: 4px;
		}
		.login-card :global(.login-submit) {
			width: 100%;
			margin-top: 22px;
			height: 44px;
			font-size: 15px;
		}
		.login-help {
			text-align: center;
			color: var(--muted-fg);
			font-size: 13px;
			margin-top: 22px;
		}
		@media (max-width: 767px) {
			.login-page > div {
				width: min(420px, 100%);
			}
			.login-card {
				padding: 28px 24px;
			}
		}
	}
</style>
