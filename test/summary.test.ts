import assert from "node:assert/strict";
import { test } from "node:test";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { Usage } from "@earendil-works/pi-ai";
import {
	addUsage,
	collectUsageTotals,
	createUsageTotals,
	formatUsageSummary,
} from "../src/extension.ts";

const ts = "2026-01-01T00:00:00.000Z";

function usage(partial: Partial<Usage>): Usage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		...partial,
	};
}

function assistantEntry(u: Usage): SessionEntry {
	return {
		type: "message",
		id: "a1",
		parentId: null,
		timestamp: ts,
		message: { role: "assistant", content: [], api: "anthropic-messages", provider: "p", model: "m", usage: u, stopReason: "stop", timestamp: 0 },
	};
}

function toolResultEntry(u: Usage): SessionEntry {
	return {
		type: "message",
		id: "t1",
		parentId: "a1",
		timestamp: ts,
		message: { role: "toolResult", toolCallId: "c1", toolName: "x", content: [], usage: u, isError: false, timestamp: 0 },
	};
}

function usageEntry(u: Usage, kind = "cache_warm"): SessionEntry {
	return { type: "usage", id: "u1", parentId: null, timestamp: ts, kind, provider: "p", model: "m", usage: u };
}

function compactionEntry(u: Usage): SessionEntry {
	return {
		type: "compaction",
		id: "cp1",
		parentId: null,
		timestamp: ts,
		summary: "s",
		firstKeptEntryId: "cp1",
		tokensBefore: 1,
		usage: u,
	};
}

test("collectUsageTotals sums assistant, toolResult, usage, and compaction entries", () => {
	const totals = collectUsageTotals([
		assistantEntry(usage({ input: 100, output: 50, cacheRead: 1000, cacheWrite: 200, reasoning: 10, totalTokens: 1350, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.01 } })),
		toolResultEntry(usage({ input: 10, output: 5, totalTokens: 15, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.002 } })),
		usageEntry(usage({ cacheRead: 5000, totalTokens: 5000, cost: { input: 0, output: 0, cacheRead: 0.015, cacheWrite: 0, total: 0.015 } })),
		compactionEntry(usage({ input: 20, output: 30, totalTokens: 50, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.003 } })),
	]);
	assert.equal(totals.input, 130);
	assert.equal(totals.output, 85);
	assert.equal(totals.cacheRead, 6000);
	assert.equal(totals.cacheWrite, 200);
	assert.equal(totals.reasoning, 10);
	assert.equal(totals.totalTokens, 6415);
	assert.ok(Math.abs(totals.cost - 0.03) < 1e-9);
});

test("addUsage falls back to computed totalTokens when absent", () => {
	const totals = createUsageTotals();
	addUsage(totals, { input: 3, output: 4, cacheRead: 5, cacheWrite: 6 });
	assert.equal(totals.totalTokens, 18);
});

test("formatUsageSummary renders Codex-style segments and hides zero fields", () => {
	const line = formatUsageSummary({
		input: 22544,
		output: 709,
		cacheRead: 104960,
		cacheWrite: 0,
		reasoning: 57,
		totalTokens: 23253,
		cost: 0.42,
	});
	assert.equal(
		line,
		"Token usage: total=23,253 input=22,544 (+104,960 cached) output=709 (reasoning 57) cost=$0.42",
	);
});

test("formatUsageSummary shows cache write and formats small costs", () => {
	const line = formatUsageSummary({
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 50000,
		reasoning: 0,
		totalTokens: 50000,
		cost: 0.015,
	});
	assert.equal(line, "Token usage: total=50,000 input=0 (50,000 cache write) output=0 cost=$0.0150");
});

test("formatUsageSummary stays silent for sessions without usage", () => {
	assert.equal(formatUsageSummary(createUsageTotals()), null);
});
