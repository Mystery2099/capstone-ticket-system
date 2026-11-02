import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor } from 'better-auth/plugins';
import { accessControl, roles } from './src/lib/server/auth-roles';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const generationDb = drizzle(new PGlite());

export const auth = betterAuth({
	database: drizzleAdapter(generationDb, { provider: 'pg' }),
	emailAndPassword: { enabled: true, disableSignUp: true },
	plugins: [
		twoFactor(),
		admin({ adminRoles: ['admin'], defaultRole: 'requester', ac: accessControl, roles })
	],
	secret: 'local-schema-generation-only-not-a-deployment-secret'
});
