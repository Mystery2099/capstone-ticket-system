import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { authenticatorCode } from '../fixtures/totp';
import { test, expect, type Page } from '@playwright/test';

/**
 * The administrator enrolls an authenticator once per run, so its key must outlive the
 * worker. Playwright replaces the worker after any failed test, which would lose a variable
 * and fail every later administrator sign-in. The output folder is emptied for each run.
 */
function getAdministratorKeyPath(): string {
	return join(test.info().project.outputDir, 'administrator-authenticator-key.txt');
}

function saveAdministratorKey(administratorKey: string): void {
	mkdirSync(dirname(getAdministratorKeyPath()), { recursive: true });
	writeFileSync(getAdministratorKeyPath(), administratorKey);
}

function readAdministratorKey(): string {
	try {
		return readFileSync(getAdministratorKeyPath(), 'utf8');
	} catch {
		return '';
	}
}

async function signIn(page: Page, email: string) {
	await page.goto('/login');
	await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
	await page.getByLabel('Email', { exact: true }).fill(email);
	await page
		.getByLabel(/Password/)
		.first()
		.fill('Capstone2026!');
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	if (email === 'jordan.ellis@example.test') {
		await expect(page).toHaveURL(/\/account-security/);
		if (await page.getByLabel('Current password', { exact: true }).isVisible()) {
			await page.getByLabel('Current password', { exact: true }).fill('Capstone2026!');
			await page.getByRole('button', { name: 'Start setup' }).click();
			await expect(
				page.getByRole('img', { name: 'QR code for authenticator setup' })
			).toBeVisible();
			await expect(
				page.getByRole('img', { name: 'QR code for authenticator setup' })
			).toHaveAttribute('src', /^data:image\/png;base64,/);
			await page.getByText('Can’t scan? Use the setup key', { exact: true }).click();
			await expect(page.locator('code').first()).toBeVisible();
			const downloadEvent = page.waitForEvent('download');
			await page.getByRole('button', { name: 'Download recovery codes' }).click();
			const download = await downloadEvent;
			expect(download.suggestedFilename()).toBe('ticket-system-recovery-codes.txt');
			const stream = await download.createReadStream();
			let downloadedCodes = '';
			for await (const chunk of stream!) downloadedCodes += chunk.toString();
			for (const code of await page.locator('.recovery-codes code').allTextContents())
				expect(downloadedCodes).toContain(code);
			expect(downloadedCodes).not.toContain((await page.locator('code').first().textContent())!);
			await expect(page.getByRole('button', { name: 'Verify', exact: true })).toBeDisabled();
			saveAdministratorKey((await page.locator('code').first().textContent())!);
			await page.getByLabel('I saved my recovery codes').check();
		}
		await page
			.getByLabel('Authenticator code', { exact: true })
			.fill(authenticatorCode(readAdministratorKey()));
		await page.getByRole('button', { name: 'Verify', exact: true }).click();
	}
	await expect(page).toHaveURL(/\/app\/tickets/);
}

/** Waits for hydration, since the compose pane and dropdowns need JavaScript. */
async function openNewTicket(page: Page) {
	await page.goto('/app/tickets/new');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
}

async function choose(page: Page, field: string, option: string) {
	await page.getByRole('button', { name: field, exact: true }).click();
	await page.getByRole('option', { name: option, exact: true }).click();
}

test('requester sees public conversation, cannot read private notes or foreign tickets', async ({
	page
}) => {
	await signIn(page, 'marcus.lee@example.test');
	await page.goto('/app/tickets/1046');
	await expect(
		page.getByRole('heading', { name: 'VPN disconnects every 20 minutes when working from home' })
	).toBeVisible();
	await expect(
		page.getByText('Likely a Wi-Fi adapter power management issue.', { exact: false })
	).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Internal note', exact: true })).toHaveCount(0);
	const response = await page.goto('/app/tickets/1048');
	expect(response?.status()).toBe(404);
});

test('agent opens an assigned ticket for a requester and posts a public comment', async ({
	page
}) => {
	await signIn(page, 'priya.raman@example.test');
	await openNewTicket(page);
	await page.getByLabel('Subject', { exact: true }).fill('Playwright classroom display');
	await page
		.getByLabel('Description', { exact: true })
		.fill('The display needs an HDMI cable check before the lecture.');
	await choose(page, 'Requester', 'Marcus Lee');
	await choose(page, 'Assignee', 'Priya Raman (you)');
	await choose(page, 'Priority', 'High');
	await choose(page, 'Status', 'In progress');
	await choose(page, 'Category', 'Hardware');
	await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Playwright classroom display' })).toBeVisible();
	await expect(page.getByText('Opened by Marcus Lee', { exact: false })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Assignee', exact: true })).toHaveText(
		'Priya Raman'
	);
	await expect(page.getByRole('button', { name: 'Priority', exact: true })).toContainText('High');
	await expect(page.getByRole('button', { name: 'Status', exact: true })).toContainText(
		'In progress'
	);
	await page
		.getByRole('textbox', { name: 'Comment', exact: true })
		.fill('I will check the cable this afternoon.');
	await page.getByRole('button', { name: 'Send comment', exact: true }).click();
	await expect(
		page.getByText('I will check the cable this afternoon.', { exact: true })
	).toBeVisible();
});

test('drafts stay in the sidebar across a reload and leave once created', async ({ page }) => {
	await signIn(page, 'marcus.lee@example.test');
	const drafts = page.getByRole('link', { name: 'Drafts', exact: true });
	await expect(drafts).toHaveCount(0);
	await openNewTicket(page);
	await page.getByLabel('Subject', { exact: true }).fill('Keyboard stopped working');
	await expect(drafts).toContainText('1');
	await expect(page).toHaveURL(/draft=/);
	// Saves are debounced, and a reload flushes them on the way out.
	await page.reload();
	await expect(page.getByLabel('Subject', { exact: true })).toHaveValue('Keyboard stopped working');

	await openNewTicket(page);
	await page.getByLabel('Subject', { exact: true }).fill('Second monitor is dark');
	await expect(drafts).toContainText('2');

	await drafts.click();
	await expect(page.getByRole('heading', { name: /^Drafts/ })).toBeVisible();
	await page.getByRole('link', { name: /Keyboard stopped working/ }).click();
	await page.getByLabel('Description', { exact: true }).fill('It stopped after an update.');
	await choose(page, 'Category', 'Hardware');
	await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Keyboard stopped working' })).toBeVisible();
	await expect(drafts).toContainText('1');
});

test('sidebar category shows that category’s open tickets', async ({ page }) => {
	await signIn(page, 'priya.raman@example.test');
	await page.getByRole('link', { name: /^Hardware/ }).click();
	await expect(page.getByRole('heading', { name: /^Open · Hardware/ })).toBeVisible();
	await expect(page.locator('a.list-row .status', { hasText: 'Resolved' })).toHaveCount(0);
	const firstTicketRow = page.locator('a.list-row').first();
	const ticketHref = await firstTicketRow.getAttribute('href');
	await firstTicketRow.click();
	await choose(page, 'Status', 'Resolved');
	await expect(page.locator(`a.list-row[href="${ticketHref}"]`)).toHaveCount(0);
});

test('administrator adds and edits records in the pane beside the list', async ({ page }) => {
	await signIn(page, 'jordan.ellis@example.test');
	await page.goto('/app/admin/categories');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await page.getByRole('link', { name: 'Add category' }).click();
	await page.getByLabel('Category name').fill('Facilities');
	await page.getByRole('button', { name: 'Add category', exact: true }).click();
	await expect(page).toHaveURL(/\?id=/);
	await expect(page.locator('a.list-row', { hasText: 'Facilities' })).toHaveClass(/selected/);
	await choose(page, 'State', 'Inactive');
	await expect(page.getByRole('button', { name: 'State', exact: true })).toHaveText('Inactive');
	await expect(page.locator('input[name=active]')).toHaveValue('false');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('a.list-row', { hasText: 'Facilities' })).toContainText('Inactive');
	await page.getByRole('button', { name: 'Revert', exact: true }).click();
	await expect(page.getByRole('button', { name: 'State', exact: true })).toHaveText('Inactive');
	await page.goto('/app/settings');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page).toHaveURL(/\/login$/);
	await signIn(page, 'jordan.ellis@example.test');
});

test('user and category drafts survive a reload without storing the password', async ({ page }) => {
	await signIn(page, 'jordan.ellis@example.test');
	await page.goto('/app/admin/users?new');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Display name').fill('Nina Patel');
	await page.getByLabel('Email').fill('nina.patel@example.test');
	await page.getByLabel('Initial password').fill('Temporary-Password-1');
	await choose(page, 'Role', 'Agent');
	await expect(page).toHaveURL(/draft=/);
	await page.reload();
	await expect(page.getByLabel('Display name')).toHaveValue('Nina Patel');
	await expect(page.getByRole('button', { name: 'Role', exact: true })).toHaveText('Agent');
	await expect(page.getByLabel('Initial password')).toHaveValue('');
	const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
	expect(stored).toContain('Nina Patel');
	expect(stored).not.toContain('Temporary-Password-1');

	await page.goto('/app/admin/categories?new');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Category name').fill('Security');
	const drafts = page.getByRole('link', { name: 'Drafts', exact: true });
	await expect(drafts).toContainText('2');

	await drafts.click();
	await expect(page.locator('a.list-row', { hasText: 'Category draft' })).toContainText('Security');
	await page.locator('a.list-row', { hasText: 'User draft' }).click();
	await expect(page.getByLabel('Display name')).toHaveValue('Nina Patel');
	await page.getByLabel('Initial password').fill('Temporary-Password-1');
	await page.getByRole('button', { name: 'Create account', exact: true }).click();
	await expect(page).toHaveURL(/\?id=/);
	await expect(page.locator('a.list-row', { hasText: 'Nina Patel' })).toHaveClass(/selected/);
	await expect(drafts).toContainText('1');
});

test('form problems appear beside the field and the password never comes back', async ({
	page
}) => {
	await signIn(page, 'jordan.ellis@example.test');
	await page.goto('/app/admin/users?new');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Display name').fill('Second Marcus');
	await page.getByLabel('Email').fill('marcus.lee@example.test');
	await page.getByLabel('Initial password').fill('Temporary-Password-2');
	const response = page.waitForResponse((r) => r.url().includes('createUser'));
	await page.getByRole('button', { name: 'Create account', exact: true }).click();
	expect(await (await response).text()).not.toContain('Temporary-Password-2');
	await expect(page.getByText('Another account already uses this email.')).toBeVisible();
	await expect(page.getByLabel('Display name')).toHaveValue('Second Marcus');
	await expect(page.getByLabel('Initial password')).toHaveValue('Temporary-Password-2');
});

test('a failed reply keeps its text and a pending retry cannot be submitted twice', async ({
	page
}) => {
	await signIn(page, 'priya.raman@example.test');
	await page.goto('/app/tickets/1046');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	const editor = page.getByRole('textbox', { name: 'Comment', exact: true });
	const text = 'Reply preserved after a connection failure';
	await editor.fill(text);
	await page.route(
		(url) => url.search.includes('/reply'),
		(route) => route.abort(),
		{ times: 1 }
	);
	await page.getByRole('button', { name: 'Send comment', exact: true }).click();
	await expect(
		page.getByText('Couldn’t send. Your comment is still in the box below.')
	).toBeVisible();
	await expect(editor).toHaveValue(text);
	await expect(page.locator('.message.sending')).toHaveCount(0);

	let requests = 0;
	let release: () => void = () => {};
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route(
		(url) => url.search.includes('/reply'),
		async (route) => {
			requests++;
			await pending;
			await route.continue();
		}
	);
	try {
		await page.getByRole('button', { name: 'Send comment', exact: true }).click();
		await expect(page.locator('.message.sending')).toContainText(text);
		await page.locator('form[action="?/reply"]').evaluate((form) => {
			(form as HTMLFormElement).requestSubmit();
			(form as HTMLFormElement).requestSubmit();
		});
		await expect.poll(() => requests).toBe(1);
	} finally {
		release();
	}
	await expect(editor).toHaveValue('');
	await expect(page.locator('.message-body', { hasText: text })).toHaveCount(1);
	await page.goto('/app/settings');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page).toHaveURL(/\/login$/);
});

test('administrator creates a custom role and account that can sign in with its permissions', async ({
	page
}) => {
	test.setTimeout(60000);
	await signIn(page, 'jordan.ellis@example.test');
	await page.goto('/app/admin/roles?new');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await choose(page, 'Copy permissions from', 'Agent');
	await page.getByLabel('Role name', { exact: true }).fill('Field Technician');
	await page.getByRole('button', { name: 'Create role', exact: true }).click();
	await expect(page).toHaveURL(/roles\?id=/);
	const roleDetailsUrl = page.url();
	await expect(page.getByLabel('Role name', { exact: true })).toHaveValue('Field Technician');
	await page.goto('/app/admin/users?new');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Display name').fill('Test Technician');
	await page.getByLabel('Email', { exact: true }).fill('technician@example.test');
	await page.getByLabel('Initial password').fill('Capstone2026!');
	await choose(page, 'Role', 'Field Technician');
	await page.getByRole('button', { name: 'Create account', exact: true }).click();
	await expect(page).toHaveURL(/users\?id=/);
	await page.getByRole('button', { name: 'Account menu', exact: true }).click();
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page).toHaveURL(/\/login$/);
	await signIn(page, 'technician@example.test');
	await openNewTicket(page);
	await expect(page.getByRole('button', { name: 'Requester', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Priority', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Status', exact: true })).toBeVisible();
	await page.goto('/app/admin/roles');
	await expect(page.getByText('Administrator access required.', { exact: false })).toBeVisible();
	await page.goto('/app/settings');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page).toHaveURL(/\/login$/);
	await signIn(page, 'jordan.ellis@example.test');
	await page.goto(roleDetailsUrl);
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Role name', { exact: true }).fill('Service Technician');
	await page.getByLabel('Read and write internal notes', { exact: true }).uncheck();
	await page.getByRole('button', { name: 'Save role', exact: true }).click();
	await expect(
		page.getByRole('heading', { name: 'Service Technician', exact: true })
	).toBeVisible();
	await page
		.getByRole('combobox', { name: 'Reassign users to', exact: true })
		.selectOption({ label: 'Requester' });
	await page.getByRole('button', { name: 'Delete role', exact: true }).click();
	await expect(page).toHaveURL(/\/app\/admin\/roles$/);
	await expect(page.getByRole('link', { name: /Service Technician/ })).toHaveCount(0);
	await page.goto('/app/admin/users');
	await expect(page.getByRole('link', { name: /Test Technician Requester/ })).toBeVisible();
});
