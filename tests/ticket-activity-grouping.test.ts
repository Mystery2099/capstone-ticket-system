import { describe, expect, it } from 'vitest';
import { groupConsecutiveActivity } from '../src/routes/app/tickets/[[id]]/ticket-activity-grouping';

type TestComment = { id: string; createdAt: Date };
type TestEvent = { id: string; actorId: string; createdAt: Date };

function createEvent(id: string, actorId: string, minute: number) {
	return { kind: 'event' as const, id, actorId, createdAt: new Date(2026, 10, 5, 10, minute) };
}

describe('groupConsecutiveActivity', () => {
	it('joins changes by one person in a row, and splits on a comment, another person, or a gap', () => {
		const groupedTimeline = groupConsecutiveActivity<TestComment, TestEvent>([
			createEvent('status', 'priya', 0),
			createEvent('priority', 'priya', 1),
			createEvent('assignee', 'priya', 2),
			{ kind: 'comment' as const, id: 'reply', createdAt: new Date(2026, 10, 5, 10, 3) },
			createEvent('category', 'priya', 4),
			createEvent('subject', 'jordan', 5),
			createEvent('later', 'jordan', 30)
		]);

		expect(
			groupedTimeline.map((entry) =>
				entry.kind === 'comment' ? entry.id : entry.events.map((event) => event.id)
			)
		).toEqual([['status', 'priority', 'assignee'], 'reply', ['category'], ['subject'], ['later']]);
	});
});
