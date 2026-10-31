import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import { user } from './schema';
import { eq } from 'drizzle-orm';
if (process.env.NODE_ENV === 'production' && !process.env.BETTER_AUTH_SECRET)
    throw new Error('BETTER_AUTH_SECRET is required in production');
if (process.env.NODE_ENV === 'production' && !process.env.ORIGIN)
    throw new Error('ORIGIN is required in production');
export const auth = betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    user: {
        additionalFields: {
            role: { type: 'string', defaultValue: 'requester', input: false },
            enabled: { type: 'boolean', defaultValue: true, input: false }
        }
    },
    secret:
        process.env.BETTER_AUTH_SECRET ||
        'local-prototype-only-change-this-secret-before-deployment-2026',
    baseURL: process.env.ORIGIN || 'http://localhost:5173',
    databaseHooks: {
        session: {
            create: {
                before: async (session) => {
                    const [person] = await db.select().from(user).where(eq(user.id, session.userId));
                    return person?.enabled ? { data: session } : false;
                }
            }
        }
    },
    trustedOrigins: [process.env.ORIGIN || 'http://localhost:5173', 'http://127.0.0.1:5173']
});
