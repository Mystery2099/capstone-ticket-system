<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
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
	let email = $state(''),
		password = $state(''),
		isPasswordVisible = $state(false),
		loginError = $state(''),
		isSigningIn = $state(false);
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

<div class="login-page">
	<div>
		<section class="login-card">
			<div class="login-heading">
				<span class="logo"><Ticket size={24} /></span>
				<div>
					<h1>Sign in</h1>
					<p>Ticket System help desk</p>
				</div>
			</div>
			<form onsubmit={signIn} inert={!isHydrated}>
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
						<Tooltip.Root>
							<Tooltip.Trigger onclick={() => (isPasswordVisible = !isPasswordVisible)}>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="ghost"
										size="icon-sm"
										type="button"
										class="absolute right-1 top-1"
										aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
									>
										{#if isPasswordVisible}<EyeOff size={19} />{:else}<Eye size={19} />{/if}
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="bottom" sideOffset={6}
								>{isPasswordVisible ? 'Hide password' : 'Show password'}</Tooltip.Content
							>
						</Tooltip.Root>
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
</div>
