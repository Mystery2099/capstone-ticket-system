import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { db } from './db';
import { ac, adminPaths, roles } from './auth-roles';
if (process.env.NODE_ENV === 'production' && !process.env.BETTER_AUTH_SECRET)
	throw new Error('BETTER_AUTH_SECRET is required in production');
if (process.env.NODE_ENV === 'production' && !process.env.ORIGIN)
	throw new Error('ORIGIN is required in production');
export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true, disableSignUp: true },
	plugins: [
		admin({
			adminRoles: ['admin'],
			defaultRole: 'requester',
			ac,
			roles
		})
	],
	secret:
		process.env.BETTER_AUTH_SECRET ||
		'local-prototype-only-change-this-secret-before-deployment-2026',
	baseURL: process.env.ORIGIN || 'http://localhost:5173',
	// The plugin is only used from server code. Its routes stay closed because they would
	// bypass rules the app enforces itself, such as keeping one enabled administrator.
	disabledPaths: adminPaths,
	trustedOrigins: [process.env.ORIGIN || 'http://localhost:5173', 'http://127.0.0.1:5173']
});
