import { db } from '../../src/lib/server/db';
import { hashPassword } from 'better-auth/crypto';
import { sql } from 'drizzle-orm';
import {
	user,
	account,
	category,
	ticket,
	ticketComment,
	ticketEvent
} from '../../src/lib/server/schema';
export async function seedTestData(): Promise<void> {
	if (process.env.NODE_ENV !== 'test') throw new Error('Test fixtures require NODE_ENV=test');
	if (!process.env.DATA_DIR || process.env.DATABASE_URL)
		throw new Error('Test fixtures require an isolated DATA_DIR');
	if ((await db.select().from(user).limit(1)).length)
		throw new Error('Test fixtures require an empty database');
	const password = await hashPassword('Capstone2026!');
	await db.transaction(async (tx) => {
		const people = [
			['priya', 'Priya Raman', 'agent'],
			['jordan', 'Jordan Ellis', 'admin'],
			['marcus', 'Marcus Lee', 'requester'],
			['rosa', 'Rosa Delgado', 'requester'],
			['theo', 'Theo Brandt', 'requester'],
			['dana', 'Dana Whitfield', 'requester'],
			['alex', 'Alex Chen', 'requester'],
			['grace', 'Grace Holm', 'requester']
		];
		for (const [id, name, role] of people) {
			await tx.insert(user).values({
				id,
				name,
				role,
				email: `${name.toLowerCase().replace(' ', '.')}@example.test`,
				emailVerified: true,
				banned: false
			});
			await tx.insert(account).values({
				id: `credential-${id}`,
				accountId: id,
				providerId: 'credential',
				userId: id,
				password,
				updatedAt: new Date()
			});
		}
		const cats = await tx
			.insert(category)
			.values(
				['Hardware', 'Software', 'Network', 'Access & accounts', 'General'].map((name) => ({
					name
				}))
			)
			.returning();
		await tx.execute(sql`ALTER TABLE ticket ALTER COLUMN ticket_number RESTART WITH 1039`);
		const samples = [
			[
				'Account password reset',
				'I am unable to sign in to the learning portal. Could you help me reset my password?',
				'marcus',
				'closed',
				'normal',
				3,
				'jordan'
			],
			[
				'Install design software',
				'Please install the approved design tools on my workstation.',
				'theo',
				'resolved',
				'low',
				1,
				'jordan'
			],
			[
				'Meeting room display flickering',
				'The meeting room display flickers when connected over HDMI.',
				'rosa',
				'resolved',
				'normal',
				0,
				'priya'
			],
			[
				'Projector in Room B214 shows no signal',
				'The ceiling projector in B214 shows no signal when connected to the lectern computer. We have a presentation tomorrow.',
				'grace',
				'open',
				'high',
				0,
				null
			],
			[
				'Update the staff directory',
				'My department has changed. Please update my entry in the staff directory.',
				'marcus',
				'closed',
				'low',
				4,
				'jordan'
			],
			[
				'Calendar invites not syncing to phone',
				'Calendar invitations appear on my laptop but are not showing up on my phone.',
				'alex',
				'on_hold',
				'normal',
				1,
				'jordan'
			],
			[
				'Laptop setup for new hire starting Monday',
				'We have a new team member starting Monday. Please prepare a laptop with the standard software and access.',
				'dana',
				'in_progress',
				'normal',
				0,
				'priya'
			],
			[
				'VPN disconnects every 20 minutes when working from home',
				'Since Monday my VPN connection drops roughly every 20 minutes while I work from home. I have to reconnect manually and lose any open remote desktop sessions. Company laptop, Windows 11, home Wi-Fi. Restarting the router did not help.',
				'marcus',
				'in_progress',
				'high',
				2,
				'priya'
			],
			[
				'Access to the shared Finance drive',
				'I moved to the Finance team this week and need access to the shared drive. My manager has approved the request.',
				'theo',
				'open',
				'normal',
				3,
				null
			],
			[
				'Second-floor printer shows “Offline” for everyone',
				'The printer by the second-floor kitchen shows Offline for everyone on our team. It is powered on and has paper.',
				'rosa',
				'open',
				'high',
				0,
				null
			]
		] as const;
		for (const [
			subject,
			description,
			requesterId,
			statusCode,
			priority,
			cat,
			assignedToUserId
		] of samples) {
			const date = new Date('2026-10-27T13:02:00Z');
			const [t] = await tx
				.insert(ticket)
				.values({
					subject,
					description,
					requesterId,
					statusCode,
					priority,
					categoryId: cats[cat].id,
					assignedToUserId,
					createdAt: date,
					updatedAt: new Date(
						subject.startsWith('Second-floor')
							? '2026-10-31T19:58:00Z'
							: subject.startsWith('Access to')
								? '2026-10-31T18:40:00Z'
								: subject.startsWith('VPN')
									? '2026-10-31T17:15:00Z'
									: subject.startsWith('Laptop') || subject.startsWith('Calendar')
										? '2026-10-29T16:00:00Z'
										: '2026-10-28T16:00:00Z'
					)
				})
				.returning();
			await tx.insert(ticketEvent).values({
				ticketId: t.id,
				actorId: requesterId,
				eventType: 'created',
				details: {},
				createdAt: date
			});
			if (t.ticketNumber === 1046) {
				await tx.insert(ticketComment).values([
					{
						ticketId: t.id,
						authorId: 'priya',
						body: 'Could you check the VPN client version and try connecting with an Ethernet cable? This will help us narrow it down.',
						createdAt: new Date('2026-10-28T15:20:00Z')
					},
					{
						ticketId: t.id,
						authorId: 'marcus',
						body: 'Version 5.2.1. I used Ethernet yesterday afternoon and it stayed connected for three hours straight.',
						createdAt: new Date('2026-10-29T20:47:00Z')
					},
					{
						ticketId: t.id,
						authorId: 'priya',
						body: 'Likely a Wi-Fi adapter power management issue. Check the driver version before escalating to Network.',
						isInternal: true,
						createdAt: new Date('2026-10-31T16:50:00Z')
					},
					{
						ticketId: t.id,
						authorId: 'priya',
						body: 'That points to the Wi-Fi connection. I’ll check your wireless adapter settings with you. Are you available this afternoon?',
						createdAt: new Date('2026-10-31T17:15:00Z')
					}
				]);
				await tx.insert(ticketEvent).values({
					ticketId: t.id,
					actorId: 'priya',
					eventType: 'status',
					details: { from: 'Open', to: 'In progress' },
					createdAt: new Date('2026-10-31T17:12:00Z')
				});
			}
		}
	});
}
