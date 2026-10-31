<script lang="ts">
    import { onMount } from 'svelte';
    let ready = $state(false);
    onMount(() => {
        ready = true;
    });
    import { Ticket, Eye, EyeOff } from '@lucide/svelte';
    import { goto, invalidateAll } from '$app/navigation';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    let { data } = $props();
    let email = $state('priya.raman@example.test'),
        password = $state(''),
        show = $state(false),
        error = $state(''),
        busy = $state(false);
    async function signIn(e: SubmitEvent) {
        e.preventDefault();
        busy = true;
        error = '';
        try {
            const r = await fetch('/api/auth/sign-in/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (!r.ok) {
                error =
                    r.status === 429
                        ? 'Too many sign-in attempts. Please wait a minute and try again.'
                        : r.status >= 500
                            ? 'Sign-in is temporarily unavailable. Please try again.'
                            : 'Email or password is incorrect, or this account is unavailable.';
                return;
            }
            await invalidateAll();
            await goto('/app/tickets');
        } catch {
            error = 'Could not connect. Please try again.';
        } finally {
            busy = false;
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
            <form onsubmit={signIn} inert={!ready}>
                <Label class="flex-col items-start gap-2">
                    Email
                    <Input
                            disabled={!ready}
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
                                disabled={!ready}
                                type={show ? 'text' : 'password'}
                                bind:value={password}
                                autocomplete="current-password"
                                required
                                class="h-11 md:text-base font-normal pr-11"
                        />
						<Button
                                variant="ghost"
                                size="icon-sm"
                                type="button"
                                class="absolute right-1 top-1"
                                aria-label={show ? 'Hide password' : 'Show password'}
                                onclick={() => (show = !show)}
                        >
							{#if show}<EyeOff size={19} />{:else}<Eye size={19} />{/if}
						</Button>
					</span>
                </Label>
                {#if error}<p class="error" role="alert">{error}</p>{/if}
                <Button
                        type="submit"
                        class="login-submit w-full h-11 rounded-full text-[15px]"
                        disabled={busy || !ready}
                >
                    {busy ? 'Signing in…' : 'Sign in'}
                </Button>
            </form>
            <p class="login-help">Accounts are created by an administrator.</p>
        </section>
        <p class="login-footer">Fictional demo organization · no real user data</p>
        {#if data.demo}<details class="demo-accounts">
            <summary>Demo sign-in details</summary>
            <p>Password: <code>Capstone2026!</code></p>
            <button onclick={() => (email = 'priya.raman@example.test')}>Agent · Priya Raman</button
            ><button onclick={() => (email = 'marcus.lee@example.test')}>Requester · Marcus Lee</button
        ><button onclick={() => (email = 'jordan.ellis@example.test')}
        >Administrator · Jordan Ellis</button
        >
        </details>{/if}
    </div>
</div>
