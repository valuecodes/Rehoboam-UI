# Pull Request Description Generation Instructions

Generate a PR title and description from the diff for this repository.

## PR Title (Semantic)

Use Semantic Commit Messages format exactly: `<type>: <subject>`.

### Allowed Types

Only these `<type>` values: chore, docs, feat, fix, refactor, style, test.

### Subject Rules

- Present tense, start with a verb
- Keep it concise (<= 72 chars)
- No trailing period
- Mention the area touched when helpful (cli, tests, tooling, config, docs)

Examples:

- `feat: add argument parsing to cli`
- `test: cover main output`
- `chore: align eslint config`

## PR Description (Required Sections)

Use exactly these headings, in this order:

## What

- Start with a 3–5 sentence description (plain text, no bullets)
- Then add optional bullet points describing what changed and why
- Call out affected areas like `src/`, tests, or config files when relevant
- If CLI behavior/output changes, note the change and any new flags or args

## How to test

Provide concrete, reproducible steps using repo scripts, such as:

- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm start` (when CLI behavior is part of the change)

Include expected results (what "good" looks like).
If you did not run something, say so and list what should be run.

## Security review

Always include a short checklist-style review. Use this format:

- **Secrets / env vars:** <changed | not changed>. (Never add real secrets to the repo.)
- **Auth / session:** <changed | not changed>.
- **Network / API calls:** <changed | not changed>. (New external calls, endpoints, telemetry.)
- **Data handling / PII:** <changed | not changed>. (Logging, storage, user-provided data.)
- **Dependencies:** <added/updated | not changed>. (Call out any new deps and why; prefer minimal deps.)

If no impact, write exactly:
`No security-impacting changes identified.`
Then add 1-2 bullets justifying, e.g.:

- No new dependencies and no network calls
- No env var changes and no auth/session logic touched

## Tone

- Keep it concise and high-signal
- Use bullet points
- Do not invent scripts/commands/files that are not in the repo
