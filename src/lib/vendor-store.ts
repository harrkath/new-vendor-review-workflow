import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  applyReview,
  newRequest,
  ROLE_LABEL,
  type FileRef,
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

const PREFS_KEY = "vendor-review-prefs-v1";
const initial: State = { role: "requester", requests: [], notices: [], lastSeen: {} };

let state: State = initial;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function set(fn: (s: State) => State) {
  state = fn(state);
  emit();
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sel(state),
    () => sel(initial),
  );
}

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ---- per-device preferences (role switcher, read notifications) ----
function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ role: state.role, lastSeen: state.lastSeen }));
  } catch {
    /* ignore */
  }
}

// ---- cloud sync ----
interface RequestRow {
  id: string;
  vendor_name: string;
  use_case: string;
  team: string;
  portfolio_company: string;
  data_sources: string;
  phi_pii: "yes" | "no" | "na";
  contract_file_name: string | null;
  contract_file_path: string | null;
  submitted_at: string;
  reviews: Record<LeadRole, { status: ReviewStatus; updatedAt?: string }>;
  execution: {
    executedFileName: string;
    executedFilePath: string | null;
    executionDate: string;
    endDate: string;
    renewalTerms: string;
    cancellationTerms: string;
    signedAt: string;
  } | null;
}

function mapRequest(row: RequestRow, messages: VendorRequest["messages"]): VendorRequest {
  return {
    id: row.id,
    vendorName: row.vendor_name,
    useCase: row.use_case,
    team: row.team,
    portfolioCompany: row.portfolio_company,
    dataSources: row.data_sources,
    phiPii: row.phi_pii,
    contractFile: row.contract_file_name
      ? { name: row.contract_file_name, path: row.contract_file_path ?? undefined }
      : undefined,
    submittedAt: row.submitted_at,
    reviews: row.reviews,
    messages,
    execution: row.execution
      ? {
          executedFile: { name: row.execution.executedFileName, path: row.execution.executedFilePath ?? undefined },
          executionDate: row.execution.executionDate,
          endDate: row.execution.endDate,
          renewalTerms: row.execution.renewalTerms,
          cancellationTerms: row.execution.cancellationTerms,
          signedAt: row.execution.signedAt,
        }
      : undefined,
  };
}

async function refresh() {
  try {
    const [reqRes, msgRes, noticeRes] = await Promise.all([
      supabase.from("vendor_requests").select("*").order("submitted_at", { ascending: false }),
      supabase.from("request_messages").select("*").order("at", { ascending: true }),
      supabase.from("notices").select("*").order("at", { ascending: false }),
    ]);
    if (reqRes.error || msgRes.error || noticeRes.error) throw reqRes.error ?? msgRes.error ?? noticeRes.error;
    const rows = (reqRes.data ?? []) as unknown as RequestRow[];
    const messages = (msgRes.data ?? []) as unknown as { id: string; request_id: string; role: Role; text: string; at: string }[];
    const notices = ((noticeRes.data ?? []) as unknown as { id: string; request_id: string | null; text: string; at: string }[]).map(
      (n) => ({ id: n.id, requestId: n.request_id ?? "", text: n.text, at: n.at }),
    );
    set((s) => ({
      ...s,
      requests: rows.map((row) =>
        mapRequest(
          row,
          messages.filter((m) => m.request_id === row.id).map((m) => ({ id: m.id, role: m.role, text: m.text, at: m.at })),
        ),
      ),
      notices,
    }));
  } catch (e) {
    console.error("Failed to load vendor data", e);
  }
}

function subscribeRealtime() {
  supabase
    .channel("vendor-review")
    .on("postgres_changes", { event: "*", schema: "public", table: "vendor_requests" }, () => void refresh())
    .on("postgres_changes", { event: "*", schema: "public", table: "request_messages" }, () => void refresh())
    .on("postgres_changes", { event: "*", schema: "public", table: "notices" }, () => void refresh())
    .subscribe();
}

export function loadStore() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { role?: Role; lastSeen?: State["lastSeen"] };
      state = { ...state, role: p.role ?? "requester", lastSeen: p.lastSeen ?? {} };
    }
  } catch {
    /* ignore */
  }
  void refresh();
  subscribeRealtime();
  // Backstop for missed realtime events
  window.setInterval(() => void refresh(), 30_000);
}

// ---- attachments ----
async function upload(requestId: string, kind: "contract" | "executed", file: File): Promise<FileRef> {
  const path = `${requestId}/${kind}-${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const { error } = await supabase.storage.from("contracts").upload(path, file);
  if (error) throw error;
  return { name: file.name, path };
}

/** Download an attachment via a short-lived signed link from storage. */
export async function downloadFile(path: string) {
  const { data, error } = await supabase.storage.from("contracts").createSignedUrl(path, 60, { download: true });
  if (error || !data) {
    toast.error("Couldn't download the file. Please try again.");
    return;
  }
  const a = document.createElement("a");
  a.href = data.signedUrl;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const actions = {
  setRole: (role: Role) => {
    set((s) => ({ ...s, role }));
    savePrefs();
  },
  markSeen: () => {
    set((s) => ({ ...s, lastSeen: { ...s.lastSeen, [s.role]: now() } }));
    savePrefs();
  },
  async submit(input: {
    vendorName: string;
    useCase: string;
    team: string;
    portfolioCompany: string;
    dataSources: string;
    phiPii: "yes" | "no" | "na";
    contractFile: File;
  }): Promise<string> {
    const id = uid();
    try {
      const ref = await upload(id, "contract", input.contractFile);
      const r = newRequest({ ...input, contractFile: ref });
      const { error } = await supabase.from("vendor_requests").insert({
        id,
        vendor_name: r.vendorName,
        use_case: r.useCase,
        team: r.team,
        portfolio_company: r.portfolioCompany,
        data_sources: r.dataSources,
        phi_pii: r.phiPii,
        contract_file_name: ref.name,
        contract_file_path: ref.path ?? null,
        submitted_at: r.submittedAt,
        reviews: r.reviews,
      });
      if (error) throw error;
      const text = `New vendor request submitted: ${r.vendorName} — review requested from Compliance, Finance, IT and Ops leads`;
      await supabase.from("notices").insert({ request_id: id, text, at: r.submittedAt });
      set((s) => ({
        ...s,
        requests: [r, ...s.requests],
        notices: [{ id: uid(), requestId: id, at: r.submittedAt, text }, ...s.notices],
      }));
      return id;
    } catch (e) {
      console.error(e);
      toast.error("Couldn't submit the request. Please try again.");
      throw e;
    }
  },
  async review(id: string, lead: LeadRole, status: ReviewStatus) {
    const r = state.requests.find((x) => x.id === id);
    if (!r) return;
    const { request, notices } = applyReview(r, lead, status);
    set((s) => ({
      ...s,
      requests: s.requests.map((x) => (x.id === id ? request : x)),
      notices: [...notices.reverse(), ...s.notices],
    }));
    const { error } = await supabase.from("vendor_requests").update({ reviews: request.reviews }).eq("id", id);
    if (error) {
      console.error(error);
      toast.error("Couldn't save the review. Please try again.");
      return;
    }
    if (notices.length) {
      await supabase.from("notices").insert(notices.map((n) => ({ request_id: id, text: n.text, at: n.at })));
    }
  },
  async post(id: string, role: Role, text: string) {
    const { data, error } = await supabase.from("request_messages").insert({ request_id: id, role, text }).select().single();
    if (error || !data) {
      console.error(error);
      toast.error("Message failed to send. Please try again.");
      return;
    }
    const m = data as unknown as { id: string; at: string };
    set((s) => ({
      ...s,
      requests: s.requests.map((x) =>
        x.id === id ? { ...x, messages: [...x.messages, { id: m.id, role, text, at: m.at }] } : x,
      ),
    }));
  },
  async execute(
    id: string,
    exec: { executionDate: string; endDate: string; renewalTerms: string; cancellationTerms: string; executedFile: File },
  ) {
    const r = state.requests.find((x) => x.id === id);
    if (!r) return;
    try {
      const ref = await upload(id, "executed", exec.executedFile);
      const execution = {
        executedFileName: ref.name,
        executedFilePath: ref.path ?? null,
        executionDate: exec.executionDate,
        endDate: exec.endDate,
        renewalTerms: exec.renewalTerms,
        cancellationTerms: exec.cancellationTerms,
        signedAt: now(),
      };
      const { error } = await supabase.from("vendor_requests").update({ execution }).eq("id", id);
      if (error) throw error;
      const text = `${ROLE_LABEL.ops} executed the ${r.vendorName} contract — added to vendor dashboard`;
      await supabase.from("notices").insert({ request_id: id, text });
      set((s) => ({
        ...s,
        requests: s.requests.map((x) =>
          x.id === id
            ? {
                ...x,
                execution: {
                  executedFile: { name: ref.name, path: ref.path },
                  executionDate: exec.executionDate,
                  endDate: exec.endDate,
                  renewalTerms: exec.renewalTerms,
                  cancellationTerms: exec.cancellationTerms,
                  signedAt: execution.signedAt,
                },
              }
            : x,
        ),
        notices: [{ id: uid(), requestId: id, at: now(), text }, ...s.notices],
      }));
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save the executed contract. Please try again.");
    }
  },
};
