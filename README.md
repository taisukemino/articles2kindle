# articles2kindle

CLI tool that fetches articles from your Feedly "Saved For Later" collection, bundles them into EPUBs, and sends them to your Kindle via email.

## Workflow

```
articles2kindle fetch      # Fetch saved articles from Feedly
articles2kindle list       # Browse fetched articles
articles2kindle bundle     # Create an EPUB from selected articles
articles2kindle send       # Email the EPUB to your Kindle
```

## Setup

### Prerequisites

- Node.js 18+
- pnpm

### Install

```sh
pnpm install
pnpm build
```

### Configure

Run the interactive setup wizard:

```sh
articles2kindle config init
```

You will be prompted for:

- **Feedly** - access token and stream ID (use `user/<your-user-id>/tag/global.saved` for Saved For Later)
- **SMTP** - host, port, username, password (for sending emails)
- **Kindle** - your `@kindle.com` email address and an approved sender email

Configuration is stored as a TOML file at the XDG-compliant config path (e.g., `~/.config/articles2kindle/config.toml` on Linux, `~/Library/Preferences/articles2kindle/config.toml` on macOS).

To view your current configuration (with secrets masked):

```sh
articles2kindle config show
```

## Usage

### Fetch articles

Fetch new articles from your Feedly "Saved For Later" collection and store them locally in SQLite:

```sh
articles2kindle fetch
```

Use `--full` to ignore the last fetch timestamp and re-fetch everything:

```sh
articles2kindle fetch --full
```

### List articles

Show unbundled articles:

```sh
articles2kindle list
```

Filter by author:

```sh
articles2kindle list --author "John Doe"
```

Include already-bundled articles:

```sh
articles2kindle list --all
```

List all authors with article counts:

```sh
articles2kindle list authors
```

List all bundles:

```sh
articles2kindle list bundles
```

### Bundle into EPUB

Create an EPUB from specific articles by ID:

```sh
articles2kindle bundle --articles 1,2,3
```

Bundle all unbundled articles by a specific author:

```sh
articles2kindle bundle --author "John Doe"
```

Set a custom title:

```sh
articles2kindle bundle --author "John Doe" --title "Weekend Reading"
```

Large bundles are automatically split into parts to stay under Gmail's 25MB SMTP limit.

### Send to Kindle

Send the latest unsent bundle:

```sh
articles2kindle send
```

Send a specific bundle by ID:

```sh
articles2kindle send --bundle 3
```

## Development

```sh
pnpm dev               # Run CLI via tsx (no build step)
pnpm build             # Build with tsup
pnpm test              # Run tests with vitest
pnpm test:watch        # Run tests in watch mode
pnpm typecheck         # TypeScript type checking
pnpm format            # Format code with Prettier
pnpm format:check      # Check formatting
pnpm db:generate       # Generate Drizzle migrations
pnpm db:migrate        # Run database migrations
```

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **CLI**: Commander.js
- **Database**: SQLite via Drizzle ORM + better-sqlite3
- **EPUB generation**: epub-gen-memory
- **Email**: Nodemailer (SMTP)
- **Config**: TOML files (XDG-compliant paths)
- **Build**: tsup
- **Test**: vitest

## License

ISC
