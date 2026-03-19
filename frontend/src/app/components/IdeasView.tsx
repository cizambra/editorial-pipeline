import { useEffect, useState, useRef } from "react";
import { ideas } from "../../lib/api";
import { PageHeader } from "./PageHeader";
import { Card, Eyebrow } from "./Card";
import {
  Lightbulb,
  Plus,
  Trash2,
  Circle,
  PenLine,
  CheckCircle2,
  Telescope,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

type Status = "new" | "writing" | "done";

const STATUS_CONFIG: Record<
  Status,
  { label: string; color: string; bg: string; Icon: typeof Circle }
> = {
  new: { label: "New", color: "var(--text-subtle)", bg: "rgba(158,143,127,0.12)", Icon: Circle },
  writing: { label: "Writing", color: "var(--primary)", bg: "rgba(var(--primary-rgb),0.1)", Icon: PenLine },
  done: { label: "Done", color: "#1c7c52", bg: "rgba(28,124,82,0.1)", Icon: CheckCircle2 },
};

const STATUS_BORDER: Record<Status, string> = {
  new: "rgba(158,143,127,0.4)",
  writing: "var(--primary)",
  done: "#1c7c52",
};

const ALL_STATUSES: Status[] = ["new", "writing", "done"];

function parseSampleUrls(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      if (typeof parsed === "string" && parsed) return [parsed];
    } catch {
      if (raw.startsWith("http://") || raw.startsWith("https://")) return [raw];
    }
  }
  return [];
}

function StatusPill({
  status,
  onChange,
}: {
  status: Status;
  onChange?: (s: Status) => void;
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
  const Icon = cfg.Icon;
  if (!onChange) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        <Icon size={10} />
        {cfg.label}
      </span>
    );
  }
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as Status)}
      onClick={(e) => e.stopPropagation()}
      className="text-[10px] font-bold px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer appearance-none"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {ALL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_CONFIG[s].label}
        </option>
      ))}
    </select>
  );
}

function FrequencyBadge({ frequency }: { frequency?: number }) {
  if (!frequency || frequency < 2) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: "rgba(var(--primary-rgb),0.08)", color: "var(--primary)" }}
    >
      ×{frequency} posts
    </span>
  );
}

function SampleLinks({ urls, compact = false }: { urls: string[]; compact?: boolean }) {
  if (!urls.length) return null;
  return (
    <div className={`flex flex-wrap ${compact ? "gap-1 mt-1.5" : "gap-1.5 mt-2"}`}>
      {urls.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 font-semibold rounded-lg transition-colors ${compact ? "text-[10px] px-1.5 py-0.5" : "text-[10px] px-2 py-1"}`}
          style={{
            background: compact ? "rgba(var(--primary-rgb),0.08)" : "rgba(var(--border-rgb),0.06)",
            color: compact ? "#9a4f27" : "var(--muted-foreground)",
            border: compact ? "1px solid rgba(var(--primary-rgb),0.16)" : "1px solid rgba(var(--border-rgb),0.1)",
          }}
        >
          <ExternalLink size={9} />
          Post {i + 1}
        </a>
      ))}
    </div>
  );
}

// ── Desktop row (expandable) ────────────────────────────────────────────────
function IdeaRow({
  item,
  onDelete,
  onStatus,
  borderBottom,
}: {
  item: any;
  onDelete: () => void;
  onStatus: (s: Status) => void;
  borderBottom?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const status: Status = item.status ?? "new";
  const sampleUrls = parseSampleUrls(item.sample_urls);
  const previewUrls = sampleUrls.slice(0, 3);

  const hasDetail = item.article_angle || item.main_struggle || item.example || sampleUrls.length > 0;

  return (
    <div
      style={{
        borderLeft: `3px solid ${STATUS_BORDER[status]}`,
        borderBottom: borderBottom ? "1px solid rgba(var(--border-rgb),0.08)" : "none",
      }}
    >
      {/* Main row */}
      <div
        className={`flex items-start gap-3 py-3.5 -mx-5 px-5 ${hasDetail ? "cursor-pointer" : ""}`}
        onClick={() => hasDetail && setExpanded((x) => !x)}
      >
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
              {item.emoji && <span className="mr-1">{item.emoji}</span>}
              {item.theme ?? item.title}
            </span>
            <FrequencyBadge frequency={item.frequency} />
          </div>
          {item.category && (
            <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-subtle)" }}>
              {item.category}
            </span>
          )}
          {previewUrls.length > 0 && (
            <div className="mt-1">
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase mb-1" style={{ color: "#b06a43" }}>
                Sample posts
              </div>
              <SampleLinks urls={previewUrls} compact />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
          <StatusPill status={status} onChange={onStatus} />
          {hasDetail && (
            <span style={{ color: "#c4b89a" }}>
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-[rgba(185,64,64,0.1)] transition-colors"
            style={{ color: "#c4b89a" }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div
          className="-mx-5 px-5 pb-4 space-y-2.5"
          style={{ background: "rgba(var(--border-rgb),0.025)" }}
        >
          {item.main_struggle && (
            <div>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase mb-1" style={{ color: "var(--text-subtle)" }}>Core struggle</div>
              <div className="text-xs leading-relaxed" style={{ color: "#3d2b18" }}>{item.main_struggle}</div>
            </div>
          )}
          {item.article_angle && (
            <div>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase mb-1" style={{ color: "var(--text-subtle)" }}>Article angle</div>
              <div className="text-xs font-semibold leading-relaxed" style={{ color: "var(--primary)" }}>{item.article_angle}</div>
            </div>
          )}
          {item.example && (
            <div>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase mb-1" style={{ color: "var(--text-subtle)" }}>Sample post</div>
              <div className="text-xs italic leading-relaxed" style={{ color: "var(--muted-foreground)" }}>"{item.example}"</div>
            </div>
          )}
          {sampleUrls.length > 0 && (
            <div>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase mb-1" style={{ color: "var(--text-subtle)" }}>Source posts</div>
              <SampleLinks urls={sampleUrls} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mobile card ──────────────────────────────────────────────────────────────
function MobileIdeaCard({
  item,
  onDelete,
  onStatus,
  onTap,
}: {
  item: any;
  onDelete: () => void;
  onStatus: (s: Status) => void;
  onTap: () => void;
}) {
  const status: Status = item.status ?? "new";
  const sampleUrls = parseSampleUrls(item.sample_urls).slice(0, 2);
  return (
    <div
      className="rounded-2xl p-4 mb-3 active:scale-[0.99] transition-all cursor-pointer"
      style={{
        background: "white",
        border: "1px solid rgba(var(--border-rgb),0.12)",
        borderLeft: `3px solid ${STATUS_BORDER[status]}`,
        boxShadow: "0 1px 3px rgba(var(--border-rgb),0.04)",
      }}
      onClick={onTap}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-semibold leading-snug flex-1" style={{ color: "var(--foreground)" }}>
          {item.emoji && <span className="mr-1">{item.emoji}</span>}
          {item.theme ?? item.title}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg active:scale-95 transition-all"
          style={{ color: "#c4b89a", flexShrink: 0 }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {item.category && (
          <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-subtle)" }}>
            {item.category}
          </span>
        )}
        <FrequencyBadge frequency={item.frequency} />
        <StatusPill status={status} onChange={onStatus} />
      </div>
      {item.article_angle && (
        <div className="mt-2 text-xs leading-relaxed font-medium" style={{ color: "var(--primary)" }}>
          {item.article_angle}
        </div>
      )}
      {sampleUrls.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] font-bold tracking-[0.08em] uppercase mb-1" style={{ color: "#b06a43" }}>
            Sample posts
          </div>
          <SampleLinks urls={sampleUrls} compact />
        </div>
      )}
    </div>
  );
}

// ── Mobile detail bottom sheet ───────────────────────────────────────────────
function IdeaDetailSheet({
  item,
  onClose,
}: {
  item: any;
  onClose: () => void;
}) {
  const status: Status = item.status ?? "new";
  const sampleUrls = parseSampleUrls(item.sample_urls);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40"
        style={{ zIndex: 60 }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 rounded-t-3xl overflow-y-auto"
        style={{
          zIndex: 60,
          background: "#faf7f2",
          maxHeight: "85vh",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(var(--border-rgb),0.2)" }} />
        </div>

        <div className="px-5 pb-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1">
              <div className="text-base font-bold leading-snug mb-1" style={{ color: "var(--foreground)" }}>
                {item.emoji && <span className="mr-1.5">{item.emoji}</span>}
                {item.theme ?? item.title}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {item.category && (
                  <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-subtle)" }}>
                    {item.category}
                  </span>
                )}
                <StatusPill status={status} />
                <FrequencyBadge frequency={item.frequency} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl"
              style={{ background: "rgba(var(--border-rgb),0.08)", color: "var(--muted-foreground)" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Sections */}
          {item.main_struggle && (
            <div className="rounded-2xl p-4 mb-3" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.1)" }}>
              <Eyebrow>Core struggle</Eyebrow>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "#3d2b18" }}>
                {item.main_struggle}
              </p>
            </div>
          )}

          {item.article_angle && (
            <div className="rounded-2xl p-4 mb-3" style={{ background: "rgba(var(--primary-rgb),0.05)", border: "1px solid rgba(var(--primary-rgb),0.15)" }}>
              <Eyebrow>Article angle</Eyebrow>
              <p className="mt-2 text-sm font-semibold leading-relaxed" style={{ color: "var(--primary)" }}>
                {item.article_angle}
              </p>
            </div>
          )}

          {item.example && (
            <div className="rounded-2xl p-4 mb-3" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.1)" }}>
              <Eyebrow>Representative post</Eyebrow>
              <p className="mt-2 text-sm italic leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                "{item.example}"
              </p>
            </div>
          )}

          {sampleUrls.length > 0 && (
            <div className="rounded-2xl p-4 mb-3" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.1)" }}>
              <Eyebrow>Source posts on Reddit</Eyebrow>
              <div className="mt-3 space-y-2">
                {sampleUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      background: "rgba(var(--border-rgb),0.06)",
                      color: "#3d2b18",
                      border: "1px solid rgba(var(--border-rgb),0.1)",
                    }}
                  >
                    <ExternalLink size={14} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
                    <span className="truncate">View post {i + 1} on Reddit</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Reddit scan card ─────────────────────────────────────────────────────────
function RedditScanCard({
  scanning, log, result, error, onScan,
}: {
  scanning: boolean;
  log: string[];
  result: { categories: any[]; total_posts: number } | null;
  error: string | null;
  onScan: () => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  return (
    <div
      className="rounded-2xl p-4 lg:p-5"
      style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)", boxShadow: "0 1px 3px rgba(var(--border-rgb),0.04)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <Eyebrow>Research miner</Eyebrow>
          <div className="font-bold text-sm mt-0.5" style={{ color: "var(--foreground)" }}>Reddit struggles scan</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
            Scans r/Discipline &amp; r/getdisciplined, extracts patterns with Claude
          </div>
        </div>
        <button
          onClick={onScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
          style={{ background: scanning ? "rgba(var(--border-rgb),0.07)" : "rgba(var(--primary-rgb),0.1)", color: scanning ? "var(--text-subtle)" : "var(--primary)" }}
        >
          {scanning
            ? <><Loader2 size={13} className="animate-spin" />Scanning…</>
            : <><Telescope size={13} />Scan Reddit</>}
        </button>
      </div>

      {(scanning || log.length > 0) && (
        <div
          ref={logRef}
          className="rounded-xl p-3 overflow-y-auto"
          style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)", maxHeight: 96 }}
        >
          {log.map((line, i) => (
            <div key={i} className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{line}</div>
          ))}
          {scanning && (
            <div className="text-xs flex items-center gap-1.5 mt-1" style={{ color: "var(--primary)" }}>
              <Loader2 size={10} className="animate-spin" />Working…
            </div>
          )}
        </div>
      )}

      {result && (
        <div
          className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl"
          style={{ background: "rgba(28,124,82,0.08)", border: "1px solid rgba(28,124,82,0.15)" }}
        >
          <div className="text-xs font-bold" style={{ color: "#1c7c52" }}>
            {result.categories.length} idea themes saved from {result.total_posts} posts
          </div>
        </div>
      )}

      {error && (
        <div
          className="mt-3 px-3 py-2 rounded-xl text-xs font-medium"
          style={{ background: "rgba(185,64,64,0.08)", color: "#b94040", border: "1px solid rgba(185,64,64,0.15)" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────
export function IdeasView() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIdea, setNewIdea] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [scanResult, setScanResult] = useState<{ categories: any[]; total_posts: number } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ideas.list() as any;
      setItems(Array.isArray(res) ? res : (res.ideas ?? []));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newIdea.trim()) return;
    const item = await ideas.create({ theme: newIdea.trim() }).catch(() => null);
    if (item) {
      setItems((prev) => [item, ...prev]);
      setNewIdea("");
      inputRef.current?.focus();
    }
  };

  const handleDelete = async (id: string) => {
    await ideas.delete(id).catch(() => {});
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const handleStatus = async (id: string, status: Status) => {
    await ideas.updateStatus(id, status).catch(() => {});
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  const handleRedditScan = async () => {
    setScanning(true);
    setScanLog([]);
    setScanResult(null);
    setScanError(null);
    try {
      const result = await ideas.redditScan((msg) =>
        setScanLog((prev) => [...prev, msg])
      );
      setScanResult(result);
      load();
    } catch (e: any) {
      setScanError(e?.message ?? "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const filtered =
    filter === "all" ? items : items.filter((x) => (x.status ?? "new") === filter);

  const counts: Record<string, number> = {
    all: items.length,
    new: items.filter((x) => (x.status ?? "new") === "new").length,
    writing: items.filter((x) => x.status === "writing").length,
    done: items.filter((x) => x.status === "done").length,
  };

  const FilterPills = () => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {(["all", ...ALL_STATUSES] as const).map((s) => {
        const active = filter === s;
        const label = s === "all" ? "All" : STATUS_CONFIG[s].label;
        return (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-all"
            style={{
              background: active ? "var(--primary)" : "rgba(var(--border-rgb),0.07)",
              color: active ? "white" : "var(--muted-foreground)",
            }}
          >
            {label}
            {counts[s] > 0 && <span className="ml-1 opacity-70">{counts[s]}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile Layout */}
      <div className="lg:hidden pb-8">
        <div className="mb-4">
          <Eyebrow>Create</Eyebrow>
          <div
            className="text-[22px] leading-tight -tracking-[0.02em]"
            style={{ fontFamily: '"Montserrat", "Inter", sans-serif', fontWeight: 800, color: "var(--foreground)" }}
          >
            Ideas
          </div>
        </div>

        {/* Add idea */}
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)", boxShadow: "0 1px 3px rgba(var(--border-rgb),0.05)" }}
        >
          <Eyebrow>New idea</Eyebrow>
          <div className="flex gap-2 mt-2">
            <input
              ref={inputRef}
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="What's the article idea?"
              className="flex-1 bg-transparent text-sm outline-none py-2 px-3 rounded-xl"
              style={{ border: "1px solid rgba(var(--border-rgb),0.2)", color: "var(--foreground)" }}
            />
            <button
              onClick={handleCreate}
              disabled={!newIdea.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "var(--primary)", color: "white" }}
            >
              <Plus size={15} />
              Add
            </button>
          </div>
        </div>

        {/* Reddit scan */}
        <div className="mb-4">
          <RedditScanCard
            scanning={scanning}
            log={scanLog}
            result={scanResult}
            error={scanError}
            onScan={handleRedditScan}
          />
        </div>

        {/* Filter pills */}
        <div className="mb-3">
          <FilterPills />
        </div>

        {/* Ideas list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl"
                style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.08)", opacity: 0.6 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Lightbulb size={32} style={{ color: "#c4b89a" }} />
            <div className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
              {items.length === 0 ? "No ideas yet" : "No ideas in this filter"}
            </div>
          </div>
        ) : (
          filtered.map((item) => (
            <MobileIdeaCard
              key={item.id}
              item={item}
              onDelete={() => handleDelete(item.id)}
              onStatus={(s) => handleStatus(item.id, s)}
              onTap={() => setSelectedItem(item)}
            />
          ))
        )}
      </div>

      {/* Mobile detail sheet */}
      {selectedItem && (
        <IdeaDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      {/* Desktop Layout */}
      <div className="hidden lg:block">
        <PageHeader
          kicker="Create"
          title="Ideas"
          description="Capture article ideas and track them through the writing process."
        />

        <div className="grid grid-cols-[320px_1fr] gap-4 mt-4">
          {/* Left column */}
          <div className="space-y-4">
            <Card>
              <Eyebrow>New idea</Eyebrow>
              <div className="mt-3 space-y-3">
                <input
                  ref={inputRef}
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Article title or concept…"
                  className="w-full text-sm outline-none py-2.5 px-3.5 rounded-xl"
                  style={{
                    background: "rgba(var(--border-rgb),0.04)",
                    border: "1px solid rgba(var(--border-rgb),0.14)",
                    color: "var(--foreground)",
                  }}
                />
                <button
                  onClick={handleCreate}
                  disabled={!newIdea.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--primary)", color: "white" }}
                >
                  <Plus size={15} />
                  Add Idea
                </button>
              </div>
            </Card>

            <RedditScanCard
              scanning={scanning}
              log={scanLog}
              result={scanResult}
              error={scanError}
              onScan={handleRedditScan}
            />

            {/* Pipeline stats */}
            {!loading && items.length > 0 && (
              <Card>
                <Eyebrow>Pipeline status</Eyebrow>
                <div className="mt-3 space-y-3">
                  {ALL_STATUSES.map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const count = counts[s];
                    const pct = items.length > 0 ? (count / items.length) * 100 : 0;
                    return (
                      <div key={s}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                            {cfg.label}
                          </span>
                          <span className="text-xs font-bold" style={{ color: cfg.color }}>
                            {count}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: "rgba(var(--border-rgb),0.08)" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: cfg.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* Right: Ideas pool */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <Eyebrow>Ideas pool</Eyebrow>
                <div className="text-[15px] font-bold -tracking-[0.01em]" style={{ color: "var(--foreground)" }}>
                  {items.length} idea{items.length !== 1 ? "s" : ""}
                </div>
              </div>
              <FilterPills />
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-10 rounded-lg"
                    style={{ background: "rgba(var(--border-rgb),0.06)", opacity: 1 - i * 0.15 }}
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Lightbulb size={28} style={{ color: "#c4b89a" }} />
                <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  {items.length === 0 ? "Add your first idea" : "No ideas in this filter"}
                </div>
              </div>
            ) : (
              filtered.map((item, i) => (
                <IdeaRow
                  key={item.id}
                  item={item}
                  borderBottom={i < filtered.length - 1}
                  onDelete={() => handleDelete(item.id)}
                  onStatus={(s) => handleStatus(item.id, s)}
                />
              ))
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
