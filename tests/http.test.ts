import { test } from 'vitest';
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL;
async function login(email: string) {
	const r = await fetch(base + '/api/auth/sign-in/email', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: base! },
		body: JSON.stringify({ email, password: 'Capstone2026!' })
	});
	assert.equal(r.status, 200, await r.clone().text());
	return r.headers
		.getSetCookie()
		.map((c) => c.split(';')[0])
		.join('; ');
}
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
	}
);
