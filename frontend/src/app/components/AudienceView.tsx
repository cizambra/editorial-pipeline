import { useEffect, useRef, useState } from "react";
import { format, startOfDay, endOfDay, startOfMonth, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import { audience } from "../../lib/api";
import { SubscriberMap } from "./SubscriberMap";
import { PageHeader } from "./PageHeader";
import { Card, Eyebrow, CardSection } from "./Card";
import { MobileBottomNav } from "./MobileBottomNav";
import { Users, Search, RefreshCw, TrendingUp, ChevronRight, ChevronLeft, X, ArrowUp, ArrowDown } from "lucide-react";
import { CustomSelect } from "./CustomSelect";
import { DateRangePicker } from "./DateRangePicker";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

type FilterType = "all" | "paid" | "free" | "top" | "active" | "churned";
type SortField = "default" | "joined" | "activity";
type SortDir = "asc" | "desc";

function timeAgo(ts: string): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Avatar({ name, email }: { name?: string; email: string }) {
  const letter = (name || email)[0]?.toUpperCase() ?? "?";
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
      style={{ background: "rgba(var(--primary-rgb),0.15)", color: "var(--primary)" }}
    >
      {letter}
    </div>
  );
}

function SubTypeBadge({ type }: { type?: string }) {
  const style =
    type === "paid"    ? { bg: "rgba(28,124,82,0.1)",          color: "#1c7c52"            } :
    type === "churned" ? { bg: "rgba(var(--border-rgb),0.07)", color: "var(--text-subtle)" } :
                         { bg: "rgba(var(--border-rgb),0.07)", color: "var(--text-subtle)" };
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: style.bg, color: style.color }}
    >
      {type ?? "free"}
    </span>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex-1 p-3 rounded-xl text-center"
      style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
    >
      <div
        className="text-xl font-extrabold leading-none mb-0.5"
        style={{ fontFamily: '"Montserrat","Inter",sans-serif', color: "var(--foreground)" }}
      >
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-subtle)" }}>
        {label}
      </div>
    </div>
  );
}

function normalizeCountryPairs(value: unknown): [string, number][] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!Array.isArray(item) || item.length < 2) return null;
      const code = typeof item[0] === "string" ? item[0].trim() : "";
      const count = Number(item[1]);
      if (!code || !Number.isFinite(count) || count <= 0) return null;
      return [code, count] as [string, number];
    })
    .filter((item): item is [string, number] => item !== null);
}

// Activity rating 0–5 → human label + color
const ACTIVITY_LEVELS: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: "None",     color: "#c4b89a", bg: "rgba(var(--border-rgb),0.07)"   },
  1: { label: "Low",      color: "var(--text-subtle)", bg: "rgba(var(--border-rgb),0.1)"    },
  2: { label: "Moderate", color: "#c47a2a", bg: "rgba(196,122,42,0.12)" },
  3: { label: "Regular",  color: "var(--primary)", bg: "rgba(var(--primary-rgb),0.12)"  },
  4: { label: "High",     color: "#a03a1a", bg: "rgba(160,58,26,0.13)"  },
  5: { label: "Super",    color: "#1c7c52", bg: "rgba(28,124,82,0.12)"  },
};

function ActivityBar({ rating }: { rating: number }) {
  const pct = (rating / 5) * 100;
  const cfg = ACTIVITY_LEVELS[rating] ?? ACTIVITY_LEVELS[0];
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-subtle)" }}>
          Engagement
        </span>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "rgba(var(--border-rgb),0.1)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: cfg.color }}
        />
      </div>
    </div>
  );
}

function formatDate(ts?: string): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return ts;
  }
}

// ──────────────────────────────────────────────
// Subscriber detail panel (used in both layouts)
// ──────────────────────────────────────────────
function SubscriberDetail({ sub, detail, hideHeader }: { sub: any; detail: any | null; hideHeader?: boolean }) {
  // Merge sub (DB row) with detail (raw Substack API) for richer data
  const crm = detail?.crmData ?? {};
  const country =
    sub.subscription_country ||
    crm.subscription_country ||
    crm.country ||
    detail?.subscription_country ||
    "";
  const interval = sub.subscription_interval || detail?.subscription_interval || "";
  const joinedAt = sub.subscription_created_at || detail?.subscription_created_at || "";
  const unsubscribedAt = sub.unsubscribed_at || null;
  const activityRating = sub.activity_rating ?? detail?.activity_rating ?? 0;
  const isComp = sub.is_comp || detail?.is_comp;

  const isPaid = !isComp && interval && interval !== "free";
  // Build subscription label
  const subLabel = (() => {
    if (unsubscribedAt) return "Churned";
    if (isComp) return "Comp";
    if (isPaid) return `Paid · ${interval.charAt(0).toUpperCase() + interval.slice(1)}`;
    return "Free";
  })();

  return (
    <div>
      {/* Header */}
      {!hideHeader && <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <Avatar name={sub.name} email={sub.email} />
          <div>
            <div className="font-bold text-base leading-tight" style={{ color: "var(--foreground)" }}>
              {sub.name || sub.email}
            </div>
            {sub.name && (
              <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                {sub.email}
              </div>
            )}
          </div>
        </div>
        <SubTypeBadge type={unsubscribedAt ? "churned" : isPaid ? "paid" : "free"} />
      </div>}

      {/* Activity bar — always visible from sub data */}
      <div className="mb-5">
        <ActivityBar rating={Number(activityRating)} />
      </div>

      {/* Subscription details grid */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <div
          className="p-3 rounded-xl"
          style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "var(--text-subtle)" }}>
            Subscription
          </div>
          <div className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            {subLabel}
          </div>
        </div>
        <div
          className="p-3 rounded-xl"
          style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "var(--text-subtle)" }}>
            {unsubscribedAt ? "Churned" : "Joined"}
          </div>
          <div className="text-sm font-bold" style={{ color: unsubscribedAt ? "var(--text-subtle)" : "var(--foreground)" }}>
            {unsubscribedAt ? formatDate(unsubscribedAt) : joinedAt ? formatDate(joinedAt) : "—"}
          </div>
        </div>
        {unsubscribedAt && joinedAt && (
          <div
            className="p-3 rounded-xl"
            style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "var(--text-subtle)" }}>
              Subscribed for
            </div>
            <div className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              {(() => {
                const days = Math.round((new Date(unsubscribedAt).getTime() - new Date(joinedAt).getTime()) / 86400000);
                return days < 30 ? `${days}d` : days < 365 ? `${Math.round(days / 30)}mo` : `${(days / 365).toFixed(1)}yr`;
              })()}
            </div>
          </div>
        )}
        {country && (
          <div
            className="p-3 rounded-xl"
            style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "var(--text-subtle)" }}>
              Country
            </div>
            <div className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              {country}
            </div>
          </div>
        )}
        <div
          className="p-3 rounded-xl"
          style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "var(--text-subtle)" }}>
            Activity score
          </div>
          <div className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            {activityRating} / 5
          </div>
        </div>
      </div>

      {/* Loading indicator for enriched data */}
      {detail === null && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(var(--border-rgb),0.04)" }}
        >
          <div
            className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
            style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
          />
          <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
            Loading enriched profile…
          </span>
        </div>
      )}

      {/* Extra fields from raw detail (crm data) */}
      {detail && (() => {
        const extras: { label: string; value: string }[] = [];
        if (crm.posts_opened !== undefined)
          extras.push({ label: "Posts opened", value: String(crm.posts_opened) });
        if (crm.clicks !== undefined)
          extras.push({ label: "Link clicks", value: String(crm.clicks) });
        if (detail.utm_source || crm.utm_source)
          extras.push({ label: "Source", value: detail.utm_source || crm.utm_source });
        if (detail.utm_medium || crm.utm_medium)
          extras.push({ label: "Medium", value: detail.utm_medium || crm.utm_medium });
        if (!extras.length) return null;
        return (
          <div
            className="mt-1 pt-4"
            style={{ borderTop: "1px solid rgba(var(--border-rgb),0.1)" }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] mb-2" style={{ color: "var(--text-subtle)" }}>
              Acquisition & activity
            </div>
            <div className="grid grid-cols-2 gap-2">
              {extras.map(({ label, value }) => (
                <div
                  key={label}
                  className="p-3 rounded-xl"
                  style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "var(--text-subtle)" }}>
                    {label}
                  </div>
                  <div className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ──────────────────────────────────────────────
// Subscribers tab content
// ──────────────────────────────────────────────
function SubscribersTab({
  subscribers,
  total,
  loading,
  syncing,
  onSync,
  mobile,
}: {
  subscribers: any[];
  total: number;
  loading: boolean;
  syncing: boolean;
  onSync: () => void;
  mobile?: boolean;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortField, setSortField] = useState<SortField>("default");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(50);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset display count when search/filter/sort changes
  useEffect(() => { setDisplayCount(50); }, [q, filter, sortField, sortDir]);

  // Infinite scroll: expand displayCount when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setDisplayCount((c) => c + 50);
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const openDetail = async (sub: any) => {
    setSelected(sub);
    setDetail(null);
    setDetailOpen(true);
    try {
      const res = await audience.detail(sub.email) as any;
      // API returns { ok, subscriber, detail } — extract the detail object
      setDetail(res?.detail ?? res);
    } catch {
      /* ignore */
    }
  };

  const filtered = subscribers.filter((s) => {
    const matchesQ =
      !q ||
      (s.name ?? "").toLowerCase().includes(q.toLowerCase()) ||
      s.email.toLowerCase().includes(q.toLowerCase());
    if (!matchesQ) return false;
    if (filter === "churned") return !!s.unsubscribed_at;
    // By default hide churned subscribers unless explicitly viewing them
    const isChurned = !!s.unsubscribed_at;
    if (isChurned && filter !== "churned") return false;
    if (filter === "paid") return s.subscription_interval !== "free" && !s.is_comp;
    if (filter === "free") return s.subscription_interval === "free";
    if (filter === "top") return (s.activity_rating ?? 0) >= 3;
    if (filter === "active") return (s.activity_rating ?? 0) >= 1;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === "joined") {
      const diff = new Date(a.subscription_created_at ?? 0).getTime() - new Date(b.subscription_created_at ?? 0).getTime();
      return sortDir === "desc" ? -diff : diff;
    }
    if (sortField === "activity") {
      const diff = (a.activity_rating ?? 0) - (b.activity_rating ?? 0);
      return sortDir === "desc" ? -diff : diff;
    }
    return 0;
  });

  const SORT_OPTIONS = [
    { value: "default", label: "Default" },
    { value: "joined",  label: "Date joined" },
    { value: "activity", label: "Activity" },
  ];

  const FILTERS: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "paid", label: "Paid" },
    { id: "free", label: "Free" },
    { id: "top", label: "Top" },
    { id: "active", label: "Active" },
    { id: "churned", label: "Churned" },
  ];

  const searchBar = (
    <div
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
      style={{
        background: mobile ? "white" : "rgba(var(--border-rgb),0.04)",
        border: "1px solid rgba(var(--border-rgb),0.14)",
      }}
    >
      <Search size={14} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search subscribers…"
        className="flex-1 bg-transparent text-sm outline-none"
        style={{ color: "var(--foreground)" }}
      />
      {q && (
        <button onClick={() => setQ("")}>
          <X size={13} style={{ color: "var(--text-subtle)" }} />
        </button>
      )}
    </div>
  );

  const filterBar = (
    <div className="flex items-center gap-1.5 flex-wrap">
      {FILTERS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => setFilter(id)}
          className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-all"
          style={{
            background: filter === id ? "var(--primary)" : "rgba(var(--border-rgb),0.07)",
            color: filter === id ? "white" : "var(--muted-foreground)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const sortControls = (
    <div className="flex items-center gap-1.5">
      <div style={{ minWidth: 130 }}>
        <CustomSelect
          options={SORT_OPTIONS}
          value={sortField}
          onChange={(v) => setSortField(v as SortField)}
        />
      </div>
      {sortField !== "default" && (
        <button
          onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
          className="flex items-center justify-center w-9 h-9 rounded-xl transition-all"
          style={{
            background: "var(--secondary)",
            border: "1px solid rgba(var(--border-rgb),0.12)",
            color: "var(--primary)",
          }}
          title={sortDir === "desc" ? "Descending" : "Ascending"}
        >
          {sortDir === "desc"
            ? <ArrowDown className="w-4 h-4" />
            : <ArrowUp className="w-4 h-4" />}
        </button>
      )}
    </div>
  );

  if (mobile) {
    return (
      <>
        <div className="pb-24">
          {/* Search + filter */}
          <div className="mb-3">
            {searchBar}
          </div>
          <div className="mb-4">
            {filterBar}
          </div>

          {/* Sync header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium" style={{ color: "var(--text-subtle)" }}>
                {total > 0 ? `${total.toLocaleString()} subscribers` : "No data yet"}
              </span>
              {sortControls}
            </div>
            <button
              onClick={onSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all"
              style={{
                background: "white",
                border: "1px solid rgba(var(--border-rgb),0.14)",
                color: syncing ? "var(--text-subtle)" : "var(--primary)",
              }}
            >
              <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync"}
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-2xl"
                  style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.08)", opacity: 0.6 }}
                />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users size={32} style={{ color: "#c4b89a" }} />
              <div className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
                {subscribers.length === 0 ? "No subscribers. Sync first." : "No matches"}
              </div>
            </div>
          ) : (
            <>
            {sorted.slice(0, displayCount).map((sub) => (
              <button
                key={sub.email}
                className="w-full flex items-center gap-3 p-4 rounded-2xl mb-2 text-left active:scale-[0.99] transition-all"
                style={{
                  background: "white",
                  border: "1px solid rgba(var(--border-rgb),0.12)",
                  boxShadow: "0 1px 3px rgba(var(--border-rgb),0.04)",
                }}
                onClick={() => openDetail(sub)}
              >
                <Avatar name={sub.name} email={sub.email} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>
                    {sub.name || sub.email}
                  </div>
                  {sub.name && (
                    <div className="text-xs truncate" style={{ color: "var(--text-subtle)" }}>
                      {sub.email}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {sub.unsubscribed_at
                    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(var(--border-rgb),0.1)", color: "var(--text-subtle)" }}>Churned</span>
                    : <SubTypeBadge type={sub.subscription_interval !== "free" && !sub.is_comp ? "paid" : "free"} />}
                  <ChevronRight size={14} style={{ color: "#c4b89a" }} />
                </div>
              </button>
            ))}
            <div ref={sentinelRef} className="h-1" />
            </>
          )}
        </div>

        {/* Full-screen detail modal */}
        {detailOpen && selected && (
          <div
            className="fixed inset-0 z-[60] flex flex-col"
            style={{ background: "var(--background)", animation: "slideInRight 0.22s cubic-bezier(0.22,1,0.36,1)" }}
          >
            <style>{`
              @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to   { transform: translateX(0);    opacity: 1; }
              }
            `}</style>

            {/* Header */}
            <div
              className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-4"
              style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.12)" }}
            >
              <button
                onClick={() => setDetailOpen(false)}
                className="p-2 -ml-1 rounded-xl active:bg-black active:bg-opacity-5 transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <Avatar name={selected.name} email={selected.email} />
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-bold truncate" style={{ fontFamily: "Montserrat, sans-serif", color: "var(--foreground)" }}>
                  {selected.name || selected.email}
                </div>
                {selected.name && (
                  <div className="text-xs truncate" style={{ color: "var(--text-subtle)" }}>{selected.email}</div>
                )}
              </div>
              <SubTypeBadge type={selected.unsubscribed_at ? "churned" : selected.subscription_interval !== "free" && !selected.is_comp ? "paid" : "free"} />
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4" style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom,0px))" }}>
              <SubscriberDetail sub={selected} detail={detail} hideHeader />
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop layout — h-full fills the flex-1 container from AudienceView
  return (
    <div className="grid grid-cols-[0.42fr_0.58fr] gap-4 h-full">
      {/* Left: list — flex column so the list fills remaining height */}
      <div
        className="flex flex-col p-5 rounded-xl overflow-hidden"
        style={{
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "rgba(var(--border-rgb),0.08)",
          background: "var(--card)",
          boxShadow: "0 1px 2px rgba(var(--border-rgb),0.05)",
        }}
      >
        <div className="mb-3 flex-shrink-0">
          <Eyebrow>Subscribers</Eyebrow>
          <div className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            {total > 0 ? `${total.toLocaleString()} total` : "No data"}
          </div>
        </div>

        <div className="mb-3 flex-shrink-0">
          {searchBar}
        </div>

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          {filterBar}
          {sortControls}
        </div>

        <div
          className="-mx-5 flex-1 overflow-y-auto min-h-0"
          style={{ borderTop: "1px solid rgba(var(--border-rgb),0.08)" }}
        >
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg"
                  style={{ background: "rgba(var(--border-rgb),0.06)", opacity: 1 - i * 0.12 }}
                />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Users size={28} style={{ color: "#c4b89a" }} />
              <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {subscribers.length === 0 ? "Sync to load subscribers" : "No matches"}
              </div>
            </div>
          ) : (
            <>
            {sorted.slice(0, displayCount).map((sub, i) => (
              <button
                key={sub.email}
                className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[rgba(var(--primary-rgb),0.04)]"
                style={{
                  borderBottom:
                    i < Math.min(sorted.length, displayCount) - 1 ? "1px solid rgba(var(--border-rgb),0.07)" : "none",
                  background:
                    selected?.email === sub.email ? "rgba(var(--primary-rgb),0.05)" : "transparent",
                }}
                onClick={() => openDetail(sub)}
              >
                <Avatar name={sub.name} email={sub.email} />
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm truncate"
                    style={{ color: "var(--foreground)" }}
                  >
                    {sub.name || sub.email}
                  </div>
                  {sub.name && (
                    <div className="text-xs truncate" style={{ color: "var(--text-subtle)" }}>
                      {sub.email}
                    </div>
                  )}
                </div>
                {sub.unsubscribed_at
                  ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(var(--border-rgb),0.1)", color: "var(--text-subtle)" }}>Churned</span>
                  : <SubTypeBadge type={sub.subscription_interval !== "free" && !sub.is_comp ? "paid" : "free"} />}
              </button>
            ))}
            <div ref={sentinelRef} className="h-1" />
            </>
          )}
        </div>
      </div>

      {/* Right: detail — scrollable */}
      <div
        className="p-5 rounded-xl overflow-y-auto"
        style={{
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "rgba(var(--border-rgb),0.08)",
          background: "var(--card)",
          boxShadow: "0 1px 2px rgba(var(--border-rgb),0.05)",
          height: "100%",
        }}
      >
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Users size={32} style={{ color: "#c4b89a" }} />
            <div className="text-sm" style={{ color: "var(--text-subtle)" }}>
              Select a subscriber to see details
            </div>
          </div>
        ) : (
          <SubscriberDetail sub={selected} detail={detail} />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Insights tab content
// ──────────────────────────────────────────────
type DateRange = { from: Date | undefined; to: Date | undefined };

function InsightsTab({
  subscribers,
  total,
  insights,
  allSubscribersLoaded,
  mobile,
}: {
  subscribers: any[];
  total: number;
  insights: any | null;
  allSubscribersLoaded: boolean;
  mobile?: boolean;
}) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  }));

  const hasRange = !!(dateRange?.from && dateRange?.to);

  // When a date range is selected: compute who was active at end of range,
  // who joined in range, who churned in range.
  const toTs = (s: string | null | undefined) => s ? new Date(s).getTime() : null;

  const viewSubs = hasRange
    ? subscribers.filter((s) => {
        const joined = toTs(s.subscription_created_at);
        const churned = toTs(s.unsubscribed_at);
        const end = endOfDay(dateRange.to!).getTime();
        if (!joined || joined > end) return false;
        return !churned || churned > end;
      })
    : subscribers.filter((s) => !s.unsubscribed_at);

  const newInPeriod = hasRange
    ? subscribers.filter((s) => {
        const joined = toTs(s.subscription_created_at);
        if (!joined) return false;
        return joined >= startOfDay(dateRange.from!).getTime() && joined <= endOfDay(dateRange.to!).getTime();
      })
    : [];

  const churnedInPeriod = hasRange
    ? subscribers.filter((s) => {
        const churned = toTs(s.unsubscribed_at);
        if (!churned) return false;
        return churned >= startOfDay(dateRange.from!).getTime() && churned <= endOfDay(dateRange.to!).getTime();
      })
    : [];

  const active = viewSubs;
  const paid = active.filter((s) => s.subscription_interval !== "free" && !s.is_comp).length;
  const free = active.filter((s) => s.subscription_interval === "free").length;
  const churned = hasRange ? churnedInPeriod.length : subscribers.filter((s) => !!s.unsubscribed_at).length;

  const engagementCounts: Record<string, number> = {};
  active.forEach((s) => {
    const label = ACTIVITY_LEVELS[s.activity_rating ?? 0]?.label?.toLowerCase() ?? "none";
    engagementCounts[label] = (engagementCounts[label] ?? 0) + 1;
  });

  const engagementOrder = ["super", "high", "regular", "moderate", "low", "none"];
  const engagementData = engagementOrder
    .filter((k) => engagementCounts[k])
    .map((k) => ({ label: k, count: engagementCounts[k] }));

  // Geography — always compute from all loaded subscribers (full dataset, not just top N)
  const countryCounts: Record<string, number> = {};
  active.forEach((s) => {
    if (s.subscription_country) countryCounts[s.subscription_country] = (countryCounts[s.subscription_country] ?? 0) + 1;
  });
  // All countries sorted descending — used for both map and country list
  const allCountries: [string, number][] = Object.entries(countryCounts)
    .sort(([, a], [, b]) => b - a) as [string, number][];
  // For all-time view, prefer the backend's full country aggregation so the map
  // is complete even before every subscriber page has loaded in the browser.
  const backendCountries = normalizeCountryPairs(insights?.country_distribution);
  const fallbackCountries = normalizeCountryPairs(insights?.top_countries);
  const mapCountries: [string, number][] = hasRange
    ? allCountries
    : allSubscribersLoaded
      ? allCountries
      : (backendCountries.length > 0 ? backendCountries : (allCountries.length > 0 ? allCountries : fallbackCountries));
  const countryCoverage = hasRange || allSubscribersLoaded
    ? Object.values(countryCounts).reduce((a, b) => a + b, 0)
    : (insights?.country_coverage ?? Object.values(countryCounts).reduce((a, b) => a + b, 0));

  // Growth — compute from subscriber data
  const growthByMonth: Record<string, number> = {};
  (hasRange ? newInPeriod : subscribers).forEach((s) => {
    const d = s.subscription_created_at ? s.subscription_created_at.slice(0, 7) : null;
    if (d) growthByMonth[d] = (growthByMonth[d] ?? 0) + 1;
  });
  // Merge with insights data when no range (server computed value is more accurate)
  const growthSource = hasRange ? growthByMonth : (insights?.monthly_growth ?? growthByMonth);
  const growthEntries = Object.entries(growthSource).sort(([a], [b]) => a.localeCompare(b));
  const growthMax = Math.max(...growthEntries.map(([, v]) => v as number), 1);

  // Range label for display
  const rangeLabel = hasRange
    ? `${format(dateRange.from!, "MMM d, yyyy")} – ${format(dateRange.to!, "MMM d, yyyy")}`
    : "All time";

  // ── Date picker control ──
  const datePicker = (
    <DateRangePicker
      dateRange={dateRange}
      onSelect={setDateRange}
      align="right"
      numberOfMonths={mobile ? 1 : 2}
    />
  );

  if (subscribers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <TrendingUp size={32} style={{ color: "#c4b89a" }} />
        <div className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
          No insights yet. Sync subscribers first.
        </div>
      </div>
    );
  }

  const statsRow = hasRange ? (
    <div className="grid grid-cols-2 gap-3">
      <StatCell label="Active at end" value={active.length.toLocaleString()} />
      <StatCell label="New" value={`+${newInPeriod.length}`} />
      <StatCell label="Churned" value={churnedInPeriod.length.toString()} />
      <StatCell label="Net" value={(newInPeriod.length - churnedInPeriod.length >= 0 ? "+" : "") + (newInPeriod.length - churnedInPeriod.length)} />
      <StatCell label="Paid" value={paid.toString()} />
      <StatCell label="Engaged" value={active.filter((s) => (s.activity_rating ?? 0) >= 1).length.toString()} />
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-3">
      <StatCell label="Total" value={total.toLocaleString()} />
      <StatCell label="Paid" value={paid.toString()} />
      <StatCell label="Free" value={free.toString()} />
      <StatCell label="Churned" value={churned.toString()} />
      <StatCell label="Engaged" value={active.filter((s) => (s.activity_rating ?? 0) >= 1).length.toString()} />
    </div>
  );

  const engagementBar = (
    <div>
      <Eyebrow>Engagement breakdown</Eyebrow>
      <div className="mt-3 space-y-3">
        {engagementData.map(({ label, count }) => {
          const pct = (count / (active.length || 1)) * 100;
          return (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold capitalize" style={{ color: "var(--foreground)" }}>{label}</span>
                <span className="text-xs font-bold" style={{ color: "var(--muted-foreground)" }}>{count}</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "rgba(var(--border-rgb),0.08)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--primary)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Churn per month (mirrors growthByMonth logic)
  const churnByMonth: Record<string, number> = {};
  (hasRange ? churnedInPeriod : subscribers.filter((s) => !!s.unsubscribed_at)).forEach((s) => {
    const d = s.unsubscribed_at?.slice(0, 7);
    if (d) churnByMonth[d] = (churnByMonth[d] ?? 0) + 1;
  });

  // Build unified chart data merging both series over all months
  const allChartMonths = Array.from(
    new Set([...growthEntries.map(([m]) => m), ...Object.keys(churnByMonth)])
  ).sort();
  const chartData = allChartMonths.map((m) => ({
    month: m,
    new: (growthSource[m] ?? 0) as number,
    churned: churnByMonth[m] ?? 0,
  }));
  const hasChurn = chartData.some((d) => d.churned > 0);

  const growthChart = chartData.length > 0 && (
    <div>
      <div className="flex items-center gap-3 mb-0.5">
        <Eyebrow>{hasRange ? "New subscribers in period" : "Monthly growth"}</Eyebrow>
      </div>
      <div className="text-xs mt-0.5 mb-4" style={{ color: "var(--text-subtle)" }}>
        {hasRange
          ? `${newInPeriod.length} new · ${churnedInPeriod.length} churned`
          : "New subscribers vs. churn per month"}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -28 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border-rgb),0.1)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 9, fill: "var(--text-subtle)", fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "var(--text-subtle)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid rgba(var(--border-rgb),0.14)",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--foreground)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            }}
            labelStyle={{ color: "var(--text-subtle)", fontSize: 10, marginBottom: 4 }}
            cursor={{ fill: "rgba(var(--border-rgb),0.06)" }}
          />
          <Legend
            iconType="square"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: 10, color: "var(--text-subtle)", fontWeight: 600 }}>{value}</span>}
            wrapperStyle={{ paddingTop: 10 }}
          />
          {/* Light pastel bar — low opacity of primary */}
          <Bar
            dataKey="new"
            name="New subscribers"
            fill="var(--primary)"
            fillOpacity={0.28}
            radius={[3, 3, 0, 0]}
            maxBarSize={36}
          />
          {/* Darker pastel line — stronger opacity of same primary */}
          <Line
            dataKey="churned"
            name="Unsubscribed"
            type="monotone"
            stroke="var(--primary)"
            strokeOpacity={0.78}
            strokeWidth={2}
            dot={(props: any) => {
              if (!props.value) return <g key={props.key} />;
              return <circle key={props.key} cx={props.cx} cy={props.cy} r={3} fill="var(--primary)" fillOpacity={0.78} stroke="none" />;
            }}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  const mapSection = mapCountries.length > 0 && (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Eyebrow>Geographic distribution</Eyebrow>
        {countryCoverage > 0 && (
          <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}>
            {countryCoverage.toLocaleString()} located
          </span>
        )}
      </div>
      <SubscriberMap allCountries={mapCountries} mobile={mobile} />
      {/* Country list below map */}
      <div className="mt-3 space-y-1.5">
        {mapCountries.slice(0, 8).map(([code, count]) => {
          const pct = (count / (countryCoverage || 1)) * 100;
          return (
            <div key={code} className="flex items-center gap-3">
              <span className="text-xs font-bold w-8 flex-shrink-0" style={{ color: "var(--foreground)" }}>{code}</span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(var(--border-rgb),0.08)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--primary)", opacity: 0.7 }} />
              </div>
              <span className="text-xs font-bold w-8 text-right flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (mobile) {
    return (
      <div className="pb-24 space-y-4">
        <div className="flex justify-end">{datePicker}</div>
        <div className="rounded-2xl p-4" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
          {statsRow}
        </div>
        <div className="rounded-2xl p-4" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
          {engagementBar}
        </div>
        {growthChart && (
          <div className="rounded-2xl p-4" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            {growthChart}
          </div>
        )}
        {mapSection && (
          <div className="rounded-2xl p-4" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            {mapSection}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto pb-4" style={{ maxHeight: "calc(100dvh - 200px)" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>
          {hasRange ? `Showing period: ${rangeLabel}` : "Showing all-time data"}
        </div>
        {datePicker}
      </div>

      {/* Stats + engagement row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <Eyebrow>{hasRange ? "Period metrics" : "Subscriber overview"}</Eyebrow>
          <div className="mt-3">{statsRow}</div>
        </Card>
        <Card>{engagementBar}</Card>
      </div>

      {/* Growth chart */}
      {growthChart && <Card>{growthChart}</Card>}

      {/* Map */}
      {mapSection && <Card>{mapSection}</Card>}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main view
// ──────────────────────────────────────────────
export function AudienceView() {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"subscribers" | "insights">("subscribers");
  const [insights, setInsights] = useState<any>(null);
  const [allSubscribersLoaded, setAllSubscribersLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    setAllSubscribersLoaded(false);
    try {
      const PAGE = 100;
      const first = await audience.list({ limit: PAGE, offset: 0 });
      const serverTotal: number = first.total ?? (first as any[]).length ?? 0;
      let all: any[] = [...(first.subscribers ?? (first as any))];
      setSubscribers(all);
      setTotal(serverTotal);
      setLoading(false);
      // Fetch remaining pages in the background
      while (all.length < serverTotal) {
        const page = await audience.list({ limit: PAGE, offset: all.length });
        const batch = page.subscribers ?? (page as any[]);
        if (!batch.length) break;
        all = [...all, ...batch];
        setSubscribers([...all]);
      }
      setAllSubscribersLoaded(true);
    } catch {
      setLoading(false);
      setAllSubscribersLoaded(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    await audience.sync().catch(() => {});
    setSyncing(false);
    load();
  };

  useEffect(() => {
    load();
    audience.insights().then(setInsights).catch(() => {});
  }, []);

  return (
    <>
      {/* Mobile Layout */}
      <div className="lg:hidden">
        {/* Header */}
        <div className="mb-4">
          <Eyebrow>Manage</Eyebrow>
          <div
            className="text-[22px] leading-tight -tracking-[0.02em]"
            style={{
              fontFamily: '"Montserrat", "Inter", sans-serif',
              fontWeight: 800,
              color: "var(--foreground)",
            }}
          >
            Audience
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "subscribers" ? (
          <SubscribersTab
            subscribers={subscribers}
            total={total}
            loading={loading}
            syncing={syncing}
            onSync={handleSync}
            mobile
          />
        ) : (
          <InsightsTab subscribers={subscribers} total={total} insights={insights} allSubscribersLoaded={allSubscribersLoaded} mobile />
        )}

        {/* Bottom tab nav */}
        <MobileBottomNav
          items={[
            { id: "subscribers", label: "Subscribers", icon: Users },
            { id: "insights", label: "Insights", icon: TrendingUp },
          ]}
          activeItem={activeTab}
          onItemChange={(id) => setActiveTab(id as typeof activeTab)}
        />
      </div>

      {/* Desktop Layout — fixed viewport height, no outer scroll */}
      <div
        className="hidden lg:flex lg:flex-col"
        style={{ height: "calc(100dvh - 88px)" }}
      >
        <PageHeader
          kicker="Manage"
          title="Audience"
          description="Browse subscribers and understand your audience engagement."
          action={
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-xl hover:opacity-80 transition-all disabled:opacity-50"
              style={{ background: "rgba(var(--border-rgb),0.07)", color: syncing ? "var(--text-subtle)" : "var(--primary)", border: "none" }}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync"}
            </button>
          }
        />

        {/* Tab strip */}
        <div
          className="flex gap-1 mt-4 mb-3 p-1 rounded-xl w-fit flex-shrink-0"
          style={{ background: "rgba(var(--border-rgb),0.07)" }}
        >
          {(
            [
              { id: "subscribers", label: "Subscribers" },
              { id: "insights", label: "Insights" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background: activeTab === id ? "white" : "transparent",
                color: activeTab === id ? "var(--primary)" : "var(--muted-foreground)",
                boxShadow: activeTab === id ? "0 1px 3px rgba(var(--border-rgb),0.1)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content fills remaining height */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "subscribers" ? (
            <SubscribersTab
              subscribers={subscribers}
              total={total}
              loading={loading}
              syncing={syncing}
              onSync={handleSync}
            />
          ) : (
            <InsightsTab subscribers={subscribers} total={total} insights={insights} allSubscribersLoaded={allSubscribersLoaded} />
          )}
        </div>
      </div>
    </>
  );
}
