# AI Assistant Guidelines

- Never assume missing context. Ask questions if uncertain
- Never hallucinate libraries or packages – only use known, verified npm packages
- Always confirm file paths and module names exist before referencing them in code or tests
- Never delete or overwrite existing code unless explicitly instructed to
- Always run linting and type checking before marking tasks complete
- Use the correct package manager (pnpm) as specified in the project
- Fix things at the cause, not the symptom

# Readable Code Principles

- Write code that minimizes time-till-understanding for future self and others
- Choose specific, concrete names over abstract or generic ones
- Avoid abbreviations like `tmp`, `str`, `obj`, `retval`, `get`
- Use longer, descriptive names that clearly express intent
- Be consistent with naming conventions throughout the codebase
- Use camelCase for variables and PascalCase for types/interfaces
- Name boolean functions with `is`, `has`, or `can` prefixes (e.g., `isEmpty`)
- Use verbs for functions/methods, nouns for classes
- Add `_` prefix for private functions
- Extract unrelated subproblems into separate functions
- Avoid giant expressions - break them into smaller, named parts
- Use UPPER_CASE for constants
- Remove obvious words and redundant protocol names from variable names
- Delete commented-out code instead of leaving it disabled
- Use explaining variables instead of comments when possible
- YAGNI (You Aren't Gonna Need It): Don't write code before you need it

# TypeScript Best Practices

- Always use strict type checking - no `any` types unless absolutely necessary
- Use `unknown` instead of `any` when the type is truly unknown
- Define proper interfaces and types for all data structures
- Use generic types to create reusable, type-safe components
- Leverage discriminated unions for complex state management
- Use `readonly` for immutable data and `const assertions` where appropriate
- Prefer type guards and assertion functions over type assertions
- Centralize type definitions close to the domain they describe

# Code Organization

- Never create a file longer than 300 lines of code. If a file approaches this limit, refactor by splitting it into modules or helper files
- Organize code into clearly separated modules, grouped by feature or responsibility

# Coding Standards

- Use TypeScript with strict mode enabled
- Follow the project's Prettier configuration
- Prefer `const` over `let`, and avoid `var` entirely
- Use `async/await` over Promises for better readability
- Use proper error handling with custom error classes when appropriate
- Prefer composition over inheritance and favor functional programming patterns

# Project Conventions

- Use PascalCase for:
  - Class names (e.g., FeedlyAdapter, EpubBuilder)
  - Type/Interface names (e.g., SourceArticle, AppConfig)
- Use camelCase for:
  - Variables (e.g., articleCount, isLoading)
  - Functions (e.g., fetchArticles, normalizeAuthor)
  - File names (e.g., builder.ts, sender.ts)
- Use kebab-case for:
  - Folder names (e.g., sources/, cli/)
  - Multi-word file names (e.g., sync-log.ts)
- Use SCREAMING_SNAKE_CASE for:
  - Constants (e.g., MAX_FILE_SIZE, DEFAULT_TIMEOUT)
- Follow consistent file structure with sources, cli, db, epub, email folders
- Maintain consistent architecture patterns across the codebase

# Known Issues

## Images stripped from EPUBs

Images (`<img>` tags) are intentionally stripped during HTML sanitization in `src/epub/templates.ts`. The `epub-gen-memory` library attempts to download every external image referenced in article HTML. Its `fetchTimeout` and `retryTimes` options do not reliably prevent hanging — Node.js fetch operations block the event loop indefinitely for image-heavy publications (e.g., Julia Evans: 73 articles, 284 images). This caused the entire bundling process to stall with no error output.

Stripping images at the sanitization layer is the current workaround. To restore images in the future, consider:

- Pre-downloading images with proper AbortController timeouts before passing HTML to epub-gen-memory
- Replacing external image URLs with data URIs during a preprocessing step
- Switching to an EPUB library with more reliable timeout behavior

# Tech Stack

- Runtime: Node.js + TypeScript
- Package manager: pnpm
- CLI framework: Commander.js
- Database: SQLite via Drizzle ORM + better-sqlite3
- EPUB generation: epub-gen-memory
- Email: Nodemailer (SMTP)
- Config: TOML files in XDG-compliant paths
- Build: tsup
- Test: vitest
- Formatter: Prettier
