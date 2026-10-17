export type LeadRole = "ops" | "finance" | "compliance" | "it";
export type Role = "requester" | LeadRole;
export type ReviewStatus = "pending" | "approved" | "rejected";
export type Stage = "in_review" | "rejected" | "awaiting_execution" | "active";

export const LEAD_ROLES: LeadRole[] = ["compliance", "finance", "it", "ops"];

export const ROLE_LABEL: Record<Role, string> = {
  requester: "Requester",
  ops: "Ops lead",
  finance: "Finance lead",
  compliance: "Compliance lead",
  it: "IT lead",
};

export const STAGE_LABEL: Record<Stage, string> = {
  in_review: "In review",
  rejected: "Rejected",
  awaiting_execution: "Awaiting execution",
  active: "Active",
};

export const TEAMS = ["Investment pod", "Portfolio pod", "Operations", "Finance", "Other"];

export interface FileRef {
  name: string;
  /** Inline data URL — only on legacy/sample files without an uploaded copy. */
  dataUrl?: string;
  /** Storage path in the private "contracts" bucket for uploaded files. */
  path?: string | undefined;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  at: string;
}

export interface Execution {
  executedFile: FileRef;
  executionDate: string;
  endDate: string;
  renewalTerms: string;
  cancellationTerms: string;
  signedAt: string;
}

export interface VendorRequest {
  id: string;
  vendorName: string;
  useCase: string;
  team: string;
  portfolioCompany: string;
  dataSources: string;
  phiPii: "yes" | "no" | "na";
  contractFile?: FileRef | undefined;
  submittedAt: string;
  reviews: Record<LeadRole, { status: ReviewStatus; updatedAt?: string }>;
  messages: Message[];
  execution?: Execution | undefined;
}

export interface Notice {
  id: string;
  requestId: string;
  text: string;
  at: string;
}

export function deriveStage(r: VendorRequest): Stage {
  if (r.execution) return "active";
  const statuses = LEAD_ROLES.map((l) => r.reviews[l].status);
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.every((s) => s === "approved")) return "awaiting_execution";
  return "in_review";
}

export function approvedCount(r: VendorRequest) {
  return LEAD_ROLES.filter((l) => r.reviews[l].status === "approved").length;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Apply a lead's review decision; returns the updated request and the notices to broadcast. */
export function applyReview(
  r: VendorRequest,
  lead: LeadRole,
  status: ReviewStatus,
  now = new Date().toISOString(),
): { request: VendorRequest; notices: Notice[] } {
  if (r.execution) return { request: r, notices: [] };
  const before = deriveStage(r);
  const request: VendorRequest = {
    ...r,
    reviews: { ...r.reviews, [lead]: { status, updatedAt: now } },
  };
  const verb = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "reset to pending";
  const notices: Notice[] = [
    { id: uid(), requestId: r.id, at: now, text: `${ROLE_LABEL[lead]} ${verb} the ${r.vendorName} vendor contract` },
  ];
  if (before !== "awaiting_execution" && deriveStage(request) === "awaiting_execution") {
    notices.push({
      id: uid(),
      requestId: r.id,
      at: now,
      text: `All leads approved ${r.vendorName} — contract sent to Ops lead for execution`,
    });
  }
  return { request, notices };
}

export function newRequest(
  input: Pick<VendorRequest, "vendorName" | "useCase" | "team" | "portfolioCompany" | "dataSources" | "phiPii" | "contractFile">,
  now = new Date().toISOString(),
): VendorRequest {
  return {
    ...input,
    id: uid(),
    submittedAt: now,
    reviews: {
      ops: { status: "pending" },
      finance: { status: "pending" },
      compliance: { status: "pending" },
      it: { status: "pending" },
    },
    messages: [],
  };
}
