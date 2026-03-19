import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X, Copy, Send, Clock, Loader2, Check, History, RotateCcw } from "lucide-react";
import { Button, Field, Label, Input } from "./FormComponents";
import { WYSIWYGEditor } from "./WYSIWYGEditor";
import { CustomSelect } from "./CustomSelect";
import { SegmentedTabs } from "./mobile";
import { history, social } from "../../lib/api";

type Platform = "linkedin" | "threads" | "instagram" | "substack_note";
type VariantKey = "reflection-en" | "reflection-es" | "companion-en" | "companion-es";

const VARIANTS: { key: VariantKey; label: string }[] = [
  { key: "reflection-en", label: "Reflection EN" },
  { key: "reflection-es", label: "Reflection ES" },
  { key: "companion-en", label: "Companion EN" },
  { key: "companion-es", label: "Companion ES" },
];

const PLATFORMS: { key: Platform; label: string }[] = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "threads", label: "Threads" },
  { key: "instagram", label: "Instagram" },
  { key: "substack_note", label: "Substack" },
];

const timezones = [
  { value: "America/Los_Angeles", label: "Pacific (PST/PDT)" },
  { value: "America/Denver", label: "Mountain (MST/MDT)" },
  { value: "America/Chicago", label: "Central (CST/CDT)" },
  { value: "America/New_York", label: "Eastern (EST/EDT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
];

type Campaign = {
  id: string;
  title: string;
  timestamp: string;
  postCount: number;
  cost: string;
  articleUrl: string | null;
};

function extractPosts(data: any, variant: VariantKey, platform: Platform): string[] {
  if (!data) return [];
  const [section, lang] = variant.split("-") as ["reflection" | "companion", "en" | "es"];
  const repurposed = data[section]?.[`repurposed_${lang}`];
  const raw: string = repurposed?.[platform] ?? "";
  if (!raw) return [];
  return raw.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
}

type Props = {
  campaign: Campaign;
  onClose: () => void;
};

export function CampaignDetailModal({ campaign, onClose }: Props) {
  const [variant, setVariant] = useState<VariantKey>("reflection-en");
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [sampleIndex, setSampleIndex] = useState(0);
  const [runData, setRunData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");
  const [showHistory, setShowHistory] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);
  const toastCounter = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addToast = (msg: string, type: "success" | "error" = "success") => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState("America/Los_Angeles");

  useEffect(() => {
    setLoading(true);
    history.get(campaign.id).then((res: any) => {
      setRunData(res.data ?? null);
    }).catch(() => {
      setRunData(null);
    }).finally(() => setLoading(false));
  }, [campaign.id]);

  // Reset sample index when variant or platform changes
  useEffect(() => {
    setSampleIndex(0);
  }, [variant, platform]);

  const performAutoSave = useCallback(async (pending: Record<string, string>) => {
    if (!runData || Object.keys(pending).length === 0) return;
    setSaveStatus("saving");
    try {
      await Promise.all(
        Object.entries(pending).map(([key, text]) => {
          const [variantKey, platform, indexStr] = key.split("::");
          const [section, lang] = variantKey.split("-");
          return history.patchContent(campaign.id, {
            section, lang, platform, sample_index: parseInt(indexStr, 10), text,
          });
        })
      );
      const res = await history.get(campaign.id);
      setRunData(res.data ?? null);
      setEditedContent({});
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("unsaved");
    }
  }, [runData, campaign.id]);

  useEffect(() => {
    if (Object.keys(editedContent).length === 0) return;
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void performAutoSave(editedContent);
    }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [editedContent]);

  const samples = extractPosts(runData, variant, platform);
  const totalSamples = samples.length || 1;
  const clampedIndex = Math.min(sampleIndex, totalSamples - 1);

  const contentKey = `${variant}::${platform}::${clampedIndex}`;
  const currentText = contentKey in editedContent ? editedContent[contentKey] : (samples[clampedIndex] ?? "");

  const handleChange = (text: string) => {
    setEditedContent((prev) => ({ ...prev, [contentKey]: text }));
  };

  const handleCopy = () => navigator.clipboard.writeText(currentText);

  const handleSchedule = async () => {
    const scheduled_at = `${scheduleDate}T${scheduleTime}:00`;
    try {
      await social.schedule({
        platform,
        text: currentText,
        scheduled_at,
        source_label: contentKey,
        timezone: scheduleTimezone,
      });
      setShowScheduleModal(false);
      setScheduleDate("");
      setScheduleTime("");
      const label = new Date(scheduled_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      addToast(`Scheduled for ${label}`, "success");
    } catch {
      addToast("Failed to schedule. Please try again.", "error");
    }
  };

  const handlePublishNow = async () => {
    setPublishing(true);
    try {
      await social.publish({ platform, text: currentText, source_label: contentKey });
      addToast("Published successfully.", "success");
    } catch {
      addToast("Failed to publish. Please try again.", "error");
    } finally {
      setPublishing(false);
    }
  };

  const variantOptions = VARIANTS.map((v) => ({ value: v.key, label: v.label }));

  const historyEntries: { timestamp: string; text: string }[] =
    (runData as any)?._edit_history?.[contentKey] ?? [];

  const SaveIndicator = () => {
    if (saveStatus === "saving") return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
        <Loader2 className="w-3 h-3 animate-spin" /> Saving…
      </span>
    );
    if (saveStatus === "saved") return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: "#16a34a" }}>
        <Check className="w-3 h-3" /> Saved
      </span>
    );
    if (saveStatus === "unsaved") return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#f59e0b" }} />
        Unsaved
      </span>
    );
    return null;
  };

  const SampleNav = ({ compact = false }: { compact?: boolean }) => (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button
        onClick={() => setSampleIndex((i) => Math.max(0, i - 1))}
        disabled={clampedIndex === 0}
        className="p-1.5 rounded-lg transition-all disabled:opacity-30"
        style={{ background: "rgba(var(--border-rgb),0.08)", color: "var(--muted-foreground)" }}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className={`font-semibold px-1 tabular-nums ${compact ? "text-xs" : "text-xs"}`} style={{ color: "var(--foreground)" }}>
        {clampedIndex + 1}/{totalSamples}
      </span>
      <button
        onClick={() => setSampleIndex((i) => Math.min(totalSamples - 1, i + 1))}
        disabled={clampedIndex >= totalSamples - 1}
        className="p-1.5 rounded-lg transition-all disabled:opacity-30"
        style={{ background: "rgba(var(--border-rgb),0.08)", color: "var(--muted-foreground)" }}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  const renderContent = (rows: number = 10) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} />
        </div>
      );
    }
    if (!currentText) {
      return (
        <div className="py-10 text-center text-sm" style={{ color: "var(--text-subtle)" }}>
          No content for this combination.
        </div>
      );
    }
    if (platform === "substack_note") {
      return (
        <WYSIWYGEditor value={currentText} onChange={handleChange} placeholder="Substack note..." />
      );
    }
    return (
      <textarea
        value={currentText}
        onChange={(e) => handleChange(e.target.value)}
        rows={rows}
        className="w-full p-4 rounded-xl text-sm leading-relaxed resize-none"
        style={{
          background: "var(--secondary)",
          border: "1px solid rgba(var(--border-rgb),0.12)",
          color: "var(--foreground)",
        }}
      />
    );
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose} />

      {/* Mobile: full-screen slide-over */}
      <div
        className="lg:hidden fixed inset-0 z-50 flex flex-col"
        style={{ background: "var(--background)", animation: "slideInRight 0.2s cubic-bezier(0.22,1,0.36,1)" }}
      >
        {/* Mobile header */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3"
          style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.12)" }}
        >
          <button onClick={onClose} className="p-2 -ml-1 rounded-xl" style={{ color: "var(--muted-foreground)" }}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-bold truncate" style={{ color: "var(--foreground)" }}>
              {campaign.title}
            </h3>
            {saveStatus !== "idle" && (
              <div className="mt-0.5"><SaveIndicator /></div>
            )}
          </div>
          <button onClick={() => setShowHistory(true)} className="p-2 rounded-xl" style={{ color: "var(--muted-foreground)" }}>
            <History className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile controls: variant dropdown + sample nav */}
        <div
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2"
          style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.08)" }}
        >
          <div className="flex-1 min-w-0">
            <CustomSelect options={variantOptions} value={variant} onChange={(v) => setVariant(v as VariantKey)} />
          </div>
          <SampleNav compact />
        </div>

        {/* Mobile platform tabs */}
        <div className="flex-shrink-0 px-4 py-2" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.08)" }}>
          <SegmentedTabs
            tabs={PLATFORMS.map((p) => ({ value: p.key, label: p.label }))}
            value={platform}
            onChange={(v) => setPlatform(v as Platform)}
            size="sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {renderContent(12)}
        </div>

        <div
          className="flex-shrink-0 px-4 pt-3 flex flex-col gap-2"
          style={{ borderTop: "1px solid rgba(var(--border-rgb),0.08)", paddingBottom: "calc(80px + env(safe-area-inset-bottom,0px))" }}
        >
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid rgba(var(--border-rgb),0.12)" }}
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button
              onClick={handlePublishNow}
              disabled={publishing}
              className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: "var(--primary)", color: "#fff", opacity: publishing ? 0.7 : 1 }}
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {publishing ? "Publishing…" : "Publish"}
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid rgba(var(--border-rgb),0.12)" }}
            >
              <Clock className="w-4 h-4" /> Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: centered modal */}
      <div className="hidden lg:flex fixed inset-0 z-50 items-center justify-center p-6">
        <div
          className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
          style={{ background: "var(--card)", boxShadow: "0 24px 80px rgba(20,12,4,0.25)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex-shrink-0 flex items-start justify-between px-6 py-5"
            style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.1)" }}
          >
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: "var(--text-subtle)" }}>
                Campaign · {campaign.timestamp} · {campaign.postCount} posts · ${campaign.cost}
              </p>
              <h2 className="text-xl font-bold leading-tight" style={{ color: "var(--foreground)" }}>
                {campaign.title}
              </h2>
              {saveStatus !== "idle" && (
                <div className="mt-1"><SaveIndicator /></div>
              )}
              {campaign.articleUrl && (
                <a
                  href={campaign.articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 mt-1 text-xs hover:underline"
                  style={{ color: "var(--primary)" }}
                >
                  <ExternalLink className="w-3 h-3" />
                  {campaign.articleUrl}
                </a>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setShowHistory(true)}
                className="p-2 rounded-xl hover:bg-black/5 transition-colors"
                style={{ color: "var(--muted-foreground)" }}
                title="Edit history"
              >
                <History className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-black/5 transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Controls: variant dropdown | platform underline tabs | sample nav */}
          <div
            className="flex-shrink-0 flex items-center gap-4 px-6 py-3"
            style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.08)" }}
          >
            {/* Variant dropdown */}
            <div className="w-44 flex-shrink-0">
              <CustomSelect options={variantOptions} value={variant} onChange={(v) => setVariant(v as VariantKey)} />
            </div>

            {/* Platform underline tabs */}
            <div className="flex flex-1 gap-0 relative" style={{ borderBottom: "2px solid rgba(var(--border-rgb),0.08)" }}>
              {PLATFORMS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPlatform(p.key)}
                  className="px-4 py-2 text-xs font-semibold transition-colors relative"
                  style={{
                    color: platform === p.key ? "var(--primary)" : "var(--muted-foreground)",
                    borderBottom: `2px solid ${platform === p.key ? "var(--primary)" : "transparent"}`,
                    marginBottom: "-2px",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Sample carousel nav */}
            <SampleNav />
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {renderContent(14)}
          </div>

          {/* Actions */}
          <div
            className="flex-shrink-0 flex items-center gap-3 px-6 py-4"
            style={{ borderTop: "1px solid rgba(var(--border-rgb),0.1)" }}
          >
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-80"
              style={{ background: "rgba(var(--border-rgb),0.07)", color: "var(--muted-foreground)" }}
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button
              onClick={handlePublishNow}
              disabled={publishing}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-90"
              style={{ background: "var(--primary)", color: "#fff", opacity: publishing ? 0.7 : 1 }}
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {publishing ? "Publishing…" : "Publish Now"}
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-80"
              style={{ background: "rgba(var(--border-rgb),0.07)", color: "var(--muted-foreground)" }}
            >
              <Clock className="w-4 h-4" /> Schedule
            </button>
          </div>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <>
          <div className="fixed inset-0 z-[70]" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setShowHistory(false)} />
          <div
            className="fixed inset-y-0 right-0 z-[80] w-full max-w-sm flex flex-col"
            style={{ background: "var(--card)", boxShadow: "-8px 0 40px rgba(0,0,0,0.18)", animation: "slideInRight 0.2s cubic-bezier(0.22,1,0.36,1)" }}
          >
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.1)" }}>
              <History className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--text-subtle)" }}>Edit history</p>
                <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{contentKey}</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-1.5 rounded-lg" style={{ color: "var(--muted-foreground)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {historyEntries.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: "var(--text-subtle)" }}>No history yet</p>
              ) : (
                [...historyEntries].reverse().map((entry, idx) => {
                  const date = new Date(entry.timestamp);
                  const label = date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
                  return (
                    <div key={idx} className="rounded-xl p-3" style={{ background: "var(--secondary)", border: "1px solid rgba(var(--border-rgb),0.1)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: "var(--text-subtle)" }}>{label}</span>
                        <button
                          onClick={() => {
                            setEditedContent(prev => ({ ...prev, [contentKey]: entry.text }));
                            setShowHistory(false);
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg"
                          style={{ color: "var(--primary)", background: "rgba(var(--primary-rgb),0.08)" }}
                        >
                          <RotateCcw size={9} /> Restore
                        </button>
                      </div>
                      <p className="text-xs leading-relaxed line-clamp-4" style={{ color: "var(--muted-foreground)", fontFamily: "inherit" }}>
                        {entry.text.slice(0, 300)}{entry.text.length > 300 ? "…" : ""}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Schedule sub-modal */}
      {showScheduleModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowScheduleModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: "var(--card)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Schedule Post</h2>
              <button onClick={() => setShowScheduleModal(false)} className="p-2 rounded-lg hover:bg-black/5" style={{ color: "var(--muted-foreground)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-5 p-3 rounded-xl text-sm" style={{ background: "var(--secondary)", border: "1px solid rgba(var(--border-rgb),0.12)", color: "var(--muted-foreground)" }}>
              {PLATFORMS.find((p) => p.key === platform)?.label} · {VARIANTS.find((v) => v.key === variant)?.label} · Sample {clampedIndex + 1}
            </div>
            <Field>
              <Label htmlFor="sched-date">Date</Label>
              <Input id="sched-date" type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
            </Field>
            <Field>
              <Label htmlFor="sched-time">Time</Label>
              <Input id="sched-time" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
            </Field>
            <Field>
              <Label>Timezone</Label>
              <CustomSelect options={timezones} value={scheduleTimezone} onChange={setScheduleTimezone} />
            </Field>
            <div className="flex gap-3 mt-5">
              <Button variant="ghost" onClick={() => setShowScheduleModal(false)} style={{ flex: 1 }}>Cancel</Button>
              <Button variant="primary" onClick={handleSchedule} disabled={!scheduleDate || !scheduleTime} style={{ flex: 1 }}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] flex flex-col gap-2 items-center pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className="px-4 py-3 rounded-2xl text-sm font-medium text-white"
              style={{ background: t.type === "error" ? "#b91c1c" : "#15803d", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
              {t.msg}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
