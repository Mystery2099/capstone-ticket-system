import { test, expect } from 'vitest';
import { databaseConfig } from '../src/lib/server/database-config';
const azure = {
	PGHOST: 'example.postgres.database.azure.com',
	PGUSER: 'admin',
	PGDATABASE: 'tickets',
	PGPORT: '5432',
	PGPASSWORD: 'test #$ password'
};
test('separate Azure settings preserve special password characters and verify TLS', () => {
	const config = databaseConfig(azure);
	expect(config.kind).toBe('postgres');
	if (config.kind === 'postgres') {
		expect(config.options.password).toBe(azure.PGPASSWORD);
		expect(config.options.ssl.rejectUnauthorized).toBe(true);
		expect(config.options.username).toBe('admin');
	}
});
test('empty Azure password fails without silently selecting a local database', () => {
	expect(() => databaseConfig({ ...azure, PGPASSWORD: '' })).toThrow('PGPASSWORD');
});
test('explicit test storage stays isolated from Azure settings', () => {
	expect(databaseConfig({ ...azure, DATA_DIR: '.data/test' })).toEqual({
		kind: 'local',
		directory: '.data/test'
	});
});
test('connection URL takes precedence and invalid ports fail', () => {
	expect(databaseConfig({ ...azure, DATABASE_URL: 'postgres://example' }).kind).toBe('url');
	expect(() => databaseConfig({ ...azure, PGPORT: 'oops' })).toThrow('PGPORT');
});
