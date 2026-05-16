/**
 * Page-aware suggestion chips for the Iris dock.
 *
 * Each page exposes 3–5 starter prompts. When no page context is registered
 * (or unknown), a generic set ships.
 */
import type { IrisPageContext } from "./PageContext";

export interface IrisSuggestion {
  label: string;
  prompt: string;
}

const GENERIC: IrisSuggestion[] = [
  { label: "What needs me today?", prompt: "What needs my attention right now?" },
  { label: "This month so far", prompt: "Summarize this month's revenue and pace." },
  { label: "Rebook candidates", prompt: "Which customers are due to rebook?" },
  { label: "Pricing patterns", prompt: "Where am I underquoting or overquoting?" },
];

const BY_PAGE: Record<IrisPageContext["page"], IrisSuggestion[]> = {
  dashboard: [
    { label: "What's today look like?", prompt: "Walk me through today — jobs, prep, anything I should know." },
    { label: "Top priorities", prompt: "What are my top 3 priorities right now?" },
    { label: "Weather risk", prompt: "Any rain risk on upcoming jobs this week?" },
    { label: "Rebook candidates", prompt: "Who's overdue for a rebook?" },
  ],
  calendar: [
    { label: "Tomorrow's jobs", prompt: "What does tomorrow look like? Any conflicts or rain risk?" },
    { label: "Next 7 days", prompt: "Workload outlook for the next 7 days — overloaded or underbooked days?" },
    { label: "Open slots", prompt: "Where's my biggest open block this week?" },
    { label: "Blockers", prompt: "What's blocked on my calendar and why?" },
  ],
  customers: [
    { label: "Best customers", prompt: "Who are my top 5 customers by lifetime value?" },
    { label: "Dormant high-value", prompt: "Any high-value customers who've gone quiet?" },
    { label: "Rebook overdue", prompt: "Which customers are overdue for a rebook?" },
  ],
  "customer-detail": [
    { label: "Should I reach out?", prompt: "Should I reach out to this customer? When were they last in?" },
    { label: "Draft a rebook", prompt: "Draft a rebook message for this customer." },
    { label: "Their history", prompt: "Summarize this customer's history with me — services, pricing, frequency." },
    { label: "Lifetime value", prompt: "What's this customer worth to me lifetime?" },
  ],
  leads: [
    { label: "Cold leads", prompt: "Which leads are going cold and need a nudge?" },
    { label: "Best source", prompt: "Which lead source is converting best?" },
    { label: "New today", prompt: "Any new leads I haven't contacted yet?" },
  ],
  tasks: [
    { label: "Top tasks", prompt: "What tasks should I knock out first today?" },
    { label: "Stale tasks", prompt: "Any tasks that have been sitting too long?" },
  ],
  services: [
    { label: "Pricing drift", prompt: "Which services am I consistently underquoting or overquoting?" },
    { label: "Best earner", prompt: "Which service makes me the most per hour?" },
    { label: "Duration drift", prompt: "Are any services consistently taking longer than I scheduled?" },
  ],
  revenue: [
    { label: "Month pace", prompt: "How am I tracking this month vs last?" },
    { label: "Outstanding balances", prompt: "How much money is still outstanding from receipts?" },
    { label: "Ticket trend", prompt: "Is my average ticket size growing or shrinking?" },
  ],
  expenses: [
    { label: "This month", prompt: "Total expenses this month — anything unusual?" },
    { label: "Categories", prompt: "Where am I spending the most by category?" },
  ],
  calculator: [
    { label: "In line with history?", prompt: "Is this quote in line with what I've historically charged for this vehicle/service?" },
    { label: "Suggest a price", prompt: "Based on past jobs, what should I quote this?" },
    { label: "Underquoting?", prompt: "Am I underquoting this service for this vehicle size?" },
  ],
  work: [
    { label: "What's next?", prompt: "What's my next job and what should I prep?" },
    { label: "Job is done", prompt: "I just finished. Walk me through wrap-up — final price, receipt, review request." },
    { label: "Weather risk", prompt: "Any rain risk for my next job?" },
  ],
  photos: [
    { label: "Untagged photos", prompt: "Are there photos I haven't tagged or linked to a customer?" },
  ],
  receipts: [
    { label: "Unpaid balances", prompt: "Which receipts have unpaid balances I should chase?" },
    { label: "Missing receipts", prompt: "Any completed jobs without a receipt?" },
  ],
  settings: [
    { label: "Setup audit", prompt: "Audit my setup — anything misconfigured (tax, deposits, scheduling, integrations)?" },
  ],
  "tax-center": [
    { label: "Set-aside", prompt: "How much should I be setting aside for taxes this period?" },
    { label: "Mileage deduction", prompt: "What's my mileage deduction looking like?" },
  ],
  mileage: [
    { label: "Untagged trips", prompt: "Any trips I haven't classified as business yet?" },
  ],
  checklists: [
    { label: "Coverage", prompt: "Are my checklists covering everything? Anything missing for a full detail?" },
  ],
  templates: [
    { label: "Best template", prompt: "Which message template do I send most often?" },
  ],
  iris: GENERIC,
  other: GENERIC,
};

export function suggestionsForContext(ctx: IrisPageContext | null): IrisSuggestion[] {
  if (!ctx) return GENERIC;
  return BY_PAGE[ctx.page] ?? GENERIC;
}
