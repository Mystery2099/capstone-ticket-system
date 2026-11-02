import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { eq, and } from 'drizzle-orm';
import { db, closeDatabase } from '../src/lib/server/db';
import {
	account,
	securityEvent,
	session,
	twoFactor,
	user,
	verification
} from '../src/lib/server/schema';

const { values: commandOptions } = parseArgs({
	options: {
		email: { type: 'string' },
		'password-file': { type: 'string' },
		'reset-mfa': { type: 'boolean', default: false }
	}
});
if (!commandOptions.email || !commandOptions['password-file'])
	throw new Error(
		'Usage: pnpm account:recover --email you@example.com --password-file /private/password-file [--reset-mfa]'
	);
try {
	const password = (await readFile(commandOptions['password-file'], 'utf8')).replace(/\r?\n$/, '');
	if (password.length < 12 || password.length > 128) throw new Error('Invalid password length');
	const passwordHash = await hashPassword(password);
	await db.transaction(async (transaction) => {
		const [person] = await transaction
			.select()
			.from(user)
			.where(eq(user.email, commandOptions.email!.trim().toLowerCase()))
			.for('update');
		if (!person) throw new Error('Account not found');
		const [credential] = await transaction
			.select()
			.from(account)
			.where(and(eq(account.userId, person.id), eq(account.providerId, 'credential')));
		if (credential)
			await transaction
				.update(account)
				.set({ password: passwordHash, updatedAt: new Date() })
				.where(eq(account.id, credential.id));
		else
			await transaction.insert(account).values({
				id: randomUUID(),
				accountId: person.id,
				providerId: 'credential',
				userId: person.id,
				password: passwordHash,
				updatedAt: new Date()
			});
		await transaction.delete(session).where(eq(session.userId, person.id));
		// Invalidate pending MFA challenges and remembered devices for this account.
		await transaction.delete(verification).where(eq(verification.value, person.id));
		if (commandOptions['reset-mfa']) {
			await transaction.delete(twoFactor).where(eq(twoFactor.userId, person.id));
			await transaction
				.update(user)
				.set({ twoFactorEnabled: false, updatedAt: new Date() })
				.where(eq(user.id, person.id));
		}
		await transaction.insert(securityEvent).values({
			actorId: null,
			action: 'operator.account_recovered',
			targetId: person.id,
			details: { resetMfa: commandOptions['reset-mfa'] }
		});
	});
	console.log(
		'Account recovered; sessions and pending MFA challenges revoked. Account enablement and role were not changed.'
	);
} catch {
	console.error('Account recovery failed. Check the input and database access.');
	process.exitCode = 1;
} finally {
	await closeDatabase();
}
