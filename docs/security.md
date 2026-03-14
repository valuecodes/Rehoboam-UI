# Security

## Cloudflare WAF Rate Limiting Rule

The `/api/events` Worker endpoint is protected by a 5-minute edge cache (per origin), so most traffic never reaches the Worker. Rate limiting is most effective at the CDN layer — before the cache is even consulted — using a Cloudflare WAF rate limiting rule.

### Where to configure

Cloudflare Dashboard → **Security** → **WAF** → **Rate limiting rules** → Create rule.

### Rule spec

| Field             | Value                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------- |
| Rule name         | `Rehoboam API Rate Limit`                                                              |
| Expression        | `(http.request.uri.path matches "^/api/") and (http.host eq "rehoboam.valuecodes.fi")` |
| Requests          | `100` per `60` seconds                                                                 |
| Characteristics   | IP address                                                                             |
| Mitigation action | Block (returns 429)                                                                    |
| Block duration    | 60 seconds                                                                             |

### Rollout procedure

1. Create the rule with action set to **Log** (not Block). Monitor Security → Events for ~24 hours to confirm the threshold doesn't fire on legitimate traffic.
2. Switch action to **Block** once the baseline looks clean.

### Rationale

- Operates before Cloudflare's cache, so it catches volumetric abuse regardless of cache state.
- Protects D1 query costs from cache-miss bursts and cache-busting attempts.
- 100 req/60s is generous for a read-only public endpoint; adjust downward if abuse is observed.

---

## Prompt Injection Hardening (Jobs Worker)

The jobs worker fetches news from external RSS feeds and passes titles and descriptions to an LLM for classification. Two layers of hardening reduce the chance that malformed feed content or unsafe model output affects classification quality or stored data.

### Input sanitization

Before content is sent to the LLM (`apps/jobs/src/lib/sanitize.ts`):

- Null bytes and C0/C1 control characters stripped (newline and tab preserved)
- `<script>` and `<style>` blocks removed with their contents
- Remaining HTML tags stripped
- Whitespace collapsed and trimmed
- Unicode normalized to NFC
- Title truncated to 200 chars, description to 500 chars

### Output validation

AI-returned fields are validated with strict Zod schemas before storage:

- `title`: max 100 chars, HTML stripped, trimmed
- `location`: max 100 chars, dangerous HTML removed, trimmed, and restricted to Unicode letters/numbers plus basic punctuation used in place names

If AI output fails these constraints, the item falls back to the original (sanitized) news title with default category/severity rather than crashing the batch.

This is hardening, not a complete prompt-injection guarantee. Plain-text instructions inside feed content can still reach the model, so the system continues to rely on constrained prompts, JSON-mode responses, and schema validation at the output boundary.
