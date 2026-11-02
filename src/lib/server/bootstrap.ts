import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { user, account, securityEvent } from './schema';
import { adminCreateUserSchema } from './validation';

/** One-time provisioning: existing accounts are never overwritten. */
export async function createFirstAdministrator(
	name: string,
	email: string,
	password: string
): Promise<void> {
	const input = adminCreateUserSchema.parse({ name, email, password, role: 'admin' });
	const passwordHash = await hashPassword(input.password);
	await db.transaction(async (transaction) => {
		// Serialize concurrent bootstrap commands before checking for existing accounts.
		await transaction.execute(sql`LOCK TABLE "user" IN EXCLUSIVE MODE`);
		if ((await transaction.select({ id: user.id }).from(user).limit(1)).length)
			throw new Error(
				'Administrator setup requires a database with no accounts. Existing accounts were not changed.'
			);
		const userId = randomUUID();
		await transaction.insert(user).values({
			id: userId,
			name: input.name,
			email: input.email,
			role: 'admin',
			emailVerified: false,
			banned: false
		});
		await transaction.insert(account).values({
			id: randomUUID(),
			accountId: userId,
			providerId: 'credential',
			userId,
			password: passwordHash,
			updatedAt: new Date()
		});
		await transaction.insert(securityEvent).values({
			actorId: null,
			action: 'operator.administrator_bootstrapped',
			targetId: userId,
			details: {}
		});
	});
}
