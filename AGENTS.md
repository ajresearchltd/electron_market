# Project instructions

## Database SQL file numbering

- Every new `.sql` file under `database/` must use the next available three-digit sequential prefix.
- Determine the number by scanning all existing numbered `.sql` files in `database/` and incrementing the highest valid prefix.
- Always use three digits with leading zeroes where needed.
- Never reuse an existing prefix, overwrite a numbered SQL file, or renumber older files to close gaps.
- Never create a new unnumbered `run_in_supabase_sql_editor_*.sql` file.
- Prefer `NNN_run_in_supabase_sql_editor_<description>.sql` for manually executed Supabase files.
- Database SQL files are manual unless the user explicitly authorizes execution.
- Never execute database SQL automatically.
