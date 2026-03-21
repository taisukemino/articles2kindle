# articles2kindle

CLI tool that fetches articles from Feedly, Substack, and X (bookmarks), bundles them into EPUBs, and sends them to your Kindle via email.

## Workflow

```
pnpm dev fetch      # Fetch articles from configured sources
pnpm dev list       # Browse fetched articles
pnpm dev bundle     # Create an EPUB from selected articles
pnpm dev send       # Email the EPUB to your Kindle
```

## Setup

### Prerequisites

- Node.js 18+
- pnpm

### Install

```sh
pnpm install
```

### Key Commands

```sh
pnpm dev <command>     # Run any CLI command (e.g. pnpm dev fetch, pnpm dev list)
pnpm build             # Build for production
pnpm test              # Run tests
pnpm typecheck         # TypeScript type checking
pnpm lint              # Lint source files
```

### Configure

Copy `.env.example` to `.env` and fill in your values:

```sh
cp .env.example .env
```

See `.env.example` for all available variables. At minimum you need:

- **At least one source**: Feedly (`FEEDLY_ACCESS_TOKEN`, `FEEDLY_STREAM_ID`), Substack (`SUBSTACK_URLS`), or X Bookmarks (see below)
- **SMTP**: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (and optionally `SMTP_PORT`, `SMTP_SECURE`)
- **Kindle**: `KINDLE_EMAIL`, `KINDLE_SENDER_EMAIL` (and optionally `KINDLE_EMAILS` for multiple devices)

#### X Bookmarks setup

X Bookmarks requires an X app with API scopes `bookmark.read`, `tweet.read`, and `users.read`.

1. Create a project and app at the [X Developer Portal](https://developer.x.com/en/portal/dashboard)
2. Copy the app's **Client ID** (from Keys and tokens) to `X_CLIENT_ID` in your `.env` file
3. Run:

```sh
pnpm dev x auth
```

This opens a browser, completes OAuth, and saves `X_ACCESS_TOKEN`, `X_REFRESH_TOKEN`, and `X_USER_ID` in `.env` automatically.

Threads are automatically detected and stitched together when a thread starter is bookmarked.

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

## Usage

### Fetch articles

Fetch new articles from all configured sources:

```sh
pnpm dev fetch
```

Fetch from a specific source:

```sh
pnpm dev fetch --source feedly
pnpm dev fetch --source substack
pnpm dev fetch --source x
```

Use `--full` to ignore the last fetch timestamp and re-fetch everything:

```sh
pnpm dev fetch --full
```

Limit the number of articles fetched (useful for testing):

```sh
pnpm dev fetch --source x --limit 3
```

### List articles

Show unbundled articles:

```sh
pnpm dev list
```

Filter by source:

```sh
pnpm dev list --source feedly
pnpm dev list --source substack
pnpm dev list --source x
```

Filter by author:

```sh
pnpm dev list --author "John Doe"
```

Include already-bundled articles:

```sh
pnpm dev list --all
```

List all publications with article counts:

```sh
pnpm dev list publications
```

List all bundles:

```sh
pnpm dev list bundles
```

### Bundle into EPUB

Bundle all unbundled articles by publication:

```sh
pnpm dev bundle --publication "Internal Tech Emails"
```

Bundle all unbundled articles from a specific source:

```sh
pnpm dev bundle --source x
pnpm dev bundle --source substack --title "Substack Digest"
```

Set a custom title:

```sh
pnpm dev bundle --publication "Internal Tech Emails" --title "Weekend Reading"
```

Include images in the EPUB (slower, downloads external images):

```sh
pnpm dev bundle --publication "Internal Tech Emails" --with-images
```

Large bundles are automatically split into parts to stay under Gmail's 25MB SMTP limit.

### Send to Kindle

Send the latest unsent bundle:

```sh
pnpm dev send
```

Send a specific bundle by ID:

```sh
pnpm dev send --bundle 3
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
- **Config**: Environment variables via `.env`
- **Build**: tsup
- **Test**: vitest

## License

ISC
