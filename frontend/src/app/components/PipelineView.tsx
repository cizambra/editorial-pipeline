import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Upload, FileText, CheckCircle, XCircle, Clock, Copy, ExternalLink, ChevronDown, Megaphone, ChevronLeft, ChevronUp, Edit2, Check, Loader2 } from "lucide-react";
import { ThumbnailConceptsPanel } from "./ThumbnailConceptsPanel";
import { PageHeader } from "./PageHeader";
import { Card, CardSection, Eyebrow, SectionTitle } from "./Card";
import { Field, Label, Input, TextArea, Dropzone, Button, SegmentedControl, Toggle, CardButton } from "./FormComponents";
import { MobileSection } from "./MobileSection";
import { WYSIWYGEditor } from "./WYSIWYGEditor";
import { CustomSelect } from "./CustomSelect";
import { SegmentedTabs } from "./mobile";
import { pipeline } from "../../lib/api";
import { usePipeline, PIPELINE_STAGE_NAMES } from "../../lib/pipeline-context";


const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  threads: "Threads",
  instagram: "Instagram",
  substack_note: "Substack",
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
    return <p className="text-sm py-6 text-center" style={{ color: "var(--text-subtle)" }}>No social posts generated yet.</p>;
  }

  const platformTabs = availablePlatforms.map((p) => ({
    value: p,
    label: (PLATFORM_LABELS[p] ?? p).replace(" Note", ""),
  }));

  return (
    <div className="space-y-3">
      <div className={mobile ? "space-y-2" : "flex items-center gap-3"}>
        {hasReflection && hasCompanion && (
          <div style={mobile ? undefined : { minWidth: "140px" }}>
            <CustomSelect
              options={SOURCE_OPTIONS}
              value={source}
              onChange={(v) => setSource(v as "reflection" | "companion")}
            />
          </div>
        )}
        {platformTabs.length > 0 && (
          <SegmentedTabs
            tabs={platformTabs}
            value={activePlatform}
            onChange={setPlatform}
            size="sm"
          />
        )}
      </div>

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


export function PipelineView() {
  const navigate = useNavigate();
  const { running, hasRun, pipelineStages, runData, runError, tokenSummary, startPipeline, cancelPipeline, resetPipeline, queueRun, pendingQueue } = usePipeline();

  const [language, setLanguage] = useState<"en" | "es">("en");
  const [showForm, setShowForm] = useState(false);
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [generateSpanish, setGenerateSpanish] = useState(true);
  const [autoThumbnail, setAutoThumbnail] = useState(false);
  const [socialTone, setSocialTone] = useState(5);
  const [articleText, setArticleText] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSlug, setArticleSlug] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [showFullArticle, setShowFullArticle] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState(false);

  // Load checkpoint on mount
  useEffect(() => {
    pipeline.checkpoint().then(cp => {
      if (cp?.exists && (cp.reflection_title || cp.title)) {
        setArticleTitle(cp.reflection_title ?? cp.title);
        setArticleUrl(cp.article_url ?? "");
        if (cp.reflection) setArticleText(cp.reflection);
      }
    }).catch(() => {});
  }, []);

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFileName(file.name);
    try {
      const text = await file.text();
      setArticleText(text);
      const filenameWithoutExt = file.name.replace(/\.(md|markdown|txt)$/i, '');
      const looksLikeTitle = /[A-Z\s]/.test(filenameWithoutExt);
      let title = '';
      if (looksLikeTitle) {
        title = filenameWithoutExt;
      } else {
        const h1Match = text.match(/^#\s+(.+)$/m);
        title = h1Match ? h1Match[1].trim() : filenameWithoutExt;
      }
      setArticleTitle(title);
      const slug = generateSlug(title);
      setArticleSlug(slug);
      setArticleUrl(`https://www.self-disciplined.com/p/${slug}`);
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  const resetFormFields = () => {
    setInputMode("file");
    setGenerateSpanish(true);
    setAutoThumbnail(false);
    setSocialTone(5);
    setArticleText("");
    setArticleTitle("");
    setArticleSlug("");
    setArticleUrl("");
    setUploadedFileName("");
  };

  const handleNew = () => {
    if (running) {
      // Pipeline still running — just show the form so user can queue another run
      setShowForm(true);
      resetFormFields();
    } else {
      // No active run — full reset
      resetPipeline();
      setShowForm(false);
      resetFormFields();
    }
  };

  const handleClearForm = handleNew;

  const handleRunPipeline = () => {
    if (!articleText || !articleTitle) return;
    // queueRun starts immediately if idle, queues if a run is in progress
    queueRun({ generateSpanish, autoThumbnail, articleText, articleTitle, articleUrl, uploadedFileName, socialTone });
    setShowForm(false);
  };

  const handleCancel = () => {
    cancelPipeline();
  };

  // On mobile: back arrow from run view → show form (to queue more) or full reset if done
  const handleMobileClose = () => {
    handleNew();
  };

  const stages = pipelineStages.length > 0
    ? pipelineStages.map((s, i) => ({ id: i + 1, name: s.label ?? s.stage, status: s.status === "done" ? "done" : s.status === "running" ? "running" : s.status === "skipped" ? "skipped" : "waiting" }))
    : PIPELINE_STAGE_NAMES.map((name, i) => ({ id: i + 1, name, status: "waiting" }));
  const showRunView = (running || hasRun || pipelineStages.length > 0 || !!runError) && !showForm;
  const completedStageCount = stages.filter((stage) => stage.status === "done").length;
  const fallbackArticleText = runData?._articleText || articleText;
  const activeAutoThumbnail = runData?._autoThumbnail ?? autoThumbnail;
  const activeRunLabel = runData?.run_id ? `Run #${runData.run_id}` : "Pipeline run";
  const liveStatus = String(runData?.status ?? "").toLowerCase();
  const displayTitle = runData?.reflection_title || articleTitle;
  const displayUrl = runData?.article_url || articleUrl;
  const articleWordCount = fallbackArticleText.trim() ? fallbackArticleText.trim().split(/\s+/).length : 0;
  const runCost = Number(tokenSummary?.estimated_cost_usd ?? runData?.cost ?? 0);

  const [activeContentTab, setActiveContentTab] = useState("reflection");
  const relatedArticles = Array.isArray(runData?.related_articles) ? runData.related_articles : [];
  const quotes = Array.isArray(runData?.quotes) ? runData.quotes : [];
  const runTags = Array.isArray(runData?.tags) ? runData.tags : [];
  const thumbnailConcepts = Array.isArray(runData?.thumbnailConcepts) ? runData.thumbnailConcepts : [];
  const reflectionPayload = runData?.reflection ?? {};
  const companionPayload = runData?.companion ?? {};
  const reflectionContent = language === "es" ? (reflectionPayload.es || "") : (reflectionPayload.en || fallbackArticleText);
  const companionContent = language === "es" ? (companionPayload.es || "") : (companionPayload.en || "");
  const reflectionSocial = language === "es" ? (reflectionPayload.repurposed_es || {}) : (reflectionPayload.repurposed_en || {});
  const companionSocial = language === "es" ? (companionPayload.repurposed_es || {}) : (companionPayload.repurposed_en || {});

  const contentTabOptions = [
    { value: "reflection", label: "Reflection" },
    { value: "companion", label: "Paid companion" },
    { value: "quotes", label: "Quotes" },
    { value: "social", label: "Social posts" },
    { value: "related", label: "Related articles" },
    ...(activeAutoThumbnail ? [{ value: "thumbnail", label: "Thumbnail concepts" }] : []),
  ];

  function TabContent({ mobile = false }: { mobile?: boolean }) {
    const editorHeight = mobile ? "400px" : "600px";
    const editorContent = activeContentTab === "companion" ? companionContent : reflectionContent;
    const currentStageStatus =
      activeContentTab === "companion"
        ? pipelineStages.find((stage) => stage.stage === "Companion")?.status
        : activeContentTab === "reflection" && language === "es"
          ? pipelineStages.find((stage) => stage.stage === "Translation")?.status
          : pipelineStages.find((stage) => stage.stage === "Reflection")?.status;
    const waitingForSelectedContent =
      (activeContentTab === "reflection" || activeContentTab === "companion") &&
      !editorContent.trim() &&
      (running || currentStageStatus === "waiting" || currentStageStatus === "running");

    return (
      <>
        {(activeContentTab === "reflection" || activeContentTab === "companion") && (
          <div style={{ height: editorHeight, borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            {waitingForSelectedContent ? (
              <div
                className="h-full flex flex-col items-center justify-center text-center px-6"
                style={{ background: "#fff" }}
              >
                {running && (
                  <Loader2 className="w-5 h-5 animate-spin mb-3" style={{ color: "var(--primary)" }} />
                )}
                <div className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                  {activeContentTab === "companion"
                    ? (language === "es" ? "Spanish companion is still generating." : "Companion article is still generating.")
                    : (language === "es" ? "Spanish reflection is still generating." : "Reflection is still generating.")}
                </div>
                <div className="text-xs max-w-sm" style={{ color: "var(--text-subtle)" }}>
                  {language === "es"
                    ? "Switch back to EN or wait for the translation stage to finish."
                    : "This section will appear automatically as soon as the current stage completes."}
                </div>
              </div>
            ) : (
              <WYSIWYGEditor
                value={editorContent}
                onChange={() => {}}
                placeholder={activeContentTab === "companion" ? "Companion article will appear here once the pipeline completes." : "Reflection will appear here once the pipeline completes."}
              />
            )}
          </div>
        )}
        {activeContentTab === "quotes" && (
          <div className="space-y-3">
            {quotes.length === 0
              ? <p className="text-sm py-6 text-center" style={{ color: 'var(--text-subtle)' }}>No quotes generated yet.</p>
              : quotes.map((quote: any, idx: number) => {
                  const quoteText = quote.quote_text || quote.text || "";
                  const quoteType = quote.quote_type || quote.type || "";
                  const quoteContext = quote.context || "";
                  return (
                    <div key={idx} className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(var(--border-rgb), 0.12)', borderLeft: '4px solid var(--primary)' }}>
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          {quoteType && (
                            <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded" style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}>
                              {quoteType}
                            </span>
                          )}
                          <button className="ml-auto p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-subtle)' }} onClick={() => navigator.clipboard.writeText(quoteText)}>
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-sm leading-relaxed italic" style={{ color: 'var(--foreground)' }}>"{quoteText}"</p>
                        {quoteContext && <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>{quoteContext}</p>}
                      </div>
                    </div>
                  );
                })
            }
          </div>
        )}
        {activeContentTab === "social" && (
          <SocialContent reflectionSocial={reflectionSocial} companionSocial={companionSocial} mobile={mobile} />
        )}
        {activeContentTab === "related" && (
          <div className="space-y-3">
            {relatedArticles.length === 0
              ? <p className="text-sm py-6 text-center" style={{ color: 'var(--text-subtle)' }}>No related articles found yet.</p>
              : relatedArticles.map((article: any, idx: number) => (
                  <div key={article.url || idx} className="p-4 rounded-xl" style={{ background: '#fff', border: '1px solid rgba(var(--border-rgb), 0.12)' }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-sm font-semibold flex-1" style={{ color: 'var(--foreground)' }}>{article.title}</div>
                      {article.type && (
                        <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded flex-shrink-0" style={{ background: 'rgba(var(--border-rgb), 0.1)', color: 'var(--muted-foreground)' }}>
                          {article.type}
                        </span>
                      )}
                    </div>
                    {article.url && (
                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1.5 hover:underline" style={{ color: 'var(--primary)' }}>
                        <ExternalLink className="w-3 h-3" />{article.url}
                      </a>
                    )}
                  </div>
                ))
            }
          </div>
        )}
        {activeContentTab === "thumbnail" && (
          <ThumbnailConceptsPanel
            concepts={thumbnailConcepts}
            emptyLabel={
              pipelineStages.find(s => s.stage === "Thumbnail")?.status === "running"
                ? "Generating thumbnail concepts…"
                : "No thumbnail concepts generated."
            }
          />
        )}
      </>
    );
  }

  return (
    <div className="pb-6 lg:pb-0">
      <PageHeader
        kicker="Full pipeline"
        title="Reflection to complete campaign"
        description="Upload your reflection article, configure translation and thumbnail options, then run the full editorial pipeline to generate all marketing content."
        action={
          <Button variant="secondary" onClick={handleNew}>
            New pipeline
          </Button>
        }
      />

      {!showRunView ? (
        /* ── Input Form ─────────────────────────────────────────── */
        <Card>
          <Eyebrow>Article source</Eyebrow>
          <SectionTitle className="mb-4">Upload or paste your reflection article</SectionTitle>

          <div className="flex gap-2 sm:gap-3 mb-5">
            <CardButton
              icon={<Upload className="w-5 h-5 lg:w-4 lg:h-4" />}
              label="From article"
              isActive={inputMode === "file"}
              onClick={() => setInputMode("file")}
            />
            <CardButton
              icon={<FileText className="w-5 h-5 lg:w-4 lg:h-4" />}
              label="Custom prompt"
              isActive={inputMode === "paste"}
              onClick={() => setInputMode("paste")}
            />
          </div>

          {inputMode === "file" ? (
            uploadedFileName ? (
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
                    <div className="p-2 rounded-lg" style={{ background: 'rgba(var(--primary-rgb), 0.1)' }}>
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
                    style={{ color: 'var(--primary)', background: 'transparent' }}
                  >
                    {showFullArticle ? (
                      <><ChevronUp className="w-4 h-4" />Hide</>
                    ) : (
                      <><ChevronDown className="w-4 h-4" />Show full article</>
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
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{articleText}</pre>
                  </div>
                )}
              </div>
            ) : (
              <Dropzone
                label="Drop reflection markdown here"
                description="Title and slug are extracted from the file automatically."
                onFileUpload={handleFileUpload}
              />
            )
          ) : (
            <div>
              <Field className="mb-4">
                <Label htmlFor="paste-title">Run title</Label>
                <Input
                  id="paste-title"
                  value={articleTitle}
                  onChange={(e) => {
                    const title = e.target.value;
                    setArticleTitle(title);
                    const slug = generateSlug(title);
                    setArticleSlug(slug);
                    setArticleUrl(slug ? `https://www.self-disciplined.com/p/${slug}` : "");
                  }}
                  placeholder="Give this run a title…"
                />
              </Field>
              <div style={{ height: '400px' }}>
                <Label htmlFor="paste-text" className="mb-2 block">Article text</Label>
                <WYSIWYGEditor
                  value={articleText}
                  onChange={setArticleText}
                  placeholder="Paste your reflection text here..."
                />
              </div>
            </div>
          )}

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
                    <><Check className="w-3.5 h-3.5" />Done</>
                  ) : (
                    <><Edit2 className="w-3.5 h-3.5" />Edit metadata</>
                  )}
                </button>
              </div>

              {editingMetadata ? (
                <div className="space-y-4">
                  <Field>
                    <Label htmlFor="edit-title">Article title</Label>
                    <Input id="edit-title" value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <Field>
                      <Label htmlFor="edit-slug">Slug</Label>
                      <Input id="edit-slug" value={articleSlug} onChange={(e) => setArticleSlug(e.target.value)} />
                    </Field>
                    <Field>
                      <Label htmlFor="edit-url">Article URL</Label>
                      <Input id="edit-url" value={articleUrl} onChange={(e) => setArticleUrl(e.target.value)} />
                    </Field>
                  </div>
                  <Field>
                    <Label htmlFor="prompt-override">Prompt override (optional)</Label>
                    <Input id="prompt-override" placeholder="Optional one-off prompt override" />
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
                  <div className="col-span-2">
                    <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>URL</div>
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--muted-foreground)' }}>{articleUrl || '—'}</div>
                  </div>
                </div>
              )}
            </CardSection>
          )}

          <CardSection>
            <Eyebrow>Run options</Eyebrow>
            <SectionTitle className="mb-5">Configure translation and automation</SectionTitle>
            <div className="space-y-3">
              <Toggle
                label="Generate Spanish versions"
                description="Reflection translation, companion translation, and both social lanes in Spanish."
                checked={generateSpanish}
                onChange={setGenerateSpanish}
              />
              <Toggle
                label="Auto-run thumbnail lane"
                description="Generate concepts and images in parallel with the text pipeline."
                checked={autoThumbnail}
                onChange={setAutoThumbnail}
              />
            </div>
          </CardSection>

          <CardSection>
            <Eyebrow>Social tone</Eyebrow>
            <SectionTitle className="mb-4">Balance between professional and conversational</SectionTitle>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-[10px] sm:text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>Professional</span>
              <input
                type="range"
                min="0"
                max="10"
                value={socialTone}
                onChange={(e) => setSocialTone(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #c4522a 0%, #c4522a ${socialTone * 10}%, #efe3cf ${socialTone * 10}%, #efe3cf 100%)`
                }}
              />
              <span className="text-[10px] sm:text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>Conversational</span>
            </div>
          </CardSection>

          <div className="mt-6 pt-6 border-t" style={{ borderTopColor: 'rgba(var(--border-rgb), 0.14)' }}>
            <Button
              variant="primary"
              onClick={handleRunPipeline}
              className="w-full mb-2.5"
              disabled={!articleText || !articleTitle}
            >
              {running ? "Queue run" : "Run full pipeline"}
            </Button>
            <Button variant="ghost" onClick={handleClearForm} className="w-full">
              Clear form
            </Button>
            {runError && !running && (
              <p className="text-center text-xs mt-3" style={{ color: "var(--destructive)" }}>{runError}</p>
            )}
            {running ? (
              <p className="text-center text-xs mt-3" style={{ color: 'var(--primary)' }}>
                Pipeline running · this run will be queued
              </p>
            ) : (
              <p className="text-center text-xs mt-3" style={{ color: 'var(--muted-foreground)' }}>
                Estimated time: 2-3 minutes · Cost: $0.45
              </p>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* ── MOBILE — full-screen modal ───────────────────────── */}
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
                onClick={handleMobileClose}
                className="p-2 -ml-1 rounded-xl active:bg-black active:bg-opacity-5 transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <div className="flex-1 min-w-0">
                <h1
                  className="text-[16px] font-bold truncate"
                  style={{ fontFamily: "Montserrat, sans-serif", color: "var(--foreground)" }}
                >
                  {displayTitle || "Pipeline run"}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {running ? (
                    <span className="text-[12px] flex items-center gap-1" style={{ color: "var(--primary)" }}>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {stages.find(s => s.status === "running")?.name ?? "Running"} · {completedStageCount}/{stages.length}
                      {pendingQueue.length > 0 && <span className="font-bold ml-1">· {pendingQueue.length} queued</span>}
                    </span>
                  ) : liveStatus === "cancelled" ? (
                    <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Pipeline cancelled</span>
                  ) : runError ? (
                    <span className="text-[12px]" style={{ color: "#b94040" }}>Pipeline failed</span>
                  ) : (
                    <span className="text-[12px] flex items-center gap-1" style={{ color: "var(--text-subtle)" }}>
                      <CheckCircle className="w-3 h-3" style={{ color: "#22c55e" }} />
                      {completedStageCount} stages complete
                      {runCost > 0 && <span className="font-bold px-1.5 py-0.5 rounded ml-1" style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}>${runCost.toFixed(4)}</span>}
                    </span>
                  )}
                </div>
              </div>

              {/* Language toggle */}
              <div
                className="flex items-center gap-1 rounded-lg p-1 flex-shrink-0"
                style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)" }}
              >
                {(["en", "es"] as const).map(lang => (
                  <button
                    key={lang}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                    style={{
                      background: language === lang ? "var(--primary)" : "transparent",
                      color: language === lang ? "#fff" : "var(--muted-foreground)",
                    }}
                    onClick={() => setLanguage(lang)}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            {running && (
              <div className="h-1 flex-shrink-0" style={{ background: "rgba(var(--primary-rgb),0.12)" }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${(completedStageCount / stages.length) * 100}%`, background: "var(--primary)" }}
                />
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4" style={{ WebkitOverflowScrolling: "touch" as any }}>
              {/* Tags + article URL — full bleed */}
              {(runTags.length > 0 || displayUrl) && (
                <div className="-mx-4">
                  {runTags.length > 0 && (
                    <div
                      className="flex flex-wrap items-center gap-2 px-4 py-2"
                      style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.12)" }}
                    >
                      {runTags.map((tag: string) => (
                        <span
                          key={tag}
                          className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md"
                          style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {displayUrl && (
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.12)" }}>
                      <a
                        href={displayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs hover:underline"
                        style={{ color: "var(--primary)" }}
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />{displayUrl}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Tab selector */}
              <CustomSelect
                options={contentTabOptions}
                value={activeContentTab}
                onChange={setActiveContentTab}
              />

              {/* Tab content */}
              <TabContent mobile />
            </div>
          </div>

          {/* ── DESKTOP ──────────────────────────────────────────── */}
          <div className="hidden lg:block">
            {/* Status banner */}
            {liveStatus === "cancelled" ? (
              <div
                className="flex items-center gap-3 p-4 rounded-2xl mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--border-rgb), 0.12), rgba(var(--border-rgb), 0.05))',
                  border: '1px solid rgba(var(--border-rgb), 0.22)',
                }}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0" style={{ background: 'rgba(var(--border-rgb), 0.16)' }}>
                  <XCircle className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm mb-0.5" style={{ color: 'var(--foreground)' }}>Pipeline run cancelled</div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{runError ?? "Processing stopped by user."}</div>
                </div>
                <div className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(var(--border-rgb), 0.12)', color: 'var(--muted-foreground)' }}>
                  {activeRunLabel}
                </div>
              </div>
            ) : runError ? (
              <div
                className="flex items-center gap-3 p-4 rounded-2xl mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(185, 64, 64, 0.1), rgba(185, 64, 64, 0.04))',
                  border: '1px solid rgba(185, 64, 64, 0.3)',
                }}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0" style={{ background: '#b94040' }}>
                  <XCircle className="w-5 h-5" style={{ color: '#fff' }} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm mb-0.5" style={{ color: '#7f1d1d' }}>Pipeline run failed</div>
                  <div className="text-xs" style={{ color: '#991b1b' }}>{runError}</div>
                </div>
                <div className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(185, 64, 64, 0.12)', color: '#7f1d1d' }}>
                  {activeRunLabel}
                </div>
              </div>
            ) : running ? (
              <div
                className="p-4 rounded-2xl mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.1), rgba(var(--primary-rgb), 0.04))',
                  border: '1px solid rgba(var(--primary-rgb), 0.28)',
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0" style={{ background: 'var(--primary)' }}>
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#fff' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: '#9a3412' }}>Pipeline running</div>
                    <div className="text-xs" style={{ color: 'var(--primary)' }}>
                      {completedStageCount} of {stages.length} stages complete
                      {pendingQueue.length > 0 && <span className="ml-2 font-bold">· {pendingQueue.length} queued</span>}
                    </div>
                  </div>
                  <div className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(var(--primary-rgb), 0.12)', color: '#9a3412' }}>
                    {activeRunLabel}
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(var(--primary-rgb), 0.15)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(completedStageCount / stages.length) * 100}%`, background: 'var(--primary)' }}
                  />
                </div>
                {(() => {
                  const active = stages.find(s => s.status === 'running');
                  return active ? (
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--primary)' }}>
                      <Loader2 size={10} className="animate-spin flex-shrink-0" />
                      <span className="font-medium">{active.name}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
              <div
                className="flex items-center gap-3 p-4 rounded-2xl mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                }}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0" style={{ background: '#22c55e' }}>
                  <CheckCircle className="w-5 h-5" style={{ color: '#fff' }} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm mb-0.5" style={{ color: '#166534' }}>All tasks complete</div>
                  <div className="text-xs" style={{ color: '#15803d' }}>{completedStageCount} of {stages.length} stages finished successfully</div>
                </div>
                <div className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#166534' }}>
                  {activeRunLabel}
                </div>
              </div>
            )}

            {/* Content card */}
            <Card>
              <div className="mb-6 pb-6 border-b" style={{ borderColor: 'rgba(var(--border-rgb), 0.12)' }}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h2 className="text-lg font-bold flex-1" style={{ color: 'var(--foreground)' }}>
                    {displayTitle || "Untitled pipeline run"}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      className="p-2 rounded-lg transition-all hover:opacity-80"
                      style={{ background: 'var(--primary)', color: '#fff' }}
                      title="Review campaign"
                      onClick={() => navigate("/marketing")}
                    >
                      <Megaphone className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 rounded-lg transition-all hover:opacity-80"
                      style={{ background: '#efe3cf', color: 'var(--foreground)' }}
                      title="View in history"
                      onClick={() => runData?.run_id ? navigate(`/history/${runData.run_id}`) : navigate("/history")}
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    <span>{running ? "Running now" : liveStatus === "cancelled" ? "Cancelled" : hasRun ? "Just completed" : runError ? "Failed" : "In progress"}</span>
                    <span>•</span>
                    <span>{articleWordCount} words</span>
                    {runCost > 0 && (
                      <>
                        <span>•</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>${runCost.toFixed(4)}</span>
                      </>
                    )}
                    {displayUrl && (
                      <>
                        <span>•</span>
                        <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: "var(--primary)" }}>
                          <ExternalLink className="w-3 h-3" />{displayUrl}
                        </a>
                      </>
                    )}
                  </div>
                  {runTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {runTags.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide"
                          style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tab bar */}
              <div
                className="flex items-end justify-between gap-4 -mb-px"
                style={{ borderBottom: '1px solid rgba(var(--border-rgb), 0.12)' }}
              >
                <div className="flex items-end gap-1 overflow-x-auto overflow-y-hidden">
                  {contentTabOptions.map(tab => (
                    <button
                      key={tab.value}
                      className="px-4 pb-3 pt-2 text-sm font-medium transition-all whitespace-nowrap"
                      style={{
                        color: activeContentTab === tab.value ? 'var(--primary)' : 'var(--muted-foreground)',
                        borderBottom: activeContentTab === tab.value ? '2px solid #c4522a' : '2px solid transparent',
                        marginBottom: '-1px',
                      }}
                      onClick={() => setActiveContentTab(tab.value)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pb-2 flex-shrink-0">
                  <SegmentedControl
                    options={[{ id: "en", label: "EN" }, { id: "es", label: "ES" }]}
                    value={language}
                    onChange={(val) => setLanguage(val as "en" | "es")}
                  />
                </div>
              </div>

              <div className="mt-5">
                <TabContent />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
