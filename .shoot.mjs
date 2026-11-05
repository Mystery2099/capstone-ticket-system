import { chromium, devices } from '@playwright/test';
const out = process.argv[2];
const base = 'http://localhost:4181';
const browser = await chromium.launch();
const page = await (await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' })).newPage();
await page.goto(base + '/login');
await page.getByLabel('Email', { exact: true }).fill('priya.raman@example.test');
await page.getByLabel(/Password/).first().fill('Capstone2026!');
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await page.waitForURL(/\/app/);
for (const variant of ['fixed', 'without-fix']) {
	await page.goto(base + '/app/inbox');
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(500);
	if (variant === 'without-fix')
		await page.addStyleTag({ content: '.quick-action{view-transition-name:none!important}' });
	// Slow the crossfade so the screenshot lands inside it.
	await page.addStyleTag({ content: '::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation-duration:3s!important}' });
	await page.locator('nav[aria-label="Mobile navigation"] a', { hasText: 'My queue' }).click();
	await page.waitForTimeout(700);
	console.log(variant, 'transitioning:', await page.evaluate(() => document.documentElement.classList.contains('page-transition')));
	await page.screenshot({ path: `${out}/transition-${variant}.png`, clip: { x: 0, y: 640, width: 412, height: 200 } });
	await page.waitForTimeout(3000);
}
await browser.close();
