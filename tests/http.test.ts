import { authenticatorCode } from './fixtures/totp';
import { test } from 'vitest';
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL;
async function login(email: string) {
	const cookies = new Map<string, string>();
	const cookieHeader = () => [...cookies.values()].join('; ');
	async function post(path: string, body: Record<string, unknown>) {
		const response = await fetch(base + '/api/auth/' + path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: base!, cookie: cookieHeader() },
			body: JSON.stringify(body)
		});
		for (const cookie of response.headers.getSetCookie()) {
			const pair = cookie.split(';')[0];
			cookies.set(pair.slice(0, pair.indexOf('=')), pair);
		}
		return response;
	}
	const response = await post('sign-in/email', { email, password: 'Capstone2026!' });
	assert.equal(response.status, 200, await response.clone().text());
	if (email === 'jordan.ellis@example.test') {
		const beforeEnrollment = cookieHeader();
		const blocked = await fetch(base + '/app/admin/users', {
			headers: { cookie: beforeEnrollment },
			redirect: 'manual'
		});
		assert.equal(blocked.status, 303);
		assert.equal(blocked.headers.get('location'), '/account-security');
		const enrollment = await post('two-factor/enable', { password: 'Capstone2026!' });
		assert.equal(enrollment.status, 200, await enrollment.clone().text());
		const details = await enrollment.json();
		administratorKey = new URL(details.totpURI).searchParams.get('secret')!;
		recoveryCode = details.backupCodes[0];
		const verified = await post('two-factor/verify-totp', {
			code: authenticatorCode(administratorKey)
		});
		assert.equal(verified.status, 200, await verified.clone().text());
		const oldSession = await fetch(base + '/app/tickets', {
			headers: { cookie: beforeEnrollment },
			redirect: 'manual'
		});
		assert.equal(oldSession.status, 303, 'Password-only sessions are revoked on enrollment');
		assert.equal(oldSession.headers.get('location'), '/login');
	}
	return cookieHeader();
}
let administratorKey = '';
let recoveryCode = '';
async function action(path: string, values: Record<string, string>, cookie: string) {
	const response = await fetch(base + path, {
		method: 'POST',
		headers: { Origin: base!, cookie, Accept: 'application/json', 'x-sveltekit-action': 'true' },
		body: new URLSearchParams(values)
	});
	const payload = await response.clone().json();
	return {
		status: payload.status ?? response.status,
		text: () => response.text(),
		clone: () => response.clone()
	};
}
test.skipIf(!base)(
	'HTTP: actual Better Auth sessions, forged actions, admin gates, private notes, disabled accounts',
	async () => {
		const requester = await login('marcus.lee@example.test'),
			agent = await login('priya.raman@example.test'),
			admin = await login('jordan.ellis@example.test');
		let r: Pick<Response, 'status' | 'text' | 'clone'> = await fetch(base + '/app/tickets/1046', {
			headers: { cookie: requester }
		});
		assert.equal(r.status, 200);
		assert(!(await r.text()).includes('Likely a Wi-Fi adapter'));
		r = await fetch(base + '/app/tickets/1048', { headers: { cookie: requester } });
		assert.equal(r.status, 404);
		r = await fetch(base + '/app/admin/users', { headers: { cookie: requester } });
		assert.equal(r.status, 403);
		r = await action(
			'/app/tickets/1046?/reply',
			{ body: 'Private note injection', internal: 'true' },
			requester
		);
		assert.equal(r.status, 403);
		r = await action('/app/tickets/1046?/reply', { body: ' ' }, requester);
		assert.equal(r.status, 400);
		assert((await r.text()).includes('Message is required'));
		r = await action('/app/tickets/1046?/update', { field: 'priority', value: 'high' }, requester);
		assert.equal(r.status, 403);
		r = await action('/app/tickets/new?/create', { requesterId: 'rosa' }, requester);
		assert.equal(r.status, 403);
		r = await action('/app/tickets/new?/create', { assignedToUserId: 'priya' }, requester);
		assert.equal(r.status, 403);
		r = await action('/app/tickets/1039?/reply', { body: 'Closed ticket injection' }, agent);
		assert.equal(r.status, 403);
		r = await action(
			'/app/admin/users?/user',
			{
				id: 'priya',
				name: 'Priya Raman',
				email: 'priya.raman@example.test',
				role: 'agent',
				enabled: 'false'
			},
			requester
		);
		assert.equal(r.status, 403);
		// Disable a seeded account briefly, then restore it even if an assertion fails.
		try {
			r = await action(
				'/app/admin/users?/user',
				{
					id: 'priya',
					name: 'Priya Raman',
					email: 'priya.raman@example.test',
					role: 'agent',
					enabled: 'false'
				},
				admin
			);
			assert.equal(r.status, 200, await r.clone().text());
			r = await fetch(base + '/app/tickets', { headers: { cookie: agent }, redirect: 'manual' });
			assert.equal(r.status, 303);
			r = await fetch(base + '/api/auth/sign-in/email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Origin: base! },
				body: JSON.stringify({ email: 'priya.raman@example.test', password: 'Capstone2026!' })
			});
			assert(r.status >= 400, 'Disabled account cannot create a session');
		} finally {
			await action(
				'/app/admin/users?/user',
				{
					id: 'priya',
					name: 'Priya Raman',
					email: 'priya.raman@example.test',
					role: 'agent',
					enabled: 'true'
				},
				admin
			);
		}
		// Admin plugin routes stay closed, even to administrators.
		r = await fetch(base + '/api/auth/admin/set-role', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: base!, cookie: admin },
			body: JSON.stringify({ userId: 'jordan', role: 'requester' })
		});
		assert.equal(r.status, 404);
		r = await fetch(base + '/api/auth/sign-up/email', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: base! },
			body: JSON.stringify({
				email: 'blocked@example.test',
				name: 'Blocked',
				password: 'Capstone2026!'
			})
		});
		assert(r.status >= 400, 'Public signup is disabled');
		// A subsequent password login must require a second factor; recovery codes are single use.
		async function challengeWithRecovery(code: string): Promise<Response> {
			const challenge = await fetch(base + '/api/auth/sign-in/email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Origin: base! },
				body: JSON.stringify({ email: 'jordan.ellis@example.test', password: 'Capstone2026!' })
			});
			assert.equal((await challenge.json()).twoFactorRedirect, true);
			const cookie = challenge.headers
				.getSetCookie()
				.map((item) => item.split(';')[0])
				.join('; ');
			return fetch(base + '/api/auth/two-factor/verify-backup-code', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Origin: base!, cookie },
				body: JSON.stringify({ code })
			});
		}
		const recovered = await challengeWithRecovery(recoveryCode);
		assert.equal(recovered.status, 200, await recovered.clone().text());
		assert((await challengeWithRecovery(recoveryCode)).status >= 400);
		const loginPage = await fetch(base + '/login');
		assert.equal(loginPage.headers.get('cache-control'), 'no-store');
		const html = await loginPage.text();
		assert(!html.includes('Capstone2026!'));
		assert(!html.includes('Demo sign-in'));
	}
);
