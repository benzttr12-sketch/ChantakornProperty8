# Firebase security deployment

Local rules do not protect a live database until deployed. Do not enable public
read/write rules to work around permission errors. Supabase login sessions do not
authenticate Firestore requests; when Firebase is configured, this application
uses Firebase Authentication exclusively for the staff session.

## Activate

1. Sign in to the Firebase Console as the owner of the project named by
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in `.env.local`.
2. In Authentication, enable Email/Password. Set the password policy to require
   at least 12 characters and enable email enumeration protection. Check the
   authorized domains for the actual site (include localhost only for local use).
3. Deploy `firestore.rules` from this directory:

   ```sh
   npx firebase login
   npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```

   Alternatively publish the corresponding files in each Console Rules editor.
   Firebase Storage is intentionally not part of the default free deployment.

4. The owner-designated first administrator is `bennzttr1@gmail.com`. Register
   that address through `/register` and follow the email verification link. If
   the Auth account was created in the Console before its profile existed,
   verify the exact email and UID, then create `profiles/{that UID}` in the
   trusted Console with `id`, `full_name`, and role `USER` before promoting it
   to `ADMIN`. Do not infer a UID from an email or grant roles based on
   client-supplied email addresses. The login page can resend a verification
   link when the account exists but the first registration attempt did not
   complete its profile write.
5. Sign in at `/login`. New accounts are `USER`; only an existing verified ADMIN
   can change another member's role using `/admin/users`. Client deletion of
   profiles and self-demotion are denied. Existing Supabase users need Firebase
   accounts; existing private Supabase photo paths are not automatically migrated.
6. The default public site keeps Firebase on the free Spark plan. Firestore is
   the source of truth for accounts, roles, properties and inquiries. Customer
   consignment photos are uploaded to the Sites R2 binding and are only read
   through an authenticated server route; staff preview links are temporary
   browser object URLs and are never public download links. Do not enable
   billing as a workaround.

## Access policy

| Resource | Public/member | Verified AGENT | Verified ADMIN |
| --- | --- | --- | --- |
| Published properties, agent contact cards | Read | Read/write properties | Read/write |
| Draft properties | Denied | Read/write/delete | Read/write/delete |
| Inquiries | Validated create only | Read and update status only | Read/status update/delete |
| Profiles | Own USER creation; own name/phone editing | Own profile only | List and edit other profiles/roles |
| Site settings | Read | Read | Update |
| Property photos | Read | Upload/delete | Upload/delete |
| Consignment photos | Validated new upload only | Read/delete | Read/delete |
| Other collections/paths | Denied | Denied | Denied |

Role checks use the current profile document, so removing a staff role takes
effect on the next database/storage request without waiting for token expiration.
Staff must have verified email. Profile listeners remove the admin UI when a
role is revoked; the database rules are the actual security boundary.

## Verification

```sh
npm run typecheck
npm run test:database
npm run test:auth
npm run test:security
```

The emulator suite uses only `demo-chantakorn-security` on localhost and clears
only emulator data. Java 21+ is required on PATH. The portable Java runtime in
`.tools` is ignored by version control and is only for this workstation.

Public inquiry submissions and customer-photo uploads remain intentionally
anonymous. Validation and private reads do not stop automated spam or storage
abuse. Before a public launch, configure App Check enforcement and monitoring,
and use a rate-limited server endpoint if anonymous abuse prevention is required.
Do not claim live protection until the deployed rules and first admin account
have been verified in the actual Firebase project.
