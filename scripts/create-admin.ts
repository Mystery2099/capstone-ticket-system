import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createFirstAdministrator } from '../src/lib/server/bootstrap';
import { closeDatabase } from '../src/lib/server/db';

const { values } = parseArgs({
	options: {
		name: { type: 'string' },
		email: { type: 'string' },
		'password-file': { type: 'string' }
	}
});
if (!values.name || !values.email || !values['password-file']) {
	throw new Error(
		'Usage: pnpm admin:create --name "Your name" --email you@example.com --password-file /path/to/private/password-file'
	);
}
try {
	const password = (await readFile(values['password-file'], 'utf8')).replace(/\r?\n$/, '');
	await createFirstAdministrator(values.name, values.email, password);
	console.log('First administrator created. Sign in and complete authenticator setup.');
} catch {
	console.error(
		'Administrator setup failed. Check the input, migrations, and that no accounts exist. No existing accounts were changed.'
	);
	process.exitCode = 1;
} finally {
	await closeDatabase();
}
