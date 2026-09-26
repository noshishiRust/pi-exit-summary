# Design notes — pi-exit-summary

## Goal

Reproduce the Codex-style exit summary in Pi: when the user quits the
interactive TUI, print one line of session token usage after the terminal is
restored, next to Pi's own "To resume this session" hint.

Codex also prints "Any running work continues." Pi runs in the foreground:
quitting stops the work and only the session survives, so that claim is
deliberately not reproduced.

## How it hooks in

- Event: `session_shutdown` with `reason === "quit"` and `ctx.mode === "tui"`.
  Session replacement (`new`/`resume`/`fork`) and `reload` must stay silent,
  and print/JSON/RPC output must not be polluted.
- Ordering (verified against pi 0.87.1 `InteractiveMode.shutdown()`):
  TUI stop / terminal restore → `session_shutdown` handlers → Pi prints
  `To resume this session: pi --session <id>`. A plain `process.stdout.write`
  from the handler therefore lands cleanly after restore, right before the
  resume hint.
- Exception: SIGTERM/SIGHUP-triggered shutdown runs handlers before terminal
  restore; output there may interleave with restore sequences. Accepted
  trade-off (rare path).

## Usage sources and provider neutrality

Totals are computed from session entries only — never from provider APIs —
so every provider (built-in or custom via `pi.registerProvider()`) is
supported without per-provider code. Pi normalizes all providers into one
`Usage` shape (`input`, `output`, `cacheRead`, `cacheWrite`, `reasoning?`,
`totalTokens`, `cost`) before entries are persisted.

Summed entry kinds (matching Pi's own session totals):

- `message` entries with role `assistant` (usage always present)
- `message` entries with role `toolResult` (nested model usage, optional)
- `usage` entries (e.g. cache warming)
- `compaction` and `branch_summary` entries (summary generation usage)

Semantics honored:

- `reasoning` is already included in `output`; displayed as a subset
  annotation, never added to totals.
- `totalTokens` falls back to `input + output + cacheRead + cacheWrite`
  when a record omits it.
- `cost` uses Pi's pre-computed per-model `cost.total`.

## Formatting

```
Token usage: total=23,253 input=22,544 (+104,960 cached) output=709 (reasoning 57) cost=$0.42
```

- `(+N cached)` only when `cacheRead > 0`; `(N cache write)` only when
  `cacheWrite > 0`; `(reasoning N)` only when `reasoning > 0`.
- `cost` shown only when > 0; `>= 0.1` uses 2 decimals, smaller uses 4.
- No usage at all (fresh session quit) prints nothing.

## Verification

- `node --test test/*.test.ts` — 5 tests: entry-kind summing, totalTokens
  fallback, segment rendering, small-cost formatting, silence on zero usage.
- `tsc --noEmit` — strict, types from `@earendil-works/pi-coding-agent` and
  `@earendil-works/pi-ai`.
- End-to-end in a pty (`script`): `pi -e <pkg>` + one prompt + Ctrl+D
  printed the usage line followed by Pi's resume hint; print mode
  (`pi -p`) stayed silent and clean.

## Non-goals (v1)

- No configuration flags; one deterministic line.
- No cost recalculation (trusts Pi's rates).
- Not a "background work continues" daemon — see Goal.
