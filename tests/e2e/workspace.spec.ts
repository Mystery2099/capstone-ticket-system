import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
	await page.goto('/login');
	await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
	await page.getByLabel('Email', { exact: true }).fill(email);
	await page
		.getByLabel(/Password/)
		.first()
		.fill('Capstone2026!');
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
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

test('agent opens an assigned ticket for a requester and posts a public reply', async ({
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
	await choose(page, 'Category', 'Hardware');
	await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Playwright classroom display' })).toBeVisible();
	await expect(page.getByText('Opened by Marcus Lee', { exact: false })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Assignee', exact: true })).toHaveText(
		'Priya Raman'
	);
	await page
		.getByRole('textbox', { name: 'Reply', exact: true })
		.fill('I will check the cable this afternoon.');
	await page.getByRole('button', { name: 'Send reply', exact: true }).click();
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
	await expect(page.locator('a.ticket-row .status', { hasText: 'Resolved' })).toHaveCount(0);
});

test('phone workspace fits and administrator can open user editor', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await signIn(page, 'jordan.ellis@example.test');
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.goto('/app/admin/users');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await expect(page.getByRole('link', { name: 'Add user' })).toBeVisible();
	await page.getByRole('link', { name: /Priya Raman/ }).click();
	await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Priya Raman');
	await page.getByRole('link', { name: 'Back to user list' }).click();
	await expect(page.getByLabel('Display name', { exact: true })).toHaveCount(0);
});

test('administrator adds and edits records in the pane beside the list', async ({ page }) => {
	await signIn(page, 'jordan.ellis@example.test');
	await page.goto('/app/admin/categories');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await page.getByRole('link', { name: 'Add category' }).click();
	await page.getByLabel('Category name').fill('Facilities');
	await page.getByRole('button', { name: 'Add category', exact: true }).click();
	await expect(page).toHaveURL(/\?id=/);
	await expect(page.locator('a.ticket-row', { hasText: 'Facilities' })).toHaveClass(/selected/);
	await choose(page, 'State', 'Inactive');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('a.ticket-row', { hasText: 'Facilities' })).toContainText('Inactive');
	await page.getByRole('button', { name: 'Revert', exact: true }).click();
	await expect(page.getByRole('button', { name: 'State', exact: true })).toHaveText('Inactive');
});

test('a minimized sidebar stays minimized while navigating', async ({ page }) => {
	await signIn(page, 'priya.raman@example.test');
	await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
	await page.getByRole('button', { name: 'Toggle navigation' }).click();
	await expect(page.locator('.app-shell')).toHaveClass(/rail/);
	await page.getByRole('link', { name: 'All tickets', exact: true }).click();
	await expect(page).toHaveURL(/view=all/);
	await expect(page.locator('.app-shell')).toHaveClass(/rail/);
});
