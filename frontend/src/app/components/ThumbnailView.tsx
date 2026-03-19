import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "./PageHeader";
import { Tabs } from "./Tabs";
import { Card, CardSection, Eyebrow, SectionTitle } from "./Card";
import { Field, Label, Input, TextArea, Dropzone, Button, CardButton } from "./FormComponents";
import { MobileSection, MobileDivider } from "./MobileSection";
import { MobileBottomNav } from "./MobileBottomNav";
import { Sparkles, Download, Copy, ArrowLeft, ChevronLeft, Check, Trash2, Plus, Edit2, X, FileText, Upload, Image, Library, Loader2, Search } from "lucide-react";
import { thumbnailConceptsFetch, thumbnailImagesFetch, thumbnails } from "../../lib/api";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "./ui/carousel";

interface Concept {
  id: number;
  title: string;
  description: string;
  interpretation: string;
  prompt: string;
  image?: string;
  imageB64?: string;
  isGenerating?: boolean;
  draftId?: number;
}

interface SavedThumbnail {
  id: number;
  title: string;
  description: string;
  image: string;
  articleTitle: string;
  articleUrl: string;
  savedAt: Date;
  conceptScene?: string;
  conceptWhy?: string;
  conceptPrompt?: string;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dataUrlFromB64(imageB64?: string) {
  return imageB64 ? `data:image/png;base64,${imageB64}` : "";
}

export function ThumbnailView() {
  const [activeTab, setActiveTab] = useState("studio");
  const [inputMode, setInputMode] = useState<"article" | "custom">("article");
  const [fileName, setFileName] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSlug, setArticleSlug] = useState("");
  const [articleText, setArticleText] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [promptOverride, setPromptOverride] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [expandedConcept, setExpandedConcept] = useState<number | null>(null);
  const [selectedConcepts, setSelectedConcepts] = useState<Set<number>>(new Set());
  const [hasGeneratedConcepts, setHasGeneratedConcepts] = useState(false);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [savedThumbnails, setSavedThumbnails] = useState<SavedThumbnail[]>([]);
  const [editingConcept, setEditingConcept] = useState<number | null>(null);
  const [selectedForImageGen, setSelectedForImageGen] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<SavedThumbnail | null>(null);
  const [isGeneratingConcepts, setIsGeneratingConcepts] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);
  const [viewPhase, setViewPhase] = useState<"concepts" | "results">("concepts");
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string; type: "error" | "success" | "info" }>>([]);
  const toastCounter = useRef(0);
  const [pendingDrafts, setPendingDrafts] = useState<any[]>([]);
  const [savedConceptDraft, setSavedConceptDraft] = useState<{ concepts: Concept[]; articleTitle: string; articleUrl: string } | null>(null);

  const CONCEPT_DRAFT_KEY = "thumbnail_concept_draft";

  const saveConceptDraft = (cs: Concept[], title: string, url: string) => {
    try {
      localStorage.setItem(CONCEPT_DRAFT_KEY, JSON.stringify({ concepts: cs, articleTitle: title, articleUrl: url }));
    } catch {}
  };

  const clearConceptDraft = () => {
    try { localStorage.removeItem(CONCEPT_DRAFT_KEY); } catch {}
  };
  const [conceptCarouselApi, setConceptCarouselApi] = useState<CarouselApi>();
  const [currentConceptSlide, setCurrentConceptSlide] = useState(0);
  const [imageCarouselApi, setImageCarouselApi] = useState<CarouselApi>();
  const [currentImageSlide, setCurrentImageSlide] = useState(0);

  const onConceptSelect = useCallback((api: CarouselApi) => {
    if (api) setCurrentConceptSlide(api.selectedScrollSnap());
  }, []);
  const onImageSelect = useCallback((api: CarouselApi) => {
    if (api) setCurrentImageSlide(api.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!conceptCarouselApi) return;
    conceptCarouselApi.on("select", onConceptSelect);
    return () => { conceptCarouselApi.off("select", onConceptSelect); };
  }, [conceptCarouselApi, onConceptSelect]);

  useEffect(() => {
    if (!imageCarouselApi) return;
    imageCarouselApi.on("select", onImageSelect);
    return () => { imageCarouselApi.off("select", onImageSelect); };
  }, [imageCarouselApi, onImageSelect]);

  const addToast = (msg: string, type: "error" | "success" | "info" = "info") => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), type === "error" ? 5000 : 3000);
  };

  const loadLibrary = async () => {
    setLibraryLoading(true);
    try {
      const { thumbnails: rows } = await thumbnails.list();
      const detailed = await Promise.all(
        (rows || []).map(async (row: any) => {
          const full = await thumbnails.get(String(row.id));
          return {
            id: Number(full.id),
            title: full.concept_name || full.article_title || "Saved thumbnail",
            description: full.article_url || full.concept_name || "Saved thumbnail",
            image: dataUrlFromB64(full.image_b64),
            articleTitle: full.article_title || "",
            articleUrl: full.article_url || "",
            savedAt: new Date(full.timestamp),
            conceptScene: full.concept_scene || undefined,
            conceptWhy: full.concept_why || undefined,
            conceptPrompt: full.concept_prompt || undefined,
          } satisfies SavedThumbnail;
        })
      );
      setSavedThumbnails(detailed);
    } catch (error: any) {
      addToast(error.message || "Failed to load thumbnail library", "error");
    } finally {
      setLibraryLoading(false);
    }
  };

  useEffect(() => {
    void loadLibrary();
    thumbnails.listDrafts().then(({ drafts }) => {
      if (drafts && drafts.length > 0) {
        setPendingDrafts(drafts);
      } else {
        // Only surface concept draft if there are no image drafts
        try {
          const raw = localStorage.getItem(CONCEPT_DRAFT_KEY);
          if (raw) setSavedConceptDraft(JSON.parse(raw));
        } catch {}
      }
    }).catch(() => {
      try {
        const raw = localStorage.getItem(CONCEPT_DRAFT_KEY);
        if (raw) setSavedConceptDraft(JSON.parse(raw));
      } catch {}
    });
  }, []);

  const handleFileSelect = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const derivedTitle = heading || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    setArticleText(text);
    setArticleTitle(derivedTitle);
    setArticleSlug(slugify(derivedTitle));
    setMobileStep(2);
  };

  const handleClearForm = () => {
    setFileName("");
    setArticleTitle("");
    setArticleSlug("");
    setArticleText("");
    setArticleUrl("");
    setPromptOverride("");
    setCustomPrompt("");
    setHasGeneratedConcepts(false);
    setConcepts([]);
    setSelectedConcepts(new Set());
    setSelectedForImageGen(new Set());
    setExpandedConcept(null);
    setEditingConcept(null);
    setMobileStep(1);
    setViewPhase("concepts");
    clearConceptDraft();
    thumbnails.deleteDrafts().catch(() => {});
  };

  const handleNew = () => {
    handleClearForm();
    setInputMode("article");
  };

  const handleGenerateConcepts = async () => {
    const baseText = inputMode === "article" ? articleText : customPrompt.trim();
    const sourceText = promptOverride.trim()
      ? `${baseText}\n\nAdditional visual direction:\n${promptOverride.trim()}`
      : baseText;
    const sourceTitle = articleTitle.trim() || (inputMode === "custom" ? "Custom thumbnail prompt" : "");
    if (!sourceTitle || !sourceText) {
      addToast("Add a title and source text before generating thumbnail concepts.", "error");
      return;
    }

    setIsGeneratingConcepts(true);
    setHasGeneratedConcepts(true);
    setConcepts([]);
    try {
      await thumbnailConceptsFetch(sourceTitle, sourceText, (event, data) => {
        if (event === "concepts_ready") {
          const nextConcepts = (data.concepts || []).map((concept: any) => ({
            id: Number(concept.index),
            title: concept.name || `Concept ${concept.index + 1}`,
            description: concept.scene || "",
            interpretation: concept.why || "",
            prompt: concept.dalle_prompt || "",
          }));
          setConcepts(nextConcepts);
          saveConceptDraft(nextConcepts, sourceTitle, articleUrl);
          return;
        }
        if (event === "error") {
          addToast(data.message || "Thumbnail generation failed.", "error");
        }
      });
    } catch (error: any) {
      addToast(error.message || "Thumbnail generation failed.", "error");
    } finally {
      setIsGeneratingConcepts(false);
    }
  };

  const handleRestoreConceptDraft = () => {
    if (!savedConceptDraft) return;
    setConcepts(savedConceptDraft.concepts);
    setArticleTitle(savedConceptDraft.articleTitle);
    setArticleUrl(savedConceptDraft.articleUrl);
    setHasGeneratedConcepts(true);
    setViewPhase("concepts");
    setSavedConceptDraft(null);
  };

  const handleDiscardConceptDraft = () => {
    setSavedConceptDraft(null);
    clearConceptDraft();
  };

  const handleRestoreDrafts = () => {
    const restored = pendingDrafts.map((d, idx) => ({
      id: idx,
      title: d.concept_name || `Concept ${idx + 1}`,
      description: "",
      interpretation: "",
      prompt: "",
      image: dataUrlFromB64(d.image_b64),
      imageB64: d.image_b64,
      draftId: Number(d.id),
    }));
    setArticleTitle(pendingDrafts[0]?.article_title || "");
    setArticleUrl(pendingDrafts[0]?.article_url || "");
    setConcepts(restored);
    setHasGeneratedConcepts(true);
    setViewPhase("results");
    setPendingDrafts([]);
  };

  const handleDiscardDrafts = async () => {
    setPendingDrafts([]);
    try { await thumbnails.deleteDrafts(); } catch {}
  };

  const handleBackToForm = () => {
    setHasGeneratedConcepts(false);
    setConcepts([]);
    setExpandedConcept(null);
    setSelectedConcepts(new Set());
    setSelectedForImageGen(new Set());
    setViewPhase("concepts");
  };

  const toggleImageGenSelection = (id: number) => {
    const newSelected = new Set(selectedForImageGen);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedForImageGen(newSelected);
  };

  const handleGenerateImages = async () => {
    const selected = concepts.filter(c => selectedForImageGen.has(c.id));
    if (!selected.length) {
      addToast("Select at least one concept before generating images.", "error");
      return;
    }

    setIsGeneratingImages(true);
    clearConceptDraft();
    setConcepts(prev => prev.map(concept => (
      selectedForImageGen.has(concept.id) ? { ...concept, isGenerating: true } : concept
    )));

    try {
      await thumbnailImagesFetch(
        selected.map(concept => ({
          index: concept.id,
          name: concept.title,
          scene: concept.description,
          dalle_prompt: concept.prompt,
        })),
        (event, data) => {
          if (event === "concept_image") {
            setConcepts(prev => {
              const updated = prev.map(concept => {
                if (concept.id !== Number(data.index)) return concept;
                const imageB64 = data.image_b64 || concept.imageB64 || "";
                // Auto-save as draft; store returned id on concept
                thumbnails.saveDraft({
                  article_title: articleTitle,
                  article_url: articleUrl,
                  concept_name: data.name || concept.title,
                  image_b64: imageB64,
                  concept_scene: concept.description,
                  concept_why: concept.interpretation,
                  concept_prompt: data.revised_prompt || concept.prompt,
                }).then(saved => {
                  setConcepts(c => c.map(cc =>
                    cc.id === Number(data.index) ? { ...cc, draftId: saved.id } : cc
                  ));
                }).catch(() => {});
                return {
                  ...concept,
                  imageB64,
                  image: dataUrlFromB64(imageB64),
                  isGenerating: false,
                  prompt: data.revised_prompt || concept.prompt,
                };
              });
              return updated;
            });
            return;
          }
          if (event === "image_cost") {
            addToast(`Images generated. Cost: $${Number(data.cost_usd || 0).toFixed(4)}`, "success");
            return;
          }
          if (event === "error") {
            addToast(data.message || "Image generation failed.", "error");
          }
        }
      );
      setSelectedForImageGen(new Set());
      setViewPhase("results");
    } catch (error: any) {
      addToast(error.message || "Image generation failed.", "error");
    } finally {
      setIsGeneratingImages(false);
      setConcepts(prev => prev.map(concept => ({ ...concept, isGenerating: false })));
    }
  };

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedConcepts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedConcepts(newSelected);
  };

  const handleSaveToLibrary = async () => {
    const conceptsToSave = concepts.filter(c => selectedConcepts.has(c.id) && c.imageB64);
    if (!conceptsToSave.length) {
      addToast("Select at least one generated image before saving.", "error");
      return;
    }

    try {
      await Promise.all(
        conceptsToSave.map(concept =>
          concept.draftId
            ? thumbnails.confirm(String(concept.draftId))
            : thumbnails.save({
                article_title: articleTitle,
                article_url: articleUrl,
                concept_name: concept.title,
                image_b64: concept.imageB64,
                concept_scene: concept.description,
                concept_why: concept.interpretation,
                concept_prompt: concept.prompt,
              })
        )
      );
      // Delete remaining drafts (unselected images)
      await thumbnails.deleteDrafts();
      await loadLibrary();
      setSelectedConcepts(new Set());
      addToast("Saved to library.", "success");
      setActiveTab("library");
    } catch (error: any) {
      addToast(error.message || "Failed to save thumbnails.", "error");
    }
  };

  const removeThumbnail = async (id: number) => {
    try {
      await thumbnails.delete(String(id));
      setSavedThumbnails(prev => prev.filter(t => t.id !== id));
      if (selectedLibraryItem?.id === id) setSelectedLibraryItem(null);
    } catch (error: any) {
      addToast(error.message || "Failed to delete thumbnail.", "error");
    }
  };

  const downloadImage = (imageUrl: string, name: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `${slugify(name) || "thumbnail"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyPrompt = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      addToast("Copied to clipboard.", "success");
    } catch {
      addToast("Copy failed.", "error");
    }
  };

  // Filter thumbnails based on search
  const filteredThumbnails = savedThumbnails.filter(thumb => 
    searchQuery === "" ||
    thumb.articleTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thumb.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thumb.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return "TODAY";
    if (diffDays === 1) return "1D AGO";
    if (diffDays < 7) return `${diffDays}D AGO`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}W AGO`;
    return `${Math.floor(diffDays / 30)}M AGO`;
  };

  const addCustomConcept = () => {
    const newConcept: Concept = {
      id: Date.now(),
      title: "Custom Concept",
      description: "Add your description here...",
      interpretation: "Add your interpretation...",
      prompt: "Add your generation prompt..."
    };
    setConcepts(prev => [...prev, newConcept]);
    setEditingConcept(newConcept.id);
    setExpandedConcept(newConcept.id);
  };

  const updateConcept = (id: number, field: keyof Concept, value: string) => {
    setConcepts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const deleteConcept = (id: number) => {
    setConcepts(prev => prev.filter(c => c.id !== id));
    if (expandedConcept === id) setExpandedConcept(null);
    if (editingConcept === id) setEditingConcept(null);
  };

  return (
    <div>
      <PageHeader
        kicker="Thumbnail generation"
        title="From article to visual concepts in minutes"
        description="Upload your reflection article to automatically generate three conceptual thumbnail options. Review, refine, and save the best one."
        action={
          <Button
            variant="secondary"
            onClick={handleNew}
            style={{ 
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            New thumbnails
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: "studio", label: "Studio" },
          { id: "library", label: "Library" }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hideOnMobile={true}
      />

      {activeTab === "studio" && (
        <div>
          {/* Draft recovery banners */}
          {pendingDrafts.length > 0 && !hasGeneratedConcepts && (
            <div
              className="mb-4 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3"
              style={{ background: 'rgba(var(--primary-rgb), 0.08)', border: '1px solid rgba(var(--primary-rgb), 0.2)' }}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  You have {pendingDrafts.length} unsaved image{pendingDrafts.length > 1 ? 's' : ''} from your last session
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  Restore to pick up where you left off, or discard to start fresh.
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="ghost" onClick={handleDiscardDrafts} style={{ fontSize: '13px', padding: '9px 14px' }}>Discard</Button>
                <Button variant="primary" onClick={handleRestoreDrafts} style={{ fontSize: '13px', padding: '9px 14px' }}>Restore session</Button>
              </div>
            </div>
          )}
          {savedConceptDraft && !hasGeneratedConcepts && pendingDrafts.length === 0 && (
            <div
              className="mb-4 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3"
              style={{ background: 'rgba(var(--primary-rgb), 0.08)', border: '1px solid rgba(var(--primary-rgb), 0.2)' }}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  You have {savedConceptDraft.concepts.length} concepts from your last session
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  Restore to review and generate images, or discard to start fresh.
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="ghost" onClick={handleDiscardConceptDraft} style={{ fontSize: '13px', padding: '9px 14px' }}>Discard</Button>
                <Button variant="primary" onClick={handleRestoreConceptDraft} style={{ fontSize: '13px', padding: '9px 14px' }}>Restore session</Button>
              </div>
            </div>
          )}

          {!hasGeneratedConcepts ? (
            /* Input Form */
            <Card>
              {/* Input Mode Toggle */}
              <div className="flex gap-2 sm:gap-3 lg:gap-2 mb-6 lg:mb-5">
                <CardButton
                  icon={<Upload className="w-5 h-5 lg:w-4 lg:h-4" />}
                  label="From article"
                  isActive={inputMode === "article"}
                  onClick={() => { setInputMode("article"); setMobileStep(1); }}
                />
                <CardButton
                  icon={<FileText className="w-5 h-5 lg:w-4 lg:h-4" />}
                  label="Custom prompt"
                  isActive={inputMode === "custom"}
                  onClick={() => { setInputMode("custom"); setMobileStep(1); }}
                />
              </div>

              {inputMode === "article" ? (
                <>
                  {/* ── Mobile wizard (hidden on desktop) ── */}
                  <div className="lg:hidden">
                    {/* Progress header */}
                    <div className="flex items-center justify-between mb-5">
                      {mobileStep > 1 ? (
                        <button
                          className="flex items-center gap-1.5 text-sm font-medium"
                          style={{ color: "var(--muted-foreground)" }}
                          onClick={() => setMobileStep(s => (s - 1) as 1 | 2 | 3)}
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>
                      ) : <div />}
                      <div className="flex items-center gap-1.5">
                        {([1, 2, 3] as const).map(s => (
                          <div
                            key={s}
                            className="rounded-full transition-all duration-300"
                            style={{
                              width: s === mobileStep ? 20 : 6,
                              height: 6,
                              background: s <= mobileStep ? "var(--primary)" : "rgba(var(--border-rgb), 0.25)",
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-bold tracking-wider" style={{ color: "var(--text-subtle)" }}>
                        {mobileStep} / 3
                      </span>
                    </div>

                    {/* Step 1 — Upload */}
                    {mobileStep === 1 && (
                      <MobileSection>
                        <Eyebrow>Step 1</Eyebrow>
                        <SectionTitle className="mb-4">Upload article</SectionTitle>
                        <p className="text-[14px] mb-5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                          Drop your markdown file to extract the title and content automatically.
                        </p>
                        <Dropzone
                          label={fileName ? fileName : "Drop file here"}
                          description={fileName ? "File loaded successfully" : "Markdown or text files only"}
                          fileName={fileName}
                          onFileSelect={handleFileSelect}
                        />
                        <Button
                          variant="primary"
                          onClick={() => setMobileStep(2)}
                          disabled={!fileName}
                          style={{ width: "100%", padding: "14px", fontSize: "14px", marginTop: "20px" }}
                        >
                          Next: Review metadata
                        </Button>
                      </MobileSection>
                    )}

                    {/* Step 2 — Metadata */}
                    {mobileStep === 2 && (
                      <MobileSection>
                        <Eyebrow>Step 2</Eyebrow>
                        <SectionTitle className="mb-4">Review metadata</SectionTitle>
                        <p className="text-[14px] mb-5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                          Verify the extracted information before generating.
                        </p>
                        <Field>
                          <Label htmlFor="article-title-m">Article title</Label>
                          <Input
                            id="article-title-m"
                            value={articleTitle}
                            onChange={(e) => setArticleTitle(e.target.value)}
                            placeholder="Extracted from file..."
                          />
                        </Field>
                        <Field>
                          <Label htmlFor="slug-m">Slug</Label>
                          <Input
                            id="slug-m"
                            value={articleSlug}
                            onChange={(e) => setArticleSlug(e.target.value)}
                            placeholder="auto-generated-slug"
                          />
                        </Field>
                        <Field>
                          <Label htmlFor="article-url-m">Article URL (optional)</Label>
                          <Input
                            id="article-url-m"
                            value={articleUrl}
                            onChange={(e) => setArticleUrl(e.target.value)}
                            placeholder="https://www.self-disciplined.com/p/..."
                          />
                        </Field>
                        <Button
                          variant="primary"
                          onClick={() => setMobileStep(3)}
                          disabled={!articleTitle}
                          style={{ width: "100%", padding: "14px", fontSize: "14px", marginTop: "4px" }}
                        >
                          Next: Generate concepts
                        </Button>
                      </MobileSection>
                    )}

                    {/* Step 3 — Generate */}
                    {mobileStep === 3 && (
                      <MobileSection>
                        <Eyebrow>Step 3</Eyebrow>
                        <SectionTitle className="mb-4">Generate concepts</SectionTitle>
                        <p className="text-[14px] mb-5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                          Add optional visual direction, then generate 3 thumbnail concepts.
                        </p>
                        <Field>
                          <Label htmlFor="prompt-override-m">Custom prompt (optional)</Label>
                          <Input
                            id="prompt-override-m"
                            value={promptOverride}
                            onChange={(e) => setPromptOverride(e.target.value)}
                            placeholder="Add specific visual direction..."
                          />
                        </Field>
                        <div
                          className="p-4 rounded-2xl mb-5"
                          style={{ background: "rgba(var(--primary-rgb), 0.08)", border: "1px solid rgba(var(--primary-rgb), 0.2)" }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
                            <span className="text-xs font-bold" style={{ color: "var(--primary)" }}>Generation settings</span>
                          </div>
                          <div className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                            <div className="mb-1">• 3 unique concepts (text only)</div>
                            <div className="mb-1">• Edit before generating images</div>
                            <div>• Est. cost: $0.05 · 15 seconds</div>
                          </div>
                        </div>
                        <Button
                          variant="primary"
                          onClick={handleGenerateConcepts}
                          disabled={isGeneratingConcepts || !articleTitle || !articleText}
                          style={{ width: "100%", padding: "14px", fontSize: "14px", marginBottom: "10px" }}
                        >
                          {isGeneratingConcepts ? "Generating..." : "Generate concepts"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={handleClearForm}
                          style={{ width: "100%", padding: "12px", fontSize: "13px" }}
                        >
                          Clear form
                        </Button>
                      </MobileSection>
                    )}
                  </div>

                  {/* ── Desktop 3-column layout (hidden on mobile) ── */}
                  <div className="hidden lg:grid lg:grid-cols-3 gap-6">
                    {/* Col 1 — Upload */}
                    <div>
                      <Eyebrow>Step 1</Eyebrow>
                      <SectionTitle className="mb-4">Upload article</SectionTitle>
                      <p className="text-xs mb-5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                        Drop your markdown file to automatically extract the title, slug, and article content.
                      </p>
                      <Dropzone
                        label={fileName ? fileName : "Drop file here"}
                        description={fileName ? "File loaded successfully" : "Markdown or text files only"}
                        fileName={fileName}
                        onFileSelect={handleFileSelect}
                      />
                    </div>

                    {/* Col 2 — Metadata */}
                    <div>
                      <Eyebrow>Step 2</Eyebrow>
                      <SectionTitle className="mb-4">Review metadata</SectionTitle>
                      <p className="text-xs mb-5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                        Verify the extracted information is correct before generating concepts.
                      </p>
                      <Field>
                        <Label htmlFor="article-title">Article title</Label>
                        <Input
                          id="article-title"
                          value={articleTitle}
                          onChange={(e) => setArticleTitle(e.target.value)}
                          placeholder="Extracted from file..."
                        />
                      </Field>
                      <Field>
                        <Label htmlFor="slug">Slug</Label>
                        <Input
                          id="slug"
                          value={articleSlug}
                          onChange={(e) => setArticleSlug(e.target.value)}
                          placeholder="auto-generated-slug"
                        />
                      </Field>
                      <Field>
                        <Label htmlFor="article-url">Article URL (optional)</Label>
                        <Input
                          id="article-url"
                          value={articleUrl}
                          onChange={(e) => setArticleUrl(e.target.value)}
                          placeholder="https://www.self-disciplined.com/p/..."
                        />
                      </Field>
                    </div>

                    {/* Col 3 — Generate */}
                    <div>
                      <Eyebrow>Step 3</Eyebrow>
                      <SectionTitle className="mb-4">Generate concepts</SectionTitle>
                      <p className="text-xs mb-5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                        Choose how many thumbnail concepts to generate from your article.
                      </p>
                      <Field>
                        <Label htmlFor="prompt-override">Custom prompt (optional)</Label>
                        <Input
                          id="prompt-override"
                          value={promptOverride}
                          onChange={(e) => setPromptOverride(e.target.value)}
                          placeholder="Add specific visual direction..."
                        />
                      </Field>
                      <div
                        className="p-4 rounded-2xl mb-5"
                        style={{ background: 'rgba(var(--primary-rgb), 0.08)', border: '1px solid rgba(var(--primary-rgb), 0.2)' }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                          <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>Generation settings</span>
                        </div>
                        <div className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                          <div className="mb-1">• 3 unique concepts (text only)</div>
                          <div className="mb-1">• Edit before generating images</div>
                          <div>• Est. cost: $0.05 · 15 seconds</div>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        onClick={handleGenerateConcepts}
                        disabled={isGeneratingConcepts || !articleTitle || !articleText}
                        style={{ width: '100%', padding: '14px', fontSize: '14px', marginBottom: '10px' }}
                      >
                        {isGeneratingConcepts ? "Generating..." : "Generate concepts"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleClearForm}
                        style={{ width: '100%', padding: '12px', fontSize: '13px' }}
                      >
                        Clear form
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                /* Custom Mode - Simple Layout */
                <div className="max-w-2xl mx-auto">
                  <Eyebrow>Standalone generation</Eyebrow>
                  <SectionTitle className="mb-4">Describe what you need thumbnails for</SectionTitle>
                  <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    Provide a description or paste content for a social post, video, or any other project. AI will generate visual concepts based on your input.
                  </p>

                  <Field>
                    <Label htmlFor="custom-title">Project title</Label>
                    <Input
                      id="custom-title"
                      value={articleTitle}
                      onChange={(e) => setArticleTitle(e.target.value)}
                      placeholder="LinkedIn post about productivity..."
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="custom-prompt">Content or description</Label>
                    <TextArea
                      id="custom-prompt"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Paste your post text here, or describe what visual concept you need...&#10;&#10;Example: 'Create a thumbnail for a LinkedIn post about the hidden costs of context switching. The post discusses how multitasking depletes your mental bandwidth and suggests batching similar tasks instead.'"
                      style={{ minHeight: '200px' }}
                    />
                  </Field>

                  <div 
                    className="p-4 rounded-2xl mb-5"
                    style={{
                      background: 'rgba(var(--primary-rgb), 0.08)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'rgba(var(--primary-rgb), 0.2)'
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                      <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>
                        Generation settings
                      </span>
                    </div>
                    <div className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                      <div className="mb-1">• 3 unique visual concepts (text only)</div>
                      <div className="mb-1">• Review and edit before generating images</div>
                      <div>• Est. cost: $0.05 · 15 seconds</div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleGenerateConcepts}
                    disabled={isGeneratingConcepts || !articleTitle || !customPrompt}
                    style={{ width: '100%', padding: '14px', fontSize: '14px', marginBottom: '10px' }}
                  >
                    {isGeneratingConcepts ? "Generating..." : "Generate concepts"}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    onClick={handleClearForm}
                    style={{ width: '100%', padding: '12px', fontSize: '13px' }}
                  >
                    Clear form
                  </Button>
                </div>
              )}
            </Card>
          ) : viewPhase === "concepts" ? (
            /* ── Phase 1: Concept selection ── */
            <>
            <Card>
              {/* Mobile header */}
              <div className="lg:hidden flex items-center justify-between mb-5">
                <button
                  className="flex items-center gap-1.5 text-sm font-medium"
                  style={{ color: 'var(--muted-foreground)' }}
                  onClick={handleBackToForm}
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="text-center">
                  <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-subtle)' }}>Concepts</p>
                </div>
                <button
                  className="flex items-center gap-1 text-sm font-semibold"
                  style={{ color: 'var(--primary)' }}
                  onClick={addCustomConcept}
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {/* Desktop header */}
              <div className="hidden lg:flex lg:items-center justify-between gap-4 mb-6">
                <div>
                  <Eyebrow>Concept review</Eyebrow>
                  <SectionTitle>Select concepts to generate images for</SectionTitle>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={addCustomConcept} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add custom
                  </Button>
                  <Button variant="ghost" onClick={handleBackToForm} className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to form
                  </Button>
                </div>
              </div>

              {/* Shared concept card renderer */}
              {(() => {
                const skeletons = isGeneratingConcepts && concepts.length === 0;
                const items = skeletons ? [0, 1, 2] : concepts;

                const renderConceptCard = (concept: Concept | number) => {
                  if (typeof concept === "number") {
                    return (
                      <div className="rounded-2xl overflow-hidden" style={{ border: "2px solid rgba(var(--border-rgb), 0.1)", background: "var(--card)" }}>
                        <div className="w-full aspect-[4/3] animate-pulse" style={{ background: "rgba(var(--border-rgb), 0.1)" }} />
                        <div className="p-4 space-y-3">
                          <div className="h-4 rounded-lg animate-pulse" style={{ background: "rgba(var(--border-rgb), 0.1)" }} />
                          <div className="h-3 rounded-lg w-3/4 animate-pulse" style={{ background: "rgba(var(--border-rgb), 0.08)" }} />
                          <div className="h-3 rounded-lg w-1/2 animate-pulse" style={{ background: "rgba(var(--border-rgb), 0.08)" }} />
                        </div>
                      </div>
                    );
                  }
                  const isSelectedForGen = selectedForImageGen.has(concept.id);
                  const isEditing = editingConcept === concept.id;
                  const isExpanded = expandedConcept === concept.id;
                  const hasImage = !!concept.image;
                  return (
                    <div
                      className="rounded-2xl overflow-hidden flex flex-col transition-all cursor-pointer h-full"
                      style={{
                        border: `2px solid ${isSelectedForGen ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.14)'}`,
                        background: isSelectedForGen ? 'rgba(var(--primary-rgb), 0.04)' : 'var(--card)',
                      }}
                      onClick={() => !hasImage && !isEditing && toggleImageGenSelection(concept.id)}
                    >
                      <div className="w-full aspect-[4/3] relative flex items-center justify-center flex-shrink-0" style={{ background: hasImage ? '#efe3cf' : 'var(--secondary)' }}>
                        {hasImage ? (
                          <img src={concept.image} alt={concept.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-center px-4">
                            <Sparkles className="w-8 h-8" style={{ color: 'var(--primary)', opacity: 0.4 }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>
                              {isSelectedForGen ? "Selected" : "Tap to select"}
                            </span>
                          </div>
                        )}
                        {!hasImage && (
                          <div
                            className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all"
                            style={{
                              background: isSelectedForGen ? 'var(--primary)' : 'rgba(255,255,255,0.85)',
                              border: `2px solid ${isSelectedForGen ? 'var(--primary)' : 'rgba(var(--border-rgb),0.25)'}`,
                              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                            }}
                          >
                            {isSelectedForGen && <Check className="w-3.5 h-3.5" style={{ color: '#fff' }} />}
                          </div>
                        )}
                        {hasImage && (
                          <div className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}>
                            Generated
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex flex-col flex-grow" onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                          <>
                            <Input value={concept.title} onChange={(e) => updateConcept(concept.id, 'title', e.target.value)} className="mb-2 text-sm font-semibold" style={{ padding: '8px' }} />
                            <TextArea value={concept.description} onChange={(e) => updateConcept(concept.id, 'description', e.target.value)} className="mb-3 text-xs flex-grow" style={{ minHeight: '80px', padding: '8px' }} />
                            <Button variant="secondary" onClick={() => setEditingConcept(null)} style={{ fontSize: '12px', padding: '8px' }}>Done</Button>
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-sm mb-1.5" style={{ color: 'var(--foreground)' }}>{concept.title}</div>
                            <div className="text-xs leading-relaxed flex-grow" style={{ color: 'var(--muted-foreground)' }}>
                              {isExpanded ? concept.description : `${concept.description.slice(0, 100)}${concept.description.length > 100 ? '…' : ''}`}
                            </div>
                            {isExpanded && concept.interpretation && (
                              <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(var(--border-rgb),0.12)' }}>
                                <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-subtle)' }}>Why it works</p>
                                <div className="text-xs leading-relaxed italic" style={{ color: 'var(--muted-foreground)' }}>{concept.interpretation}</div>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-3">
                              <button className="text-xs font-semibold" style={{ color: 'var(--primary)' }} onClick={() => setExpandedConcept(isExpanded ? null : concept.id)}>
                                {isExpanded ? 'Less' : 'More'}
                              </button>
                              <button className="text-xs font-semibold ml-auto" style={{ color: 'var(--muted-foreground)' }} onClick={() => setEditingConcept(concept.id)}>
                                <Edit2 className="w-3 h-3 inline mr-1" />Edit
                              </button>
                              <button onClick={() => deleteConcept(concept.id)}>
                                <X className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {/* Mobile: swipeable carousel */}
                    <div className="lg:hidden">
                      <Carousel opts={{ align: "start", loop: false }} setApi={setConceptCarouselApi}>
                        <CarouselContent className="-ml-3">
                          {(items as (Concept | number)[]).map((item, idx) => (
                            <CarouselItem key={typeof item === "number" ? item : item.id} className="pl-3">
                              {renderConceptCard(item)}
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                      </Carousel>
                      {!skeletons && concepts.length > 1 && (
                        <div className="flex justify-center gap-1.5 mt-3">
                          {concepts.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => conceptCarouselApi?.scrollTo(idx)}
                              className="rounded-full transition-all"
                              style={{
                                width: idx === currentConceptSlide ? '16px' : '6px',
                                height: '6px',
                                background: idx === currentConceptSlide ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.4)',
                              }}
                              aria-label={`Go to concept ${idx + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Desktop: 3-column grid */}
                    <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                      {(items as (Concept | number)[]).map((item) => (
                        <div key={typeof item === "number" ? item : item.id}>
                          {renderConceptCard(item)}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {/* Desktop action bar */}
              <div
                className="hidden lg:flex mt-6 p-5 rounded-2xl flex-row items-center justify-between gap-4"
                style={{ background: 'rgba(var(--primary-rgb), 0.06)', border: '1px solid rgba(var(--primary-rgb), 0.2)' }}
              >
                <div className="flex-1">
                  <div className="font-semibold text-sm mb-1" style={{ color: 'var(--foreground)' }}>
                    {selectedForImageGen.size > 0
                      ? `${selectedForImageGen.size} concept${selectedForImageGen.size > 1 ? 's' : ''} selected`
                      : 'Click a concept to select it'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {selectedForImageGen.size > 0
                      ? `Est. cost: $${(selectedForImageGen.size * 0.10).toFixed(2)} · ~${selectedForImageGen.size * 30}s`
                      : 'Select which concepts to turn into images'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setSelectedForImageGen(new Set(concepts.filter(c => !c.image).map(c => c.id)))}>
                    Select all
                  </Button>
                  <Button variant="primary" disabled={isGeneratingImages || selectedForImageGen.size === 0} onClick={handleGenerateImages}>
                    <Sparkles className="w-4 h-4 inline mr-2" />
                    {isGeneratingImages ? 'Generating…' : 'Generate images'}
                  </Button>
                </div>
              </div>

              {/* Desktop shortcut to results */}
              {concepts.some(c => c.image) && (
                <button
                  className="hidden lg:block w-full mt-3 py-2.5 text-sm font-semibold rounded-xl"
                  style={{ color: 'var(--primary)' }}
                  onClick={() => setViewPhase('results')}
                >
                  View generated images →
                </button>
              )}

              {/* Mobile: bottom padding so fixed bar doesn't overlap */}
              <div className="lg:hidden h-6" />
            </Card>

            {/* Mobile fixed action bar — Phase 1 */}
            {activeTab === "studio" && hasGeneratedConcepts && viewPhase === "concepts" && (
              <div
                className="lg:hidden fixed left-4 right-4 z-40 flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{
                  bottom: '84px',
                  background: 'var(--card)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
                  border: '1px solid rgba(var(--border-rgb), 0.14)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                    {selectedForImageGen.size > 0
                      ? `${selectedForImageGen.size} selected`
                      : 'Tap to select'}
                  </p>
                </div>
                <button
                  className="text-xs font-semibold flex-shrink-0"
                  style={{ color: 'var(--primary)' }}
                  onClick={() => setSelectedForImageGen(new Set(concepts.filter(c => !c.image).map(c => c.id)))}
                >
                  Select all
                </button>
                <Button
                  variant="primary"
                  disabled={isGeneratingImages || selectedForImageGen.size === 0}
                  onClick={handleGenerateImages}
                  style={{ fontSize: '13px', padding: '10px 16px', flexShrink: 0 }}
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
                  {isGeneratingImages ? 'Generating…' : 'Generate'}
                </Button>
              </div>
            )}
            </>
          ) : (
            /* ── Phase 2: Image results ── */
            <>
            <Card>
              {/* Mobile header */}
              <div className="lg:hidden flex items-center justify-between mb-5">
                <button
                  className="flex items-center gap-1.5 text-sm font-medium"
                  style={{ color: 'var(--muted-foreground)' }}
                  onClick={() => setViewPhase('concepts')}
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-subtle)' }}>Generated</p>
                <div className="w-12" />
              </div>

              {/* Desktop header */}
              <div className="hidden lg:flex lg:items-center justify-between gap-4 mb-6">
                <div>
                  <Eyebrow>Generated images</Eyebrow>
                  <SectionTitle>Choose the ones to save to your library</SectionTitle>
                </div>
                <Button variant="ghost" onClick={() => setViewPhase('concepts')} className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back to concepts
                </Button>
              </div>

              {(() => {
                const imageItems = concepts.filter(c => c.image);

                const renderImageCard = (concept: Concept) => {
                  const isSelected = selectedConcepts.has(concept.id);
                  return (
                    <div
                      className="rounded-2xl overflow-hidden flex flex-col transition-all cursor-pointer h-full"
                      style={{
                        border: `2px solid ${isSelected ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.14)'}`,
                        background: isSelected ? 'rgba(var(--primary-rgb), 0.04)' : 'var(--card)',
                      }}
                      onClick={() => toggleSelection(concept.id)}
                    >
                      <div className="w-full aspect-[4/3] relative overflow-hidden flex-shrink-0" style={{ backgroundColor: '#efe3cf' }}>
                        <img src={concept.image} alt={concept.title} className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(var(--primary-rgb), 0.18)' }}>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--primary)' }}>
                              <Check className="w-5 h-5" style={{ color: '#fff' }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-4" onClick={e => e.stopPropagation()}>
                        <div className="font-semibold text-sm mb-1" style={{ color: 'var(--foreground)' }}>{concept.title}</div>
                        <div className="text-xs leading-relaxed mb-3" style={{ color: 'var(--muted-foreground)' }}>
                          {concept.description.slice(0, 80)}{concept.description.length > 80 ? '…' : ''}
                        </div>
                        <Button variant="secondary" onClick={() => downloadImage(concept.image!, concept.title)} style={{ width: '100%', fontSize: '12px', padding: '9px' }}>
                          <Download className="w-3.5 h-3.5 inline mr-1.5" />Download
                        </Button>
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {/* Mobile: swipeable carousel */}
                    <div className="lg:hidden">
                      <Carousel opts={{ align: "start", loop: false }} setApi={setImageCarouselApi}>
                        <CarouselContent className="-ml-3">
                          {imageItems.map(concept => (
                            <CarouselItem key={concept.id} className="pl-3">
                              {renderImageCard(concept)}
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                      </Carousel>
                      {imageItems.length > 1 && (
                        <div className="flex justify-center gap-1.5 mt-3">
                          {imageItems.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => imageCarouselApi?.scrollTo(idx)}
                              className="rounded-full transition-all"
                              style={{
                                width: idx === currentImageSlide ? '16px' : '6px',
                                height: '6px',
                                background: idx === currentImageSlide ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.4)',
                              }}
                              aria-label={`Go to image ${idx + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Desktop: 3-column grid */}
                    <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                      {imageItems.map(concept => (
                        <div key={concept.id}>{renderImageCard(concept)}</div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {/* Desktop action bar */}
              <div
                className="hidden lg:flex mt-6 p-5 rounded-2xl flex-row items-center justify-between gap-4"
                style={{ background: 'rgba(34, 197, 94, 0.07)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
              >
                <div className="flex-1">
                  <div className="font-semibold text-sm mb-1" style={{ color: 'var(--foreground)' }}>
                    {selectedConcepts.size > 0
                      ? `${selectedConcepts.size} image${selectedConcepts.size > 1 ? 's' : ''} selected`
                      : 'Click an image to select it'}
                  </div>
                  <div className="text-xs" style={{ color: '#166534' }}>
                    {selectedConcepts.size > 0 ? 'Ready to save to your library' : 'Select which images to keep'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setSelectedConcepts(new Set(concepts.filter(c => c.image).map(c => c.id)))}>
                    Select all
                  </Button>
                  <Button variant="primary" disabled={selectedConcepts.size === 0} onClick={handleSaveToLibrary}>
                    Save to library
                  </Button>
                </div>
              </div>

              {/* Mobile: bottom padding */}
              <div className="lg:hidden h-6" />
            </Card>

            {/* Mobile fixed action bar — Phase 2 */}
            {activeTab === "studio" && hasGeneratedConcepts && viewPhase === "results" && (
              <div
                className="lg:hidden fixed left-4 right-4 z-40 flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{
                  bottom: '84px',
                  background: 'var(--card)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
                  border: '1px solid rgba(var(--border-rgb), 0.14)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                    {selectedConcepts.size > 0 ? `${selectedConcepts.size} selected` : 'Tap to select'}
                  </p>
                </div>
                <button
                  className="text-xs font-semibold flex-shrink-0"
                  style={{ color: 'var(--primary)' }}
                  onClick={() => setSelectedConcepts(new Set(concepts.filter(c => c.image).map(c => c.id)))}
                >
                  Select all
                </button>
                <Button
                  variant="primary"
                  disabled={selectedConcepts.size === 0}
                  onClick={handleSaveToLibrary}
                  style={{ fontSize: '13px', padding: '10px 16px', flexShrink: 0 }}
                >
                  Save
                </Button>
              </div>
            )}
            </>
          )}
        </div>
      )}

      {activeTab === "library" && (
        <div>
          {libraryLoading && (
            <div className="mb-4 flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              Loading thumbnail library...
            </div>
          )}
          {savedThumbnails.length === 0 && !libraryLoading ? (
            <Card>
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(var(--primary-rgb), 0.1)' }}>
                  <Image className="w-8 h-8" style={{ color: 'var(--primary)' }} />
                </div>
                <Eyebrow className="justify-center mb-2">Library</Eyebrow>
                <SectionTitle className="mb-3">No thumbnails saved yet</SectionTitle>
                <p className="text-sm max-w-xs mx-auto mb-6" style={{ color: 'var(--muted-foreground)' }}>
                  Generate thumbnails in the studio and save the ones you want to keep.
                </p>
                <Button variant="secondary" onClick={() => setActiveTab("studio")}>
                  Go to studio
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <Eyebrow>Thumbnail library</Eyebrow>
              <SectionTitle className="mb-5">Saved thumbnails</SectionTitle>

              <div
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-5"
                style={{ background: 'var(--secondary)', border: '1px solid rgba(var(--border-rgb), 0.14)' }}
              >
                <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search thumbnails..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--foreground)' }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")}>
                    <X className="w-3.5 h-3.5" style={{ color: 'var(--text-subtle)' }} />
                  </button>
                )}
              </div>

              {filteredThumbnails.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>No thumbnails match your search</p>
                  <button onClick={() => setSearchQuery("")} className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                    Clear search
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-subtle)' }}>
                    {filteredThumbnails.length} thumbnail{filteredThumbnails.length !== 1 ? 's' : ''}
                  </p>

                  {/* Mobile: tight 2-column image grid */}
                  <div className="lg:hidden grid grid-cols-2 gap-2">
                    {filteredThumbnails.map(thumbnail => (
                      <button
                        key={thumbnail.id}
                        className="relative overflow-hidden rounded-2xl w-full"
                        style={{ aspectRatio: '4/3' }}
                        onClick={() => setSelectedLibraryItem(thumbnail)}
                      >
                        <img src={thumbnail.image} alt={thumbnail.title} className="w-full h-full object-cover" />
                        <div
                          className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-6"
                          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)' }}
                        >
                          <p className="text-white text-[11px] font-semibold line-clamp-2 text-left leading-tight">{thumbnail.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Desktop: 3-column cards */}
                  <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                    {filteredThumbnails.map(thumbnail => (
                      <div
                        key={thumbnail.id}
                        className="rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all hover:shadow-md"
                        style={{ border: '1px solid rgba(var(--border-rgb), 0.14)', background: 'var(--card)' }}
                        onClick={() => setSelectedLibraryItem(thumbnail)}
                      >
                        <div className="w-full aspect-[4/3] overflow-hidden flex-shrink-0" style={{ backgroundColor: '#efe3cf' }}>
                          <img src={thumbnail.image} alt={thumbnail.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-4 flex flex-col flex-grow">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-semibold text-sm leading-snug flex-1" style={{ color: 'var(--foreground)' }}>{thumbnail.title}</p>
                            <span className="text-[10px] font-bold tracking-wider uppercase flex-shrink-0" style={{ color: 'var(--primary)' }}>
                              {formatRelativeTime(thumbnail.savedAt)}
                            </span>
                          </div>
                          {thumbnail.articleTitle && (
                            <p className="text-xs mb-4 flex-grow" style={{ color: 'var(--muted-foreground)' }}>{thumbnail.articleTitle}</p>
                          )}
                          <div className="flex gap-2 mt-auto" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="primary"
                              onClick={() => downloadImage(thumbnail.image, thumbnail.title)}
                              style={{ flex: 1, fontSize: '12px', padding: '9px' }}
                            >
                              <Download className="w-3.5 h-3.5 inline mr-1.5" />
                              Download
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => removeThumbnail(thumbnail.id)}
                              style={{ fontSize: '12px', padding: '9px' }}
                            >
                              <Trash2 className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Library detail — mobile slide-over + desktop modal */}
          {selectedLibraryItem && (
            <>
              {/* Shared backdrop */}
              <div
                className="fixed inset-0 z-40"
                style={{ background: 'rgba(0,0,0,0.45)' }}
                onClick={() => setSelectedLibraryItem(null)}
              />

              {/* Mobile: full-screen slide-over */}
              <div
                className="lg:hidden fixed inset-0 z-50 flex flex-col"
                style={{ background: 'var(--background)', animation: 'slideInRight 0.2s cubic-bezier(0.22,1,0.36,1)' }}
              >
                <div
                  className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3"
                  style={{ borderBottom: '1px solid rgba(var(--border-rgb),0.12)' }}
                >
                  <button onClick={() => setSelectedLibraryItem(null)} className="p-2 -ml-1 rounded-xl" style={{ color: 'var(--muted-foreground)' }}>
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-subtle)' }}>Saved thumbnail</p>
                    <h3 className="text-[16px] font-bold truncate" style={{ color: 'var(--foreground)' }}>{selectedLibraryItem.title}</h3>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div className="w-full aspect-[4/3]" style={{ backgroundColor: '#efe3cf' }}>
                    <img src={selectedLibraryItem.image} alt={selectedLibraryItem.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="px-4 py-5 space-y-5">
                    {selectedLibraryItem.articleTitle && (
                      <div>
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-subtle)' }}>Source article</p>
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{selectedLibraryItem.articleTitle}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-subtle)' }}>Concept</p>
                      <p className="text-sm" style={{ color: 'var(--foreground)' }}>{selectedLibraryItem.title}</p>
                    </div>
                    {selectedLibraryItem.conceptScene && (
                      <div>
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-subtle)' }}>Scene</p>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{selectedLibraryItem.conceptScene}</p>
                      </div>
                    )}
                    {selectedLibraryItem.conceptWhy && (
                      <div>
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-subtle)' }}>Why it works</p>
                        <p className="text-sm leading-relaxed italic" style={{ color: 'var(--muted-foreground)' }}>{selectedLibraryItem.conceptWhy}</p>
                      </div>
                    )}
                    {selectedLibraryItem.conceptPrompt && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-subtle)' }}>Image prompt</p>
                          <button
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg"
                            style={{ color: 'var(--primary)', background: 'rgba(var(--primary-rgb), 0.08)' }}
                            onClick={() => void copyPrompt(selectedLibraryItem.conceptPrompt!)}
                          >
                            <Copy size={10} /> Copy
                          </button>
                        </div>
                        <p className="text-xs leading-relaxed p-3 rounded-xl" style={{ color: 'var(--muted-foreground)', background: 'var(--secondary)', border: '1px solid rgba(var(--border-rgb),0.12)', fontFamily: 'monospace' }}>
                          {selectedLibraryItem.conceptPrompt}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-subtle)' }}>Saved</p>
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        {selectedLibraryItem.savedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <Button variant="primary" onClick={() => downloadImage(selectedLibraryItem.image, selectedLibraryItem.title)} style={{ flex: 1, padding: '14px', fontSize: '14px' }}>
                        <Download className="w-4 h-4 inline mr-2" />Download
                      </Button>
                      <Button variant="ghost" onClick={() => removeThumbnail(selectedLibraryItem.id)} style={{ padding: '14px' }}>
                        <Trash2 className="w-4 h-4" style={{ color: '#dc2626' }} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop: centered modal */}
              <div className="hidden lg:flex fixed inset-0 z-50 items-center justify-center p-6">
                <div
                  className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
                  style={{ background: 'var(--card)', boxShadow: '0 24px 80px rgba(20,12,4,0.25)' }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Modal header */}
                  <div
                    className="flex-shrink-0 flex items-start justify-between px-6 py-5"
                    style={{ borderBottom: '1px solid rgba(var(--border-rgb),0.1)' }}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-subtle)' }}>Saved thumbnail</p>
                      <h2 className="text-xl font-bold leading-tight" style={{ color: 'var(--foreground)' }}>{selectedLibraryItem.title}</h2>
                    </div>
                    <button onClick={() => setSelectedLibraryItem(null)} className="p-2 rounded-xl hover:bg-black/5 transition-colors flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal body */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="aspect-[16/9] w-full" style={{ backgroundColor: '#efe3cf' }}>
                      <img src={selectedLibraryItem.image} alt={selectedLibraryItem.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="px-6 py-5 space-y-5">
                      {selectedLibraryItem.conceptScene && (
                        <div>
                          <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-subtle)' }}>Scene</p>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{selectedLibraryItem.conceptScene}</p>
                        </div>
                      )}
                      {selectedLibraryItem.conceptWhy && (
                        <div>
                          <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-subtle)' }}>Why it works</p>
                          <p className="text-sm leading-relaxed italic" style={{ color: 'var(--muted-foreground)' }}>{selectedLibraryItem.conceptWhy}</p>
                        </div>
                      )}
                      {selectedLibraryItem.conceptPrompt && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-subtle)' }}>Image prompt</p>
                            <button
                              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg"
                              style={{ color: 'var(--primary)', background: 'rgba(var(--primary-rgb), 0.08)' }}
                              onClick={() => void copyPrompt(selectedLibraryItem.conceptPrompt!)}
                            >
                              <Copy size={10} /> Copy
                            </button>
                          </div>
                          <p className="text-xs leading-relaxed p-3 rounded-xl" style={{ color: 'var(--muted-foreground)', background: 'var(--secondary)', border: '1px solid rgba(var(--border-rgb),0.12)', fontFamily: 'monospace' }}>
                            {selectedLibraryItem.conceptPrompt}
                          </p>
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid rgba(var(--border-rgb),0.1)', paddingTop: '16px' }} className="grid grid-cols-2 gap-4">
                        {selectedLibraryItem.articleTitle && (
                          <div>
                            <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-subtle)' }}>Source article</p>
                            <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>{selectedLibraryItem.articleTitle}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-subtle)' }}>Saved</p>
                          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            {selectedLibraryItem.savedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="px-6 pb-6 flex gap-3">
                      <Button variant="primary" onClick={() => downloadImage(selectedLibraryItem.image, selectedLibraryItem.title)} style={{ flex: 1, padding: '12px', fontSize: '14px' }}>
                        <Download className="w-4 h-4 inline mr-2" />Download
                      </Button>
                      {selectedLibraryItem.articleUrl && (
                        <Button variant="secondary" onClick={() => void copyPrompt(selectedLibraryItem.articleUrl)} style={{ padding: '12px', fontSize: '14px' }}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => removeThumbnail(selectedLibraryItem.id)} style={{ padding: '12px' }}>
                        <Trash2 className="w-4 h-4" style={{ color: '#dc2626' }} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <MobileBottomNav
        items={[
          { id: "studio", label: "Studio", icon: Image },
          { id: "library", label: "Library", icon: Library },
        ]}
        activeItem={activeTab}
        onItemChange={setActiveTab}
      />

      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center w-full max-w-sm px-4 pointer-events-none">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className="w-full px-4 py-3 rounded-2xl text-sm font-medium"
              style={{
                background: toast.type === "error"
                  ? "#b91c1c"
                  : toast.type === "success"
                  ? "#15803d"
                  : "var(--foreground)",
                color: "#fff",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}
            >
              {toast.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
