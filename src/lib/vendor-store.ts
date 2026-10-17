import { useSyncExternalStore } from "react";
import {
  applyReview,
  newRequest,
  ROLE_LABEL,
  type Execution,
  type LeadRole,
  type Notice,
  type ReviewStatus,
  type Role,
  type VendorRequest,
} from "./workflow";

interface State {
  role: Role;
  requests: VendorRequest[];
  notices: Notice[];
  lastSeen: Partial<Record<Role, string>>;
}

const KEY = "vendor-review-demo-v1";
const blank: FileRef = { name: "sample-contract.pdf", dataUrl: "" };
type FileRef = { name: string; dataUrl: string };

const approvedAll = (d: string) => ({
  ops: { status: "approved" as const, updatedAt: d },
  finance: { status: "approved" as const, updatedAt: d },
  compliance: { status: "approved" as const, updatedAt: d },
  it: { status: "approved" as const, updatedAt: d },
});

const seed: State = {
  role: "requester",
  lastSeen: {},
  notices: [
    { id: "n1", requestId: "r4", at: "2026-10-15T15:10:00Z", text: "Finance lead approved the Kensho Data vendor contract" },
    { id: "n2", requestId: "r5", at: "2026-10-16T13:00:00Z", text: "New vendor request submitted: Veritas Health Analytics" },
    { id: "n3", requestId: "r6", at: "2026-10-16T18:20:00Z", text: "All leads approved Ledgerline — contract sent to Ops lead for execution" },
  ],
  requests: [
    {
      id: "r1", vendorName: "PitchBook", useCase: "Private market comps and deal sourcing for diligence.",
      team: "Investment pod", portfolioCompany: "", dataSources: "PitchBook proprietary dataset, SEC filings",
      phiPii: "no", contractFile: blank, submittedAt: "2025-12-02T14:00:00Z", reviews: approvedAll("2025-12-10T14:00:00Z"), messages: [],
      execution: { executedFile: { name: "pitchbook-executed.pdf", dataUrl: "" }, executionDate: "2026-01-05", endDate: "2027-01-04",
        renewalTerms: "Auto-renews annually; 5% max uplift", cancellationTerms: "60 days written notice before renewal", signedAt: "2026-01-05T10:00:00Z" },
    },
    {
      id: "r2", vendorName: "Carta", useCase: "Cap table management and 409A support.",
      team: "Portfolio pod", portfolioCompany: "Northwind Clinics", dataSources: "Company-provided equity records",
      phiPii: "yes", contractFile: blank, submittedAt: "2026-02-11T14:00:00Z", reviews: approvedAll("2026-02-20T14:00:00Z"), messages: [],
      execution: { executedFile: { name: "carta-executed.pdf", dataUrl: "" }, executionDate: "2026-03-01", endDate: "2026-12-31",
        renewalTerms: "Annual renewal by mutual agreement", cancellationTerms: "30 days notice; no termination fee", signedAt: "2026-03-01T10:00:00Z" },
    },
    {
      id: "r3", vendorName: "Snowflake", useCase: "Data warehouse for portfolio KPI reporting.",
      team: "Portfolio pod", portfolioCompany: "Harbor Logistics", dataSources: "Portfolio company ERP exports",
      phiPii: "no", contractFile: blank, submittedAt: "2026-05-02T14:00:00Z", reviews: approvedAll("2026-05-12T14:00:00Z"), messages: [],
      execution: { executedFile: { name: "snowflake-executed.pdf", dataUrl: "" }, executionDate: "2026-05-20", endDate: "2028-05-19",
        renewalTerms: "2-year term; renewal at then-current rates", cancellationTerms: "90 days notice; unused credits forfeited", signedAt: "2026-05-20T10:00:00Z" },
    },
    {
      id: "r4", vendorName: "Kensho Data", useCase: "NLP extraction from earnings calls for sector screens.",
      team: "Investment pod", portfolioCompany: "", dataSources: "S&P Global transcripts", phiPii: "no", contractFile: blank,
      submittedAt: "2026-10-14T14:00:00Z",
      reviews: { ops: { status: "pending" }, finance: { status: "approved", updatedAt: "2026-10-15T15:10:00Z" },
        compliance: { status: "approved", updatedAt: "2026-10-15T12:00:00Z" }, it: { status: "pending" } },
      messages: [
        { id: "m1", role: "it", text: "Does this require SSO? We'd want it behind Okta.", at: "2026-10-15T09:00:00Z" },
        { id: "m2", role: "requester", text: "Yes — SAML SSO is included in the enterprise tier.", at: "2026-10-15T09:40:00Z" },
      ],
    },
    {
      id: "r5", vendorName: "Veritas Health Analytics", useCase: "Claims benchmarking for healthcare portfolio company.",
      team: "Portfolio pod", portfolioCompany: "Northwind Clinics", dataSources: "De-identified claims data (CMS, payers)",
      phiPii: "yes", contractFile: blank, submittedAt: "2026-10-16T13:00:00Z",
      reviews: { ops: { status: "pending" }, finance: { status: "pending" }, compliance: { status: "pending" }, it: { status: "pending" } },
      messages: [{ id: "m3", role: "compliance", text: "We'll need a BAA before I can approve.", at: "2026-10-16T15:00:00Z" }],
    },
    {
      id: "r6", vendorName: "Ledgerline", useCase: "Automated fund expense reconciliation.",
      team: "Finance", portfolioCompany: "", dataSources: "", phiPii: "na", contractFile: blank,
      submittedAt: "2026-10-09T13:00:00Z", reviews: approvedAll("2026-10-16T18:20:00Z"), messages: [],
    },
  ],
};

let state: State = seed;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full (large attachments) — keep in memory */
    }
  }
  listeners.forEach((l) => l());
}

function set(fn: (s: State) => State) {
  state = fn(state);
  emit();
}

export function loadStore() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw);
      listeners.forEach((l) => l());
    }
  } catch {
    /* ignore */
  }
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sel(state),
    () => sel(seed),
  );
}

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

export const actions = {
  setRole: (role: Role) => set((s) => ({ ...s, role })),
  markSeen: () => set((s) => ({ ...s, lastSeen: { ...s.lastSeen, [s.role]: now() } })),
  submit(input: Parameters<typeof newRequest>[0]) {
    const r = newRequest(input);
    set((s) => ({
      ...s,
      requests: [r, ...s.requests],
      notices: [
        { id: uid(), requestId: r.id, at: r.submittedAt, text: `New vendor request submitted: ${r.vendorName} — review requested from Compliance, Finance, IT and Ops leads` },
        ...s.notices,
      ],
    }));
    return r.id;
  },
  review(id: string, lead: LeadRole, status: ReviewStatus) {
    set((s) => {
      const r = s.requests.find((x) => x.id === id);
      if (!r) return s;
      const { request, notices } = applyReview(r, lead, status);
      return { ...s, requests: s.requests.map((x) => (x.id === id ? request : x)), notices: [...notices.reverse(), ...s.notices] };
    });
  },
  post(id: string, role: Role, text: string) {
    set((s) => ({
      ...s,
      requests: s.requests.map((x) => (x.id === id ? { ...x, messages: [...x.messages, { id: uid(), role, text, at: now() }] } : x)),
    }));
  },
  execute(id: string, exec: Omit<Execution, "signedAt">) {
    set((s) => {
      const r = s.requests.find((x) => x.id === id);
      if (!r) return s;
      return {
        ...s,
        requests: s.requests.map((x) => (x.id === id ? { ...x, execution: { ...exec, signedAt: now() } } : x)),
        notices: [{ id: uid(), requestId: id, at: now(), text: `${ROLE_LABEL.ops} executed the ${r.vendorName} contract — added to vendor dashboard` }, ...s.notices],
      };
    });
  },
  reset: () => set(() => seed),
};

export function readFile(file: File): Promise<FileRef> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res({ name: file.name, dataUrl: String(fr.result) });
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
