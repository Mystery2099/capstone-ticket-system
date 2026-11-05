/**
 * Folds runs of ticket changes into one timeline entry, so changing status, priority, and
 * assignee one after another reads as a single line instead of three. Only the display is
 * grouped; every change is still its own row in `ticket_event`.
 */

/** Changes by the same person this close together are shown as one entry. */
export const ACTIVITY_GROUPING_WINDOW_MILLISECONDS = 10 * 60 * 1000;

type GroupableActivityEvent = { id: string; actorId: string | null; createdAt: Date | string };

export type TimelineComment<CommentType> = CommentType & { kind: 'comment' };
export type TimelineActivityEvent<EventType> = EventType & { kind: 'event' };
export type TimelineActivityGroup<EventType> = {
	kind: 'activity';
	/** The first change's id, which stays the same as later changes join the group. */
	id: string;
	events: EventType[];
};
export type GroupedTimelineEntry<CommentType, EventType> =
	TimelineComment<CommentType> | TimelineActivityGroup<EventType>;

/**
 * Groups consecutive changes made by the same person, as long as no comment comes between them
 * and each change follows the previous one within the grouping window. The timeline must
 * already be sorted oldest first.
 */
export function groupConsecutiveActivity<CommentType, EventType extends GroupableActivityEvent>(
	sortedTimeline: (TimelineComment<CommentType> | TimelineActivityEvent<EventType>)[],
	groupingWindowMilliseconds = ACTIVITY_GROUPING_WINDOW_MILLISECONDS
): GroupedTimelineEntry<CommentType, EventType>[] {
	const groupedTimeline: GroupedTimelineEntry<CommentType, EventType>[] = [];
	for (const timelineEntry of sortedTimeline) {
		if (timelineEntry.kind === 'comment') {
			groupedTimeline.push(timelineEntry);
			continue;
		}
		const nextEvent: EventType = timelineEntry;
		const previousEntry = groupedTimeline.at(-1);
		if (
			previousEntry?.kind === 'activity' &&
			canJoinActivityGroup(previousEntry, nextEvent, groupingWindowMilliseconds)
		)
			previousEntry.events.push(nextEvent);
		else groupedTimeline.push({ kind: 'activity', id: nextEvent.id, events: [nextEvent] });
	}
	return groupedTimeline;
}

function canJoinActivityGroup<EventType extends GroupableActivityEvent>(
	activityGroup: TimelineActivityGroup<EventType>,
	nextEvent: EventType,
	groupingWindowMilliseconds: number
): boolean {
	const lastEvent = activityGroup.events[activityGroup.events.length - 1];
	const millisecondsBetween = +new Date(nextEvent.createdAt) - +new Date(lastEvent.createdAt);
	return (
		lastEvent.actorId === nextEvent.actorId && millisecondsBetween <= groupingWindowMilliseconds
	);
}
