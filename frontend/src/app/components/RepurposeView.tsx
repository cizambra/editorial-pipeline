import { useState } from "react";
import { Upload, X, Calendar, ChevronDown, ChevronUp, Edit2, FileText, Check } from "lucide-react";
import { Card, CardSection, Eyebrow, SectionTitle } from "./Card";
import { Button, Field, Label, Input, Dropzone, CardButton } from "./FormComponents";
import { MobileSection } from "./MobileSection";
import { WYSIWYGEditor } from "./WYSIWYGEditor";
import { CustomSelect } from "./CustomSelect";
import { 
  MobileHeader, 
  MobileButton, 
  MobileSegmentedControl,
  MobileSpinner 
} from "./mobile";

type Platform = "linkedin" | "threads" | "instagram" | "substack";

const platformLabels: Record<Platform, string> = {
  "linkedin": "LinkedIn",
  "threads": "Threads",
  "instagram": "Instagram",
  "substack": "Substack Note"
};

type ArticleWithQuotes = {
  id: string;
  title: string;
  quoteCount: number;
  timestamp: string;
  quotes: QuoteItem[];
};

interface RepurposeViewProps {
  onOpenLibrary?: () => void;
}

export function RepurposeView({ onOpenLibrary }: RepurposeViewProps) {
  const [articleSource, setArticleSource] = useState<"upload" | "paste">("upload");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSlug, setArticleSlug] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [articleText, setArticleText] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [language, setLanguage] = useState("English");
  const [angleNote, setAngleNote] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("linkedin");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState("America/Los_Angeles");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [showFullArticle, setShowFullArticle] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState(false);

  const platforms: Platform[] = ["linkedin", "threads", "instagram", "substack"];

  const timezones = [
    { value: "America/Los_Angeles", label: "Pacific Time (PST/PDT)" },
    { value: "America/Denver", label: "Mountain Time (MST/MDT)" },
    { value: "America/Chicago", label: "Central Time (CST/CDT)" },
    { value: "America/New_York", label: "Eastern Time (EST/EDT)" },
    { value: "America/Phoenix", label: "Arizona (MST)" },
    { value: "America/Anchorage", label: "Alaska (AKST/AKDT)" },
    { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
    { value: "Europe/London", label: "London (GMT/BST)" },
    { value: "Europe/Paris", label: "Paris (CET/CEST)" },
    { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
    { value: "Australia/Sydney", label: "Sydney (AEDT/AEST)" },
  ];

  // Function to generate slug from title
  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  };

  // Handle file upload and parse markdown
  const handleFileUpload = async (file: File) => {
    setUploadedFileName(file.name);
    
    try {
      const text = await file.text();
      setArticleText(text);
      
      // Extract title from filename (remove extension)
      const filenameWithoutExt = file.name.replace(/\.(md|markdown|txt)$/i, '');
      
      // Check if filename looks like a title (contains uppercase letters or spaces)
      const looksLikeTitle = /[A-Z\s]/.test(filenameWithoutExt);
      
      let title = '';
      
      if (looksLikeTitle) {
        // Use filename as title
        title = filenameWithoutExt;
      } else {
        // Fall back to searching for H1 in markdown content
        const h1Match = text.match(/^#\s+(.+)$/m);
        if (h1Match) {
          title = h1Match[1].trim();
        } else {
          // If no H1 found, use filename anyway
          title = filenameWithoutExt;
        }
      }
      
      setArticleTitle(title);
      
      // Generate slug from title
      const slug = generateSlug(title);
      setArticleSlug(slug);
      
      // Generate URL using slug
      setArticleUrl(`https://www.self-disciplined.com/p/${slug}`);
      
      // Auto-set publish date to today
      const today = new Date().toISOString().split('T')[0];
      setPublishDate(today);
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  const handleNew = () => {
    setArticleSource("upload");
    setArticleTitle("");
    setArticleSlug("");
    setArticleUrl("");
    setArticleText("");
    setPublishDate("");
    setLanguage("English");
    setAngleNote("");
    setIsGenerating(false);
    setIsComplete(false);
    setUploadedFileName("");
    setSelectedPlatform("linkedin");
    setShowFullArticle(false);
    setEditingMetadata(false);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    // Simulate generation process
    setTimeout(() => {
      setIsGenerating(false);
      setIsComplete(true);
    }, 2000);
  };

  const handleSchedule = () => {
    console.log(`Scheduling post for ${scheduleDate} at ${scheduleTime} ${scheduleTimezone}`);
    setShowScheduleModal(false);
    setScheduleDate("");
    setScheduleTime("");
    setScheduleTimezone("America/Los_Angeles");
  };

  const handleCopy = () => {
    const content = selectedPlatform === "substack" ? mockPosts[selectedPlatform] : mockPosts[selectedPlatform];
    navigator.clipboard.writeText(content);
  };

  const mockPosts = {
    linkedin: "Your workload isn't the problem. The switching between them is.\n\nYou finish a meeting, switch to a project update, check Slack, pivot to your kid's homework, start dinner, circle back to email. Each swap is manageable. But every time you shift contexts, your brain isn't working on the actual task — it's adjusting to the new one.\n\nTechnically you have time. You care. You sit down. And starting still feels like pushing through concrete.",
    threads: "The switching tax is invisible until you add it all up.\n\nEvery context shift costs you 10-20 minutes of cognitive overhead. Not the task itself — just the mental recalibration.\n\nThat's why a \"light day\" still leaves you exhausted.\n\n---\n\n## Thread 3 — Good still adds up\n\nFamily. Career. Side project. Health. Each one makes sense. The problem is your brain doesn't care that the load came from meaningful choices. \"Good\" still costs bandwidth, so you assume the exhaustion means you're doing something wrong.",
    instagram: "Nobody has unlimited bandwidth. Anyone who tells you they do is selling something.\n\n#executivefunction #parentingtips #workingparents #mentalload #contextswitching #productivity #ADHDparenting #selfawareness\n\n---\n\nDescribe the image... (leave blank to auto-generate from post text)",
    substack: "## Note 1 — The switching tax\n\nMost people think they're overwhelmed by the amount of work. That's not usually it.\n\nIt's the cost of switching between different types of work. Every time you shift from one priority to another, your brain has to reload the entire context: what matters here, what the rules are, where you left off. That reload isn't free. It's expensive, and it's invisible."
  };

  return (
    <div>
      {/* Mobile Version */}
      <div className="lg:hidden">
        <div className="pt-4 pb-20">
          {/* Input Form */}
          <MobileSection>
            <div className="space-y-4">
              <div>
                <Eyebrow>Article source</Eyebrow>
                <SectionTitle className="mb-4">Upload a file or paste your article</SectionTitle>
                
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setArticleSource("upload")}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                      articleSource === "upload" ? '' : ''
                    }`}
                    style={
                      articleSource === "upload"
                        ? {
                            background: 'var(--primary)',
                            color: '#ffffff',
                            border: '1px solid rgba(var(--primary-rgb), 0.3)',
                            boxShadow: '0 4px 14px rgba(var(--primary-rgb), 0.25)'
                          }
                        : {
                            background: 'rgba(255, 255, 255, 0.6)',
                            color: 'var(--primary)',
                            border: '1px solid rgba(var(--border-rgb), 0.14)',
                            boxShadow: '0 2px 8px rgba(var(--border-rgb), 0.06)'
                          }
                    }
                  >
                    <Upload className="w-4 h-4" />
                    Upload File
                  </button>
                  <button
                    onClick={() => setArticleSource("paste")}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                      articleSource === "paste" ? '' : ''
                    }`}
                    style={
                      articleSource === "paste"
                        ? {
                            background: 'var(--primary)',
                            color: '#ffffff',
                            border: '1px solid rgba(var(--primary-rgb), 0.3)',
                            boxShadow: '0 4px 14px rgba(var(--primary-rgb), 0.25)'
                          }
                        : {
                            background: 'rgba(255, 255, 255, 0.6)',
                            color: 'var(--primary)',
                            border: '1px solid rgba(var(--border-rgb), 0.14)',
                            boxShadow: '0 2px 8px rgba(var(--border-rgb), 0.06)'
                          }
                    }
                  >
                    <FileText className="w-4 h-4" />
                    Paste Text
                  </button>
                </div>
              </div>

              {articleSource === "upload" && (
                <div>
                  <input
                    type="file"
                    accept=".md,.markdown,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="block w-full px-4 py-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all active:scale-[0.98] text-center"
                    style={{
                      background: 'white',
                      borderColor: 'rgba(var(--border-rgb), 0.2)',
                      color: 'var(--text-subtle)'
                    }}
                  >
                    {uploadedFileName ? (
                      <div>
                        <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--primary)' }} />
                        <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                          {uploadedFileName}
                        </p>
                        <p className="text-[12px]">Tap to change file</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                          Tap to browse
                        </p>
                        <p className="text-[12px]">.md, .markdown, or .txt files</p>
                      </div>
                    )}
                  </label>
                </div>
              )}

              {articleSource === "paste" && (
                <div>
                  <textarea
                    value={articleText}
                    onChange={(e) => setArticleText(e.target.value)}
                    placeholder="Paste your article text here..."
                    rows={12}
                    className="w-full px-4 py-4 rounded-2xl text-[16px] resize-none"
                    style={{
                      background: 'white',
                      border: '1px solid rgba(var(--border-rgb), 0.15)',
                      color: 'var(--foreground)',
                      lineHeight: '1.6'
                    }}
                  />
                </div>
              )}
            </div>
          </MobileSection>

          <MobileSection>
            <div className="space-y-5">
              <div>
                <Eyebrow>Article information</Eyebrow>
                <SectionTitle className="mb-4">Tell us about this article</SectionTitle>
              </div>

              <div>
                <input
                  id="article-title"
                  type="text"
                  placeholder="Article title"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl text-[16px]"
                  style={{
                    background: 'white',
                    border: '1px solid rgba(var(--border-rgb), 0.15)',
                    color: 'var(--foreground)'
                  }}
                />
              </div>

              <div>
                <input
                  id="slug"
                  type="text"
                  placeholder="URL slug"
                  value={articleSlug}
                  onChange={(e) => setArticleSlug(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl text-[16px]"
                  style={{
                    background: 'white',
                    border: '1px solid rgba(var(--border-rgb), 0.15)',
                    color: 'var(--foreground)'
                  }}
                />
              </div>

              <div className="space-y-3">
                <input
                  id="article-url"
                  type="url"
                  placeholder="Article URL (https://...)"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl text-[16px]"
                  style={{
                    background: 'white',
                    border: '1px solid rgba(var(--border-rgb), 0.15)',
                    color: 'var(--foreground)'
                  }}
                />

                <input
                  id="publish-date"
                  type="text"
                  placeholder="Publish date (e.g., March 2025)"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl text-[16px]"
                  style={{
                    background: 'white',
                    border: '1px solid rgba(var(--border-rgb), 0.15)',
                    color: 'var(--foreground)'
                  }}
                />
              </div>
            </div>
          </MobileSection>

          <MobileSection>
            <div className="px-4 py-4 space-y-5">
              <div>
                <Eyebrow>Generation settings</Eyebrow>
                <SectionTitle className="mb-4">Configure how we repurpose this article</SectionTitle>
              </div>

              <div>
                <label className="block text-base lg:text-xs font-bold tracking-[0.08em] uppercase mb-2 lg:mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  Language
                </label>
                <CustomSelect
                  id="language"
                  options={[
                    { value: "English", label: "English" },
                    { value: "Spanish", label: "Spanish" }
                  ]}
                  value={language}
                  onChange={setLanguage}
                />
              </div>

              <div>
                <label className="block text-base lg:text-xs font-bold tracking-[0.08em] uppercase mb-2 lg:mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  Angle note (optional)
                </label>
                <textarea
                  id="angle-note"
                  value={angleNote}
                  onChange={(e) => setAngleNote(e.target.value)}
                  placeholder="Fresh angle, audience, or hook for the repurpose lane"
                  rows={3}
                  className="w-full px-4 py-4 rounded-2xl text-[16px] resize-none"
                  style={{
                    background: 'white',
                    border: '1px solid rgba(var(--border-rgb), 0.15)',
                    color: 'var(--foreground)',
                    lineHeight: '1.6'
                  }}
                />
              </div>
            </div>
          </MobileSection>

          <MobileSection>
            <div className="space-y-2">
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={isGenerating}
                style={{ width: '100%' }}
              >
                {isGenerating ? "Generating..." : "Generate and save campaign"}
              </Button>
              <button
                onClick={onOpenLibrary}
                className="w-full text-sm font-semibold py-2"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Open library
              </button>
            </div>
          </MobileSection>

          {/* Generation Progress */}
          {isGenerating && (
            <MobileSection>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Ready.</p>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Standalone marketing cost will appear here.</p>
            </MobileSection>
          )}

          {/* Generated Output */}
          {isComplete && (
            <>
              <MobileSection>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {articleTitle || 'Campaign'} — saved
                  </p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}>
                    $0.0578
                  </span>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>Standalone repurpose · {language}</p>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(var(--border-rgb), 0.12)' }}>
                  <div className="h-full" style={{ width: '100%', background: 'var(--primary)' }} />
                </div>
              </MobileSection>

              <MobileSection>
                {/* Platform tabs */}
                <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'var(--secondary)' }}>
                  {platforms.map((platform) => (
                    <button
                      key={platform}
                      onClick={() => setSelectedPlatform(platform)}
                      className="flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: selectedPlatform === platform ? '#fff' : 'transparent',
                        color: selectedPlatform === platform ? 'var(--foreground)' : 'var(--muted-foreground)',
                        boxShadow: selectedPlatform === platform ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {platformLabels[platform].replace(' Note', '')}
                    </button>
                  ))}
                </div>

                {/* Content */}
                {selectedPlatform === "substack" ? (
                  <textarea
                    value={mockPosts.substack}
                    readOnly
                    rows={8}
                    className="w-full p-4 rounded-xl text-sm mb-4 resize-none leading-relaxed"
                    style={{
                      background: 'var(--secondary)',
                      border: '1px solid rgba(var(--border-rgb), 0.12)',
                      color: 'var(--foreground)'
                    }}
                  />
                ) : selectedPlatform === "instagram" ? (
                  <>
                    <textarea
                      value={mockPosts.instagram.split('\n\n---\n\n')[0]}
                      readOnly
                      rows={5}
                      className="w-full p-4 rounded-xl text-sm mb-3 resize-none"
                      style={{
                        background: 'var(--secondary)',
                        border: '1px solid rgba(var(--border-rgb), 0.12)',
                        color: 'var(--foreground)'
                      }}
                    />
                    <div className="space-y-3 mb-4">
                      <Input placeholder="Image prompt (leave blank to auto-generate)" style={{ fontSize: '0.875rem' }} />
                      <Input placeholder="Paste public image URL…" style={{ fontSize: '0.875rem' }} />
                    </div>
                  </>
                ) : (
                  <textarea
                    value={mockPosts[selectedPlatform]}
                    readOnly
                    rows={8}
                    className="w-full p-4 rounded-xl text-sm mb-4 resize-none leading-relaxed"
                    style={{
                      background: 'var(--secondary)',
                      border: '1px solid rgba(var(--border-rgb), 0.12)',
                      color: 'var(--foreground)'
                    }}
                  />
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'rgba(var(--border-rgb), 0.1)' }}>
                  <Button variant="ghost" onClick={handleCopy} style={{ flex: 1 }}>Copy</Button>
                  <Button variant="primary" style={{ flex: 1 }}>Publish</Button>
                  <Button variant="secondary" onClick={() => setShowScheduleModal(true)} style={{ flex: 1 }}>Schedule</Button>
                </div>
              </MobileSection>
            </>
          )}
        </div>
      </div>

      {/* Desktop Version */}
      <div className="hidden lg:block pt-6">
        {/* Header with Action Button */}
        <div className="flex items-center justify-end mb-4">
          <Button
            variant="secondary"
            onClick={handleNew}
            style={{ 
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            New campaign
          </Button>
        </div>

        <Card>
          {/* Article Source Section */}
          <Eyebrow>Article source</Eyebrow>
          <SectionTitle className="mb-4">Upload or paste your source article</SectionTitle>

          <div className="flex gap-2 sm:gap-3 mb-5">
            <CardButton
              icon={<Upload className="w-5 h-5 lg:w-4 lg:h-4" />}
              label="From article"
              isActive={articleSource === "upload"}
              onClick={() => setArticleSource("upload")}
            />
            <CardButton
              icon={<FileText className="w-5 h-5 lg:w-4 lg:h-4" />}
              label="Custom prompt"
              isActive={articleSource === "paste"}
              onClick={() => setArticleSource("paste")}
            />
          </div>

          {uploadedFileName ? (
            <div>
              <div
                className="p-4 rounded-xl flex items-center justify-between"
                style={{
                  background: 'var(--secondary)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'rgba(var(--border-rgb), 0.12)'
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ background: 'rgba(var(--primary-rgb), 0.1)' }}
                  >
                    <FileText className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--foreground)' }}>
                      {articleTitle || 'Untitled Article'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {uploadedFileName}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowFullArticle(!showFullArticle)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    color: 'var(--primary)',
                    background: 'transparent'
                  }}
                >
                  {showFullArticle ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show full article
                    </>
                  )}
                </button>
              </div>

              {showFullArticle && articleText && (
                <div
                  className="mt-3 p-4 rounded-xl text-sm max-h-60 overflow-y-auto"
                  style={{
                    background: 'var(--secondary)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(var(--border-rgb), 0.12)',
                    color: 'var(--muted-foreground)'
                  }}
                >
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                    {articleText}
                  </pre>
                </div>
              )}
            </div>
          ) : articleSource === "upload" ? (
            <Dropzone
              label="Drop article markdown here"
              description="Title and slug are extracted from the file automatically."
              onFileUpload={handleFileUpload}
            />
          ) : (
            <div style={{ height: '400px' }}>
              <Label htmlFor="paste-text" className="mb-2 block">Article text</Label>
              <WYSIWYGEditor
                value={articleText}
                onChange={setArticleText}
                placeholder="Paste your article text here..."
              />
            </div>
          )}

          {/* Extracted Metadata - Only show if we have a title */}
          {articleTitle && (
            <CardSection>
              <div className="flex items-center justify-between mb-4">
                <Eyebrow>Extracted metadata</Eyebrow>
                <button
                  onClick={() => setEditingMetadata(!editingMetadata)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    color: 'var(--primary)',
                    background: editingMetadata ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent'
                  }}
                >
                  {editingMetadata ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Done
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit metadata
                    </>
                  )}
                </button>
              </div>

              {editingMetadata ? (
                <div className="space-y-4">
                  <Field>
                    <Label htmlFor="edit-title">Article title</Label>
                    <Input
                      id="edit-title"
                      value={articleTitle}
                      onChange={(e) => setArticleTitle(e.target.value)}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <Label htmlFor="edit-slug">Slug</Label>
                      <Input
                        id="edit-slug"
                        value={articleSlug}
                        onChange={(e) => setArticleSlug(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="edit-date">Publish date</Label>
                      <Input
                        id="edit-date"
                        value={publishDate}
                        onChange={(e) => setPublishDate(e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field>
                    <Label htmlFor="edit-url">Article URL</Label>
                    <Input
                      id="edit-url"
                      value={articleUrl}
                      onChange={(e) => setArticleUrl(e.target.value)}
                    />
                  </Field>
                </div>
              ) : (
                <div
                  className="p-4 rounded-xl grid grid-cols-2 gap-x-8 gap-y-3"
                  style={{
                    background: 'var(--secondary)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(var(--border-rgb), 0.12)'
                  }}
                >
                  <div>
                    <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>TITLE</div>
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{articleTitle}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>SLUG</div>
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{articleSlug || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>URL</div>
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--muted-foreground)' }}>{articleUrl || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>PUBLISH DATE</div>
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{publishDate || '—'}</div>
                  </div>
                </div>
              )}
            </CardSection>
          )}

          <CardSection>
            <Eyebrow>Generation settings</Eyebrow>
            <SectionTitle className="mb-4">Configure output preferences</SectionTitle>

            <div className="space-y-4">
              <Field>
                <Label htmlFor="gen-language">Language</Label>
                <CustomSelect
                  id="gen-language"
                  options={[
                    { value: "English", label: "English" },
                    { value: "Spanish", label: "Spanish" }
                  ]}
                  value={language}
                  onChange={setLanguage}
                />
              </Field>

              <Field>
                <Label htmlFor="gen-angle">Angle note</Label>
                <textarea
                  id="gen-angle"
                  value={angleNote}
                  onChange={(e) => setAngleNote(e.target.value)}
                  placeholder="Fresh angle, audience, or hook for the repurpose lane"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl text-sm resize-none"
                  style={{
                    background: 'var(--secondary)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(var(--border-rgb), 0.12)',
                    color: 'var(--foreground)'
                  }}
                />
              </Field>
            </div>
          </CardSection>

          {/* Primary Action */}
          <div className="mt-6 pt-6 border-t" style={{ borderTopColor: 'rgba(var(--border-rgb), 0.14)' }}>
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{ 
                width: '100%',
                padding: '16px',
                fontSize: '15px',
                fontWeight: 700
              }}
            >
              {isGenerating ? "Generating campaign..." : "Generate social campaign"}
            </Button>
            <p className="text-center text-xs mt-3" style={{ color: 'var(--muted-foreground)' }}>
              Estimated time: 30-45 seconds · Cost: $0.12
            </p>
          </div>
        </Card>

        {/* Generation Progress */}
        {isGenerating && (
          <Card className="mt-4">
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Ready.</p>
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Standalone marketing cost will appear here.</p>
          </Card>
        )}

        {/* Generated Output */}
        {isComplete && (
          <Card className="mt-4">
            {/* Result header */}
            <div className="flex items-center justify-between mb-5 pb-5 border-b" style={{ borderColor: 'rgba(var(--border-rgb), 0.12)' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {articleTitle || 'Campaign'} — saved to library
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  Standalone repurpose · {language}
                </p>
              </div>
              <span className="text-sm font-bold px-3 py-1 rounded-lg" style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}>
                $0.0578
              </span>
            </div>

            {/* Controls bar: platform tabs */}
            <div className="flex items-center gap-3 mb-5 pb-5 border-b" style={{ borderColor: 'rgba(var(--border-rgb), 0.12)' }}>
              <div className="flex gap-1 p-1 rounded-xl flex-1" style={{ background: 'var(--secondary)' }}>
                {platforms.map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setSelectedPlatform(platform)}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: selectedPlatform === platform ? '#fff' : 'transparent',
                      color: selectedPlatform === platform ? 'var(--foreground)' : 'var(--muted-foreground)',
                      boxShadow: selectedPlatform === platform ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {platformLabels[platform].replace(' Note', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Content area */}
            <div className="mb-5">
              {selectedPlatform === "substack" ? (
                <WYSIWYGEditor
                  value={mockPosts.substack}
                  onChange={() => {}}
                  placeholder="Substack note content..."
                />
              ) : selectedPlatform === "instagram" ? (
                <>
                  <textarea
                    value={mockPosts.instagram.split('\n\n---\n\n')[0]}
                    readOnly
                    rows={6}
                    className="w-full p-4 rounded-xl text-sm mb-4 resize-none"
                    style={{
                      background: 'var(--secondary)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'rgba(var(--border-rgb), 0.12)',
                      color: 'var(--foreground)'
                    }}
                  />
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <Field>
                      <Label>Image prompt</Label>
                      <Input placeholder="(leave blank to auto-generate)" />
                    </Field>
                    <Field>
                      <Label>Image URL</Label>
                      <Input placeholder="Paste public image URL…" />
                    </Field>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                    Paste a local path (e.g. /static/generation.jpg) or any public URL — Instagram uploads directly from disk.
                  </p>
                </>
              ) : (
                <textarea
                  value={mockPosts[selectedPlatform]}
                  readOnly
                  rows={12}
                  className="w-full p-4 rounded-xl text-sm resize-none leading-relaxed"
                  style={{
                    background: 'var(--secondary)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(var(--border-rgb), 0.12)',
                    color: 'var(--foreground)'
                  }}
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-4 border-t" style={{ borderColor: 'rgba(var(--border-rgb), 0.12)' }}>
              <Button variant="ghost" onClick={handleCopy}>Copy</Button>
              <Button variant="secondary">Publish now</Button>
              <Button variant="secondary" onClick={() => setShowScheduleModal(true)}>Schedule</Button>
              <div className="flex-1" />
              <Button variant="ghost" onClick={handleNew}>New campaign</Button>
            </div>
          </Card>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowScheduleModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{
              background: 'var(--card)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="p-2.5 rounded-xl"
                  style={{ background: 'rgba(var(--primary-rgb), 0.1)' }}
                >
                  <Calendar className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                </div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  Schedule Post
                </h2>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 rounded-lg transition-all hover:bg-black/5"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Info */}
            <div
              className="mb-5 p-4 rounded-xl"
              style={{
                background: 'var(--secondary)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'rgba(var(--border-rgb), 0.12)'
              }}
            >
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
                {platformLabels[selectedPlatform]} · Standalone campaign
              </div>
              <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                Fresh socials from the standalone generator
              </div>
            </div>

            {/* Form Fields */}
            <Field>
              <Label htmlFor="schedule-date">Publication date</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </Field>

            <Field>
              <Label htmlFor="schedule-time">Publication time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </Field>

            <Field>
              <Label htmlFor="schedule-timezone">Timezone</Label>
              <CustomSelect
                id="schedule-timezone"
                options={timezones}
                value={scheduleTimezone}
                onChange={setScheduleTimezone}
              />
            </Field>

            <p className="text-xs mb-5" style={{ color: 'var(--muted-foreground)' }}>
              Posts will be published automatically at the scheduled time. You can view and manage scheduled posts in the Marketing dashboard.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowScheduleModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSchedule}
                disabled={!scheduleDate || !scheduleTime}
                style={{ flex: 1 }}
              >
                Confirm Schedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}