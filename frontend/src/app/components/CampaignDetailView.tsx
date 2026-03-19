import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X, Copy, Send, Clock, Loader2 } from "lucide-react";
import { Button, Field, Label, Input } from "./FormComponents";
import { WYSIWYGEditor } from "./WYSIWYGEditor";
import { CustomSelect } from "./CustomSelect";
import { SegmentedTabs } from "./mobile";
import { history } from "../../lib/api";

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

  const samples = extractPosts(runData, variant, platform);
  const totalSamples = samples.length || 1;
  const clampedIndex = Math.min(sampleIndex, totalSamples - 1);

  const contentKey = `${variant}::${platform}::${clampedIndex}`;
  const currentText = contentKey in editedContent ? editedContent[contentKey] : (samples[clampedIndex] ?? "");

  const handleChange = (text: string) => {
    setEditedContent((prev) => ({ ...prev, [contentKey]: text }));
  };

  const handleCopy = () => navigator.clipboard.writeText(currentText);

  const handleSchedule = () => {
    console.log(`Scheduling ${platform} for ${scheduleDate} ${scheduleTime} ${scheduleTimezone}`);
    setShowScheduleModal(false);
    setScheduleDate("");
    setScheduleTime("");
  };

  const variantOptions = VARIANTS.map((v) => ({ value: v.key, label: v.label }));

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

  const ContentArea = ({ rows = 10 }: { rows?: number }) => {
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
          <h3 className="flex-1 min-w-0 text-[16px] font-bold truncate" style={{ color: "var(--foreground)" }}>
            {campaign.title}
          </h3>
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
          <ContentArea rows={12} />
        </div>

        <div
          className="flex-shrink-0 px-4 py-3 flex gap-2"
          style={{ borderTop: "1px solid rgba(var(--border-rgb),0.08)", paddingBottom: "calc(80px + env(safe-area-inset-bottom,0px))" }}
        >
          <button
            onClick={handleCopy}
            className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid rgba(var(--border-rgb),0.12)" }}
          >
            <Copy className="w-4 h-4" /> Copy
          </button>
          <button
            className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Send className="w-4 h-4" /> Publish
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
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/5 transition-colors flex-shrink-0"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="w-5 h-5" />
            </button>
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
            <ContentArea rows={14} />
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
              className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-90"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              <Send className="w-4 h-4" /> Publish Now
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
    </>
  );
}
