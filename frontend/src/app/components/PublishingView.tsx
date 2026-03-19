import { useState } from "react";
import {
  Calendar,
  Clock,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BarChart3,
  Search,
  Filter,
  Eye,
  Heart,
  MessageCircle,
  MoreVertical,
} from "lucide-react";
import { Card } from "./Card";
import { MobileSection } from "./MobileSection";
import { Button } from "./FormComponents";
import { CustomSelect } from "./CustomSelect";
import { MobileSegmentedControl } from "./mobile";

type Platform =
  | "threads"
  | "linkedin"
  | "instagram"
  | "substack";

type PublishedPost = {
  id: string;
  platform: Platform;
  platformLabel: string;
  content: string;
  publishedAt: string;
  timeAgo: string;
  sourceType: "THREADS" | "Companion" | "Substack Note";
  engagement?: {
    views?: number;
    likes?: number;
    comments?: number;
  };
};

type ScheduledPost = {
  id: string;
  platform: Platform;
  platformLabel: string;
  content: string;
  scheduledFor: string;
  scheduledDate: string;
  scheduledTime: string;
  sourceType: "THREADS" | "Companion" | "Substack Note";
};

export function PublishingView() {
  const [expandedPosts, setExpandedPosts] = useState<
    Set<string>
  >(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatformFilter, setSelectedPlatformFilter] =
    useState<Platform | "all">("all");
  const [mobileTab, setMobileTab] = useState<
    "queue" | "published"
  >("queue");

  // Mock data - in real app this would come from backend
  const scheduledPosts: ScheduledPost[] = [
    // Empty for now - shows empty state
  ];

  const publishedPosts: PublishedPost[] = [
    {
      id: "pub-1",
      platform: "threads",
      platformLabel: "Threads",
      content:
        "Skip the meditation app guilt. Try 5-4-3-2-1 grounding for two minutes: five things you see, four you touch, three you hear, two you smell, one you taste. Short enough to repeat tomorrow. That's where the real habit lives.",
      publishedAt: "2025-03-07T10:00:00Z",
      timeAgo: "5d ago",
      sourceType: "THREADS",
      engagement: { views: 12340, likes: 456, comments: 23 },
    },
    {
      id: "pub-2",
      platform: "threads",
      platformLabel: "Threads",
      content:
        "Three good options paralyzing you? Ask, 'If I skip this, what breaks in 30 days? In 90 days?' The consequences aren't equal. Let them decide, not your gut. Your brain stops lying to itself. You move.",
      publishedAt: "2025-03-07T11:00:00Z",
      timeAgo: "5d ago",
      sourceType: "Companion",
      engagement: { views: 8920, likes: 312, comments: 18 },
    },
    {
      id: "pub-3",
      platform: "threads",
      platformLabel: "Threads",
      content:
        "You promised yourself you'd exercise. But reality has more pull than intention—always does. Your future self didn't show up as vividly as your current self needed to move. This is everyone, not just you.",
      publishedAt: "2025-03-07T12:00:00Z",
      timeAgo: "5d ago",
      sourceType: "THREADS",
      engagement: { views: 15670, likes: 589, comments: 41 },
    },
    {
      id: "pub-4",
      platform: "substack",
      platformLabel: "Substack",
      content:
        "You're planning your whole day down to lunch, but nothing ever sticks. Try this: plan only the first three things tomorrow. Leave the afternoon open. When chaos shows up, you're not rewriting everything—you're just working with what's next. Sounds lazy. It's actually the opposite.",
      publishedAt: "2025-03-07T13:00:00Z",
      timeAgo: "5d ago",
      sourceType: "Substack Note",
      engagement: { views: 2340, likes: 145 },
    },
    {
      id: "pub-5",
      platform: "substack",
      platformLabel: "Substack",
      content:
        "The urgency of someone else's request lands in your nervous system before your judgment can catch up.\n\nThat's not a character flaw—it's how attention works. The gap between 'this feels important' and 'this actually meets my goals' is where you lose the day.\n\nStart noticing that gap in real time instead of after the calendar fills.",
      publishedAt: "2025-03-09T09:00:00Z",
      timeAgo: "6d ago",
      sourceType: "Substack Note",
      engagement: { views: 3120, likes: 198 },
    },
    {
      id: "pub-6",
      platform: "substack",
      platformLabel: "Substack",
      content:
        "Pick something so small it feels almost silly: two minutes of stretching, five deep breaths, one glass of water, writing three sentences.\n\nDo the small version for two weeks before you level up.\n\nThis isn't laziness, it's a form-factor revision system learns that the new thing is safe and worth repeating.",
      publishedAt: "2025-03-09T10:00:00Z",
      timeAgo: "6d ago",
      sourceType: "Substack Note",
      engagement: { views: 2890, likes: 167 },
    },
    {
      id: "pub-7",
      platform: "substack",
      platformLabel: "Substack",
      content:
        "One small win: when you finish a task, close the tab or put the thing away before moving to the next one.\n\nThis tiny interruption of 'finish, then reset' is less about tidiness and more about stopping decision fatigue from stacking.\n\nYour brain doesn't have to hold the ghost of the last thing while starting the next one.",
      publishedAt: "2025-03-09T14:00:00Z",
      timeAgo: "6d ago",
      sourceType: "Substack Note",
      engagement: { views: 2650, likes: 143 },
    },
  ];

  const togglePostExpansion = (postId: string) => {
    setExpandedPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const getPlatformColor = (platform: Platform) => {
    switch (platform) {
      case "threads":
        return { bg: "rgba(0, 0, 0, 0.08)", text: "#000000" };
      case "linkedin":
        return {
          bg: "rgba(10, 102, 194, 0.15)",
          text: "#0a66c2",
        };
      case "instagram":
        return {
          bg: "rgba(225, 48, 108, 0.15)",
          text: "#e1306c",
        };
      case "substack":
        return {
          bg: "rgba(255, 106, 0, 0.15)",
          text: "#ff6a00",
        };
      default:
        return {
          bg: "rgba(var(--primary-rgb), 0.15)",
          text: "var(--primary)",
        };
    }
  };

  const getSourceTypeColor = (sourceType: string) => {
    switch (sourceType) {
      case "THREADS":
        return {
          bg: "rgba(59, 130, 246, 0.15)",
          text: "#2563eb",
        };
      case "Companion":
        return {
          bg: "rgba(168, 85, 247, 0.15)",
          text: "#7c3aed",
        };
      case "Substack Note":
        return {
          bg: "rgba(255, 106, 0, 0.15)",
          text: "#ff6a00",
        };
      default:
        return {
          bg: "rgba(var(--primary-rgb), 0.15)",
          text: "var(--primary)",
        };
    }
  };

  const truncateContent = (
    content: string,
    maxLength: number = 120,
  ) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toString();
  };

  const filteredPublished = publishedPosts.filter((post) => {
    const matchesSearch =
      searchQuery === "" ||
      post.content
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesPlatform =
      selectedPlatformFilter === "all" ||
      post.platform === selectedPlatformFilter;
    return matchesSearch && matchesPlatform;
  });

  return (
    <div className="space-y-6">
      {/* Mobile: Segmented Control */}
      <MobileSegmentedControl
        segments={[
          {
            label: "Queue",
            value: "queue",
            badge: scheduledPosts.length,
          },
          {
            label: "Published",
            value: "published",
            badge: publishedPosts.length,
          },
        ]}
        value={mobileTab}
        onChange={(val) => setMobileTab(val as "queue" | "published")}
        sticky
        smartPadding
      />

      {/* Publishing Queue Section */}
      <div
        className={
          mobileTab === "queue" ? "" : "hidden lg:block"
        }
      >
        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-between mb-4">
          <div>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase inline-block mb-2"
              style={{
                background: "rgba(var(--primary-rgb), 0.15)",
                color: "var(--primary)",
              }}
            >
              PUBLISHING QUEUE
            </span>
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              Upcoming
              <span
                className="ml-2 px-2 py-0.5 rounded text-sm font-bold"
                style={{
                  background: "var(--secondary)",
                  color: "var(--muted-foreground)",
                }}
              >
                {scheduledPosts.length} QUEUED
              </span>
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              Posts are published automatically by the app — no
              external service needed. The scheduler checks
              every minute.
            </p>
          </div>
          <Button variant="secondary">Refresh</Button>
        </div>

        {/* Mobile: Show scheduled count inline if not empty */}
        {scheduledPosts.length > 0 && (
          <div className="lg:hidden mb-3 px-4">
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
                style={{
                  background: "rgba(var(--primary-rgb), 0.15)",
                  color: "var(--primary)",
                }}
              >
                {scheduledPosts.length} QUEUED
              </span>
            </div>
          </div>
        )}

        {scheduledPosts.length === 0 ? (
          <>
            {/* Desktop Empty State */}
            <div
              className="hidden lg:block relative overflow-hidden rounded-3xl p-6 text-center py-12"
              style={{
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "rgba(var(--border-rgb), 0.14)",
                background:
                  "linear-gradient(180deg, #fffaf1, rgba(255, 251, 243, 0.88))",
                boxShadow: "0 14px 34px rgba(var(--border-rgb), 0.08)",
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at top right, rgba(var(--primary-rgb), 0.09), transparent 24%), linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.02))",
                }}
              />
              <div className="relative z-10">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: "rgba(var(--primary-rgb), 0.1)",
                  }}
                >
                  <Calendar
                    className="w-8 h-8"
                    style={{ color: "var(--primary)" }}
                  />
                </div>
                <h3
                  className="text-lg mb-2 font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  No scheduled posts
                </h3>
                <p
                  className="text-sm max-w-md mx-auto"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Use the Campaigns or Repurpose tabs to
                  schedule posts
                </p>
              </div>
            </div>

            {/* Mobile Empty State */}
            <div className="lg:hidden px-4">
              <div
                className="text-center py-12 rounded-2xl"
                style={{
                  background: "white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: "rgba(var(--primary-rgb), 0.1)",
                  }}
                >
                  <Calendar
                    className="w-8 h-8"
                    style={{ color: "var(--primary)" }}
                  />
                </div>
                <h3
                  className="text-[15px] mb-2 font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  No scheduled posts
                </h3>
                <p
                  className="text-[13px] max-w-md mx-auto px-4"
                  style={{ color: "var(--text-subtle)" }}
                >
                  Use the Campaigns or Repurpose tabs to
                  schedule posts
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Desktop: Scheduled Posts */}
            <div className="hidden lg:block space-y-3">
              {scheduledPosts.map((post) => {
                const platformColors = getPlatformColor(
                  post.platform,
                );
                const sourceColors = getSourceTypeColor(
                  post.sourceType,
                );

                return (
                  <Card key={post.id}>
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="px-2 py-1 rounded text-[11px] font-bold tracking-wider uppercase"
                            style={{
                              background: platformColors.bg,
                              color: platformColors.text,
                            }}
                          >
                            {post.platformLabel}
                          </span>
                          <span
                            className="px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase"
                            style={{
                              background: sourceColors.bg,
                              color: sourceColors.text,
                            }}
                          >
                            {post.sourceType}
                          </span>
                          <div
                            className="flex items-center gap-1.5 text-sm"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {post.scheduledDate} at{" "}
                              {post.scheduledTime}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "var(--foreground)" }}
                      >
                        {post.content}
                      </p>

                      {/* Actions */}
                      <div
                        className="flex items-center gap-2 pt-4"
                        style={{
                          borderTop:
                            "1px solid rgba(var(--border-rgb), 0.08)",
                        }}
                      >
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-opacity-80 flex items-center gap-1.5"
                          style={{
                            background: "var(--secondary)",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-opacity-80 flex items-center gap-1.5"
                          style={{
                            background: "var(--secondary)",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          Reschedule
                        </button>
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-opacity-80 flex items-center gap-1.5"
                          style={{
                            background:
                              "rgba(220, 38, 38, 0.1)",
                            color: "#dc2626",
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Mobile: Scheduled Posts */}
            <div className="lg:hidden space-y-3 px-4">
              {scheduledPosts.map((post) => {
                const platformColors = getPlatformColor(
                  post.platform,
                );

                return (
                  <div
                    key={post.id}
                    className="rounded-2xl p-4"
                    style={{
                      background: "white",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{
                            background: platformColors.bg,
                          }}
                        >
                          <span
                            className="text-[10px] font-bold"
                            style={{
                              color: platformColors.text,
                            }}
                          >
                            {post.platformLabel.substring(0, 1)}
                          </span>
                        </div>
                        <div>
                          <div
                            className="text-[13px] font-bold"
                            style={{ color: "#1f2937" }}
                          >
                            {post.platformLabel}
                          </div>
                          <div
                            className="text-[11px]"
                            style={{ color: "#9ca3af" }}
                          >
                            {post.scheduledDate} at{" "}
                            {post.scheduledTime}
                          </div>
                        </div>
                      </div>
                      <span
                        className="px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase"
                        style={{
                          background: "rgba(var(--primary-rgb), 0.15)",
                          color: "var(--primary)",
                        }}
                      >
                        QUEUED
                      </span>
                    </div>

                    {/* Content */}
                    <p
                      className="text-[15px] leading-[1.5] mb-4 whitespace-pre-wrap"
                      style={{ color: "#1f2937" }}
                    >
                      {post.content}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98]"
                        style={{
                          background: "#f3f4f6",
                          color: "#4b5563",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98]"
                        style={{
                          background: "#f3f4f6",
                          color: "#4b5563",
                        }}
                      >
                        Reschedule
                      </button>
                      <button
                        className="px-4 py-2.5 rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98]"
                        style={{
                          background: "rgba(220, 38, 38, 0.1)",
                          color: "#dc2626",
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Published History Section */}
      <div
        className={
          mobileTab === "published" ? "" : "hidden lg:block"
        }
      >
        {/* Desktop Header */}
        <div className="hidden lg:flex items-start justify-between mb-4 gap-4">
          <div className="flex-1">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase inline-block mb-2"
              style={{
                background: "rgba(16, 185, 129, 0.15)",
                color: "#059669",
              }}
            >
              HISTORY
            </span>
            <h2
              className="text-xl font-bold mb-1"
              style={{ color: "var(--foreground)" }}
            >
              Published
              <span
                className="ml-2 px-2 py-0.5 rounded text-sm font-bold"
                style={{
                  background: "var(--secondary)",
                  color: "var(--muted-foreground)",
                }}
              >
                {publishedPosts.length} TOTAL
              </span>
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              All posts that have been published to your social
              platforms
            </p>
          </div>
          <Button variant="secondary">Refresh</Button>
        </div>

        {/* Desktop Filters */}
        <div className="hidden lg:block mb-4">
          <div
            className="relative overflow-hidden rounded-3xl p-6"
            style={{
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "rgba(var(--border-rgb), 0.14)",
              background:
                "linear-gradient(180deg, #fffaf1, rgba(255, 251, 243, 0.88))",
              boxShadow: "0 14px 34px rgba(var(--border-rgb), 0.08)",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at top right, rgba(var(--primary-rgb), 0.09), transparent 24%), linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.02))",
              }}
            />
            <div className="relative z-10 flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="flex-1 min-w-[240px]">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(e.target.value)
                    }
                    placeholder="Search published posts..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
                    style={{
                      background: "var(--secondary)",
                      border:
                        "1px solid rgba(var(--border-rgb), 0.12)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
              </div>

              {/* Platform Filter */}
              <div className="flex items-center gap-2">
                <Filter
                  className="w-4 h-4"
                  style={{ color: "var(--muted-foreground)" }}
                />
                <CustomSelect
                  value={selectedPlatformFilter}
                  onChange={(value) =>
                    setSelectedPlatformFilter(
                      value as Platform | "all",
                    )
                  }
                  options={[
                    { value: "all", label: "All Platforms" },
                    { value: "threads", label: "Threads" },
                    { value: "linkedin", label: "LinkedIn" },
                    { value: "instagram", label: "Instagram" },
                    { value: "substack", label: "Substack" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Simple platform filter header */}
        <div className="lg:hidden px-4 mb-3">
          <CustomSelect
            value={selectedPlatformFilter}
            onChange={(value) =>
              setSelectedPlatformFilter(
                value as Platform | "all",
              )
            }
            options={[
              { value: "all", label: "All Platforms" },
              { value: "threads", label: "Threads" },
              { value: "linkedin", label: "LinkedIn" },
              { value: "instagram", label: "Instagram" },
              { value: "substack", label: "Substack" },
            ]}
          />
        </div>

        {/* Published Posts List */}
        {filteredPublished.length === 0 ? (
          <div className="lg:hidden px-4 py-16 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(var(--primary-rgb), 0.1)" }}
            >
              <BarChart3
                className="w-8 h-8"
                style={{ color: "var(--primary)" }}
              />
            </div>
            <h3
              className="text-lg mb-2 font-bold"
              style={{ color: "var(--foreground)" }}
            >
              No published posts found
            </h3>
            <p
              className="text-sm max-w-md mx-auto"
              style={{ color: "var(--muted-foreground)" }}
            >
              {searchQuery || selectedPlatformFilter !== "all"
                ? "Try adjusting your filters"
                : "Published posts will appear here after they go live"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: Published Posts - Reimagined */}
            <div className="lg:hidden pb-20">
              <div className="space-y-3 px-4">
                {filteredPublished.map((post) => {
                  const platformColors = getPlatformColor(
                    post.platform,
                  );
                  const isExpanded = expandedPosts.has(post.id);
                  const shouldShowExpand =
                    post.content.length > 180;

                  return (
                    <div
                      key={post.id}
                      className="rounded-2xl p-4"
                      style={{
                        background: "white",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      }}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{
                              background: platformColors.bg,
                            }}
                          >
                            <span
                              className="text-[10px] font-bold"
                              style={{
                                color: platformColors.text,
                              }}
                            >
                              {post.platformLabel.substring(
                                0,
                                1,
                              )}
                            </span>
                          </div>
                          <div>
                            <div
                              className="text-[13px] font-bold"
                              style={{ color: "#1f2937" }}
                            >
                              {post.platformLabel}
                            </div>
                            <div
                              className="text-[11px]"
                              style={{ color: "#9ca3af" }}
                            >
                              {post.timeAgo}
                            </div>
                          </div>
                        </div>
                        <button
                          className="p-2 -mr-2 rounded-full active:bg-black active:bg-opacity-5"
                          style={{ color: "#d1d5db" }}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Content */}
                      <div className="mb-4">
                        <p
                          className="text-[15px] leading-[1.5] whitespace-pre-wrap"
                          style={{ color: "#1f2937" }}
                        >
                          {isExpanded
                            ? post.content
                            : shouldShowExpand
                              ? truncateContent(
                                  post.content,
                                  180,
                                )
                              : post.content}
                        </p>
                        {shouldShowExpand && (
                          <button
                            onClick={() =>
                              togglePostExpansion(post.id)
                            }
                            className="mt-2 text-[14px] font-semibold"
                            style={{ color: "var(--primary)" }}
                          >
                            {isExpanded
                              ? "Show less"
                              : "Read more"}
                          </button>
                        )}
                      </div>

                      {/* Engagement Stats */}
                      {post.engagement && (
                        <div
                          className="flex items-center gap-4 px-3 py-2.5 rounded-xl mb-3"
                          style={{ background: "#f9fafb" }}
                        >
                          {post.engagement.views !==
                            undefined && (
                            <div className="flex items-center gap-1.5">
                              <Eye
                                className="w-4 h-4"
                                style={{ color: "#9ca3af" }}
                              />
                              <span
                                className="text-[13px] font-bold"
                                style={{ color: "#4b5563" }}
                              >
                                {formatNumber(
                                  post.engagement.views,
                                )}
                              </span>
                            </div>
                          )}
                          {post.engagement.likes !==
                            undefined && (
                            <div className="flex items-center gap-1.5">
                              <Heart
                                className="w-4 h-4"
                                style={{ color: "#9ca3af" }}
                              />
                              <span
                                className="text-[13px] font-bold"
                                style={{ color: "#4b5563" }}
                              >
                                {formatNumber(
                                  post.engagement.likes,
                                )}
                              </span>
                            </div>
                          )}
                          {post.engagement.comments !==
                            undefined && (
                            <div className="flex items-center gap-1.5">
                              <MessageCircle
                                className="w-4 h-4"
                                style={{ color: "#9ca3af" }}
                              />
                              <span
                                className="text-[13px] font-bold"
                                style={{ color: "#4b5563" }}
                              >
                                {formatNumber(
                                  post.engagement.comments,
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98]"
                          style={{
                            background: "#f3f4f6",
                            color: "#4b5563",
                          }}
                        >
                          View Post
                        </button>
                        <button
                          className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98]"
                          style={{
                            background: "#f3f4f6",
                            color: "#4b5563",
                          }}
                        >
                          Analytics
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Desktop: Published Posts */}
            <div className="hidden lg:block space-y-3">
              {filteredPublished.map((post) => {
                const platformColors = getPlatformColor(
                  post.platform,
                );
                const sourceColors = getSourceTypeColor(
                  post.sourceType,
                );
                const isExpanded = expandedPosts.has(post.id);
                const shouldShowExpand =
                  post.content.length > 120;

                return (
                  <Card key={post.id}>
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                          <span
                            className="px-2 py-1 rounded text-[11px] font-bold tracking-wider uppercase"
                            style={{
                              background: platformColors.bg,
                              color: platformColors.text,
                            }}
                          >
                            {post.platformLabel}
                          </span>
                          <span
                            className="px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase"
                            style={{
                              background: sourceColors.bg,
                              color: sourceColors.text,
                            }}
                          >
                            {post.sourceType}
                          </span>
                        </div>
                        <span
                          className="text-xs font-semibold whitespace-nowrap"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {post.timeAgo}
                        </span>
                      </div>

                      {/* Content */}
                      <div>
                        <p
                          className="text-sm leading-relaxed whitespace-pre-wrap"
                          style={{ color: "var(--foreground)" }}
                        >
                          {isExpanded
                            ? post.content
                            : truncateContent(post.content)}
                        </p>
                        {shouldShowExpand && (
                          <button
                            onClick={() =>
                              togglePostExpansion(post.id)
                            }
                            className="mt-2 flex items-center gap-1.5 text-xs font-semibold transition-all"
                            style={{ color: "var(--primary)" }}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                Show more
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Engagement Stats */}
                      {post.engagement && (
                        <div
                          className="flex items-center gap-4 px-3 py-2 rounded-lg"
                          style={{ background: "var(--secondary)" }}
                        >
                          {post.engagement.views !==
                            undefined && (
                            <div className="flex items-center gap-1.5">
                              <Eye
                                className="w-3.5 h-3.5"
                                style={{ color: "var(--muted-foreground)" }}
                              />
                              <span
                                className="text-sm font-bold"
                                style={{ color: "var(--foreground)" }}
                              >
                                {formatNumber(
                                  post.engagement.views,
                                )}
                              </span>
                            </div>
                          )}
                          {post.engagement.likes !==
                            undefined && (
                            <div className="flex items-center gap-1.5">
                              <Heart
                                className="w-3.5 h-3.5"
                                style={{ color: "var(--muted-foreground)" }}
                              />
                              <span
                                className="text-sm font-bold"
                                style={{ color: "var(--foreground)" }}
                              >
                                {formatNumber(
                                  post.engagement.likes,
                                )}
                              </span>
                            </div>
                          )}
                          {post.engagement.comments !==
                            undefined && (
                            <div className="flex items-center gap-1.5">
                              <MessageCircle
                                className="w-3.5 h-3.5"
                                style={{ color: "var(--muted-foreground)" }}
                              />
                              <span
                                className="text-sm font-bold"
                                style={{ color: "var(--foreground)" }}
                              >
                                {formatNumber(
                                  post.engagement.comments,
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div
                        className="flex items-center gap-2 pt-4"
                        style={{
                          borderTop:
                            "1px solid rgba(var(--border-rgb), 0.08)",
                        }}
                      >
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-opacity-80 flex items-center gap-1.5"
                          style={{
                            background: "var(--secondary)",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View on {post.platformLabel}
                        </button>
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-opacity-80 flex items-center gap-1.5"
                          style={{
                            background: "var(--secondary)",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          Analytics
                        </button>
                        <div className="flex-1" />
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-opacity-80 flex items-center gap-1.5"
                          style={{
                            background:
                              "rgba(220, 38, 38, 0.1)",
                            color: "#dc2626",
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
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