/**
 * pi-exit-summary — print a token usage summary when Pi exits.
 *
 * On quit (interactive TUI mode only), prints one Codex-style line after the
 * terminal has been restored and before Pi's own "To resume this session"
 * hint. Usage totals come from session entries, which Pi normalizes across
 * every provider, so this works with any built-in or custom provider.
 */

import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent";

/** Minimal structural view of pi's provider-neutral Usage. */
interface UsageLike {
	input?: number;
	output?: number;
	cacheRead?: number;
	cacheWrite?: number;
	reasoning?: number;
	totalTokens?: number;
	cost?: { total?: number };
}

export interface UsageTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	reasoning: number;
	totalTokens: number;
	cost: number;
}

export function createUsageTotals(): UsageTotals {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0, cost: 0 };
}

/** Sum one Usage record. Mirrors pi semantics: reasoning is part of output, never added twice. */
export function addUsage(totals: UsageTotals, usage: UsageLike): void {
	totals.input += usage.input ?? 0;
	totals.output += usage.output ?? 0;
	totals.cacheRead += usage.cacheRead ?? 0;
	totals.cacheWrite += usage.cacheWrite ?? 0;
	totals.reasoning += usage.reasoning ?? 0;
	totals.totalTokens +=
		usage.totalTokens ?? (usage.input ?? 0) + (usage.output ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
	totals.cost += usage.cost?.total ?? 0;
}

/**
 * Sum usage across all session entries: assistant messages, tool-result
 * nested usage, standalone usage entries (e.g. cache warming), compaction
 * summaries, and branch summaries. This matches Pi's own session totals.
 */
export function collectUsageTotals(entries: SessionEntry[]): UsageTotals {
	const totals = createUsageTotals();
	for (const entry of entries) {
		if (entry.type === "message") {
			const message = entry.message;
			if ((message.role === "assistant" || message.role === "toolResult") && message.usage) {
				addUsage(totals, message.usage);
			}
		} else if (entry.type === "usage") {
			addUsage(totals, entry.usage);
		} else if (entry.type === "compaction" || entry.type === "branch_summary") {
			if (entry.usage) addUsage(totals, entry.usage);
		}
	}
	return totals;
}

function formatNumber(value: number): string {
	return value.toLocaleString("en-US");
}

function formatCost(value: number): string {
	return value >= 0.1 ? value.toFixed(2) : value.toFixed(4);
}

/**
 * Render the summary line, or null when the session recorded no model usage
 * (a fresh session quit stays silent).
 */
export function formatUsageSummary(totals: UsageTotals): string | null {
	if (totals.totalTokens === 0) return null;
	const parts = [`total=${formatNumber(totals.totalTokens)}`, `input=${formatNumber(totals.input)}`];
	if (totals.cacheRead > 0) parts.push(`(+${formatNumber(totals.cacheRead)} cached)`);
	if (totals.cacheWrite > 0) parts.push(`(${formatNumber(totals.cacheWrite)} cache write)`);
	parts.push(`output=${formatNumber(totals.output)}`);
	if (totals.reasoning > 0) parts.push(`(reasoning ${formatNumber(totals.reasoning)})`);
	if (totals.cost > 0) parts.push(`cost=$${formatCost(totals.cost)}`);
	return `Token usage: ${parts.join(" ")}`;
}

export default function exitSummaryExtension(pi: ExtensionAPI): void {
	pi.on("session_shutdown", (event, ctx) => {
		if (event.reason !== "quit" || ctx.mode !== "tui") return;
		const line = formatUsageSummary(collectUsageTotals(ctx.sessionManager.getEntries()));
		if (line) process.stdout.write(`${line}\n`);
	});
}
