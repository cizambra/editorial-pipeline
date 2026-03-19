import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Loader2, ChevronUp, X, XCircle, CheckCircle, Layers } from "lucide-react";
import { usePipeline } from "../../lib/pipeline-context";

function QueuePanelContent({
  running,
  displayTitle,
  activeStage,
  completedCount,
  totalStages,
  runCost,
  pendingQueue,
  cancelPipeline,
  removeFromQueue,
  clearQueue,
  onNavigateToPipeline,
}: {
  running: boolean;
  displayTitle: string;
  activeStage: { label?: string; stage: string } | undefined;
  completedCount: number;
  totalStages: number;
  runCost: number;
  pendingQueue: any[];
  cancelPipeline: () => void;
  removeFromQueue: (i: number) => void;
  clearQueue: () => void;
  onNavigateToPipeline: () => void;
}) {
  return (
    <>
      {/* Current run */}
      {running && (
        <div
          className="px-4 py-3"
          style={{
            borderBottom: pendingQueue.length > 0
              ? "1px solid rgba(var(--border-rgb),0.1)"
              : undefined,
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: "var(--primary)" }} />
                <span
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: "var(--primary)" }}
                >
                  Running
                </span>
              </div>
              <button
                className="text-sm font-semibold truncate max-w-full text-left hover:underline"
                style={{ color: "var(--foreground)" }}
                onClick={onNavigateToPipeline}
              >
                {displayTitle}
              </button>
              {activeStage && (
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {activeStage.label ?? activeStage.stage}
                </div>
              )}
            </div>
            <button
              onClick={cancelPipeline}
              className="flex-shrink-0 p-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ color: "#b94040", background: "rgba(185,64,64,0.07)" }}
              title="Cancel run"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--primary-rgb),0.12)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: totalStages > 0 ? `${(completedCount / totalStages) * 100}%` : "0%",
                background: "var(--primary)",
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}>
              {completedCount} / {totalStages} stages
            </span>
            {runCost > 0 && (
              <span className="text-[10px] font-semibold" style={{ color: "var(--primary)" }}>
                ${runCost.toFixed(4)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Queue list */}
      {pendingQueue.length > 0 && (
        <div className="px-4 py-3">
          <div
            className="text-[10px] font-bold tracking-[0.1em] uppercase mb-2"
            style={{ color: "var(--text-subtle)" }}
          >
            Queued ({pendingQueue.length})
          </div>
          <div className="space-y-1">
            {pendingQueue.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 py-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                  style={{ background: "rgba(var(--border-rgb),0.1)", color: "var(--muted-foreground)" }}
                >
                  {idx + 1}
                </div>
                <span className="flex-1 text-sm truncate" style={{ color: "var(--foreground)" }}>
                  {item.articleTitle || "Untitled"}
                </span>
                <button
                  onClick={() => removeFromQueue(idx)}
                  className="flex-shrink-0 p-1 rounded-lg transition-all hover:opacity-80"
                  style={{ color: "var(--text-subtle)" }}
                  title="Remove from queue"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function PipelineQueueWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    running,
    pipelineStages,
    runData,
    runError,
    tokenSummary,
    pendingQueue,
    cancelPipeline,
    removeFromQueue,
    clearQueue,
  } = usePipeline();

  const [expanded, setExpanded] = useState(false);

  const isVisible = running || pendingQueue.length > 0;
  if (!isVisible) return null;

  const stages = pipelineStages;
  const completedCount = stages.filter(s => s.status === "done").length;
  const activeStage = stages.find(s => s.status === "running");
  const displayTitle = runData?.reflection_title ?? "Pipeline run";
  const runCost = Number(tokenSummary?.estimated_cost_usd ?? runData?.cost ?? 0);

  const handleNavigateToPipeline = () => {
    // Navigating to "/" remounts PipelineView, which resets mobileDismissed → modal reappears
    navigate("/");
    setExpanded(false);
  };

  const pillLabel = running
    ? (activeStage?.label ?? activeStage?.stage ?? "Running…")
    : "Done";

  return (
    <>
      {/* ── MOBILE bottom sheet ──────────────────────────────── */}
      {expanded && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setExpanded(false)}
          />

          {/* Sheet */}
          <div
            className="relative rounded-t-2xl overflow-hidden"
            style={{
              background: "var(--card, white)",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.14)",
              animation: "slideUp 0.22s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); }
                to   { transform: translateY(0); }
              }
            `}</style>

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(var(--border-rgb),0.2)" }} />
            </div>

            {/* Sheet header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.1)" }}
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" style={{ color: "var(--primary)" }} />
                <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                  Pipeline Queue
                </span>
              </div>
              <div className="flex items-center gap-1">
                {pendingQueue.length > 0 && (
                  <button
                    onClick={clearQueue}
                    className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                    style={{ background: "rgba(var(--border-rgb),0.07)", color: "var(--muted-foreground)" }}
                  >
                    Clear queue
                  </button>
                )}
                <button
                  onClick={() => setExpanded(false)}
                  className="p-1.5 rounded-lg"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <QueuePanelContent
              running={running}
              displayTitle={displayTitle}
              activeStage={activeStage}
              completedCount={completedCount}
              totalStages={stages.length}
              runCost={runCost}
              pendingQueue={pendingQueue}
              cancelPipeline={cancelPipeline}
              removeFromQueue={removeFromQueue}
              clearQueue={clearQueue}
              onNavigateToPipeline={handleNavigateToPipeline}
            />

                  {/* Spacer for bottom nav + home bar */}
            <div style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }} />
          </div>
        </div>
      )}

      {/* ── DESKTOP floating panel ───────────────────────────── */}
      {expanded && (
        <div
          className="hidden lg:block fixed bottom-20 right-5 z-50 rounded-2xl overflow-hidden"
          style={{
            width: "300px",
            background: "var(--card, white)",
            border: "1px solid rgba(var(--border-rgb),0.14)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.1)" }}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                Pipeline Queue
              </span>
            </div>
            <div className="flex items-center gap-1">
              {pendingQueue.length > 0 && (
                <button
                  onClick={clearQueue}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                  style={{ background: "rgba(var(--border-rgb),0.07)", color: "var(--muted-foreground)" }}
                >
                  Clear queue
                </button>
              )}
              <button
                onClick={() => setExpanded(false)}
                className="p-1.5 rounded-lg transition-all hover:opacity-80"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <QueuePanelContent
            running={running}
            displayTitle={displayTitle}
            activeStage={activeStage}
            completedCount={completedCount}
            totalStages={stages.length}
            runCost={runCost}
            pendingQueue={pendingQueue}
            cancelPipeline={cancelPipeline}
            removeFromQueue={removeFromQueue}
            clearQueue={clearQueue}
            onNavigateToPipeline={handleNavigateToPipeline}
          />
        </div>
      )}

      {/* ── Pill button (both breakpoints) ──────────────────── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="fixed bottom-20 right-4 lg:bottom-5 lg:right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full transition-all hover:opacity-90 active:scale-95"
        style={{
          background: runError ? "#b94040" : running ? "var(--primary)" : "var(--foreground)",
          color: "#fff",
          boxShadow: "0 4px 16px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.1)",
        }}
      >
        {running ? (
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
        ) : runError ? (
          <XCircle className="w-4 h-4 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="text-sm font-semibold whitespace-nowrap">
          {pillLabel}
          {pendingQueue.length > 0 && (
            <span className="ml-1.5 opacity-80">· {pendingQueue.length} queued</span>
          )}
        </span>
        <ChevronUp
          className="w-3.5 h-3.5 flex-shrink-0 opacity-80 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
        />
      </button>
    </>
  );
}
