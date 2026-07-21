# Project instructions

## Regression safety

- A requested correction is not permission to redesign, replace, or remove previously working behavior.
- Before changing a workflow, identify the exact requested change and the surrounding behavior that must remain intact.
- Preserve unrelated navigation, state transitions, database ownership, and business rules unless the user explicitly requests a change.
- Add focused regression coverage for existing behavior and make the smallest correction that resolves the reported problem.
- Treat local UI and validation corrections as scoped changes, not authorization to rebuild the wider workflow.

## Database SQL file numbering

- Every new `.sql` file under `database/` must use the next available three-digit sequential prefix.
- Determine the number by scanning all existing numbered `.sql` files in `database/` and incrementing the highest valid prefix.
- Always use three digits with leading zeroes where needed.
- Never reuse an existing prefix, overwrite a numbered SQL file, or renumber older files to close gaps.
- Never create a new unnumbered `run_in_supabase_sql_editor_*.sql` file.
- Prefer `NNN_run_in_supabase_sql_editor_<description>.sql` for manually executed Supabase files.
- Database SQL files are manual unless the user explicitly authorizes execution.
- Never execute database SQL automatically.

## Procurement document conversions

- Every procurement-document conversion must follow: source document -> editable conversion draft -> explicit user confirmation -> atomic destination creation.
- Opening or cancelling a conversion modal must never create or modify a document, relationship, allocation, status, or progress row.
- Conversion APIs must reload protected ownership and relationship fields server-side, preserve `procurement_chain_id`, reject stale source revisions, and use persistent server-enforced idempotency.
- Never add a direct one-click conversion mutation. New conversion actions must use the shared editable conversion-modal workflow and a transactional canonical service.
