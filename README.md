# articles2kindle

CLI tool that fetches articles from Feedly and Substack, bundles them into EPUBs, and sends them to your Kindle via email.

## Workflow

```
articles2kindle fetch      # Fetch articles from configured sources
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

You will be prompted to configure one or both sources:

- **Feedly** - access token and stream ID (use `user/<your-user-id>/tag/global.saved` for Saved For Later)
- **Substack** - publication URLs (e.g., `https://www.techemails.com`)

Plus shared settings:

- **SMTP** - host, port, username, password (for sending emails)
- **Kindle** - your `@kindle.com` email address and an approved sender email

Configuration is stored as a TOML file at the XDG-compliant config path (e.g., `~/.config/articles2kindle/config.toml` on Linux, `~/Library/Preferences/articles2kindle/config.toml` on macOS).

#### Substack paywalled content

To fetch paywalled Substack articles, set the `SUBSTACK_CONNECT_SID` environment variable:

1. Log in to Substack in your browser
2. Open DevTools → Application → Cookies → find `connect.sid` on the publication's domain
3. Copy the cookie value
4. Create a `.env` file in the project root (see `.env.example`):

```
SUBSTACK_CONNECT_SID=s%3Ayour-cookie-value-here
```

The cookie expires periodically — update it when you see auth errors.

To view your current configuration (with secrets masked):

```sh
articles2kindle config show
```

## Usage

### Fetch articles

Fetch new articles from all configured sources:

```sh
articles2kindle fetch
```

Fetch from a specific source:

```sh
articles2kindle fetch --source substack
articles2kindle fetch --source feedly
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

List all publications with article counts:

```sh
articles2kindle list publications
```

List all bundles:

```sh
articles2kindle list bundles
```

### Bundle into EPUB

Bundle all unbundled articles by publication:

```sh
articles2kindle bundle --publication "Internal Tech Emails"
```

Set a custom title:

```sh
articles2kindle bundle --publication "Internal Tech Emails" --title "Weekend Reading"
```

Include images in the EPUB (slower, downloads external images):

```sh
articles2kindle bundle --publication "Internal Tech Emails" --with-images
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
