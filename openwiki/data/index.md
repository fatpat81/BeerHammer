# Files

- [Postgres Data Model, Prisma Migrations & Seed](data-model-and-migrations.md) - The canonical 11th Edition schema in packages/db-client: 13 tables split into public rules catalog, per-user tables and the sync_metadata ETL log; JSON payload columns with no DB validation; migrate-on-boot in both the pulled prod image and the source-build stack; the manual idempotent seed; and why rls-policies.sql is intent, not enforcement.
