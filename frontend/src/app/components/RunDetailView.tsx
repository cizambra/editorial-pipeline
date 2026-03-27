import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, ChevronLeft, ExternalLink, Copy, Check, Clock, Loader2 } from "lucide-react";
import { ThumbnailConceptsPanel } from "./ThumbnailConceptsPanel";
import { history } from "../../lib/api";
import { usePipeline } from "../../lib/pipeline-context";
import { PageHeader } from "./PageHeader";
import { Card } from "./Card";
import { SegmentedControl } from "./FormComponents";
import { CustomSelect } from "./CustomSelect";
import { WYSIWYGEditor } from "./WYSIWYGEditor";
import { SegmentedTabs } from "./mobile";

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} className="p-2 rounded-lg transition-all hover:opacity-80" style={{ color: "var(--text-subtle)" }} title="Copy">
      {copied ? <Check className="w-4 h-4" style={{ color: "#22c55e" }} /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

const BASE_TAB_OPTIONS = [
  { value: "reflection", label: "Reflection" },
  { value: "companion", label: "Paid companion" },
  { value: "quotes", label: "Quotes" },
  { value: "social", label: "Social posts" },
  { value: "related", label: "Related articles" },
];

function RelatedContent({ articles }: { articles: any[] }) {
  if (!articles.length) return <p className="text-sm" style={{ color: "var(--text-subtle)" }}>No related articles in this run.</p>;
  return (
    <div className="space-y-3">
      {articles.map((a: any, idx: number) => (
        <div key={a.url || idx} className="p-4 rounded-2xl" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="text-sm font-semibold flex-1" style={{ color: "var(--foreground)" }}>{a.title}</div>
            {a.type && (
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded flex-shrink-0" style={{ background: "rgba(var(--border-rgb),0.1)", color: "var(--muted-foreground)" }}>
                {a.type}
              </span>
            )}
          </div>
          {a.url && (
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1.5 hover:underline" style={{ color: "var(--primary)" }}>
              <ExternalLink className="w-3.5 h-3.5" />{a.url}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function QuotesContent({ quotes }: { quotes: any[] }) {
  if (!quotes.length) return <p className="text-sm" style={{ color: "var(--text-subtle)" }}>No quotes in this run.</p>;
  return (
    <div className="space-y-4">
      {quotes.map((q: any, i: number) => (
        <div key={i} className="p-4 rounded-2xl" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.12)", borderLeft: "4px solid #c4522a" }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            {q.quote_type && (
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded" style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}>
                {q.quote_type}
              </span>
            )}
            <CopyButton text={q.quote_text ?? q.quote ?? ""} />
          </div>
          <p className="text-sm leading-relaxed italic" style={{ color: "var(--foreground)" }}>"{q.quote_text ?? q.quote}"</p>
          {q.context && <p className="text-xs mt-2" style={{ color: "var(--text-subtle)" }}>{q.context}</p>}
        </div>
      ))}
    </div>
  );
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  threads: "Threads",
  instagram: "Instagram",
  substack_note: "Substack Note",
};

const SOURCE_OPTIONS = [
  { value: "reflection", label: "Reflection" },
  { value: "companion", label: "Companion" },
];

function SocialContent({
  reflectionSocial,
  companionSocial,
  mobile = false,
}: {
  reflectionSocial: Record<string, string>;
  companionSocial: Record<string, string>;
  mobile?: boolean;
}) {
  const hasReflection = Object.values(reflectionSocial).some((v) => v?.trim());
  const hasCompanion = Object.values(companionSocial).some((v) => v?.trim());
  const [source, setSource] = useState<"reflection" | "companion">(hasReflection ? "reflection" : "companion");
  const [platform, setPlatform] = useState("");
  const [copied, setCopied] = useState(false);

  const socialData = source === "reflection" ? reflectionSocial : companionSocial;
  const availablePlatforms = ["linkedin", "threads", "instagram", "substack_note"].filter((p) => socialData[p]?.trim());
  const activePlatform = availablePlatforms.includes(platform) ? platform : availablePlatforms[0] ?? "";
  const content = socialData[activePlatform] ?? "";

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!hasReflection && !hasCompanion) {
    return <p className="text-sm" style={{ color: "var(--text-subtle)" }}>No social posts in this run.</p>;
  }

  const platformTabs = availablePlatforms.map((p) => ({
    value: p,
    label: (PLATFORM_LABELS[p] ?? p).replace(" Note", ""),
  }));

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className={mobile ? "space-y-2" : "flex items-center gap-3"}>
        {/* Source picker — only if both exist */}
        {hasReflection && hasCompanion && (
          <div style={mobile ? undefined : { minWidth: "140px" }}>
            <CustomSelect
              options={SOURCE_OPTIONS}
              value={source}
              onChange={(v) => setSource(v as "reflection" | "companion")}
            />
          </div>
        )}

        {/* Platform tabs */}
        {platformTabs.length > 0 && (
          <SegmentedTabs
            tabs={platformTabs}
            value={activePlatform}
            onChange={setPlatform}
            size="sm"
          />
        )}
      </div>

      {/* Content */}
      {content ? (
        <textarea
          value={content}
          readOnly
          rows={mobile ? 10 : 12}
          className="w-full p-4 rounded-xl text-sm leading-relaxed resize-none"
          style={{
            background: "var(--secondary)",
            border: "1px solid rgba(var(--border-rgb),0.12)",
            color: "var(--foreground)",
          }}
        />
      ) : (
        <p className="text-sm py-2" style={{ color: "var(--text-subtle)" }}>No content for this platform.</p>
      )}

      {/* Action row */}
      {content && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: "rgba(var(--border-rgb),0.07)", color: "var(--muted-foreground)" }}
          >
            {copied
              ? <><Check className="w-4 h-4" style={{ color: "#22c55e" }} /> Copied</>
              : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
        </div>
      )}
    </div>
  );
}

export function RunDetailView() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { runData: liveRunData } = usePipeline();
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [activeTab, setActiveTab] = useState("reflection");

  useEffect(() => {
    if (!runId) return;
    history.get(runId)
      .then((r: any) => setRun(r))
      .catch((e: any) => setError(e.message ?? "Failed to load run"))
      .finally(() => setLoading(false));
  }, [runId]);

  useEffect(() => {
    if (!runId || !run || String(liveRunData?.run_id) !== runId) return;
    const liveStatus = String(liveRunData?.status ?? "").toLowerCase();
    if (liveStatus === "cancelled" || liveStatus === "error") {
      setRun((prev: any) => prev ? { ...prev, status: liveStatus } : prev);
    }
  }, [liveRunData, run, runId]);

  // ── derive content ────────────────────────────────────────────
  const data = run?.data ?? {};
  const relatedArticles = Array.isArray(data.related_articles) ? data.related_articles : [];
  const quotes = Array.isArray(data.quotes) ? data.quotes : [];
  const runTags = Array.isArray(data.tags) ? data.tags : [];
  // Prefer stored DB concepts; fall back to live pipeline context when this is the most recent run
  const storedConcepts = Array.isArray(data.thumbnail_concepts) ? data.thumbnail_concepts
    : Array.isArray(data.thumbnailConcepts) ? data.thumbnailConcepts : [];
  const liveConcepts = String(liveRunData?.run_id) === runId && Array.isArray(liveRunData?.thumbnailConcepts)
    ? liveRunData!.thumbnailConcepts as any[]
    : [];
  const thumbnailConcepts = storedConcepts.length > 0 ? storedConcepts : liveConcepts;
  const reflectionPayload = data.reflection ?? {};
  const companionPayload = data.companion ?? {};
  const reflectionContent = language === "es" ? (reflectionPayload.es || "") : (reflectionPayload.en || "");
  const companionContent = language === "es" ? (companionPayload.es || "") : (companionPayload.en || "");
  const reflectionSocial = language === "es" ? (reflectionPayload.repurposed_es ?? {}) : (reflectionPayload.repurposed_en ?? {});
  const companionSocial = language === "es" ? (companionPayload.repurposed_es ?? {}) : (companionPayload.repurposed_en ?? {});
  const editorContent = activeTab === "reflection" ? reflectionContent : companionContent;
  // Only show thumbnail tab when thumbnail generation was requested for this run
  const hasThumbnails = thumbnailConcepts.length > 0 ||
    (String(liveRunData?.run_id) === runId && liveRunData?._autoThumbnail === true);
  const tabOptions = hasThumbnails
    ? [...BASE_TAB_OPTIONS, { value: "thumbnail", label: "Thumbnail concepts" }]
    : BASE_TAB_OPTIONS;

  // Triage info (if present on run.data.triage)
  const triage = run?.data?.triage ?? null;

  // ── shared tab content renderer ───────────────────────────────
  function TabContent({ mobile = false }: { mobile?: boolean }) {
    const editorHeight = mobile ? "400px" : "600px";
    const normalizedStatus = String(run?.status ?? "").toLowerCase();
    const waitingForSelectedContent =
      (activeTab === "reflection" || activeTab === "companion") &&
      !editorContent.trim() &&
      (normalizedStatus === "running" || normalizedStatus === "queued" || normalizedStatus === "pending");

    return (
      <>
        {(activeTab === "reflection" || activeTab === "companion") && (
          <div style={{ height: editorHeight, borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            {waitingForSelectedContent ? (
              <div
                className="h-full flex flex-col items-center justify-center text-center px-6"
                style={{ background: "#fff" }}
              >
                <Loader2 className="w-5 h-5 animate-spin mb-3" style={{ color: "var(--primary)" }} />
                <div className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                  {activeTab === "companion"
                    ? (language === "es" ? "Spanish companion is still generating." : "Companion article is still generating.")
                    : (language === "es" ? "Spanish reflection is still generating." : "Reflection is still generating.")}
                </div>
                <div className="text-xs max-w-sm" style={{ color: "var(--text-subtle)" }}>
                  {language === "es"
                    ? "Switch back to EN or wait for the translation stage to finish."
                    : "This section will appear automatically as soon as the current stage completes."}
                </div>
              </div>
            ) : editorContent.trim() ? (
              <WYSIWYGEditor value={editorContent} onChange={() => {}} placeholder="No content" />
            ) : (
              <div
                className="h-full flex flex-col items-center justify-center text-center px-6"
                style={{ background: "#fff" }}
              >
                <div className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                  {activeTab === "companion"
                    ? (language === "es" ? "Spanish companion is not available for this run." : "Companion article is not available for this run.")
                    : (language === "es" ? "Spanish reflection is not available for this run." : "Reflection is not available for this run.")}
                </div>
                <div className="text-xs max-w-sm" style={{ color: "var(--text-subtle)" }}>
                  {language === "es"
                    ? "Try switching back to EN or open another section from this run."
                    : "Try switching languages or opening another section from this run."}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === "quotes" && <QuotesContent quotes={quotes} />}
        {activeTab === "social" && <SocialContent reflectionSocial={reflectionSocial} companionSocial={companionSocial} mobile={mobile} />}
        {activeTab === "related" && <RelatedContent articles={relatedArticles} />}
        {activeTab === "thumbnail" && (
          <ThumbnailConceptsPanel concepts={thumbnailConcepts} />
        )}
      </>
    );
  }

  // ── loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <>
        {/* Mobile skeleton — full-screen modal */}
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
          <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-4" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <button onClick={() => navigate("/history")} className="p-2 -ml-1 rounded-xl" style={{ color: "var(--muted-foreground)" }}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 h-5 rounded-lg" style={{ background: "rgba(var(--border-rgb),0.12)" }} />
          </div>
          <div className="flex-1 px-4 py-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl" style={{ background: "rgba(var(--border-rgb),0.06)", opacity: 1 - i * 0.2 }} />
            ))}
          </div>
        </div>
        {/* Desktop skeleton */}
        <div className="hidden lg:block space-y-4 mt-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl" style={{ background: "rgba(var(--border-rgb),0.06)", opacity: 1 - i * 0.2 }} />
          ))}
        </div>
      </>
    );
  }

  // ── error / not found ─────────────────────────────────────────
  if (error || !run) {
    return (
      <>
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
          <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-4" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <button onClick={() => navigate("/history")} className="p-2 -ml-1 rounded-xl" style={{ color: "var(--muted-foreground)" }}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="text-base font-bold" style={{ color: "var(--foreground)" }}>Run not found</span>
          </div>
          <div className="px-4 py-4">
            <div className="p-4 rounded-2xl text-sm" style={{ background: "rgba(185,64,64,0.08)", color: "#b94040" }}>{error ?? "Run not found"}</div>
          </div>
        </div>
        <div className="hidden lg:block px-4 pt-4">
          <button onClick={() => navigate("/history")} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--primary)" }}>
            <ArrowLeft className="w-4 h-4" /> Back to History
          </button>
          <div className="p-4 rounded-2xl text-sm" style={{ background: "rgba(185,64,64,0.08)", color: "#b94040" }}>{error ?? "Run not found"}</div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── MOBILE — full-screen modal ──────────────────────────── */}
      <div
        className="lg:hidden fixed inset-0 z-50 flex flex-col"
        style={{
          background: "var(--background)",
          animation: "slideInRight 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
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
            onClick={() => navigate("/history")}
            className="p-2 -ml-1 rounded-xl active:bg-black active:bg-opacity-5 transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-[16px] font-bold truncate" style={{ fontFamily: "Montserrat, sans-serif", color: "var(--foreground)" }}>
              {run.title || `Run #${run.id}`}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[12px]" style={{ color: "var(--text-subtle)" }}>
                <Clock className="w-3 h-3 inline mr-1" />
                {timeAgo(run.timestamp ?? run.created_at ?? "")}
              </span>
              {run.cost_usd > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}>
                  ${Number(run.cost_usd).toFixed(4)}
                </span>
              )}
            </div>
          </div>

          {/* Language toggle */}
          <div className="flex items-center gap-1 rounded-lg p-1 flex-shrink-0" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            {(["en", "es"] as const).map(lang => (
              <button
                key={lang}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={{ background: language === lang ? "var(--primary)" : "transparent", color: language === lang ? "#fff" : "var(--muted-foreground)" }}
                onClick={() => setLanguage(lang)}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4" style={{ WebkitOverflowScrolling: "touch" as any }}>
          {/* Tags + article URL */}
          {(runTags.length > 0 || run.article_url) && (
            <div className="-mx-4">
              {runTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.12)" }}>
                  {runTags.map((tag: string) => (
                    <span key={tag} className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md" style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {run.article_url && (
                <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.12)" }}>
                  <a href={run.article_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--primary)" }}>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />{run.article_url}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Tab selector */}
          <CustomSelect options={tabOptions} value={activeTab} onChange={setActiveTab} />

          {/* Content */}
          <TabContent mobile />
        </div>
      </div>

      {/* ── DESKTOP ─────────────────────────────────────────────── */}
      <div className="hidden lg:block">
        <button
          onClick={() => navigate("/history")}
          className="flex items-center gap-1.5 text-sm font-medium mb-3 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          History
        </button>

        <PageHeader kicker="History" title={run.title || `Run #${run.id}`} />

        <Card className="mt-4">
          {/* Metadata */}
          <div className="mb-6 pb-6 border-b" style={{ borderColor: "rgba(var(--border-rgb),0.12)" }}>
            <div className="flex flex-wrap items-center gap-y-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span>{timeAgo(run.timestamp ?? run.created_at ?? "")}</span>
                {run.cost_usd > 0 && (
                  <><span>•</span><span style={{ color: "var(--primary)", fontWeight: 600 }}>${Number(run.cost_usd).toFixed(4)}</span></>
                )}
              </div>
              {run.article_url && (
                <>
                  <span className="mx-3">·</span>
                  <a href={run.article_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: "var(--primary)" }}>
                    <ExternalLink className="w-3 h-3" />{run.article_url}
                  </a>
                </>
              )}
              {runTags.length > 0 && (
                <>
                  <span className="mx-3">·</span>
                  <div className="flex items-center gap-1.5">
                    {runTags.map((tag: string) => (
                      <span key={tag} className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide" style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-end justify-between gap-4 -mb-px" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div className="flex items-end gap-1 overflow-x-auto overflow-y-hidden">
              {tabOptions.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className="px-4 pb-3 pt-2 text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    color: activeTab === tab.value ? "var(--primary)" : "var(--muted-foreground)",
                    borderBottom: activeTab === tab.value ? "2px solid #c4522a" : "2px solid transparent",
                    marginBottom: "-1px",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pb-2 flex-shrink-0">
              <SegmentedControl
                options={[{ id: "en", label: "EN" }, { id: "es", label: "ES" }]}
                value={language}
                onChange={(v) => setLanguage(v as "en" | "es")}
              />
            </div>
          </div>

          <div className="mt-5">
            <TabContent />
          </div>
        </Card>
      </div>
    </>
  );
}
