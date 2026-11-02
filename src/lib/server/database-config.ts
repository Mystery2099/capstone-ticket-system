import { z } from 'zod';

/** Explicit local storage keeps test processes isolated from hosted credentials. */
export function resolveDatabaseConfig(environment: NodeJS.ProcessEnv) {
	if (environment.DATABASE_URL) return { kind: 'url' as const, url: environment.DATABASE_URL };
	if (environment.DATA_DIR) {
		if (environment.NODE_ENV === 'production')
			throw new Error(
				'Production requires hosted PostgreSQL; DATA_DIR is only for development and tests.'
			);
		return { kind: 'local' as const, directory: environment.DATA_DIR };
	}
	if (environment.PGHOST) {
		const result = z
			.object({
				PGHOST: z.string().trim().min(1),
				PGUSER: z.string().trim().min(1),
				PGDATABASE: z.string().trim().min(1),
				PGPORT: z.coerce.number().int().min(1).max(65535).default(5432),
				PGPASSWORD: z.string().min(1)
			})
			.safeParse(environment);
		if (!result.success) {
			const invalidSettingNames = [
				...new Set(result.error.issues.map((issue) => String(issue.path[0])))
			].join(', ');
			throw new Error(
				`Complete the PostgreSQL settings in .env: ${invalidSettingNames}. No local database fallback was used.`
			);
		}
		const postgresSettings = result.data;
		return {
			kind: 'postgres' as const,
			options: {
				host: postgresSettings.PGHOST,
				port: postgresSettings.PGPORT,
				username: postgresSettings.PGUSER,
				database: postgresSettings.PGDATABASE,
				password: postgresSettings.PGPASSWORD,
				ssl: { rejectUnauthorized: true },
				max: 5
			}
		};
	}
	if (environment.NODE_ENV === 'production')
		throw new Error(
			'Set DATABASE_URL or PGHOST/PGUSER/PGDATABASE/PGPASSWORD for hosted PostgreSQL.'
		);
	return { kind: 'local' as const, directory: '.data/postgres' };
}
