import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Search,
  Filter,
  Eye,
  Heart,
  MessageCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card } from "./Card";
import { CustomSelect } from "./CustomSelect";
import { MobileSegmentedControl } from "./mobile";
import { social } from "../../lib/api";
import { markdownToHtml } from "../../lib/markdown";

type Platform = "threads" | "linkedin" | "instagram" | "substack";

type ScheduledPost = {
  id: string;
  platform: Platform;
  platformLabel: string;
  content: string;
  scheduledDate: string;
  scheduledTime: string;
  sourceLabel: string;
};

type PublishedPost = {
  id: string;
  platform: Platform;
  platformLabel: string;
  content: string;
  timeAgo: string;
  sourceLabel: string;
  engagement?: { views?: number; likes?: number; comments?: number };
};

function timeAgo(ts: string): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function normalizePlatform(raw: string): { platform: Platform; label: string } {
  switch (raw) {
    case "substack_note": return { platform: "substack", label: "Substack" };
    case "linkedin":      return { platform: "linkedin",  label: "LinkedIn" };
    case "instagram":     return { platform: "instagram", label: "Instagram" };
    default:              return { platform: "threads",   label: "Threads" };
  }
}

function mapScheduled(post: any): ScheduledPost {
  const { platform, label } = normalizePlatform(post.platform ?? "");
  const d = post.scheduled_at ? new Date(post.scheduled_at) : null;
  return {
    id: String(post.id),
    platform,
    platformLabel: label,
    content: post.text ?? "",
    scheduledDate: d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
    scheduledTime: d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "",
    sourceLabel: post.source_label ?? "",
  };
}

function mapPublished(post: any): PublishedPost {
  const { platform, label } = normalizePlatform(post.platform ?? "");
  return {
    id: String(post.id),
    platform,
    platformLabel: label,
    content: post.text ?? "",
    timeAgo: timeAgo(post.published_at ?? post.scheduled_at ?? ""),
    sourceLabel: post.source_label ?? "",
  };
}

export function PublishingView() {
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<Platform | "all">("all");
  const [mobileTab, setMobileTab] = useState<"queue" | "published">("queue");

  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([social.scheduled(), social.published(100)]);
      setScheduledPosts((sRes.posts ?? []).map(mapScheduled));
      setPublishedPosts((pRes.posts ?? []).map(mapPublished));
    } catch {
      // leave existing data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id: string) => {
    if (!confirm("Remove this post from the queue?")) return;
    setCancelling(id);
    try {
      await social.cancelScheduled(id);
      setScheduledPosts(prev => prev.filter(p => p.id !== id));
    } catch {
      // ignore
    } finally {
      setCancelling(null);
    }
  };

  const togglePostExpansion = (postId: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  };

  const getPlatformColor = (platform: Platform) => {
    switch (platform) {
      case "threads":   return { bg: "rgba(0,0,0,0.08)",            text: "#000000" };
      case "linkedin":  return { bg: "rgba(10,102,194,0.15)",        text: "#0a66c2" };
      case "instagram": return { bg: "rgba(225,48,108,0.15)",        text: "#e1306c" };
      case "substack":  return { bg: "rgba(255,106,0,0.15)",         text: "#ff6a00" };
      default:          return { bg: "rgba(var(--primary-rgb),0.15)", text: "var(--primary)" };
    }
  };

  const formatNumber = (num: number) => num >= 1000 ? (num / 1000).toFixed(1) + "k" : String(num);
  const truncate = (content: string, max = 120) => content.length <= max ? content : content.slice(0, max) + "…";

  const filteredPublished = publishedPosts.filter(post => {
    const matchesSearch = !searchQuery || post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = selectedPlatformFilter === "all" || post.platform === selectedPlatformFilter;
    return matchesSearch && matchesPlatform;
  });

  return (
    <div className="space-y-6">
      <MobileSegmentedControl
        segments={[
          { label: "Queue",     value: "queue",     badge: scheduledPosts.length },
          { label: "Published", value: "published", badge: publishedPosts.length },
        ]}
        value={mobileTab}
        onChange={(val) => setMobileTab(val as "queue" | "published")}
        sticky
        smartPadding
      />

      {/* ── Queue ── */}
      <div className={mobileTab === "queue" ? "" : "hidden lg:block"}>
        <div className="hidden lg:flex items-center justify-between mb-4">
          <div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase inline-block mb-2"
              style={{ background: "rgba(var(--primary-rgb),0.15)", color: "var(--primary)" }}>
              PUBLISHING QUEUE
            </span>
            <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
              Upcoming
              <span className="ml-2 px-2 py-0.5 rounded text-sm font-bold"
                style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                {scheduledPosts.length} QUEUED
              </span>
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
              Posts are published automatically — the scheduler checks every minute.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {loading && scheduledPosts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : scheduledPosts.length === 0 ? (
          <>
            <div className="hidden lg:block relative overflow-hidden rounded-3xl p-6 text-center py-12"
              style={{ border: "1px solid rgba(var(--border-rgb),0.14)", background: "linear-gradient(180deg,#fffaf1,rgba(255,251,243,0.88))", boxShadow: "0 14px 34px rgba(var(--border-rgb),0.08)" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(var(--primary-rgb),0.1)" }}>
                <Calendar className="w-8 h-8" style={{ color: "var(--primary)" }} />
              </div>
              <h3 className="text-lg mb-2 font-bold" style={{ color: "var(--foreground)" }}>No scheduled posts</h3>
              <p className="text-sm max-w-md mx-auto" style={{ color: "var(--muted-foreground)" }}>Use the Campaigns or Compose tabs to schedule posts</p>
            </div>
            <div className="lg:hidden px-4">
              <div className="text-center py-12 rounded-2xl" style={{ background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(var(--primary-rgb),0.1)" }}>
                  <Calendar className="w-8 h-8" style={{ color: "var(--primary)" }} />
                </div>
                <h3 className="text-[15px] mb-2 font-bold" style={{ color: "var(--foreground)" }}>No scheduled posts</h3>
                <p className="text-[13px] max-w-md mx-auto px-4" style={{ color: "var(--text-subtle)" }}>Use the Campaigns or Compose tabs to schedule posts</p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block space-y-3">
              {scheduledPosts.map(post => {
                const colors = getPlatformColor(post.platform);
                return (
                  <Card key={post.id}>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 rounded text-[11px] font-bold tracking-wider uppercase" style={{ background: colors.bg, color: colors.text }}>
                            {post.platformLabel}
                          </span>
                          {post.sourceLabel && (
                            <span className="px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase" style={{ background: "rgba(var(--border-rgb),0.1)", color: "var(--muted-foreground)" }}>
                              {post.sourceLabel}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{post.scheduledDate} at {post.scheduledTime}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm" style={{ color: "var(--foreground)" }} dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content) }} />
                      <div className="flex items-center gap-2 pt-4" style={{ borderTop: "1px solid rgba(var(--border-rgb),0.08)" }}>
                        <button
                          onClick={() => handleCancel(post.id)}
                          disabled={cancelling === post.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-opacity-80 flex items-center gap-1.5"
                          style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}
                        >
                          {cancelling === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          Remove
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Mobile */}
            <div className="lg:hidden space-y-3 px-4">
              {scheduledPosts.map(post => {
                const colors = getPlatformColor(post.platform);
                return (
                  <div key={post.id} className="rounded-2xl p-4" style={{ background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: colors.bg }}>
                          <span className="text-[10px] font-bold" style={{ color: colors.text }}>{post.platformLabel[0]}</span>
                        </div>
                        <div>
                          <div className="text-[13px] font-bold" style={{ color: "#1f2937" }}>{post.platformLabel}</div>
                          <div className="text-[11px]" style={{ color: "#9ca3af" }}>{post.scheduledDate} at {post.scheduledTime}</div>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase" style={{ background: "rgba(var(--primary-rgb),0.15)", color: "var(--primary)" }}>QUEUED</span>
                    </div>
                    <div className="text-[15px] mb-4" style={{ color: "#1f2937" }} dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content) }} />
                    <button
                      onClick={() => handleCancel(post.id)}
                      disabled={cancelling === post.id}
                      className="w-full py-2.5 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                      style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}
                    >
                      {cancelling === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Published ── */}
      <div className={mobileTab === "published" ? "" : "hidden lg:block"}>
        <div className="hidden lg:flex items-start justify-between mb-4 gap-4">
          <div className="flex-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase inline-block mb-2" style={{ background: "rgba(16,185,129,0.15)", color: "#059669" }}>HISTORY</span>
            <h2 className="text-xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
              Published
              <span className="ml-2 px-2 py-0.5 rounded text-sm font-bold" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                {publishedPosts.length} TOTAL
              </span>
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>All posts that have been published to your social platforms</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0"
            style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {/* Desktop Filters */}
        <div className="hidden lg:block mb-4">
          <div className="relative overflow-hidden rounded-3xl p-6"
            style={{ border: "1px solid rgba(var(--border-rgb),0.14)", background: "linear-gradient(180deg,#fffaf1,rgba(255,251,243,0.88))", boxShadow: "0 14px 34px rgba(var(--border-rgb),0.08)" }}>
            <div className="relative z-10 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search published posts…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
                  style={{ background: "var(--secondary)", border: "1px solid rgba(var(--border-rgb),0.12)", color: "var(--foreground)" }} />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                <CustomSelect
                  value={selectedPlatformFilter}
                  onChange={v => setSelectedPlatformFilter(v as Platform | "all")}
                  options={[
                    { value: "all",       label: "All Platforms" },
                    { value: "threads",   label: "Threads" },
                    { value: "linkedin",  label: "LinkedIn" },
                    { value: "instagram", label: "Instagram" },
                    { value: "substack",  label: "Substack" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile filter */}
        <div className="lg:hidden px-4 mb-3">
          <CustomSelect
            value={selectedPlatformFilter}
            onChange={v => setSelectedPlatformFilter(v as Platform | "all")}
            options={[
              { value: "all",       label: "All Platforms" },
              { value: "threads",   label: "Threads" },
              { value: "linkedin",  label: "LinkedIn" },
              { value: "instagram", label: "Instagram" },
              { value: "substack",  label: "Substack" },
            ]}
          />
        </div>

        {loading && publishedPosts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : filteredPublished.length === 0 ? (
          <div className="text-center py-12 rounded-2xl lg:rounded-3xl"
            style={{ background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(var(--primary-rgb),0.1)" }}>
              <BarChart3 className="w-8 h-8" style={{ color: "var(--primary)" }} />
            </div>
            <h3 className="text-lg mb-2 font-bold" style={{ color: "var(--foreground)" }}>No published posts found</h3>
            <p className="text-sm max-w-md mx-auto" style={{ color: "var(--muted-foreground)" }}>
              {searchQuery || selectedPlatformFilter !== "all" ? "Try adjusting your filters" : "Published posts will appear here after they go live"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="lg:hidden pb-20 space-y-3 px-4">
              {filteredPublished.map(post => {
                const colors = getPlatformColor(post.platform);
                const isExpanded = expandedPosts.has(post.id);
                const shouldExpand = post.content.length > 180;
                return (
                  <div key={post.id} className="rounded-2xl p-4" style={{ background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: colors.bg }}>
                          <span className="text-[10px] font-bold" style={{ color: colors.text }}>{post.platformLabel[0]}</span>
                        </div>
                        <div>
                          <div className="text-[13px] font-bold" style={{ color: "#1f2937" }}>{post.platformLabel}</div>
                          <div className="text-[11px]" style={{ color: "#9ca3af" }}>{post.timeAgo}</div>
                        </div>
                      </div>
                      {post.sourceLabel && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(var(--border-rgb),0.1)", color: "var(--muted-foreground)" }}>{post.sourceLabel}</span>
                      )}
                    </div>
                    <div className="mb-3">
                      <div className="text-[15px]" style={{ color: "#1f2937" }}
                        dangerouslySetInnerHTML={{ __html: markdownToHtml(isExpanded || !shouldExpand ? post.content : truncate(post.content, 180)) }} />
                      {shouldExpand && (
                        <button onClick={() => togglePostExpansion(post.id)} className="mt-2 text-[14px] font-semibold" style={{ color: "var(--primary)" }}>
                          {isExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                    {post.engagement && (
                      <div className="flex items-center gap-4 px-3 py-2.5 rounded-xl" style={{ background: "#f9fafb" }}>
                        {post.engagement.views !== undefined && <div className="flex items-center gap-1.5"><Eye className="w-4 h-4" style={{ color: "#9ca3af" }} /><span className="text-[13px] font-bold" style={{ color: "#4b5563" }}>{formatNumber(post.engagement.views)}</span></div>}
                        {post.engagement.likes !== undefined && <div className="flex items-center gap-1.5"><Heart className="w-4 h-4" style={{ color: "#9ca3af" }} /><span className="text-[13px] font-bold" style={{ color: "#4b5563" }}>{formatNumber(post.engagement.likes)}</span></div>}
                        {post.engagement.comments !== undefined && <div className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4" style={{ color: "#9ca3af" }} /><span className="text-[13px] font-bold" style={{ color: "#4b5563" }}>{formatNumber(post.engagement.comments)}</span></div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop */}
            <div className="hidden lg:block space-y-3">
              {filteredPublished.map(post => {
                const colors = getPlatformColor(post.platform);
                const isExpanded = expandedPosts.has(post.id);
                const shouldExpand = post.content.length > 120;
                return (
                  <Card key={post.id}>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                          <span className="px-2 py-1 rounded text-[11px] font-bold tracking-wider uppercase" style={{ background: colors.bg, color: colors.text }}>{post.platformLabel}</span>
                          {post.sourceLabel && (
                            <span className="px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase" style={{ background: "rgba(var(--border-rgb),0.1)", color: "var(--muted-foreground)" }}>{post.sourceLabel}</span>
                          )}
                        </div>
                        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>{post.timeAgo}</span>
                      </div>
                      <div>
                        <div className="text-sm" style={{ color: "var(--foreground)" }}
                          dangerouslySetInnerHTML={{ __html: markdownToHtml(isExpanded || !shouldExpand ? post.content : truncate(post.content)) }} />
                        {shouldExpand && (
                          <button onClick={() => togglePostExpansion(post.id)} className="mt-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--primary)" }}>
                            {isExpanded ? <><ChevronUp className="w-3.5 h-3.5" />Show less</> : <><ChevronDown className="w-3.5 h-3.5" />Show more</>}
                          </button>
                        )}
                      </div>
                      {post.engagement && (
                        <div className="flex items-center gap-4 px-3 py-2 rounded-lg" style={{ background: "var(--secondary)" }}>
                          {post.engagement.views !== undefined && <div className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} /><span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{formatNumber(post.engagement.views)}</span></div>}
                          {post.engagement.likes !== undefined && <div className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} /><span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{formatNumber(post.engagement.likes)}</span></div>}
                          {post.engagement.comments !== undefined && <div className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} /><span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{formatNumber(post.engagement.comments)}</span></div>}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
