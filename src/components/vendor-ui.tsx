import { Link } from "@tanstack/react-router";
import { Bell, Check, Circle, FileSignature, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { actions, useStore } from "@/lib/vendor-store";
import {
  deriveStage,
  LEAD_ROLES,
  ROLE_LABEL,
  STAGE_LABEL,
  type ReviewStatus,
  type Role,
  type Stage,
  type VendorRequest,
} from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const statusTone: Record<ReviewStatus, string> = {
  pending: "bg-pending-soft text-pending border-pending/30",
  approved: "bg-approved-soft text-approved border-approved/30",
  rejected: "bg-rejected-soft text-rejected border-rejected/30",
};
const stageTone: Record<Stage, string> = {
  in_review: statusTone.pending,
  awaiting_execution: "bg-accent/25 text-accent-foreground border-accent/60",
  active: statusTone.approved,
  rejected: statusTone.rejected,
};

export function StatusPill({ status }: { status: ReviewStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize", statusTone[status])}>
      {status === "approved" ? <Check className="size-3" /> : status === "rejected" ? <X className="size-3" /> : <Circle className="size-2 fill-current" />}
      {status}
    </span>
  );
}

export function StagePill({ stage }: { stage: Stage }) {
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", stageTone[stage])}>{STAGE_LABEL[stage]}</span>;
}

/** Horizontal track: Submitted → four lead reviews → Execution → Active */
export function WorkflowTrack({ r, compact = false }: { r: VendorRequest; compact?: boolean }) {
  const stage = deriveStage(r);
  const node = (done: boolean, bad = false) =>
    cn(
      "flex items-center justify-center rounded-full border-2",
      compact ? "size-5" : "size-8",
      bad ? "border-rejected bg-rejected text-primary-foreground" : done ? "border-approved bg-approved text-primary-foreground" : "border-input bg-card text-muted-foreground",
    );
  const icon = compact ? "size-3" : "size-4";
  const line = (done: boolean) => cn("h-0.5 flex-1", done ? "bg-approved" : "bg-border");
  const reviewsDone = stage === "awaiting_execution" || stage === "active";
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center gap-1">
        <div className={node(true)}><Send className={icon} /></div>
        {!compact && <span className="eyebrow">Submitted</span>}
      </div>
      <div className={line(true)} />
      <div className={cn("flex flex-col items-center gap-1 rounded-md", !compact && "border bg-muted/50 px-3 py-2")}>
        <div className="flex gap-1.5">
          {LEAD_ROLES.map((l) => {
            const s = r.reviews[l].status;
            return (
              <div key={l} className="flex flex-col items-center gap-1" title={`${ROLE_LABEL[l]}: ${s}`}>
                <div className={node(s === "approved", s === "rejected")}>
                  {s === "approved" ? <Check className={icon} /> : s === "rejected" ? <X className={icon} /> : <span className="text-[10px] font-semibold">{l === "it" ? "IT" : l.charAt(0).toUpperCase()}</span>}
                </div>
                {!compact && <span className="text-[10px] text-muted-foreground">{ROLE_LABEL[l].replace(" lead", "")}</span>}
              </div>
            );
          })}
        </div>
        {!compact && <span className="eyebrow">Lead reviews</span>}
      </div>
      <div className={line(reviewsDone)} />
      <div className="flex flex-col items-center gap-1">
        <div className={node(stage === "active")}><FileSignature className={icon} /></div>
        {!compact && <span className="eyebrow">Executed</span>}
      </div>
    </div>
  );
}

const ROLES: Role[] = ["requester", "compliance", "finance", "it", "ops"];

export function RoleSwitcher() {
  const role = useStore((s) => s.role);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="eyebrow text-ink-foreground/60">Viewing as</span>
      <select
        value={role}
        onChange={(e) => actions.setRole(e.target.value as Role)}
        className="rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1.5 text-sm text-ink-foreground"
      >
        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
    </label>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notices = useStore((s) => s.notices);
  const seen = useStore((s) => s.lastSeen[s.role]);
  const unread = notices.filter((n) => !seen || n.at > seen).length;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Notifications"
        onClick={() => { setOpen(!open); if (!open) actions.markSeen(); }}
        className="relative rounded-md p-2 text-ink-foreground hover:bg-sidebar-accent"
      >
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-card">
          <div className="border-b px-4 py-2.5 eyebrow">Group notifications</div>
          <ul className="max-h-96 divide-y overflow-auto">
            {notices.slice(0, 25).map((n) => (
              <li key={n.id}>
                <Link to="/requests/$id" params={{ id: n.requestId }} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-muted">
                  <p className="text-sm">{n.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Sent to all leads + requester · {formatDistanceToNow(new Date(n.at), { addSuffix: true })}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
