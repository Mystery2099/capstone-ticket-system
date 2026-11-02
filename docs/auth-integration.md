# Better Auth integration

Better Auth manages password hashing, sessions, authenticator enrollment, MFA
challenges, and recovery codes. Application code enforces ticket ownership, staff
access, internal-note visibility, and administrator operations.

The browser uses one typed client in `src/lib/auth-client.ts`, configured with the
two-factor client plugin. Sign-in, enrollment, authenticator/recovery verification,
and sign-out use SDK methods. Components keep friendly failure messages instead
of exposing raw server errors. Both sign-out buttons share the same flow.

Public signup and direct admin-plugin routes are disabled. The first administrator
is provisioned explicitly; subsequent accounts are created through audited
administrator actions. Ordinary profile changes, account deletion, and disabling
MFA over HTTP are closed so they cannot bypass application rules.

Enrollment displays a QR code generated locally in the browser from the TOTP setup URI,
with a manual setup key as a fallback. Recovery codes can be downloaded as a text file;
the file contains only the codes and storage instructions, not the authenticator secret.
Users must confirm they saved the codes before verification. Downloading does not
mark that confirmation automatically.

Administrators must enroll MFA before workspace access. Enrollment revokes older
password-only sessions, and future sign-ins require a second factor. Administrative
writes require an active administrator session with MFA enabled. Role/email changes and
account disablement revoke sessions. Runtime requests re-read account state instead
of trusting a role copied into the browser or an old session response.

The schema includes Better Auth's user, session, account, verification, and
two-factor tables. Authenticator secrets and recovery material use Better Auth's
storage protection; keep the deployment secret stable and backed up securely.
The operator recovery procedure and separate database privileges are documented in
[production deployment](azure-deployment.md).

Local HTTP checks cover MFA enrollment, stale-session revocation, subsequent MFA
sign-in, single-use recovery codes, disabled accounts, and blocked administrative
endpoints. Hosted proxy/IP handling, secure cookies over the actual HTTPS origin,
and cross-instance login throttling still require deployment verification.

## Setup screenshot

[Redacted MFA setup screen](screenshots/mfa-setup-redacted.png), suitable for the course demonstration.
The QR code and recovery codes are hidden.
