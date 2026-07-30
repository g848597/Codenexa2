/**
 * Company profile. This is the one thing in this file that's still a
 * static constant — a real deployment would fetch it from the company's
 * account/settings record (see storage/settingsStorage.js) rather than
 * hardcoding it.
 *
 * Everything else that used to live here (METRICS, AI_INSIGHTS,
 * REVENUE_SERIES, MONTH_SERIES) has been removed: those were disconnected
 * mock numbers. Dashboard/Finance/Analytics/Sales now derive every figure
 * from live `clients`/`projects` via storage/aggregates.js.
 */

export const COMPANY = { name: "Nova Studio", legal: "TOO Nova Studio", bin: "231140012385", plan: "Business" };
