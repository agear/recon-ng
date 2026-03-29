# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Framework

```bash
# Interactive console
./recon-ng

# CLI mode (non-interactive)
./recon-cli -m <module_path> -o SOURCE=example.com -x

# Web UI + REST API
./recon-web

# Docker
docker-compose up
```

Key flags for `recon-ng`/`recon-cli`:
- `-w <workspace>` — select workspace
- `-r <script>` — execute command script
- `--stealth` — disable version check, analytics, and marketplace requests
- `-m <module>` — specify module (CLI only)
- `-g name=value` / `-o name=value` — set global/module options (CLI only)
- `-x` — execute the module immediately (CLI only)

## Installing Dependencies

```bash
pip install -r REQUIREMENTS
```

No formal build step. No test suite is present in this repo.

## Architecture Overview

Recon-ng is a modular OSINT reconnaissance framework with three execution modes (console, CLI, web), all sharing a common core.

### Core Classes (`recon/core/`)

- **`base.py` — `Recon` class**: Top-level orchestrator. Manages workspaces, module loading/unloading, marketplace, global options, and the main command loop. Instantiated by each entry point script.
- **`framework.py` — `Framework` class**: Base class for everything. Extends `cmd.Cmd`. Provides the SQLite database interface (`self.query()`), HTTP request wrapper (`self.request()`), output methods (`self.output()`, `self.error()`, `self.alert()`), and global option handling. `Recon` inherits from this.
- **`module.py` — `BaseModule` class**: Template all modules must subclass. Handles option parsing, input validation, and the `module_run()` entry point. Inherits from `Framework`.

### Module System

Modules live in `~/.recon-ng/modules/` (installed via `marketplace install`), organized as `category/subcategory/name.py`. They are dynamically loaded via `importlib` at runtime.

Every module must:
1. Subclass `BaseModule` (from `recon.core.module`)
2. Define a `meta` dict with `name`, `author`, `description`, `query`, `options`, `required_keys`, etc.
3. Implement a `module()` method containing the main logic

Modules interact with the workspace database via `self.query()` and use `self.add_*()` helper methods (e.g., `self.add_hosts()`, `self.add_contacts()`) to write results into the standard tables.

### Mixins (`recon/mixins/`)

Reusable capabilities modules can inherit alongside `BaseModule`:
- `search.py` — Google, Bing, Shodan API wrappers
- `browser.py` — Mechanize-based browser
- `threads.py` — Threading utilities
- `oauth.py` — OAuth helpers

### Web Mode (`recon/core/web/`)

Flask app with REST API (Flask-RESTful + Flasgger/Swagger). Uses Redis + RQ for async background job execution. The API mirrors the console commands and results are stored in the workspace database.

### Database

Each workspace gets its own SQLite DB at `~/.recon-ng/workspaces/<name>/data.db`. Standard tables: `domains`, `hosts`, `contacts`, `credentials`, `leaks`, `ports`, `vulnerabilities`, `companies`, `netblocks`, `locations`, `pushpins`, `profiles`, `repositories`. Schema version is tracked and migrations run automatically on open.

### Global Options

Set via `options set <name> <value>` in console, or `-g name=value` in CLI:

| Option | Default | Purpose |
|--------|---------|---------|
| `nameserver` | 8.8.8.8 | DNS resolver |
| `proxy` | — | HTTP proxy (host:port) |
| `threads` | 10 | Thread pool size |
| `timeout` | 10 | Socket timeout (seconds) |
| `user-agent` | — | Custom User-Agent header |
| `verbosity` | 0 | 0=quiet, 1=verbose, 2=debug |

### Marketplace

Remote module repository hosted on GitHub. Commands: `marketplace search`, `marketplace info`, `marketplace install <path>`, `marketplace remove <path>`. API key management: `keys add <name> <value>`, `keys list`.
