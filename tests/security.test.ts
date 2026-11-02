import { describe, expect, it } from 'vitest';
import {
	applySecurityHeaders,
	RequestLimiter,
	validateProductionAuth
} from '../src/lib/server/security';

describe('production safeguards', () => {
	it('rejects weak secrets and origins with paths or insecure protocols', () => {
		const environment = {
			NODE_ENV: 'production',
			BETTER_AUTH_SECRET: 'a'.repeat(32),
			ORIGIN: 'https://tickets.example.com'
		};
		expect(() => validateProductionAuth(environment)).not.toThrow();
		for (const ORIGIN of [
			'http://tickets.example.com',
			'https://tickets.example.com/path',
			'https://tickets.example.com/'
		]) {
			expect(() => validateProductionAuth({ ...environment, ORIGIN })).toThrow();
		}
		expect(() => validateProductionAuth({ ...environment, BETTER_AUTH_SECRET: 'short' })).toThrow();
	});

	it('isolates accounts, expires limits, and bounds bucket storage', () => {
		const limiter = new RequestLimiter(1, 1000, 2);
		expect(limiter.recordRequest('alice', 0)).toBe(0);
		expect(limiter.recordRequest('alice', 1)).toBe(1);
		expect(limiter.recordRequest('bob', 1)).toBe(0);
		expect(limiter.recordRequest('charlie', 2)).toBeGreaterThan(0);
		expect(limiter.recordRequest('charlie', 1001)).toBe(0);
	});

	it('prevents caching and framing, with HSTS only over HTTPS', () => {
		const response = applySecurityHeaders(new Response('ok'), true);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
		expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000');
		expect(
			applySecurityHeaders(new Response(), false).headers.has('Strict-Transport-Security')
		).toBe(false);
	});
});
