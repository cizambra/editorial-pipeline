import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { history } from "../../lib/api";
import { usePipeline } from "../../lib/pipeline-context";
import { PageHeader } from "./PageHeader";
import { Card, Eyebrow } from "./Card";
import { Clock, Trash2, ChevronDown, Search, RefreshCw, Loader2, CheckCircle2, MoreVertical } from "lucide-react";

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STAGE_ABBR: Record<string, string> = {
  "Reflection":        "Reflect",
  "Translation":       "Trans.",
  "Companion":         "Comp.",
  "Related Articles":  "Related",
  "Social Posts":      "Social",
  "Pillar Tags":       "Tags",
  "Quotes":            "Quotes",
  "Thumbnail":         "Thumb.",
};

function StageDot({ stage }: { stage: { stage: string; status: string } }) {
  const label = STAGE_ABBR[stage.stage] ?? stage.stage;
  const color =
    stage.status === "done"    ? "var(--primary)"           :
    stage.status === "running" ? "var(--primary)"           :
    stage.status === "skipped" ? "rgba(var(--border-rgb),0.3)" :
                                 "rgba(var(--border-rgb),0.18)";
  const opacity = stage.status === "waiting" ? 0.5 : 1;
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ opacity }}>
      <div
        className="rounded-full flex-shrink-0"
        style={{
          width: 6, height: 6,
          background: color,
          ...(stage.status === "running" ? { boxShadow: "0 0 0 3px rgba(var(--primary-rgb),0.2)" } : {}),
        }}
      />
      <span className="text-[8px] font-semibold whitespace-nowrap" style={{ color: stage.status === "done" ? "var(--primary)" : "var(--text-subtle)" }}>
        {label}
      </span>
    </div>
  );
}

function LiveRunCard({ runData, stages, hasRun }: { runData: any; stages: any[]; hasRun: boolean }) {
  const done = stages.filter(s => s.status === "done").length;
  const total = stages.filter(s => s.status !== "skipped").length || 1;
  const pct = Math.round((done / total) * 100);
  const title = runData?.reflection_title ?? runData?.title ?? "Processing…";

  return (
    <div
      className="rounded-2xl mb-3 overflow-hidden"
      style={{
        background: "white",
        border: "1px solid rgba(var(--primary-rgb),0.25)",
        boxShadow: "0 0 0 3px rgba(var(--primary-rgb),0.06)",
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          {hasRun
            ? <CheckCircle2 size={16} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
            : <Loader2 size={16} className="animate-spin flex-shrink-0 mt-0.5" style={{ color: "var(--primary)" }} />
          }
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm leading-tight truncate" style={{ color: "var(--foreground)" }}>
              {title}
            </div>
            <div className="text-[10px] font-bold tracking-[0.08em] uppercase mt-0.5" style={{ color: "var(--primary)" }}>
              {hasRun ? "Completed — saving…" : `Running · ${pct}%`}
            </div>
          </div>
        </div>

        {/* Stage dots */}
        {stages.length > 0 && (
          <div className="flex gap-3 flex-wrap mt-2 mb-3">
            {stages.map(s => <StageDot key={s.stage} stage={s} />)}
          </div>
        )}

        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(var(--primary-rgb),0.1)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: "var(--primary)" }}
          />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = String(status ?? "done").toLowerCase();
  if (normalized === "running") {
    return (
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ background: "rgba(var(--primary-rgb),0.12)", color: "var(--primary)" }}
      >
        Running
      </span>
    );
  }
  if (normalized === "error") {
    return (
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ background: "rgba(185,64,64,0.12)", color: "#b94040" }}
      >
        Error
      </span>
    );
  }
  if (normalized === "cancelled") {
    return (
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ background: "rgba(var(--border-rgb),0.12)", color: "var(--muted-foreground)" }}
      >
        Cancelled
      </span>
    );
  }
  return null;
}

function LiveRunRowDesktop({ runData, stages, hasRun }: { runData: any; stages: any[]; hasRun: boolean }) {
  const done = stages.filter(s => s.status === "done").length;
  const total = stages.filter(s => s.status !== "skipped").length || 1;
  const pct = Math.round((done / total) * 100);
  const title = runData?.reflection_title ?? runData?.title ?? "Processing…";
  const currentStage = stages.find(s => s.status === "running")?.stage ?? (hasRun ? "Saving" : "Starting");

  return (
    <div
      className="flex items-center gap-4 py-3.5 -mx-5 px-5"
      style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.08)", background: "rgba(var(--primary-rgb),0.025)" }}
    >
      {hasRun
        ? <CheckCircle2 size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
        : <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: "var(--primary)" }} />
      }
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>{title}</div>
        {/* mini progress */}
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(var(--primary-rgb),0.12)", maxWidth: 120 }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "var(--primary)" }} />
          </div>
          <span className="text-[10px] font-semibold" style={{ color: "var(--primary)" }}>
            {hasRun ? "Saving…" : currentStage}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[11px] font-medium w-20 text-right" style={{ color: "var(--muted-foreground)" }}>just now</span>
        <div className="w-14" />
      </div>
    </div>
  );
}

function RunCard({ run, onDelete, onOpen }: { run: any; onDelete: () => void; onOpen: () => void }) {
  const status = String(run.status ?? "done").toLowerCase();
  const [menuOpen, setMenuOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const revealWidth = 60;
  const revealThreshold = 36;
  const deleteThreshold = 132;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaX) <= Math.abs(deltaY) || Math.abs(deltaX) < revealThreshold) return;
    if (deltaX > deleteThreshold) {
      onDelete();
      return;
    }
    if (deltaX > 0) setMenuOpen(true);
    else setMenuOpen(false);
  };

  return (
    <div
      className="rounded-2xl mb-3 overflow-hidden relative"
      style={{
        background: "white",
        border: "1px solid rgba(var(--border-rgb),0.12)",
        boxShadow: "0 1px 3px rgba(var(--border-rgb),0.05)",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="absolute inset-y-0 left-0 flex items-center pl-3 pr-2"
        style={{
          width: revealWidth + 16,
          background: "rgba(185,64,64,0.08)",
          borderRight: "1px solid rgba(185,64,64,0.16)",
        }}
      >
        <button
          className="w-11 h-11 flex items-center justify-center rounded-xl"
          style={{ color: "#b94040", background: "rgba(185,64,64,0.12)" }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete run"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div
        className="relative flex items-center gap-2 p-2.5 pr-3 transition-transform duration-200"
        style={{
          transform: menuOpen ? `translateX(${revealWidth}px)` : "translateX(0)",
          background: "white",
        }}
      >
        <button
          className="flex-1 min-w-0 flex items-center gap-3 p-1.5 text-left active:bg-[rgba(var(--primary-rgb),0.04)] rounded-xl transition-colors"
          onClick={() => {
            if (menuOpen) {
              setMenuOpen(false);
              return;
            }
            onOpen();
          }}
        >
          <div className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ background: "var(--primary)" }} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm leading-tight truncate" style={{ color: "var(--foreground)" }}>
              {run.title || "Untitled run"}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--muted-foreground)" }}>
                {timeAgo(run.created_at ?? run.timestamp ?? "")}
              </span>
              <StatusBadge status={status} />
              {run.cost > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}>
                  ${run.cost.toFixed(4)}
                </span>
              )}
            </div>
          </div>
          <ChevronDown size={16} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
        </button>
        <button
          className="p-2 rounded-xl active:scale-95 transition-all"
          style={{ color: menuOpen ? "var(--primary)" : "var(--text-subtle)" }}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          aria-label={menuOpen ? "Close run actions" : "Open run actions"}
        >
          <MoreVertical size={16} />
        </button>
      </div>
    </div>
  );
}

function DesktopRunRow({ run, isLast, onDelete, onOpen }: { run: any; isLast: boolean; onDelete: () => void; onOpen: () => void }) {
  const status = String(run.status ?? "done").toLowerCase();
  return (
    <div
      className="flex items-center gap-4 py-3.5 cursor-pointer hover:bg-[rgba(var(--primary-rgb),0.03)] transition-colors -mx-5 px-5"
      style={{ borderBottom: !isLast ? "1px solid rgba(var(--border-rgb),0.08)" : "none" }}
      onClick={onOpen}
    >
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--primary)" }} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>
          {run.title || "Untitled run"}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusBadge status={status} />
        {run.cost > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}>
            ${run.cost.toFixed(4)}
          </span>
        )}
        <span className="text-[11px] font-medium w-20 text-right" style={{ color: "var(--muted-foreground)" }}>
          {timeAgo(run.created_at ?? run.timestamp ?? "")}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg hover:bg-[rgba(185,64,64,0.1)] transition-colors"
          style={{ color: "var(--text-subtle)" }}
        >
          <Trash2 size={14} />
        </button>
        <div className="w-6" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Clock size={36} style={{ color: "#c4b89a" }} />
      <div className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>No runs yet</div>
      <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Run the pipeline to see history here</div>
    </div>
  );
}

export function HistoryView() {
  const navigate = useNavigate();
  const { runData: liveRunData, running, hasRun, pipelineStages, runError } = usePipeline();
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await history.list() as any;
      setRuns(Array.isArray(res) ? res : (res.runs ?? []));
    } catch (err: any) {
      setError(err.message ?? "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const liveId = liveRunData?.run_id != null ? String(liveRunData.run_id) : null;
  const liveRowIsRunning = !!liveId && runs.some(
    (run) => String(run.id) === liveId && String(run.status ?? "").toLowerCase() === "running"
  );

  useEffect(() => {
    if (!running && !hasRun && !liveRowIsRunning) return;
    const timer = window.setInterval(() => {
      load();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [running, hasRun, liveRowIsRunning]);

  // Reload whenever run_id changes — fires both on run_pending (start) and run_saved (end)
  useEffect(() => {
    if (!liveRunData?.run_id) return;
    load();
  }, [liveRunData?.run_id]);

  useEffect(() => {
    if (!runError || !liveId) return;
    load();
  }, [runError, liveId]);

  const handleDelete = async (runId: string) => {
    if (!confirm("Delete this run?")) return;
    await history.delete(runId).catch(() => {});
    setRuns((r) => r.filter((x) => x.id !== runId));
  };

  // The live entry is now DB-backed — show in-memory overlay only before first DB refresh
  const liveStatus = String(liveRunData?.status ?? "").toLowerCase();
  const terminalLiveStatus = liveStatus === "cancelled" || liveStatus === "error" ? liveStatus : "";
  const showLive =
    (running || hasRun) &&
    liveStatus !== "cancelled" &&
    liveStatus !== "error" &&
    !!liveRunData &&
    (!liveId || !runs.some(r => String(r.id) === liveId));

  const filtered = q.trim()
    ? runs.filter((r) => (r.title ?? "").toLowerCase().includes(q.toLowerCase()))
    : runs;

  return (
    <>
      {/* Mobile Layout */}
      <div className="lg:hidden pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Eyebrow>Pipeline</Eyebrow>
            <div className="text-[22px] leading-tight -tracking-[0.02em]" style={{ fontFamily: '"Montserrat", "Inter", sans-serif', fontWeight: 800, color: "var(--foreground)" }}>
              History
            </div>
          </div>
          <button onClick={load} className="p-2.5 rounded-xl active:scale-95 transition-all" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)", color: "var(--muted-foreground)" }}>
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl mb-4" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.14)" }}>
          <Search size={15} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search runs…" className="flex-1 bg-transparent text-sm outline-none" style={{ color: "var(--foreground)" }} />
        </div>

        {showLive && (
          <LiveRunCard runData={liveRunData} stages={pipelineStages} hasRun={hasRun} />
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.08)", opacity: 0.6 }} />
            ))}
          </div>
        ) : error ? (
          <div className="py-10 text-center text-sm" style={{ color: "#b94040" }}>{error}</div>
        ) : filtered.length === 0 && !showLive ? (
          <EmptyState />
        ) : (
          filtered.map((run) => {
            const renderedRun =
              terminalLiveStatus && String(run.id) === liveId
                ? { ...run, status: terminalLiveStatus }
                : run;
            return (
              <RunCard key={run.id} run={renderedRun} onDelete={() => handleDelete(run.id)} onOpen={() => navigate(`/history/${run.id}`)} />
            );
          })
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">
        <PageHeader
          kicker="Pipeline"
          title="History"
          description="All past pipeline runs with costs and article sources."
          action={
            <button onClick={load} className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-xl hover:opacity-80 transition-all" style={{ background: "rgba(var(--border-rgb),0.07)", color: "var(--muted-foreground)", border: "none" }}>
              <RefreshCw size={14} />
              Refresh
            </button>
          }
        />

        <Card className="mt-4">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4" style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.1)" }}>
            <Search size={14} style={{ color: "var(--text-subtle)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…" className="flex-1 bg-transparent text-sm outline-none" style={{ color: "var(--foreground)" }} />
          </div>

          {!loading && (filtered.length > 0 || showLive) && (
            <div className="flex items-center gap-4 -mx-5 px-5 pb-2" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.1)" }}>
              <div className="w-4 flex-shrink-0" />
              <div className="flex-1 text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: "var(--text-subtle)" }}>Title</div>
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase flex-shrink-0 w-16 text-right" style={{ color: "var(--text-subtle)" }}>Cost</div>
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase flex-shrink-0 w-20 text-right" style={{ color: "var(--text-subtle)" }}>When</div>
              <div className="w-14 flex-shrink-0" />
            </div>
          )}

          {showLive && (
            <LiveRunRowDesktop runData={liveRunData} stages={pipelineStages} hasRun={hasRun} />
          )}

          {loading ? (
            <div className="space-y-3 mt-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-lg" style={{ background: "rgba(var(--border-rgb),0.06)", opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm" style={{ color: "#b94040" }}>{error}</div>
          ) : filtered.length === 0 && !showLive ? (
            <EmptyState />
          ) : (
            filtered.map((run, i) => {
              const renderedRun =
                terminalLiveStatus && String(run.id) === liveId
                  ? { ...run, status: terminalLiveStatus }
                  : run;
              return (
                <DesktopRunRow
                  key={run.id}
                  run={renderedRun}
                  isLast={i === filtered.length - 1}
                  onDelete={() => handleDelete(run.id)}
                  onOpen={() => navigate(`/history/${run.id}`)}
                />
              );
            })
          )}
        </Card>
      </div>
    </>
  );
}
