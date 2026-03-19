import { useState, useRef, useEffect, useCallback } from "react";
import { FileText, Calendar, StickyNote, Quote, Search, ChevronRight, ChevronLeft, ExternalLink, Plus, ThumbsUp, Filter, X, Copy, Send, Clock, Share2, ThumbsDown, Upload, Loader2 } from "lucide-react";
import { notes as notesApi, marketing, social } from "../../lib/api";
import type { Note } from "./NotesInfiniteList";
import { Card } from "./Card";
import { MobileSection } from "./MobileSection";
import { Tabs } from "./Tabs";
import { PageHeader } from "./PageHeader";
import { RepurposeView } from "./RepurposeView";
import { WYSIWYGEditor } from "./WYSIWYGEditor";
import { NotesInfiniteList } from "./NotesInfiniteList";
import { CampaignDetailModal } from "./CampaignDetailView";
import { ScheduleModal } from "./ScheduleModal";
import { QuotesView } from "./QuotesView";
import { PublishingView } from "./PublishingView";
import { MobileBottomNav } from "./MobileBottomNav";
import { CustomSelect } from "./CustomSelect";
import { 
  MobileHeader, 
  MobileTabBar, 
  MobileFAB,
  MobileList,
  MobileEmptyState 
} from "./mobile";

type Campaign = {
  id: string;
  title: string;
  timestamp: string;
  postCount: number;
  cost: string;
  articleUrl: string | null;
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

export function MarketingView() {
  const [activeTab, setActiveTab] = useState("campaigns");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterShared, setFilterShared] = useState(false);
  const [filterCrossPosted, setFilterCrossPosted] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set(["batch-1"]));
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState("substack");
  const [noteContent, setNoteContent] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showScheduleAllModal, setShowScheduleAllModal] = useState(false);

  // Separate content for each platform
  const [platformContent, setPlatformContent] = useState({
    substack: "",
    linkedin: "",
    threads: "",
    instagram: ""
  });

  const [instagramImage, setInstagramImage] = useState<string>("");
  const [instagramImageFile, setInstagramImageFile] = useState<File | null>(null);

  // Real data state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [selectedNoteData, setSelectedNoteData] = useState<Note | null>(null);
  const [notesTotal, setNotesTotal] = useState(0);
  const [notesKey, setNotesKey] = useState(0);
  const [mobileNotes, setMobileNotes] = useState<Note[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const scheduledPosts: any[] = [];

  // Load campaigns from API
  useEffect(() => {
    setCampaignsLoading(true);
    marketing.library().then((res: any) => {
      const runs: any[] = res.runs ?? [];
      setCampaigns(runs.map((r) => ({
        id: String(r.id),
        title: r.title || "Untitled",
        timestamp: timeAgo(r.created_at ?? r.ts ?? ""),
        postCount: r.post_count ?? 0,
        cost: r.cost ? Number(r.cost).toFixed(4) : "0",
        articleUrl: r.article_url ?? null,
      })));
    }).catch(() => {}).finally(() => setCampaignsLoading(false));
  }, []);

  // Load first batch of notes for mobile list
  useEffect(() => {
    notesApi.batches().then((res: any) => {
      const batches: any[] = Array.isArray(res) ? res : (res.batches ?? []);
      batches.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (batches.length > 0) {
        return notesApi.batchNotes(String(batches[0].id)).then((r: any) => {
          setMobileNotes((Array.isArray(r) ? r : (r.notes ?? [])).map((n: any) => ({
            ...n, batch_id: batches[0].id
          })));
        });
      }
    }).catch(() => {});
  }, [notesKey]);

  const handleSelectNote = useCallback((note: Note) => {
    setSelectedNote(String(note.id));
    setSelectedNoteData(note);
    setPlatformContent({
      substack: note.note_text ?? "",
      linkedin: note.linkedin_post ?? "",
      threads: note.threads_post ?? "",
      instagram: note.instagram_post ?? "",
    });
    setActivePlatform("substack");
  }, []);

  const handleCreateNewNote = () => {
    setPlatformContent({ substack: "", linkedin: "", threads: "", instagram: "" });
    setInstagramImage("");
    setInstagramImageFile(null);
    setActivePlatform("substack");
    setSelectedNote("new-note");
    setSelectedNoteData(null);
  };

  const handleSave = async () => {
    if (!selectedNoteData) return;
    setSaving(true);
    try {
      await notesApi.update(String(selectedNoteData.id), { note_text: platformContent.substack });
      setSelectedNoteData((prev) => prev ? { ...prev, note_text: platformContent.substack } : prev);
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedNoteData) return;
    const text = platformContent[activePlatform as keyof typeof platformContent];
    if (!text) return;
    const apiPlatform = activePlatform === "substack" ? "substack_note" : activePlatform;
    setPublishing(true);
    try {
      await social.publish({ platform: apiPlatform, text, source_label: selectedNoteData.issue ?? "" });
    } catch (err) {
      console.error("Publish failed", err);
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNoteData) return;
    if (!confirm("Delete this note?")) return;
    try {
      await notesApi.delete(String(selectedNoteData.id));
      setSelectedNote(null);
      setSelectedNoteData(null);
      setNotesKey((k) => k + 1);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleMarkShared = async () => {
    if (!selectedNoteData) return;
    const newShared = !selectedNoteData.shared;
    try {
      await notesApi.update(String(selectedNoteData.id), { shared: newShared });
      setSelectedNoteData((prev) => prev ? { ...prev, shared: newShared } : prev);
    } catch (err) {
      console.error("Mark shared failed", err);
    }
  };

  const handleSignal = async (signal: "pos" | "neg") => {
    if (!selectedNoteData) return;
    const newSignal = selectedNoteData.signal === signal ? null : signal;
    try {
      await notesApi.update(String(selectedNoteData.id), { signal: newSignal ?? "" });
      setSelectedNoteData((prev) => prev ? { ...prev, signal: newSignal } : prev);
    } catch (err) {
      console.error("Signal failed", err);
    }
  };

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      await notesApi.generate({});
      setNotesKey((k) => k + 1);
    } catch (err) {
      console.error("Generate failed", err);
    } finally {
      setGenerating(false);
    }
  };

  // Dynamic page header content based on active tab
  const getPageHeaderContent = () => {
    switch (activeTab) {
      case "campaigns":
        return {
          kicker: "Marketing",
          title: "Campaigns",
          description: campaignsLoading ? "Loading..." : `${campaigns.length} total campaigns from pipeline runs and repurposing`
        };
      case "repurpose":
        return {
          kicker: "Marketing",
          title: "Repurpose Content",
          description: "Transform articles into social media posts"
        };
      case "compose":
        return {
          kicker: "Marketing",
          title: "Compose",
          description: notesTotal > 0 ? `${notesTotal} notes ready to publish` : "Notes ready to publish"
        };
      case "quotes":
        return {
          kicker: "Marketing",
          title: "Quotes",
          description: "Extract and manage quotes from your articles"
        };
      case "publishing":
        return {
          kicker: "Marketing",
          title: "Publishing",
          description: `${scheduledPosts.length} queued`
        };
      default:
        return {
          kicker: "Marketing",
          title: "All your social posts in one place",
          description: "From pipeline runs and on-demand repurposing"
        };
    }
  };

  const headerContent = getPageHeaderContent();

  return (
    <div>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      <PageHeader
        kicker={headerContent.kicker}
        title={headerContent.title}
        description={headerContent.description}
      />

      <Tabs
        tabs={[
          { id: "campaigns", label: "Campaigns", icon: FileText },
          { id: "repurpose", label: "Repurpose", icon: Calendar },
          { id: "compose", label: "Compose", icon: StickyNote },
          { id: "quotes", label: "Quotes", icon: Quote },
          { id: "publishing", label: "Publishing", count: scheduledPosts.length }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hideOnMobile={true}
      />

      {activeTab === "campaigns" && (
        <>
          {/* Mobile: New Mobile-Optimized View */}
          <div className="lg:hidden">
            <div className="pt-4 pb-20">
              {/* Search Bar */}
              <div className="relative mb-4 px-4">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                  style={{
                    background: 'white',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(var(--border-rgb), 0.2)',
                    color: 'var(--foreground)'
                  }}
                />
              </div>

              {/* Campaign List */}
              <div className="px-4">
                <MobileList
                  items={campaigns}
                  renderItem={(campaign) => (
                    <button
                      onClick={() => setSelectedCampaign(campaign)}
                      className="w-full mb-3 p-4 rounded-2xl text-left active:scale-[0.98] transition-transform"
                      style={{
                        background: 'white',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'rgba(var(--border-rgb), 0.12)',
                        boxShadow: '0 1px 3px rgba(var(--border-rgb), 0.06)'
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-[15px] font-bold flex-1 leading-tight" style={{ color: 'var(--foreground)' }}>
                          {campaign.title}
                        </h4>
                        <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                      </div>
                      
                      {campaign.articleUrl && (
                        <div className="flex items-center gap-2 mb-3">
                          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
                          <p className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>
                            {campaign.articleUrl}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <span className="font-semibold">{campaign.timestamp}</span>
                        <span>•</span>
                        <span>{campaign.postCount} posts</span>
                        <span>•</span>
                        <span className="font-semibold" style={{ color: 'var(--primary)' }}>${campaign.cost}</span>
                      </div>
                    </button>
                  )}
                  keyExtractor={(campaign) => campaign.id}
                  emptyState={
                    <MobileEmptyState
                      icon={FileText}
                      title="No campaigns yet"
                      description="Run the pipeline to generate your first campaign with social posts"
                    />
                  }
                />
              </div>
            </div>
          </div>

          {/* Desktop: Search + Cards Grid */}
          <div className="hidden lg:block pt-6">
            <Card className="mb-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
                  <input
                    type="text"
                    placeholder="Search by title or article URL..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
                    style={{
                      background: 'var(--secondary)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'rgba(var(--border-rgb), 0.12)',
                      color: 'var(--foreground)'
                    }}
                  />
                </div>
                <p className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                  {campaigns.length} campaigns
                </p>
              </div>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {campaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  className="cursor-pointer transition-all hover:shadow-lg"
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-lg font-bold leading-tight flex-1" style={{ color: 'var(--foreground)' }}>
                      {campaign.title}
                    </h3>
                    <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                  </div>

                  {campaign.articleUrl && (
                    <div className="flex items-center gap-2 mb-3">
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
                      <p className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>
                        {campaign.articleUrl}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    <span className="font-semibold">{campaign.timestamp}</span>
                    <span>•</span>
                    <span>{campaign.postCount} posts</span>
                    <span>•</span>
                    <span className="font-semibold" style={{ color: 'var(--primary)' }}>${campaign.cost}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === "repurpose" && (
        <RepurposeView onOpenLibrary={() => setActiveTab("campaigns")} />
      )}

      {activeTab === "compose" && (
        <>
          {/* Desktop Layout */}
          <div className="hidden lg:flex gap-6 pt-6">
            {/* Left Panel - Notes List */}
            <div className="w-80 flex-shrink-0 flex flex-col space-y-4">
              {/* Actions Bar */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {notesTotal > 0 ? `${notesTotal} notes` : "Notes"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="p-2 rounded-lg transition-all hover:bg-opacity-90"
                    style={{ background: 'var(--primary)', color: '#fff' }}
                    onClick={handleCreateNewNote}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(var(--border-rgb),0.07)', color: 'var(--muted-foreground)' }}
                  >
                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : "⚡"}
                    {generating ? "Generating…" : "Generate"}
                  </button>
                </div>
              </div>

              {/* Search & Filters */}
              <Card>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
                    <input
                      type="text"
                      placeholder="Search notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
                      style={{
                        background: 'var(--secondary)',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'rgba(var(--border-rgb), 0.12)',
                        color: 'var(--foreground)'
                      }}
                    />
                  </div>
                  
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="w-full px-3 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: showFilters ? 'rgba(var(--primary-rgb), 0.1)' : 'var(--secondary)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: showFilters ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.12)',
                      color: showFilters ? 'var(--primary)' : 'var(--muted-foreground)'
                    }}
                  >
                    <Filter className="w-4 h-4" />
                    Filters
                  </button>

                  {/* Filter Pills */}
                  {showFilters && (
                    <div className="flex items-center gap-2 flex-wrap pt-3" style={{ borderTop: '1px solid rgba(var(--border-rgb), 0.12)' }}>
                      <button
                        onClick={() => setFilterShared(!filterShared)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: filterShared ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: filterShared ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.2)',
                          color: filterShared ? 'var(--primary)' : 'var(--muted-foreground)'
                        }}
                      >
                        Shared
                      </button>
                      <button
                        onClick={() => setFilterCrossPosted(!filterCrossPosted)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: filterCrossPosted ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: filterCrossPosted ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.2)',
                          color: filterCrossPosted ? 'var(--primary)' : 'var(--muted-foreground)'
                        }}
                      >
                        Cross-posted
                      </button>
                      <button
                        className="px-2 py-1.5 rounded-lg text-xs transition-all"
                        style={{
                          background: 'transparent',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'rgba(var(--border-rgb), 0.2)'
                        }}
                      >
                        👍
                      </button>
                      <button
                        className="px-2 py-1.5 rounded-lg text-xs transition-all"
                        style={{
                          background: 'transparent',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: 'rgba(var(--border-rgb), 0.2)'
                        }}
                      >
                        🏆
                      </button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Scrollable Notes List */}
              <NotesInfiniteList
                selectedNote={selectedNote}
                onSelectNote={handleSelectNote}
                onTotalCount={setNotesTotal}
                reloadKey={notesKey}
              />
            </div>

            {/* Right Panel - Note Detail */}
            <div className="flex-1 min-w-0">
              {selectedNote ? (
                <Card>
                {/* Note Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1 min-w-0">
                    {selectedNoteData && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase" style={{ background: 'rgba(var(--primary-rgb), 0.15)', color: 'var(--primary)' }}>
                          {selectedNoteData.intent}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {selectedNoteData.timestamp ? timeAgo(selectedNoteData.timestamp) : ""}
                        </span>
                      </div>
                    )}
                    <h3 className="text-base font-bold leading-snug" style={{ color: 'var(--foreground)' }}>
                      {selectedNoteData?.issue || "New Note"}
                    </h3>
                  </div>
                  <button
                    onClick={() => { setSelectedNote(null); setSelectedNoteData(null); }}
                    className="p-2 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0 ml-4"
                  >
                    <X className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
                  </button>
                </div>

                {/* Platform Tabs */}
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={() => setActivePlatform("substack")}
                    className="px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: activePlatform === "substack" ? 'var(--primary)' : 'transparent',
                      color: activePlatform === "substack" ? '#fff' : 'var(--muted-foreground)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: activePlatform === "substack" ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.2)'
                    }}
                  >
                    Substack
                  </button>
                  <button
                    onClick={() => setActivePlatform("linkedin")}
                    className="px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: activePlatform === "linkedin" ? 'var(--primary)' : 'transparent',
                      color: activePlatform === "linkedin" ? '#fff' : 'var(--muted-foreground)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: activePlatform === "linkedin" ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.2)'
                    }}
                  >
                    LinkedIn
                  </button>
                  <button
                    onClick={() => setActivePlatform("instagram")}
                    className="px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: activePlatform === "instagram" ? 'var(--primary)' : 'transparent',
                      color: activePlatform === "instagram" ? '#fff' : 'var(--muted-foreground)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: activePlatform === "instagram" ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.2)'
                    }}
                  >
                    Instagram
                  </button>
                  <button
                    onClick={() => setActivePlatform("threads")}
                    className="px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: activePlatform === "threads" ? 'var(--primary)' : 'transparent',
                      color: activePlatform === "threads" ? '#fff' : 'var(--muted-foreground)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: activePlatform === "threads" ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.2)'
                    }}
                  >
                    Threads
                  </button>
                </div>

                {/* Instagram Image Upload */}
                {activePlatform === "instagram" && (
                  <div className="mb-6">
                    <label className="block mb-2 lg:mb-1.5 text-base lg:text-xs font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted-foreground)' }}>
                      Post Image
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setInstagramImageFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setInstagramImage(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      />
                      <div
                        className="relative rounded-2xl transition-all duration-180 cursor-pointer overflow-hidden min-h-[140px] flex flex-col items-center justify-center p-6"
                        style={{
                          borderWidth: instagramImage ? '1px' : '2px',
                          borderStyle: instagramImage ? 'solid' : 'dashed',
                          borderColor: instagramImage ? 'rgba(var(--primary-rgb), 0.3)' : 'rgba(var(--border-rgb), 0.2)',
                          background: instagramImage ? 'rgba(var(--primary-rgb), 0.05)' : 'rgba(255, 255, 255, 0.4)',
                        }}
                      >
                        {instagramImage ? (
                          <div className="w-full">
                            <img src={instagramImage} alt="Instagram preview" className="w-full h-auto rounded-lg" />
                          </div>
                        ) : (
                          <div className="text-center">
                            <svg className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <div className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                              Upload Instagram Image
                            </div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              Click or drag an image (JPG, PNG)
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Editor */}
                <div className="mb-6">
                  {activePlatform === "substack" ? (
                    <WYSIWYGEditor
                      value={platformContent.substack}
                      onChange={(value) => setPlatformContent(prev => ({ 
                        ...prev, 
                        substack: value 
                      }))}
                      placeholder="Start typing your note..."
                    />
                  ) : (
                    <textarea
                      value={platformContent[activePlatform as keyof typeof platformContent]}
                      onChange={(e) => setPlatformContent(prev => ({ 
                        ...prev, 
                        [activePlatform]: e.target.value 
                      }))}
                      placeholder="Start typing your note..."
                      className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all duration-[180ms] resize-y font-normal"
                      style={{
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'rgba(var(--border-rgb), 0.24)',
                        color: 'var(--foreground)',
                        background: 'var(--card)',
                        minHeight: '200px',
                        lineHeight: '1.6'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--primary-rgb), 0.12)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.24)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-4 pt-6" style={{ borderTop: '1px solid rgba(var(--border-rgb), 0.12)' }}>
                  {/* Primary Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(platformContent[activePlatform as keyof typeof platformContent] ?? "")}
                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-opacity-80 flex items-center gap-2"
                        style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                      >
                        <Copy className="w-4 h-4" />
                        Copy
                      </button>
                      <button
                        onClick={handlePublish}
                        disabled={publishing}
                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-opacity-90 flex items-center gap-2"
                        style={{ background: 'var(--primary)', color: '#fff', opacity: publishing ? 0.7 : 1 }}
                      >
                        {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {publishing ? "Publishing…" : "Publish"}
                      </button>
                      <button
                        onClick={() => setShowScheduleModal(true)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-opacity-80 flex items-center gap-2"
                        style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                      >
                        <Clock className="w-4 h-4" />
                        Schedule
                      </button>
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={saving || !selectedNoteData}
                      className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                      style={{ background: 'var(--primary)', color: '#fff', opacity: saving ? 0.7 : 1 }}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(var(--border-rgb), 0.06)' }}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleMarkShared}
                        className="px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-opacity-80 flex items-center gap-2"
                        style={{
                          background: selectedNoteData?.shared ? 'rgba(var(--primary-rgb),0.12)' : 'var(--secondary)',
                          color: selectedNoteData?.shared ? 'var(--primary)' : 'var(--muted-foreground)'
                        }}
                      >
                        <Share2 className="w-4 h-4" />
                        {selectedNoteData?.shared ? "Shared ✓" : "Mark as shared"}
                      </button>
                      <button
                        onClick={() => handleSignal("pos")}
                        className="p-2 rounded-lg transition-all hover:bg-opacity-80"
                        style={{
                          background: selectedNoteData?.signal === "pos" ? 'rgba(16,185,129,0.15)' : 'var(--secondary)',
                          color: selectedNoteData?.signal === "pos" ? '#059669' : 'var(--muted-foreground)'
                        }}
                        title="Good - Generate more like this"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSignal("neg")}
                        className="p-2 rounded-lg transition-all hover:bg-opacity-80"
                        style={{
                          background: selectedNoteData?.signal === "neg" ? 'rgba(220,38,38,0.1)' : 'var(--secondary)',
                          color: selectedNoteData?.signal === "neg" ? '#dc2626' : 'var(--muted-foreground)'
                        }}
                        title="Bad - Generate less like this"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDelete}
                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-opacity-80"
                        style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Bulk Action */}
                  <div className="pt-4" style={{ borderTop: '1px solid rgba(var(--border-rgb), 0.06)' }}>
                    <button
                      className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:bg-opacity-90 flex items-center justify-center gap-2"
                      style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--primary)' }}
                      onClick={() => setShowScheduleAllModal(true)}
                    >
                      <Clock className="w-4 h-4" />
                      Schedule to all platforms
                    </button>
                  </div>
                </div>
              </Card>
              ) : (
                <Card className="text-center py-12">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(var(--primary-rgb), 0.1)' }}
                  >
                    <StickyNote className="w-8 h-8" style={{ color: 'var(--primary)' }} />
                  </div>
                  <h3 
                    className="text-lg mb-2 font-bold"
                    style={{ color: 'var(--foreground)' }}
                  >
                    No note selected
                  </h3>
                  <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--muted-foreground)' }}>
                    Select a note from the list to edit
                  </p>
                </Card>
              )}
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden">
            {!selectedNote ? (
              <>
                <div className="pt-4 pb-20">
                  {/* New Note + Generate Buttons */}
                  <div className="px-4 mb-4 flex gap-2">
                    <button
                      onClick={handleCreateNewNote}
                      className="flex-1 p-4 rounded-2xl text-center transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      style={{ background: 'var(--primary)', color: '#fff', boxShadow: '0 2px 8px rgba(var(--primary-rgb), 0.3)' }}
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-[15px] font-semibold">New Note</span>
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="px-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                      style={{ background: 'white', color: 'var(--muted-foreground)', border: '1px solid rgba(var(--border-rgb),0.12)' }}
                    >
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-base">⚡</span>}
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative mb-4 px-4">
                    <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
                    <input
                      type="text"
                      placeholder="Search notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                      style={{
                        background: 'white',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'rgba(var(--border-rgb), 0.2)',
                        color: 'var(--foreground)'
                      }}
                    />
                  </div>

                  {/* Mobile: Notes List */}
                  <div className="space-y-2.5 px-4">
                    {mobileNotes.length === 0 ? (
                      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-subtle)' }}>
                        No notes yet. Tap Generate to create some.
                      </div>
                    ) : mobileNotes.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => handleSelectNote(note)}
                        className="w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]"
                        style={{
                          background: 'white',
                          border: '1px solid rgba(var(--border-rgb), 0.12)',
                          boxShadow: '0 1px 3px rgba(var(--border-rgb), 0.06)'
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase" style={{ background: 'rgba(var(--primary-rgb),0.15)', color: 'var(--primary)' }}>
                            {note.intent}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                            {timeAgo(note.timestamp)}
                          </span>
                        </div>
                        <p className="text-[13px] leading-relaxed line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
                          {note.issue}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Mobile: Full-Screen Compose Modal */}
          {selectedNote && (
            <div 
              className="lg:hidden fixed inset-0 z-50 flex flex-col"
              style={{ 
                background: 'var(--background)',
                animation: 'slideInRight 0.2s cubic-bezier(0.22, 1, 0.36, 1)'
              }}
            >
              {/* Minimal Header */}
              <div 
                className="flex-shrink-0 px-4 pt-4 pb-4 flex items-center gap-3" 
                style={{ background: 'var(--background)', borderBottom: '1px solid rgba(var(--border-rgb), 0.12)' }}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  const startX = touch.clientX;
                  const startY = touch.clientY;
                  
                  const handleTouchMove = (moveEvent: TouchEvent) => {
                    const moveTouch = moveEvent.touches[0];
                    const deltaX = moveTouch.clientX - startX;
                    const deltaY = moveTouch.clientY - startY;
                    
                    // If swipe is more horizontal than vertical and going right
                    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 50) {
                      setSelectedNote(null);
                      document.removeEventListener('touchmove', handleTouchMove);
                    }
                  };
                  
                  document.addEventListener('touchmove', handleTouchMove, { passive: true });
                  document.addEventListener('touchend', () => {
                    document.removeEventListener('touchmove', handleTouchMove);
                  }, { once: true });
                }}
              >
                <button
                  onClick={() => setSelectedNote(null)}
                  className="p-2 -ml-1 rounded-xl active:bg-black active:bg-opacity-5"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[18px] font-bold truncate" style={{ color: 'var(--foreground)' }}>
                    {selectedNote === 'new-note' ? 'New Note' : (selectedNoteData?.issue || 'Compose Post')}
                  </h3>
                  <p className="text-[13px]" style={{ color: 'var(--text-subtle)' }}>
                    {activePlatform || 'Select platform'}
                  </p>
                </div>
                <button
                  className="px-4 py-2 rounded-xl text-[15px] font-semibold transition-all active:scale-95 flex items-center gap-1.5"
                  style={{ background: 'var(--primary)', color: '#fff', opacity: saving ? 0.7 : 1 }}
                  onClick={async () => {
                    await handleSave();
                    setSelectedNote(null);
                    setSelectedNoteData(null);
                  }}
                >
                  Done
                </button>
              </div>

              {/* Platform Selector */}
              <div className="flex-shrink-0 px-4 pt-4 pb-3" style={{ background: 'var(--background)' }}>
                <CustomSelect
                  options={[
                    { value: 'substack', label: 'Substack' },
                    { value: 'linkedin', label: 'LinkedIn' },
                    { value: 'instagram', label: 'Instagram' },
                    { value: 'threads', label: 'Threads' }
                  ]}
                  value={activePlatform}
                  onChange={(value) => {
                    console.log('onChange called with value:', value);
                    console.log('Current activePlatform:', activePlatform);
                    setActivePlatform(value);
                    console.log('setActivePlatform called with:', value);
                  }}
                  placeholder="Select platform"
                />
              </div>

              {/* Scrollable Content Area */}
              <div 
                className="flex-1 overflow-y-auto px-4 py-2"
                style={{
                  minHeight: 0,
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {/* Instagram Image Upload */}
                {activePlatform === "instagram" && (
                  <div className="mb-3">
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setInstagramImageFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setInstagramImage(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      />
                      <div
                        className="relative rounded-2xl transition-all cursor-pointer overflow-hidden min-h-[180px] flex flex-col items-center justify-center p-6"
                        style={{ 
                          borderWidth: instagramImage ? '1px' : '2px',
                          borderStyle: instagramImage ? 'solid' : 'dashed',
                          borderColor: instagramImage ? 'rgba(var(--border-rgb), 0.12)' : 'rgba(var(--primary-rgb), 0.3)',
                          background: 'var(--card)'
                        }}
                      >
                        {instagramImage ? (
                          <div className="w-full">
                            <img src={instagramImage} alt="Instagram preview" className="w-full h-auto rounded-lg" />
                          </div>
                        ) : (
                          <div className="text-center">
                            <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--primary)' }} />
                            <div className="text-[14px] font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                              Add Photo
                            </div>
                            <div className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>
                              Tap to upload
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Editor */}
                {activePlatform === "substack" ? (
                  <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid rgba(var(--border-rgb), 0.08)' }}>
                    <WYSIWYGEditor
                      value={platformContent.substack}
                      onChange={(value) => setPlatformContent(prev => ({ 
                        ...prev, 
                        substack: value 
                      }))}
                      placeholder="Start writing..."
                    />
                  </div>
                ) : (
                  <textarea
                    value={platformContent[activePlatform as keyof typeof platformContent]}
                    onChange={(e) => setPlatformContent(prev => ({ 
                      ...prev, 
                      [activePlatform]: e.target.value 
                    }))}
                    placeholder="Start writing..."
                    className="w-full px-4 py-4 rounded-2xl text-[16px] outline-none resize-none"
                    style={{ 
                      border: '1px solid rgba(var(--border-rgb), 0.08)',
                      color: 'var(--foreground)',
                      background: 'var(--card)',
                      minHeight: '300px',
                      lineHeight: '1.5'
                    }}
                    rows={12}
                  />
                )}

                {/* Bottom padding to ensure scroll clears the fixed footer */}
                <div style={{ height: '20px' }} />
              </div>

              {/* Fixed Bottom Actions */}
              <div className="flex-shrink-0 p-4 space-y-2" style={{ background: 'var(--background)', borderTop: '1px solid rgba(var(--border-rgb), 0.08)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                {/* Secondary Actions - Subtle at top */}
                <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: '1px solid rgba(var(--border-rgb), 0.06)' }}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(platformContent[activePlatform as keyof typeof platformContent] ?? "")}
                      className="p-2 rounded-lg transition-all active:scale-95"
                      style={{ background: 'rgba(255, 250, 241, 0.5)', color: 'var(--muted-foreground)' }}
                      title="Copy"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleMarkShared}
                      className="p-2 rounded-lg transition-all active:scale-95"
                      style={{
                        background: selectedNoteData?.shared ? 'rgba(var(--primary-rgb),0.12)' : 'rgba(255, 250, 241, 0.5)',
                        color: selectedNoteData?.shared ? 'var(--primary)' : 'var(--muted-foreground)'
                      }}
                      title="Mark as shared"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSignal("pos")}
                      className="p-2 rounded-lg transition-all active:scale-95"
                      style={{
                        background: selectedNoteData?.signal === "pos" ? 'rgba(16,185,129,0.15)' : 'rgba(255, 250, 241, 0.5)',
                        color: selectedNoteData?.signal === "pos" ? '#059669' : 'var(--muted-foreground)'
                      }}
                      title="Good"
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSignal("neg")}
                      className="p-2 rounded-lg transition-all active:scale-95"
                      style={{
                        background: selectedNoteData?.signal === "neg" ? 'rgba(220,38,38,0.1)' : 'rgba(255, 250, 241, 0.5)',
                        color: selectedNoteData?.signal === "neg" ? '#dc2626' : 'var(--muted-foreground)'
                      }}
                      title="Bad"
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Primary Actions Stack */}
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="w-full py-3.5 rounded-full text-[16px] font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ background: 'var(--primary)', color: '#fff', opacity: publishing ? 0.7 : 1 }}
                >
                  {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {publishing ? "Publishing…" : "Publish Now"}
                </button>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="w-full py-3.5 rounded-full text-[16px] font-semibold transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(255, 250, 241, 0.9)', color: 'var(--muted-foreground)', border: '1px solid rgba(var(--border-rgb), 0.08)' }}
                >
                  Schedule for Later
                </button>
                <button
                  onClick={() => setShowScheduleAllModal(true)}
                  className="w-full py-3.5 rounded-full text-[16px] font-semibold transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(var(--primary-rgb), 0.12)', color: 'var(--primary)', border: '1px solid rgba(var(--primary-rgb), 0.3)' }}
                >
                  Schedule to All Platforms
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "quotes" && (
        <QuotesView />
      )}

      {activeTab === "publishing" && (
        <PublishingView />
      )}

      {/* Campaign Detail Modal */}
      {selectedCampaign && (
        <CampaignDetailModal
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        items={[
          { id: "campaigns", label: "Campaigns", icon: FileText },
          { id: "repurpose", label: "Repurpose", icon: Calendar },
          { id: "compose", label: "Compose", icon: StickyNote },
          { id: "quotes", label: "Quotes", icon: Quote },
          { id: "publishing", label: "Publish", icon: Send }
        ]}
        activeItem={activeTab}
        onItemChange={setActiveTab}
      />

      {/* Schedule Modals */}
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={(date, time, timezone) => {
          const text = platformContent[activePlatform as keyof typeof platformContent];
          const apiPlatform = activePlatform === "substack" ? "substack_note" : activePlatform;
          const scheduled_at = `${date}T${time}:00`;
          social.schedule({
            platform: apiPlatform,
            text,
            scheduled_at,
            timezone,
            source_label: selectedNoteData?.issue ?? "",
            note_id: selectedNoteData?.id,
          }).catch(console.error);
          setShowScheduleModal(false);
        }}
        platform={activePlatform as "substack" | "linkedin" | "instagram" | "threads"}
        title="Schedule Post"
      />

      <ScheduleModal
        isOpen={showScheduleAllModal}
        onClose={() => setShowScheduleAllModal(false)}
        onSchedule={(date, time, timezone, platforms) => {
          console.log(`Scheduling to ${platforms?.join(', ')} for ${date} at ${time} ${timezone}`);
          setShowScheduleAllModal(false);
        }}
        multiPlatform
        title="Schedule to All Platforms"
        description="Schedule this note to multiple platforms at once. Posts will be published automatically at the scheduled time."
      />
    </div>
  );
}