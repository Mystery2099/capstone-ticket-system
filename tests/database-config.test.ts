import { test, expect } from 'vitest';
import { resolveDatabaseConfig } from '../src/lib/server/database-config';
const azure = {
	PGHOST: 'example.postgres.database.azure.com',
	PGUSER: 'admin',
	PGDATABASE: 'tickets',
	PGPORT: '5432',
	PGPASSWORD: 'test #$ password'
};
test('separate Azure settings preserve special password characters and verify TLS', () => {
	const config = resolveDatabaseConfig(azure);
	expect(config.kind).toBe('postgres');
	if (config.kind === 'postgres') {
		expect(config.options.password).toBe(azure.PGPASSWORD);
		expect(config.options.ssl.rejectUnauthorized).toBe(true);
		expect(config.options.username).toBe('admin');
	}
});
test('empty Azure password fails without silently selecting a local database', () => {
	expect(() => resolveDatabaseConfig({ ...azure, PGPASSWORD: '' })).toThrow('PGPASSWORD');
});
test('explicit test storage stays isolated from Azure settings', () => {
	expect(resolveDatabaseConfig({ ...azure, DATA_DIR: '.data/test' })).toEqual({
		kind: 'local',
		directory: '.data/test'
	});
});
test('connection URL takes precedence and invalid ports fail', () => {
	expect(resolveDatabaseConfig({ ...azure, DATABASE_URL: 'postgres://example' }).kind).toBe('url');
	expect(() => resolveDatabaseConfig({ ...azure, PGPORT: 'oops' })).toThrow('PGPORT');
});

test('production refuses embedded storage and implicit local fallback', () => {
	expect(() => resolveDatabaseConfig({ NODE_ENV: 'production', DATA_DIR: '.data/db' })).toThrow(
		'hosted PostgreSQL'
	);
	expect(() => resolveDatabaseConfig({ NODE_ENV: 'production' })).toThrow('hosted PostgreSQL');
});
