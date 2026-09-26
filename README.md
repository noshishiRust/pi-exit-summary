# pi-exit-summary

[![CI](https://github.com/noshishiRust/pi-exit-summary/actions/workflows/ci.yml/badge.svg)](https://github.com/noshishiRust/pi-exit-summary/actions/workflows/ci.yml)

A [Pi](https://pi.dev) extension that prints a Codex-style token usage summary when you exit Pi:

```text
Token usage: total=23,253 input=22,544 (+104,960 cached) output=709 (reasoning 57) cost=$0.42
To resume this session: pi --session 3fb0c1e2-...
```

(The second line is printed by Pi itself; this extension adds the first.)

## Install

```bash
pi install npm:pi-exit-summary
```

Try it once without installing:

```bash
pi -e npm:pi-exit-summary
```

## How it works

- Hooks the `session_shutdown` event and prints one line after the terminal has been restored, right before Pi's own "To resume this session" hint.
- Usage totals are computed from session entries: assistant messages, tool-result nested usage, standalone usage entries (e.g. cache warming), compaction summaries, and branch summaries — the same sources Pi uses for its session totals.
- Provider-neutral by design: Pi normalizes usage for every provider (Anthropic, OpenAI, Google, custom providers) into one `Usage` shape before it reaches session entries, so this works with any API. Providers that do not report cache or reasoning tokens simply omit those segments.

## Behavior notes

- Interactive TUI mode only; print/JSON/RPC output stays clean.
- Silent when the session recorded no model usage.
- `reasoning` is displayed as a subset of `output`, matching provider semantics (never double-counted).
- `cost` uses the per-model rates Pi already computes; zero-cost setups (e.g. subscriptions) omit the segment.

## License

MIT
