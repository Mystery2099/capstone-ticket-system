import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const generationDb = drizzle(new PGlite());

export const auth = betterAuth({
	database: drizzleAdapter(generationDb, { provider: 'pg' }),
	emailAndPassword: { enabled: true, disableSignUp: true },
	user: {
		additionalFields: {
			role: { type: 'string', defaultValue: 'requester', input: false },
			enabled: { type: 'boolean', defaultValue: true, input: false }
		}
	},
	secret: 'local-schema-generation-only-not-a-deployment-secret'
});
