/** Dates and times as the ticket screens show them, such as "Mar 4" and "3:05 PM". */

export function formatDate(timestamp: Date | string): string {
	return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime(timestamp: Date | string): string {
	return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(timestamp: Date | string): string {
	return `${formatDate(timestamp)}, ${formatTime(timestamp)}`;
}

/** The time for something from today, otherwise the date. */
export function formatRecentTimestamp(timestamp: Date | string): string {
	const isToday = new Date(timestamp).toDateString() === new Date().toDateString();
	return isToday ? formatTime(timestamp) : formatDate(timestamp);
}
