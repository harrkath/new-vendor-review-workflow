import { createFileRoute, Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { Download, FileSignature, Send } from "lucide-react";
import { useState } from "react";
import { StagePill, StatusPill, WorkflowTrack } from "@/components/vendor-ui";
import { actions, readFile, useStore } from "@/lib/vendor-store";
import { deriveStage, LEAD_ROLES, ROLE_LABEL, type FileRef, type LeadRole, type ReviewStatus, type VendorRequest } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/requests/$id")({
  head: () => ({
    meta: [
      { title: "Vendor Request — Vendor Review Desk" },
      { name: "description", content: "Review status, Q&A channel and execution for a vendor contract." },
      { property: "og:title", content: "Vendor Request — Vendor Review Desk" },
      { property: "og:description", content: "Cross-functional review of a vendor contract." },
    ],
  }),
  component: RequestPage,
});

function RequestPage() {
  const { id } = Route.useParams();
  const r = useStore((s) => s.requests.find((x) => x.id === id));
  const role = useStore((s) => s.role);
  if (!r) return <div className="py-20 text-center"><p className="text-muted-foreground">Request not found.</p><Link to="/requests" className="text-primary underline">Back to pipeline</Link></div>;
  const stage = deriveStage(r);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/requests" className="eyebrow hover:underline">← Review pipeline</Link>
          <div className="mt-1 flex items-center gap-3"><h1 className="text-5xl">{r.vendorName}</h1><StagePill stage={stage} /></div>
          <p className="mt-1 text-sm text-muted-foreground">Submitted by Requester · {format(new Date(r.submittedAt), "MMM d, yyyy")}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-card"><WorkflowTrack r={r} /></div>

      {stage === "awaiting_execution" && <ExecutionPanel r={r} canSign={role === "ops"} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Details r={r} />
          <Reviews r={r} role={role} />
        </div>
        <Chat r={r} role={role} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="grid grid-cols-[150px_1fr] gap-3 py-2.5 text-sm"><dt className="text-muted-foreground">{k}</dt><dd>{v || "—"}</dd></div>;
}

function Details({ r }: { r: VendorRequest }) {
  const e = r.execution;
  return (
    <section className="rounded-lg border bg-card p-6 shadow-card">
      <p className="eyebrow mb-2">Request details</p>
      <dl className="divide-y">
        <Row k="Use case" v={r.useCase} />
        <Row k="Requesting team" v={r.team} />
        <Row k="Portfolio company" v={r.portfolioCompany} />
        <Row k="Data source(s)" v={r.dataSources} />
        <Row k="PHI / PII" v={r.phiPii === "yes" ? "Yes" : r.phiPii === "no" ? "No" : "Not applicable"} />
        <Row k="Contract template" v={r.contractFile && (r.contractFile.dataUrl
          ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={r.contractFile.dataUrl} download={r.contractFile.name}><Download className="size-3.5" />{r.contractFile.name}</a>
          : r.contractFile.name)} />
        {e && <>
          <Row k="Executed" v={e.executionDate} />
          <Row k="End date" v={e.endDate} />
          <Row k="Renewal terms" v={e.renewalTerms} />
          <Row k="Cancellation terms" v={e.cancellationTerms} />
          <Row k="Executed copy" v={e.executedFile.dataUrl ? <a className="text-primary hover:underline" href={e.executedFile.dataUrl} download={e.executedFile.name}>{e.executedFile.name}</a> : e.executedFile.name} />
        </>}
      </dl>
    </section>
  );
}

const opts: ReviewStatus[] = ["pending", "approved", "rejected"];

function Reviews({ r, role }: { r: VendorRequest; role: string }) {
  const locked = !!r.execution;
  return (
    <section className="rounded-lg border bg-card p-6 shadow-card">
      <p className="eyebrow mb-3">Lead reviews</p>
      <ul className="divide-y">
        {LEAD_ROLES.map((l) => {
          const rv = r.reviews[l];
          const mine = role === l && !locked;
          return (
            <li key={l} className={cn("flex flex-wrap items-center justify-between gap-3 py-3", mine && "-mx-3 rounded-md bg-accent/15 px-3")}>
              <div>
                <p className="text-sm font-medium">{ROLE_LABEL[l]}{mine && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</p>
                {rv.updatedAt && <p className="text-xs text-muted-foreground">Updated {formatDistanceToNow(new Date(rv.updatedAt), { addSuffix: true })}</p>}
              </div>
              {mine ? (
                <div className="flex gap-1 rounded-md border bg-card p-1">
                  {opts.map((o) => (
                    <button key={o} onClick={() => actions.review(r.id, l as LeadRole, o)}
                      className={cn("rounded px-3 py-1 text-xs font-medium capitalize",
                        rv.status === o ? (o === "approved" ? "bg-approved text-primary-foreground" : o === "rejected" ? "bg-rejected text-primary-foreground" : "bg-pending text-primary-foreground") : "text-muted-foreground hover:bg-muted")}>
                      {o}
                    </button>
                  ))}
                </div>
              ) : <StatusPill status={rv.status} />}
            </li>
          );
        })}
      </ul>
      {!LEAD_ROLES.includes(role as LeadRole) && !locked && <p className="mt-3 text-xs text-muted-foreground">Switch “Viewing as” to a team lead to update their review.</p>}
    </section>
  );
}

function Chat({ r, role }: { r: VendorRequest; role: "requester" | LeadRole }) {
  const [text, setText] = useState("");
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    actions.post(r.id, role, t.slice(0, 2000));
    setText("");
  };
  return (
    <section className="flex h-[640px] flex-col rounded-lg border bg-card shadow-card">
      <header className="border-b px-6 py-4">
        <p className="eyebrow"># {r.vendorName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}</p>
        <p className="mt-1 text-xs text-muted-foreground">Members: Requester, {LEAD_ROLES.map((l) => ROLE_LABEL[l]).join(", ")}</p>
      </header>
      <div className="flex-1 space-y-4 overflow-auto px-6 py-4">
        {r.messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No questions yet. Start the conversation.</p>}
        {r.messages.map((m) => {
          const me = m.role === role;
          return (
            <div key={m.id} className={cn("flex flex-col", me && "items-end")}>
              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{ROLE_LABEL[m.role]}</span> · {formatDistanceToNow(new Date(m.at), { addSuffix: true })}</p>
              <p className={cn("mt-1 max-w-[85%] rounded-lg px-3 py-2 text-sm", me ? "bg-primary text-primary-foreground" : "bg-muted")}>{m.text}</p>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message as ${ROLE_LABEL[role]}…`}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />
        <button aria-label="Send" className="rounded-md bg-primary px-3 text-primary-foreground hover:bg-primary/90"><Send className="size-4" /></button>
      </form>
    </section>
  );
}

function ExecutionPanel({ r, canSign }: { r: VendorRequest; canSign: boolean }) {
  const [f, setF] = useState({ executionDate: "", endDate: "", renewalTerms: "", cancellationTerms: "" });
  const [file, setFile] = useState<FileRef>();
  const [err, setErr] = useState("");
  const cls = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || Object.values(f).some((v) => !v.trim())) return setErr("All fields and the signed copy are required.");
    if (f.endDate < f.executionDate) return setErr("End date must be after the execution date.");
    actions.execute(r.id, { ...f, executedFile: file });
  };
  return (
    <section className="rounded-lg border-2 border-accent bg-accent/10 p-6">
      <div className="flex items-center gap-2"><FileSignature className="size-5" /><h2 className="text-2xl">Ready for execution</h2></div>
      <p className="mt-1 text-sm text-muted-foreground">All four leads approved. The contract has been sent to the Ops lead for signature.</p>
      {canSign ? (
        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Execution date<input type="date" className={cls} value={f.executionDate} onChange={(e) => setF({ ...f, executionDate: e.target.value })} /></label>
          <label className="space-y-1 text-sm">Contract end date<input type="date" className={cls} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
          <label className="space-y-1 text-sm">Renewal terms<input className={cls} value={f.renewalTerms} onChange={(e) => setF({ ...f, renewalTerms: e.target.value })} placeholder="e.g. Auto-renews annually" /></label>
          <label className="space-y-1 text-sm">Cancellation terms<input className={cls} value={f.cancellationTerms} onChange={(e) => setF({ ...f, cancellationTerms: e.target.value })} placeholder="e.g. 60 days notice" /></label>
          <label className="space-y-1 text-sm sm:col-span-2">Signed contract (executed copy)
            <input type="file" accept=".pdf,.doc,.docx" className="block text-sm" onChange={async (e) => { const fl = e.target.files?.[0]; if (fl) setFile(await readFile(fl)); }} />
          </label>
          {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2"><button className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Mark executed & add to dashboard</button></div>
        </form>
      ) : <p className="mt-3 text-sm">Waiting on the Ops lead. Switch “Viewing as” to Ops lead to complete signing.</p>}
    </section>
  );
}
