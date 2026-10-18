# Local-first storage, no accounts yet

Saved Versions, the Kitchen profile, the Cook log and the cook's settings live in the browser, in a versioned format, with export and import as a file. The alternative was accounts and a database from the start, which would let cooks keep recipes across devices but needs sign-in, a database, privacy handling and running costs before anyone has said they want it. For now the people testing Remy can use it without signing up.

## Consequences

- Clearing the browser or changing device loses the data, so export ships together with saving.
- Every stored record carries a schema version, so a later move to accounts is a migration, not a rewrite.
- Nothing that needs sharing (public recipes, shared Versions) is built until accounts exist.
