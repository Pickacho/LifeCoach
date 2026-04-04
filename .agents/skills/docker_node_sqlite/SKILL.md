---
name: Docker & SQLite Workflow
description: Procedures for managing better-sqlite3 schema migrations and volume mappings in a Linux/Docker environment.
---

# Docker and SQLite Procedures

1. **DB Path Strategy**: `better-sqlite3` must ALWAYS use `process.env.DB_PATH` falling back to a `/data/` folder directory.
2. **Migrations**: When adding a table, add it to `db.exec()` block. Do not alter tables natively in SQLite without verifying if a drop/recreate is viable during dev.
3. **Build Tooling**: Whenever node packages are changed, `docker-compose up --build -d` must be suggested to the user, as node-gyp native bindings require rebuilding inside the container.
