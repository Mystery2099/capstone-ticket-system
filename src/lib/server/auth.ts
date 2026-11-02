import { building } from '$app/environment';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor } from 'better-auth/plugins';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { session } from './schema';
import { accessControl, adminPaths, roles } from './auth-roles';
import { validateProductionAuth } from './security';
if (!building) validateProductionAuth(process.env);
export const auth = betterAuth({
	appName: 'Capstone Ticket System',
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
	databaseHooks: {
		user: {
			update: {
				after: async (updatedUser) => {
					// Enrollment rotates the current session afterwards. Remove all older
					// password-only sessions so they cannot inherit the enrolled flag.
					if (updatedUser.twoFactorEnabled)
						await db.delete(session).where(eq(session.userId, updatedUser.id));
				}
			}
		}
	},
	plugins: [
		twoFactor(),
		admin({
			adminRoles: ['admin'],
			defaultRole: 'requester',
			ac: accessControl,
			roles
		})
	],
	secret:
		process.env.BETTER_AUTH_SECRET ||
		'local-prototype-only-change-this-secret-before-deployment-2026',
	baseURL: process.env.ORIGIN || 'http://localhost:5173',
	// The plugin is only used from server code. Its routes stay closed because they would
	// bypass rules the app enforces itself, such as keeping one enabled administrator.
	disabledPaths: [
		...adminPaths,
		'/two-factor/disable',
		'/update-user',
		'/change-email',
		'/delete-user'
	],
	trustedOrigins:
		process.env.NODE_ENV === 'production'
			? [process.env.ORIGIN!]
			: [process.env.ORIGIN || 'http://localhost:5173', 'http://127.0.0.1:5173']
});
