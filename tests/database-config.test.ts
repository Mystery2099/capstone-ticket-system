import { test, expect } from 'vitest';
import { resolveDatabaseConfig } from '../src/lib/server/database-config';
const azure = {
	PGHOST: 'example.postgres.database.azure.com',
	PGUSER: 'admin',
	PGDATABASE: 'tickets',
	PGPORT: '5432',
	PGPASSWORD: 'test #$ password'
};
test('Azure settings keep special password characters, verify TLS, and reject bad values', () => {
	const config = resolveDatabaseConfig(azure);
	expect(config.kind).toBe('postgres');
	if (config.kind === 'postgres') {
		expect(config.options.password).toBe(azure.PGPASSWORD);
		expect(config.options.ssl.rejectUnauthorized).toBe(true);
		expect(config.options.username).toBe('admin');
	}
	expect(() => resolveDatabaseConfig({ ...azure, PGPASSWORD: '' })).toThrow('PGPASSWORD');
	expect(() => resolveDatabaseConfig({ ...azure, PGPORT: 'oops' })).toThrow('PGPORT');
	expect(resolveDatabaseConfig({ ...azure, DATABASE_URL: 'postgres://example' }).kind).toBe('url');
});

test('local storage is used only when asked for, and never in production', () => {
	expect(resolveDatabaseConfig({ ...azure, DATA_DIR: '.data/test' })).toEqual({
		kind: 'local',
		directory: '.data/test'
	});
	expect(() => resolveDatabaseConfig({ NODE_ENV: 'production', DATA_DIR: '.data/db' })).toThrow(
		'hosted PostgreSQL'
	);
	expect(() => resolveDatabaseConfig({ NODE_ENV: 'production' })).toThrow('hosted PostgreSQL');
});
