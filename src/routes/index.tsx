import { createFileRoute, Link } from "@tanstack/react-router";
import { differenceInDays, format, parseISO } from "date-fns";
import { ShieldAlert } from "lucide-react";
import { FileLink } from "@/components/vendor-ui";
import { useStore } from "@/lib/vendor-store";
import { deriveStage } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Active Vendors — Vendor Review Desk" },
      { name: "description", content: "Dashboard of all active vendors with contract dates, renewal and cancellation terms, data sources and PHI/PII flags." },
      { property: "og:title", content: "Active Vendors — Vendor Review Desk" },
      { property: "og:description", content: "Centralized dashboard of executed vendor contracts." },
    ],
  }),
  component: Dashboard,
});

const fmt = (d: string) => format(parseISO(d), "MMM d, yyyy");

function Dashboard() {
  const requests = useStore((s) => s.requests);
  const active = requests.filter((r) => r.execution);
  const inReview = requests.filter((r) => deriveStage(r) === "in_review").length;
  const awaiting = requests.filter((r) => deriveStage(r) === "awaiting_execution").length;
  const today = new Date();
  const soon = active.filter((r) => {
    const d = differenceInDays(parseISO(r.execution!.endDate), today);
    return d >= 0 && d <= 90;
  }).length;
  const phi = active.filter((r) => r.phiPii === "yes").length;

  const stats = [
    { label: "Active vendors", value: active.length },
    { label: "In review", value: inReview, to: true },
    { label: "Awaiting execution", value: awaiting, to: true },
    { label: "Ending within 90 days", value: soon },
    { label: "Handle PHI / PII", value: phi },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Executed contracts</p>
        <h1 className="mt-1 text-5xl">Active vendors</h1>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="bg-card p-5">
            <p className="eyebrow">{s.label}</p>
            <p className="mt-2 font-display text-4xl">{s.value}</p>
            {s.to && s.value > 0 && <Link to="/requests" className="text-xs text-primary underline-offset-2 hover:underline">View pipeline →</Link>}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="border-b bg-muted/60 text-left">
            <tr>
              {["Vendor & use case", "Requesting team", "Portfolio company", "Executed", "Ends", "Renewal terms", "Cancellation terms", "Data source(s)", "PHI / PII", "Contract"].map((h) => (
                <th key={h} className="px-4 py-3 eyebrow font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {active.map((r) => {
              const e = r.execution!;
              const days = differenceInDays(parseISO(e.endDate), today);
              return (
                <tr key={r.id} className="align-top hover:bg-muted/40">
                  <td className="max-w-64 px-4 py-4">
                    <Link to="/requests/$id" params={{ id: r.id }} className="font-semibold hover:underline">{r.vendorName}</Link>
                    <p className="mt-1 text-muted-foreground">{r.useCase}</p>
                  </td>
                  <td className="px-4 py-4">{r.team}</td>
                  <td className="px-4 py-4">{r.portfolioCompany || <span className="text-muted-foreground">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-mono text-xs">{fmt(e.executionDate)}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-mono text-xs">
                    {fmt(e.endDate)}
                    {days >= 0 && days <= 90 && <span className="mt-1 block font-sans text-pending">in {days} days</span>}
                  </td>
                  <td className="max-w-48 px-4 py-4">{e.renewalTerms}</td>
                  <td className="max-w-48 px-4 py-4">{e.cancellationTerms}</td>
                  <td className="max-w-48 px-4 py-4">{r.dataSources || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-4">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                      r.phiPii === "yes" ? "border-rejected/30 bg-rejected-soft text-rejected" : "border-border bg-muted text-muted-foreground")}>
                      {r.phiPii === "yes" && <ShieldAlert className="size-3" />}
                      {r.phiPii === "yes" ? "Yes" : r.phiPii === "no" ? "No" : "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <FileLink file={e.executedFile} label="Executed copy" />
                  </td>
                </tr>
              );
            })}
            {active.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">No executed contracts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
