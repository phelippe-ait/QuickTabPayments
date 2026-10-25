#!/usr/bin/env bash
#
# Export the demo Supabase project's data for the reviewer.
#
# Usage:
#   DATABASE_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' \
#     npm run db:export
#
# Requires `pg_dump` (PostgreSQL client tools). On macOS:
#   brew install libpq
#   export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
#
# Output:
#   supabase/auth_data.sql   - auth.users + auth.identities (logins)
#   supabase/public_data.sql - public schema data (restaurant, menu, orders)
#
# Both files are git-ignored. Include them in the submission folder/zip, not in
# the public GitHub repository: auth_data.sql contains password hashes.
#
# --on-conflict-do-nothing makes the dump safe to re-run. Import auth first:
# the handle_new_user() trigger creates profiles, and the public dump's profile
# rows are then skipped instead of failing with a duplicate-key error.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  echo "Example: DATABASE_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' npm run db:export" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump was not found. Install the PostgreSQL client tools first." >&2
  echo "On macOS: brew install libpq && export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"" >&2
  exit 1
fi

mkdir -p supabase

# PostgreSQL 18+ emits psql-only \restrict / \unrestrict meta-commands. Strip
# them so the same files work in psql and in the Supabase Studio SQL Editor.
pg_dump "$DATABASE_URL" \
  --data-only \
  --inserts \
  --on-conflict-do-nothing \
  --no-owner \
  --no-privileges \
  --table=auth.users \
  --table=auth.identities \
  | sed '/^\\restrict /d; /^\\unrestrict /d' \
  > supabase/auth_data.sql

pg_dump "$DATABASE_URL" \
  --data-only \
  --inserts \
  --on-conflict-do-nothing \
  --no-owner \
  --no-privileges \
  --schema=public \
  | sed '/^\\restrict /d; /^\\unrestrict /d' \
  > supabase/public_data.sql

echo "Wrote:"
echo "  supabase/auth_data.sql"
echo "  supabase/public_data.sql"
