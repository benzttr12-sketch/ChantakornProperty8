# Supabase legacy reference

The production application now uses Firebase Firestore and Firebase Authentication
as its source of truth. The files in this directory are retained only to document
the previous Supabase schema and to support a deliberate, one-time migration if
the owner supplies a real source dataset.

Do not run this guide as part of a new deployment. Configure Firebase using
[FIREBASE-SECURITY.md](../FIREBASE-SECURITY.md), publish `firestore.rules`, and
create the first verified administrator profile before entering listings.

The configured Supabase endpoint currently has no application tables, so there is
no automatic migration to perform. Existing Supabase accounts, rows, and private
photo paths are not silently copied or used as a secondary write target when
Firebase is configured. Any future migration must be reviewed, mapped, and run
with a trusted server credential outside the browser.
