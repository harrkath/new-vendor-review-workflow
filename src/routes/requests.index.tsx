import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Plus } from "lucide-react";
import { StagePill, WorkflowTrack } from "@/components/vendor-ui";
import { useStore } from "@/lib/vendor-store";
import { approvedCount, deriveStage, STAGE_LABEL, type Stage } from "@/lib/workflow";

export const Route = createFileRoute("/requests/")({
  head: () => ({
    meta: [
      { title: "Review Pipeline — Vendor Review Desk" },
      { name: "description", content: "Track every vendor request through Compliance, Finance, IT and Ops review to execution." },
      { property: "og:title", content: "Review Pipeline — Vendor Review Desk" },
      { property: "og:description", content: "Every vendor request, by stage." },
    ],
  }),
  component: Pipeline,
});

const COLS: Stage[] = ["in_review", "awaiting_execution", "rejected", "active"];

function Pipeline() {
  const requests = useStore((s) => s.requests);
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Submission → review → approval → execution</p>
          <h1 className="mt-1 text-5xl">Review pipeline</h1>
        </div>
        <Link to="/requests/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="size-4" /> New vendor request
        </Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-4">
        {COLS.map((c) => {
          const items = requests.filter((r) => deriveStage(r) === c);
          return (
            <section key={c} className="rounded-lg border bg-muted/40 p-3">
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-xl">{STAGE_LABEL[c]}</h2>
                <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
              </header>
              <div className="space-y-3">
                {items.map((r) => (
                  <Link key={r.id} to="/requests/$id" params={{ id: r.id }} className="block rounded-md border bg-card p-4 shadow-card transition hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{r.vendorName}</p>
                      <StagePill stage={c} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.useCase}</p>
                    <div className="mt-4"><WorkflowTrack r={r} compact /></div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{approvedCount(r)}/4 approved · {r.team}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="size-3" />{r.messages.length}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Submitted {formatDistanceToNow(new Date(r.submittedAt), { addSuffix: true })}</p>
                  </Link>
                ))}
                {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nothing here</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
