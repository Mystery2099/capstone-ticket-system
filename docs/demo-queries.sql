-- Demonstration queries: Support Ticket Management System
-- CISY 8503 Applied Database Management, Open Source Database Lab
-- Student: Mathew Kennedy-Brewer
--
-- Run with psql against the hosted database, for example:
--   psql "sslmode=verify-full sslrootcert=system" -f docs/demo-queries.sql
-- Sections 1-4 only read data. Section 5 runs inside a transaction that is always
-- rolled back, so it never changes anything.

-- 1. Tickets joined to their requester, assignee, category, and status.
SELECT t.ticket_number,
       t.subject,
       requester.name AS requester,
       COALESCE(assignee.name, '(unassigned)') AS assignee,
       c.name AS category,
       s.label AS status,
       t.priority,
       t.created_at
FROM ticket t
JOIN "user" requester ON requester.id = t.requester_id
LEFT JOIN "user" assignee ON assignee.id = t.assigned_to_user_id
JOIN category c ON c.id = t.category_id
JOIN ticket_status s ON s.code = t.status_code
ORDER BY t.ticket_number DESC
LIMIT 10;

-- 2. Counts grouped by status, then by category.
SELECT s.label AS status, COUNT(t.id) AS tickets
FROM ticket_status s
LEFT JOIN ticket t ON t.status_code = s.code
GROUP BY s.label, s.code
ORDER BY tickets DESC;

SELECT c.name AS category, COUNT(t.id) AS tickets,
       COUNT(t.id) FILTER (WHERE t.status_code IN ('resolved', 'closed')) AS finished
FROM category c
LEFT JOIN ticket t ON t.category_id = c.id
GROUP BY c.name
ORDER BY tickets DESC;

-- 3. One ticket's full history in order: comments and server-written events together.
--    Change 1046 to any ticket number.
SELECT happened_at, kind, who, detail
FROM (
    SELECT cm.created_at AS happened_at,
           CASE WHEN cm.is_internal THEN 'internal note' ELSE 'public comment' END AS kind,
           u.name AS who,
           LEFT(cm.body, 80) AS detail
    FROM ticket_comment cm
    JOIN ticket t ON t.id = cm.ticket_id
    JOIN "user" u ON u.id = cm.author_id
    WHERE t.ticket_number = 1046
    UNION ALL
    SELECT e.created_at, 'event: ' || e.event_type, COALESCE(u.name, '(system)'), e.details::text
    FROM ticket_event e
    JOIN ticket t ON t.id = e.ticket_id
    LEFT JOIN "user" u ON u.id = e.actor_id
    WHERE t.ticket_number = 1046
) history
ORDER BY happened_at;

-- 4. What a requester's comment count looks like compared with staff, showing why
--    internal notes must be filtered on the server.
SELECT t.ticket_number,
       COUNT(cm.id) FILTER (WHERE NOT cm.is_internal) AS visible_to_requester,
       COUNT(cm.id) AS visible_to_staff
FROM ticket t
JOIN ticket_comment cm ON cm.ticket_id = t.id
GROUP BY t.ticket_number
HAVING COUNT(cm.id) FILTER (WHERE cm.is_internal) > 0
ORDER BY t.ticket_number;

-- 5. Constraints rejecting bad data. Each statement fails on its own savepoint, and the
--    whole transaction is rolled back at the end.
BEGIN;

SAVEPOINT missing_category;
-- Fails: the category does not exist (foreign key). This is an update rather than an
-- insert, because a failed insert would still use up a ticket number from the sequence.
UPDATE ticket SET category_id = gen_random_uuid() WHERE ticket_number = 1046;
ROLLBACK TO SAVEPOINT missing_category;

SAVEPOINT bad_priority;
-- Fails: priority only accepts low, normal, or high (check constraint).
UPDATE ticket SET priority = 'urgent' WHERE ticket_number = 1046;
ROLLBACK TO SAVEPOINT bad_priority;

SAVEPOINT bad_status;
-- Fails: the status must exist in ticket_status (foreign key).
UPDATE ticket SET status_code = 'archived' WHERE ticket_number = 1046;
ROLLBACK TO SAVEPOINT bad_status;

ROLLBACK;
