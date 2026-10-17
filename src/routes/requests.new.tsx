import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Paperclip } from "lucide-react";
import { useState, type ReactNode } from "react";
import { actions, readFile } from "@/lib/vendor-store";
import { LEAD_ROLES, ROLE_LABEL, TEAMS, type FileRef } from "@/lib/workflow";

export const Route = createFileRoute("/requests/new")({
  head: () => ({
    meta: [
      { title: "New Vendor Request — Vendor Review Desk" },
      { name: "description", content: "Submit a new vendor for cross-functional review by Ops, Finance, Compliance and IT." },
      { property: "og:title", content: "New Vendor Request — Vendor Review Desk" },
      { property: "og:description", content: "Submit a vendor contract for review." },
    ],
  }),
  component: NewRequest,
});

const input = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}{hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}</span>
      {children}
    </label>
  );
}

function NewRequest() {
  const nav = useNavigate();
  const [f, setF] = useState({ vendorName: "", useCase: "", team: TEAMS[0], portfolioCompany: "", dataSources: "", phiPii: "no" as "yes" | "no" | "na" });
  const [file, setFile] = useState<FileRef>();
  const [err, setErr] = useState("");
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.vendorName.trim() || !f.useCase.trim()) return setErr("Vendor name and use case are required.");
    if (!file) return setErr("Please attach the vendor contract template.");
    const id = actions.submit({ ...f, contractFile: file });
    nav({ to: "/requests/$id", params: { id } });
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <form onSubmit={submit} className="space-y-6 rounded-lg border bg-card p-8 shadow-card">
        <div>
          <p className="eyebrow">Step 1 of 4 · Submission</p>
          <h1 className="mt-1 text-4xl">New vendor request</h1>
        </div>
        <Field label="Vendor name"><input className={input} value={f.vendorName} onChange={up("vendorName")} maxLength={120} /></Field>
        <Field label="Use case" hint="— brief description"><textarea className={input} rows={3} value={f.useCase} onChange={up("useCase")} maxLength={600} /></Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Requesting team">
            <select className={input} value={f.team} onChange={up("team")}>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>
          </Field>
          <Field label="Portfolio company" hint="(if applicable)"><input className={input} value={f.portfolioCompany} onChange={up("portfolioCompany")} maxLength={120} /></Field>
        </div>
        <Field label="Original data source(s) provided by vendor" hint="(if applicable)">
          <input className={input} value={f.dataSources} onChange={up("dataSources")} placeholder="e.g. SEC filings, CMS claims data" maxLength={300} />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Does data provided via the tool contain PHI / PII?</legend>
          <div className="flex gap-2">
            {([["yes", "Yes"], ["no", "No"], ["na", "Not applicable"]] as const).map(([v, l]) => (
              <label key={v} className={`cursor-pointer rounded-md border px-4 py-2 text-sm ${f.phiPii === v ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
                <input type="radio" className="sr-only" checked={f.phiPii === v} onChange={() => setF({ ...f, phiPii: v })} />{l}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Vendor contract template">
          <div className="flex items-center gap-3 rounded-md border border-dashed border-input bg-muted/40 p-4">
            <Paperclip className="size-4 text-muted-foreground" />
            <input type="file" accept=".pdf,.doc,.docx" className="text-sm" onChange={async (e) => { const fl = e.target.files?.[0]; if (fl) setFile(await readFile(fl)); }} />
          </div>
        </Field>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Submit for review</button>
      </form>
      <aside className="space-y-4">
        <p className="eyebrow">On submit, these leads are notified at once</p>
        <ul className="space-y-2">
          {LEAD_ROLES.map((l) => <li key={l} className="rounded-md border bg-card px-4 py-3 text-sm">{ROLE_LABEL[l]}</li>)}
        </ul>
        <p className="text-sm text-muted-foreground">A dedicated Q&A channel opens for the leads and you. Once all four approve, the contract goes to the Ops lead for execution.</p>
      </aside>
    </div>
  );
}
