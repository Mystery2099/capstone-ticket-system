# Authentication

Better Auth handles passwords, sessions, authenticator MFA, and single-use recovery
codes. `src/lib/auth-client.ts` provides the shared typed browser client.
Application services enforce ticket and administration permissions.

- Public signup and direct admin-plugin routes are disabled. An operator provisions
  the first administrator; administrators create subsequent accounts.
- Administrators enroll MFA before workspace access. Enrollment revokes older
  password-only sessions; later sign-ins require a second factor.
- Setup generates the QR code locally, provides a manual key, and requires users
  to confirm they saved recovery codes. Downloads contain no authenticator secret.
- Disabling an account or changing its role/email revokes sessions. Requests reload
  account state and permissions rather than trusting browser or stale session roles.
- Ordinary profile edits, account deletion, and disabling MFA over HTTP are blocked.
- Auth tables live in `src/lib/server/auth-schema.ts`. Keep `BETTER_AUTH_SECRET`
  stable and backed up: protected MFA material depends on it.

See [operations and recovery](azure-deployment.md) for operator commands and hosted
cookie, proxy, and throttling checks. The [redacted setup screenshot](screenshots/mfa-setup-redacted.png)
is safe for the course demonstration.
