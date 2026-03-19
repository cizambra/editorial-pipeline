import { useState, useEffect } from "react";
import { Quote, Upload, FileText, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Plus, Minus, Copy, Lightbulb, X } from "lucide-react";
import { Card, Eyebrow, SectionTitle } from "./Card";
import { MobileSection } from "./MobileSection";
import { Button, Dropzone, Field, Label, Description, Input, TextArea } from "./FormComponents";
import { CustomSelect } from "./CustomSelect";

type QuoteItem = {
  id: string;
  text: string;
  context: string;
  category: "OBSERVATION" | "INSIGHT" | "RULE" | "ANALOGY";
  shared: boolean;
};

type ArticleWithQuotes = {
  id: string;
  title: string;
  quoteCount: number;
  timestamp: string;
  quotes: QuoteItem[];
};

export function QuotesView() {
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [quotesSearchQuery, setQuotesSearchQuery] = useState("");
  const [uploadMethod, setUploadMethod] = useState<"file" | "paste">("file");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleText, setArticleText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [showFullArticle, setShowFullArticle] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mock data for articles with quotes
  const articlesWithQuotes: ArticleWithQuotes[] = [
    {
      id: "article-1",
      title: "You Don't Have Unlimited Bandwidth",
      quoteCount: 7,
      timestamp: "4d ago",
      quotes: [
        {
          id: "q1",
          text: "Nobody has unlimited bandwidth. Anyone who tells you they do is selling something.",
          context: "A bold, self-contained claim that works as truth about human capacity.",
          category: "OBSERVATION",
          shared: false
        },
        {
          id: "q2",
          text: "Building for them turns effort into meaning, and meaning changes how tired feels.",
          context: "A vivid insight about the psychology of fatigue that stands alone as a principle.",
          category: "INSIGHT",
          shared: true
        },
        {
          id: "q3",
          text: "The load is not only the amount of work. It's the cost of switching.",
          context: "A counterintuitive reframing of what actually drains bandwidth—sharp enough for social media.",
          category: "INSIGHT",
          shared: false
        },
        {
          id: "q4",
          text: "You technically have time; you care about the thing; you sit down. And starting still feels expensive; not because you're lazy, and not because you lack discipline, but because you're switching lanes all day, and every lane change leaves residue.",
          context: "Concrete explanation of why capable people procrastinate—shifts blame from character to mechanics.",
          category: "OBSERVATION",
          shared: true
        },
        {
          id: "q5",
          text: "If you don't know your capacity, you can't set boundaries with integrity.",
          context: "A direct rule about the relationship between self-knowledge and personal integrity.",
          category: "RULE",
          shared: false
        },
        {
          id: "q6",
          text: "It's why capable people start feeling unreliable, not because they lost ambition, but because they're paying the switching tax all day without accounting for it.",
          context: "A paradox that reframes why high-performers struggle—works as standalone insight.",
          category: "OBSERVATION",
          shared: false
        },
        {
          id: "q7",
          text: "In software, a CPU can make it look like many things are happening at once by switching with overhead. Every switch requires the machine to reload context. It looks similar.",
          context: "A vivid technical analogy that illustrates how the mind actually works under load.",
          category: "ANALOGY",
          shared: false
        }
      ]
    },
    {
      id: "article-2",
      title: "The Hidden Cost of Context Switching",
      quoteCount: 5,
      timestamp: "1w ago",
      quotes: []
    },
    {
      id: "article-3",
      title: "Building Creative Momentum",
      quoteCount: 12,
      timestamp: "2w ago",
      quotes: []
    }
  ];

  const selectedArticleData = articlesWithQuotes.find(a => a.id === selectedArticle);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "OBSERVATION": return { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb' };
      case "INSIGHT": return { bg: 'rgba(168, 85, 247, 0.15)', text: '#7c3aed' };
      case "RULE": return { bg: 'rgba(234, 179, 8, 0.15)', text: '#a16207' };
      case "ANALOGY": return { bg: 'rgba(16, 185, 129, 0.15)', text: '#059669' };
      default: return { bg: 'rgba(var(--primary-rgb), 0.15)', text: 'var(--primary)' };
    }
  };

  return (
    <div className="pb-20 lg:pb-0">
      {/* Desktop Layout */}
      <div className="hidden lg:block pt-6">
        {/* Upload Form Section - Always Visible */}
        <Card className="mb-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6 pb-6" style={{ borderBottom: '1px solid rgba(var(--border-rgb), 0.12)' }}>
            <div className="flex-1 min-w-0">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase inline-block mb-2" style={{ background: 'rgba(var(--primary-rgb), 0.15)', color: 'var(--primary)' }}>
                UPLOAD
              </span>
              <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                Extract Quotes from Article
              </h3>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Upload a file or paste your article text to extract meaningful quotes
              </p>
            </div>
          </div>

          {/* Form Content */}
          <div className="space-y-6">
            {/* Method Tabs */}
            <div>
              <label className="block text-base lg:text-xs font-bold tracking-[0.08em] uppercase mb-3 lg:mb-2" style={{ color: 'var(--muted-foreground)' }}>
                ARTICLE SOURCE
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setUploadMethod("file")}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: uploadMethod === "file" ? 'var(--primary)' : 'var(--secondary)',
                    color: uploadMethod === "file" ? '#ffffff' : 'var(--muted-foreground)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: uploadMethod === "file" ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.12)'
                  }}
                >
                  <Upload className="w-4 h-4 inline-block mr-2" />
                  Upload File
                </button>
                <button
                  onClick={() => setUploadMethod("paste")}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: uploadMethod === "paste" ? 'var(--primary)' : 'var(--secondary)',
                    color: uploadMethod === "paste" ? '#ffffff' : 'var(--muted-foreground)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: uploadMethod === "paste" ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.12)'
                  }}
                >
                  <FileText className="w-4 h-4 inline-block mr-2" />
                  Paste Text
                </button>
              </div>
            </div>

            {/* Article Title - Full Width */}
            <Field>
              <Label htmlFor="article-title">Article Title</Label>
              <Description>The title that will identify this article in your library</Description>
              <Input
                id="article-title"
                type="text"
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="Enter article title..."
              />
            </Field>

            {/* Conditional Content Based on Method */}
            {uploadMethod === "paste" ? (
              <Field>
                <Label htmlFor="article-text">Article Text</Label>
                <Description>Paste the full article content to extract quotes from</Description>
                <TextArea
                  id="article-text"
                  value={articleText}
                  onChange={(e) => setArticleText(e.target.value)}
                  placeholder="Paste your article text here..."
                  rows={10}
                />
              </Field>
            ) : uploadedFileName ? (
              <Field>
                <Label>Upload File</Label>
                <Description>Your uploaded file is ready for quote extraction</Description>
                <div>
                  <div
                    className="p-4 rounded-xl flex items-center justify-between mb-4"
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
                      className="p-4 rounded-xl text-sm max-h-60 overflow-y-auto"
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
              </Field>
            ) : (
              <Field>
                <Label>Upload File</Label>
                <Description>Drop your article file or click to browse from your computer</Description>
                <Dropzone
                  label="Drop a file here or click to browse"
                  description="Supports .txt, .md, .doc, .docx files"
                  onFileUpload={(file) => {
                    setUploadedFileName(file.name);
                    // Simulate extracting content from file
                    setArticleText(`Sample article content from ${file.name}...\n\nThis would be the actual file content in the real application.`);
                  }}
                />
              </Field>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-6" style={{ borderTop: '1px solid rgba(var(--border-rgb), 0.12)' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setArticleTitle("");
                  setArticleText("");
                  setUploadedFileName("");
                }}
              >
                Clear
              </Button>
              <Button
                variant="primary"
                disabled={!articleTitle || (uploadMethod === "paste" && !articleText) || isExtracting}
                onClick={() => {
                  setIsExtracting(true);
                  // Simulate extraction
                  setTimeout(() => {
                    setIsExtracting(false);
                    setArticleTitle("");
                    setArticleText("");
                    setUploadedFileName("");
                    // In real app, this would add the new article to the list
                    alert("Quote extraction complete! The article has been added to your library.");
                  }, 2000);
                }}
                className="flex items-center gap-2"
              >
                {isExtracting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Quote className="w-4 h-4" />
                    Extract Quotes
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Two-Column Layout */}
        <div className="flex gap-6">
          {/* Left Panel - Articles List */}
          <div className="w-80 flex-shrink-0 flex flex-col space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {articlesWithQuotes.reduce((sum, a) => sum + a.quoteCount, 0)} quotes
              </span>
            </div>

            {/* Article List */}
            <Card className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              <div className="space-y-2">
                <div className="pb-2 mb-3" style={{ borderBottom: '1px solid rgba(var(--border-rgb), 0.12)' }}>
                  <p className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--text-subtle)' }}>
                    PIPELINE RUNS
                  </p>
                </div>
                {articlesWithQuotes.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => setSelectedArticle(article.id)}
                    className="w-full text-left px-3 py-3 rounded-xl transition-all"
                    style={{
                      background: selectedArticle === article.id ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: selectedArticle === article.id ? 'var(--primary)' : 'transparent'
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-semibold leading-tight flex-1" style={{ color: 'var(--foreground)' }}>
                        {article.title}
                      </h4>
                      {selectedArticle === article.id && (
                        <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      <span className="font-semibold">{article.quoteCount} quotes</span>
                      <span>•</span>
                      <span>{article.timestamp}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Panel - Quotes Detail */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {selectedArticleData ? (
              <>
                {/* Header - Fixed */}
                <Card className="mb-4 flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase inline-block mb-2" style={{ background: 'rgba(var(--primary-rgb), 0.15)', color: 'var(--primary)' }}>
                        QUOTES
                      </span>
                      <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                        {selectedArticleData.title}
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        {selectedArticleData.quoteCount} quotes extracted
                      </p>
                    </div>
                    <Button variant="secondary" className="flex-shrink-0">
                      Refresh
                    </Button>
                  </div>
                </Card>

                {/* Quotes List - Scrollable */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2" style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(var(--primary-rgb), 0.3) transparent'
                }}>
                  {selectedArticleData.quotes.map((quote) => {
                    const colors = getCategoryColor(quote.category);
                    return (
                      <Card key={quote.id}>
                        <div className="space-y-4">
                          {/* Quote Text */}
                          <div
                            className="pl-4 italic text-sm leading-relaxed"
                            style={{
                              borderLeft: '3px solid #c4522a',
                              color: 'var(--foreground)'
                            }}
                          >
                            {quote.text}
                          </div>

                          {/* Context */}
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                            {quote.context}
                          </p>

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(var(--border-rgb), 0.08)' }}>
                            <div className="flex items-center gap-2">
                              <span
                                className="px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase"
                                style={{
                                  background: colors.bg,
                                  color: colors.text
                                }}
                              >
                                {quote.category}
                              </span>
                              <button
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-opacity-80"
                                style={{
                                  background: quote.shared ? 'rgba(16, 185, 129, 0.15)' : 'var(--secondary)',
                                  color: quote.shared ? '#059669' : 'var(--muted-foreground)'
                                }}
                              >
                                {quote.shared ? '✓ Shared' : 'Mark shared'}
                              </button>
                              <button
                                className="p-1.5 rounded-lg transition-all hover:bg-opacity-80"
                                style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                                title="Thumbs up"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                className="p-1.5 rounded-lg transition-all hover:bg-opacity-80"
                                style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                                title="Thumbs down"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <button
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-opacity-80 flex items-center gap-1.5"
                                style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                              >
                                <Copy className="w-3.5 h-3.5" />
                                Copy
                              </button>
                              <button
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-opacity-80 flex items-center gap-1.5"
                                style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                              >
                                Repurpose →
                              </button>
                            </div>
                            <button
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-opacity-80 flex items-center gap-1.5"
                              style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}
                            >
                              <Lightbulb className="w-3.5 h-3.5" />
                              → Ideas
                            </button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : (
              <Card className="text-center py-12">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(var(--primary-rgb), 0.1)' }}
                >
                  <Quote className="w-8 h-8" style={{ color: 'var(--primary)' }} />
                </div>
                <h3
                  className="text-lg mb-2 font-bold"
                  style={{ color: 'var(--foreground)' }}
                >
                  No article selected
                </h3>
                <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--muted-foreground)' }}>
                  Select an article from the list to view its quotes
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        {!showUploadModal && !selectedArticle ? (
          <>
            <div className="pt-4 pb-20">
              {/* Extract Button - Prominent */}
              <div className="px-4 mb-4">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="w-full p-4 rounded-2xl text-center transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{
                    background: 'var(--primary)',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(var(--primary-rgb), 0.3)'
                  }}
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-[15px] font-semibold">Extract Quotes from Article</span>
                </button>
              </div>

              {/* Articles List */}
              <div className="space-y-2.5 px-4">
                {articlesWithQuotes.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => setSelectedArticle(article.id)}
                    className="w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]"
                    style={{
                      background: 'white',
                      border: '1px solid rgba(var(--border-rgb), 0.12)',
                      boxShadow: '0 1px 3px rgba(var(--border-rgb), 0.06)'
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-[15px] font-bold flex-1 leading-tight" style={{ color: 'var(--foreground)' }}>
                        {article.title}
                      </h4>
                      <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                    </div>
                    <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                      <span className="font-semibold">{article.quoteCount} quotes</span>
                      <span>•</span>
                      <span>{article.timestamp}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : showUploadModal && !selectedArticle ? (
          /* Mobile: Upload Modal */
          <div 
            className="fixed inset-0 z-50 flex flex-col"
            style={{ 
              background: 'var(--background)',
              animation: 'slideInRight 0.2s cubic-bezier(0.22, 1, 0.36, 1)'
            }}
          >
            {/* Header */}
            <div 
              className="flex-shrink-0 px-4 pt-4 pb-4 flex items-center gap-3" 
              style={{ background: 'var(--background)', borderBottom: '1px solid rgba(var(--border-rgb), 0.12)' }}
            >
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setArticleTitle("");
                  setArticleText("");
                  setUploadedFileName("");
                }}
                className="p-2 -ml-1 rounded-xl active:bg-black active:bg-opacity-5"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex-1">
                <h3 className="text-[18px] font-bold" style={{ color: 'var(--foreground)' }}>
                  Extract Quotes
                </h3>
                <p className="text-[13px]" style={{ color: 'var(--text-subtle)' }}>
                  from article text or file
                </p>
              </div>
            </div>

            {/* Method Selector */}
            <div className="flex-shrink-0 px-4 pt-4 pb-3" style={{ background: 'var(--background)' }}>
              <div className="flex gap-2.5 p-1.5 rounded-2xl" style={{ background: 'white' }}>
                <button
                  onClick={() => setUploadMethod("file")}
                  className="flex-1 px-4 py-3 rounded-xl text-[14px] font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: uploadMethod === "file" ? 'var(--primary)' : 'transparent',
                    color: uploadMethod === "file" ? '#ffffff' : 'var(--muted-foreground)',
                    boxShadow: uploadMethod === "file" ? '0 2px 8px rgba(var(--primary-rgb), 0.25)' : 'none'
                  }}
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
                <button
                  onClick={() => setUploadMethod("paste")}
                  className="flex-1 px-4 py-3 rounded-xl text-[14px] font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: uploadMethod === "paste" ? 'var(--primary)' : 'transparent',
                    color: uploadMethod === "paste" ? '#ffffff' : 'var(--muted-foreground)',
                    boxShadow: uploadMethod === "paste" ? '0 2px 8px rgba(var(--primary-rgb), 0.25)' : 'none'
                  }}
                >
                  <FileText className="w-4 h-4" />
                  Paste
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div 
              className="flex-1 overflow-y-auto px-4 py-2 space-y-6"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {/* Article Title Section */}
              <div>
                <Eyebrow>Article information</Eyebrow>
                <SectionTitle className="mb-4">What should we call this?</SectionTitle>
                <input
                  type="text"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  placeholder="Enter article title..."
                  className="w-full px-4 py-3.5 rounded-2xl text-[16px]"
                  style={{
                    background: 'white',
                    border: '1px solid rgba(var(--border-rgb), 0.15)',
                    color: 'var(--foreground)'
                  }}
                />
              </div>

              {/* Content Input Section */}
              {uploadMethod === "paste" ? (
                <div>
                  <Eyebrow>Article source</Eyebrow>
                  <SectionTitle className="mb-4">
                    Paste your article text
                  </SectionTitle>
                  <textarea
                    value={articleText}
                    onChange={(e) => setArticleText(e.target.value)}
                    placeholder="Paste your article text here..."
                    rows={14}
                    className="w-full px-4 py-4 rounded-2xl text-[16px] resize-none"
                    style={{
                      background: 'white',
                      border: '1px solid rgba(var(--border-rgb), 0.15)',
                      color: 'var(--foreground)',
                      lineHeight: '1.6'
                    }}
                  />
                </div>
              ) : (
                <div>
                  <Eyebrow>Article source</Eyebrow>
                  <SectionTitle className="mb-4">
                    Upload your article file
                  </SectionTitle>
                  {uploadedFileName ? (
                    <div
                      className="p-4 rounded-2xl flex items-center gap-3"
                      style={{
                        background: 'white',
                        border: '1px solid rgba(var(--border-rgb), 0.15)'
                      }}
                    >
                      <div
                        className="p-3 rounded-xl flex-shrink-0"
                        style={{ background: 'rgba(var(--primary-rgb), 0.1)' }}
                      >
                        <FileText className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-bold truncate mb-0.5" style={{ color: 'var(--foreground)' }}>
                          {articleTitle || 'Untitled Article'}
                        </div>
                        <div className="text-[13px] truncate" style={{ color: 'var(--text-subtle)' }}>
                          {uploadedFileName}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setUploadedFileName("");
                          setArticleText("");
                        }}
                        className="p-2.5 rounded-xl flex-shrink-0 active:scale-95 transition-all"
                        style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' }}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <label className="block">
                      <input
                        type="file"
                        accept=".txt,.md,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setUploadedFileName(file.name);
                            setArticleText(`Sample content from ${file.name}...`);
                          }
                        }}
                        className="hidden"
                      />
                      <div
                        className="p-10 rounded-2xl text-center cursor-pointer transition-all active:scale-[0.98]"
                        style={{
                          background: 'white',
                          border: '2px dashed rgba(var(--primary-rgb), 0.3)'
                        }}
                      >
                        <div 
                          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                          style={{ background: 'rgba(var(--primary-rgb), 0.1)' }}
                        >
                          <Upload className="w-8 h-8" style={{ color: 'var(--primary)' }} />
                        </div>
                        <div className="text-[17px] font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                          Tap to upload file
                        </div>
                        <div className="text-[14px]" style={{ color: 'var(--text-subtle)' }}>
                          Supports .txt, .md, .doc, .docx
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Fixed Bottom Actions */}
            <div 
              className="flex-shrink-0 p-4 space-y-3" 
              style={{ 
                background: 'var(--background)', 
                borderTop: '1px solid rgba(var(--border-rgb), 0.12)',
                paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))'
              }}
            >
              <button
                disabled={!articleTitle || (uploadMethod === "paste" && !articleText) || isExtracting}
                onClick={() => {
                  setIsExtracting(true);
                  setTimeout(() => {
                    setIsExtracting(false);
                    setArticleTitle("");
                    setArticleText("");
                    setUploadedFileName("");
                    setShowUploadModal(false);
                    alert("Quotes extracted!");
                  }, 2000);
                }}
                className="w-full px-6 py-4 rounded-2xl text-[17px] font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2.5"
                style={{
                  background: (!articleTitle || (uploadMethod === "paste" && !articleText) || isExtracting) ? '#e5ddd1' : 'var(--primary)',
                  color: '#fff',
                  boxShadow: (!articleTitle || (uploadMethod === "paste" && !articleText) || isExtracting) ? 'none' : '0 4px 12px rgba(var(--primary-rgb), 0.3)',
                  opacity: (!articleTitle || (uploadMethod === "paste" && !articleText) || isExtracting) ? 0.5 : 1
                }}
              >
                {isExtracting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Extracting Quotes...
                  </>
                ) : (
                  <>
                    <Quote className="w-5 h-5" />
                    Extract Quotes
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setArticleTitle("");
                  setArticleText("");
                  setUploadedFileName("");
                }}
                className="w-full px-6 py-4 rounded-2xl text-[17px] font-bold transition-all active:scale-[0.98]"
                style={{
                  background: 'white',
                  color: 'var(--muted-foreground)',
                  border: '1px solid rgba(var(--border-rgb), 0.12)'
                }}
              >
                Clear Form
              </button>
            </div>
          </div>
        ) : selectedArticle && !showUploadModal ? (
          /* Mobile: Article Detail Modal */
          <div 
            className="fixed inset-0 z-50 flex flex-col"
            style={{ 
              background: 'var(--background)',
              animation: 'slideInRight 0.2s cubic-bezier(0.22, 1, 0.36, 1)'
            }}
          >
            {/* Header */}
            <div 
              className="flex-shrink-0 px-3 pt-4 pb-3 flex items-center gap-3" 
              style={{ background: 'var(--background)', borderBottom: '1px solid rgba(var(--border-rgb), 0.08)' }}
            >
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-2 -ml-1 rounded-xl active:bg-black active:bg-opacity-5"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-bold truncate" style={{ color: 'var(--foreground)' }}>
                  {selectedArticleData?.title}
                </h3>
                <p className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>
                  {selectedArticleData?.quoteCount} quotes
                </p>
              </div>
            </div>

            {/* Scrollable Quotes */}
            <div 
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {selectedArticleData?.quotes.map((quote) => {
                const colors = getCategoryColor(quote.category);
                return (
                  <div
                    key={quote.id}
                    className="p-4 rounded-2xl"
                    style={{
                      background: 'var(--card)',
                      border: '1px solid rgba(var(--border-rgb), 0.08)',
                      boxShadow: '0 1px 3px rgba(var(--border-rgb), 0.06)'
                    }}
                  >
                    {/* Quote Text */}
                    <div
                      className="pl-3 italic text-[14px] leading-relaxed mb-3"
                      style={{
                        borderLeft: '3px solid #c4522a',
                        color: 'var(--foreground)'
                      }}
                    >
                      {quote.text}
                    </div>

                    {/* Context */}
                    <p className="text-[12px] leading-relaxed mb-3" style={{ color: 'var(--muted-foreground)' }}>
                      {quote.context}
                    </p>

                    {/* Category Badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase"
                        style={{
                          background: colors.bg,
                          color: colors.text
                        }}
                      >
                        {quote.category}
                      </span>
                      {quote.shared && (
                        <span
                          className="px-2 py-1 rounded text-[10px] font-bold"
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#059669'
                          }}
                        >
                          ✓ Shared
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid rgba(var(--border-rgb), 0.06)' }}>
                      <button
                        className="flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        style={{ background: 'rgba(255, 250, 241, 0.5)', color: 'var(--muted-foreground)' }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                      <button
                        className="flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all active:scale-95"
                        style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}
                      >
                        Repurpose
                      </button>
                      <button
                        className="p-2 rounded-lg transition-all active:scale-95"
                        style={{ background: 'rgba(255, 250, 241, 0.5)', color: 'var(--muted-foreground)' }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 rounded-lg transition-all active:scale-95"
                        style={{ background: 'rgba(255, 250, 241, 0.5)', color: 'var(--muted-foreground)' }}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}