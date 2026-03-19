import { useState } from "react";
import { PageHeader } from "./PageHeader";
import { Tabs } from "./Tabs";
import { Card, CardSection, Eyebrow, SectionTitle } from "./Card";
import { Field, Label, Input, TextArea, Dropzone, Button, CardButton } from "./FormComponents";
import { MobileSection, MobileDivider } from "./MobileSection";
import { MobileBottomNav } from "./MobileBottomNav";
import { Sparkles, Download, Copy, ArrowLeft, ChevronDown, ChevronUp, Check, Trash2, Plus, Edit2, X, FileText, Upload, Image, Library } from "lucide-react";

interface Concept {
  id: number;
  title: string;
  description: string;
  interpretation: string;
  prompt: string;
  image?: string;
  isGenerating?: boolean;
}

export function ThumbnailView() {
  const [activeTab, setActiveTab] = useState("studio");
  const [inputMode, setInputMode] = useState<"article" | "custom">("article");
  const [fileName, setFileName] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSlug, setArticleSlug] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [expandedConcept, setExpandedConcept] = useState<number | null>(null);
  const [selectedConcepts, setSelectedConcepts] = useState<Set<number>>(new Set());
  const [hasGeneratedConcepts, setHasGeneratedConcepts] = useState(false);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [savedThumbnails, setSavedThumbnails] = useState<Array<{
    id: number;
    title: string;
    description: string;
    image: string;
    articleTitle: string;
    savedAt: Date;
  }>>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [editingConcept, setEditingConcept] = useState<number | null>(null);
  const [selectedForImageGen, setSelectedForImageGen] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLibraryItem, setExpandedLibraryItem] = useState<number | null>(null);
  const [idCounter, setIdCounter] = useState(1);

  const handleFileSelect = (file: File) => {
    setFileName(file.name);
    // Simulate file parsing
    setArticleTitle("You Don't Have Unlimited Bandwidth");
    setArticleSlug("you-don-t-have-unlimited-bandwidth");
  };

  const handleClearForm = () => {
    setFileName("");
    setArticleTitle("");
    setArticleSlug("");
    setCustomPrompt("");
    setHasGeneratedConcepts(false);
    setConcepts([]);
    setSelectedConcepts(new Set());
    setSelectedForImageGen(new Set());
    setExpandedConcept(null);
    setEditingConcept(null);
  };

  const handleNew = () => {
    setFileName("");
    setArticleTitle("");
    setArticleSlug("");
    setCustomPrompt("");
    setHasGeneratedConcepts(false);
    setConcepts([]);
    setSelectedConcepts(new Set());
    setSelectedForImageGen(new Set());
    setExpandedConcept(null);
    setEditingConcept(null);
    setInputMode("article");
  };

  const handleGenerateConcepts = () => {
    // Simulate concept generation (text only, no images)
    const timestamp = Date.now();
    const newConcepts: Concept[] = [
      {
        id: timestamp * 1000 + 0,
        title: "Parent at Kitchen Counter",
        description: "A parent stands at a kitchen counter with a closed laptop, a children's picture book, and a coffee mug, hand hovering between them as if deciding what to reach for next.",
        interpretation: "This captures the moment of physical context-switching between work, family, and personal priorities—the frozen instant before choosing which commitment to re-enter.",
        prompt: "Flat vector illustration of a person standing at a kitchen counter viewed from the side, hand positioned midway between three objects on the counter surface..."
      },
      {
        id: timestamp * 1000 + 1,
        title: "Desk Drawer Moment",
        description: "A person sits at a clean desk with one hand on a work document and the other hand caught between two project materials.",
        interpretation: "Symbolizes the mental weight of switching between different work contexts and the cognitive load of managing multiple priorities.",
        prompt: "Minimalist flat illustration of a workspace from above, showing hands positioned between different work materials on a clean desk surface..."
      },
      {
        id: timestamp * 1000 + 2,
        title: "Evening Transition",
        description: "A parent kneeling on the floor helping a child put away toys with a work bag sits by the door, showing the layered transitions.",
        interpretation: "Represents the physical and emotional transitions between roles, and the visible reminders of competing priorities that exist simultaneously.",
        prompt: "Warm flat vector illustration showing a figure transitioning between family time and work, with visual elements representing both contexts present in the same frame..."
      }
    ];
    setConcepts(newConcepts);
    setHasGeneratedConcepts(true);
  };

  const handleBackToForm = () => {
    setHasGeneratedConcepts(false);
    setConcepts([]);
    setExpandedConcept(null);
    setSelectedConcepts(new Set());
    setSelectedForImageGen(new Set());
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

  const handleGenerateImages = () => {
    // Generate images for selected concepts
    setConcepts(prev => prev.map(c => {
      if (selectedForImageGen.has(c.id)) {
        // Simulate image generation
        const images = [
          "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600&h=400&fit=crop",
          "https://images.unsplash.com/photo-1544725121-be3bf52e2dc8?w=600&h=400&fit=crop",
          "https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=600&h=400&fit=crop"
        ];
        return { ...c, image: images[Math.floor(Math.random() * images.length)] };
      }
      return c;
    }));
    setSelectedForImageGen(new Set());
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

  const handleSaveToLibrary = () => {
    // Save selected concepts to library with guaranteed unique IDs
    const conceptsToSave = concepts
      .filter(c => selectedConcepts.has(c.id) && c.image)
      .map((c) => {
        const uniqueId = idCounter;
        setIdCounter(prev => prev + 1);
        return {
          id: uniqueId,
          title: c.title,
          description: c.description,
          image: c.image!,
          articleTitle,
          savedAt: new Date()
        };
      });
    
    setSavedThumbnails(prev => [...conceptsToSave, ...prev]);
    setSelectedConcepts(new Set());
    
    // Show success message
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
    
    // Navigate to library tab
    setTimeout(() => setActiveTab("library"), 500);
  };

  const removeThumbnail = (id: number) => {
    setSavedThumbnails(prev => prev.filter(t => t.id !== id));
    if (expandedLibraryItem === id) {
      setExpandedLibraryItem(null);
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
    
    if (diffDays === 0) return "TODAY";
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
          {!hasGeneratedConcepts ? (
            /* Input Form */
            <Card>
              {/* Input Mode Toggle */}
              <div className="flex gap-2 sm:gap-3 lg:gap-2 mb-6 lg:mb-5">
                <CardButton
                  icon={<Upload className="w-5 h-5 lg:w-4 lg:h-4" />}
                  label="From article"
                  isActive={inputMode === "article"}
                  onClick={() => setInputMode("article")}
                />
                <CardButton
                  icon={<FileText className="w-5 h-5 lg:w-4 lg:h-4" />}
                  label="Custom prompt"
                  isActive={inputMode === "custom"}
                  onClick={() => setInputMode("custom")}
                />
              </div>

              {inputMode === "article" ? (
                /* Article Mode - 3 Column Layout */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-6">
                  {/* Left Column - Upload */}
                  <MobileSection className="lg:col-span-1">
                    <Eyebrow>Step 1</Eyebrow>
                    <SectionTitle className="mb-4">Upload article</SectionTitle>
                    <p className="text-[14px] lg:text-xs mb-5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                      Drop your markdown file to automatically extract the title, slug, and article content.
                    </p>
                    <Dropzone
                      label={fileName ? fileName : "Drop file here"}
                      description={fileName ? "File loaded successfully" : "Markdown or text files only"}
                      fileName={fileName}
                      onFileSelect={handleFileSelect}
                    />
                  </MobileSection>

                  {/* Middle Column - Metadata */}
                  <MobileSection className="lg:col-span-1">
                    <Eyebrow>Step 2</Eyebrow>
                    <SectionTitle className="mb-4">Review metadata</SectionTitle>
                    <p className="text-[14px] lg:text-xs mb-5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
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
                        placeholder="https://www.self-disciplined.com/p/..."
                      />
                    </Field>
                  </MobileSection>

                  {/* Right Column - Options */}
                  <MobileSection className="lg:col-span-1">
                    <Eyebrow>Step 3</Eyebrow>
                    <SectionTitle className="mb-4">Generate concepts</SectionTitle>
                    <p className="text-[14px] lg:text-xs mb-5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                      Choose how many thumbnail concepts to generate from your article.
                    </p>

                    <Field>
                      <Label htmlFor="prompt-override">Custom prompt (optional)</Label>
                      <Input
                        id="prompt-override"
                        placeholder="Add specific visual direction..."
                      />
                    </Field>

                    <div 
                      className="p-4 lg:p-4 rounded-2xl mb-5"
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
                        <div className="mb-1">• 3 unique concepts (text only)</div>
                        <div className="mb-1">• Edit before generating images</div>
                        <div>• Est. cost: $0.05 · 15 seconds</div>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      onClick={handleGenerateConcepts}
                      disabled={!fileName || !articleTitle}
                      style={{ width: '100%', padding: '14px', fontSize: '14px', marginBottom: '10px' }}
                    >
                      Generate concepts
                    </Button>
                    
                    <Button
                      variant="ghost"
                      onClick={handleClearForm}
                      style={{ width: '100%', padding: '12px', fontSize: '13px' }}
                    >
                      Clear form
                    </Button>
                  </MobileSection>
                </div>
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
                    disabled={!articleTitle || !customPrompt}
                    style={{ width: '100%', padding: '14px', fontSize: '14px', marginBottom: '10px' }}
                  >
                    Generate concepts
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
          ) : (
            /* Concepts Review View - Two Step Generation */
            <Card>
              {/* Header with back button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <Eyebrow>Concept review</Eyebrow>
                  <SectionTitle>Edit concepts before generating images</SectionTitle>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary"
                    onClick={addCustomConcept}
                    className="flex items-center gap-2 flex-1 sm:flex-none justify-center"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add custom</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={handleBackToForm}
                    className="flex items-center gap-2 flex-1 sm:flex-none justify-center"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Back to form</span>
                    <span className="sm:hidden">Back</span>
                  </Button>
                </div>
              </div>

              {/* Concepts grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {concepts.map((concept) => {
                  const isExpanded = expandedConcept === concept.id;
                  const isEditing = editingConcept === concept.id;
                  const isSelectedForGen = selectedForImageGen.has(concept.id);
                  const hasImage = !!concept.image;
                  const isSelected = selectedConcepts.has(concept.id);
                  
                  return (
                    <div
                      key={concept.id}
                      className="transition-all rounded-2xl overflow-hidden flex flex-col"
                      style={{
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: isExpanded ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.14)',
                        background: isExpanded ? 'rgba(var(--primary-rgb), 0.04)' : 'var(--card)'
                      }}
                    >
                      {/* Image placeholder or actual image */}
                      <div className="relative">
                        {hasImage ? (
                          <>
                            <div 
                              className="w-full aspect-[4/3] bg-cover bg-center cursor-pointer"
                              style={{ 
                                backgroundImage: `url(${concept.image})`,
                                backgroundColor: '#efe3cf'
                              }}
                              onClick={() => setExpandedConcept(isExpanded ? null : concept.id)}
                            />
                            {/* Selection checkbox for saving */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelection(concept.id);
                              }}
                              className="absolute top-3 right-3 w-7 h-7 rounded-lg transition-all flex items-center justify-center"
                              style={{
                                background: isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.9)',
                                borderWidth: '2px',
                                borderStyle: 'solid',
                                borderColor: isSelected ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.2)',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                              }}
                            >
                              {isSelected && <Check className="w-4 h-4" style={{ color: '#fff' }} />}
                            </button>
                          </>
                        ) : (
                          <>
                            <div 
                              className="w-full aspect-[4/3] flex flex-col items-center justify-center cursor-pointer"
                              style={{ background: '#efe3cf' }}
                              onClick={() => setExpandedConcept(isExpanded ? null : concept.id)}
                            >
                              <Sparkles className="w-10 h-10 mb-3" style={{ color: 'var(--primary)', opacity: 0.5 }} />
                              <div className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                                No image yet
                              </div>
                              <div className="text-[11px] mt-1" style={{ color: 'var(--text-subtle)' }}>
                                Check box to generate
                              </div>
                            </div>
                            {/* Selection checkbox for image generation */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleImageGenSelection(concept.id);
                              }}
                              className="absolute top-3 right-3 w-7 h-7 rounded-lg transition-all flex items-center justify-center"
                              style={{
                                background: isSelectedForGen ? 'var(--primary)' : 'rgba(255, 255, 255, 0.9)',
                                borderWidth: '2px',
                                borderStyle: 'solid',
                                borderColor: isSelectedForGen ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.2)',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                              }}
                            >
                              {isSelectedForGen && <Check className="w-4 h-4" style={{ color: '#fff' }} />}
                            </button>
                          </>
                        )}
                      </div>
                      
                      {/* Card content */}
                      <div className="p-4 flex flex-col flex-grow">
                        {isEditing ? (
                          <>
                            <Input
                              value={concept.title}
                              onChange={(e) => updateConcept(concept.id, 'title', e.target.value)}
                              className="mb-2 text-sm font-semibold"
                              style={{ padding: '8px' }}
                            />
                            <TextArea
                              value={concept.description}
                              onChange={(e) => updateConcept(concept.id, 'description', e.target.value)}
                              className="mb-3 text-xs flex-grow"
                              style={{ minHeight: '80px', padding: '8px' }}
                            />
                            <Button
                              variant="secondary"
                              onClick={() => setEditingConcept(null)}
                              style={{ fontSize: '12px', padding: '8px', marginBottom: '8px' }}
                            >
                              Done editing
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-sm mb-2" style={{ color: 'var(--foreground)' }}>
                              {concept.title}
                            </div>
                            <div className="text-xs leading-relaxed mb-4 flex-grow" style={{ color: 'var(--muted-foreground)' }}>
                              {concept.description}
                            </div>
                          </>
                        )}

                        {/* Actions */}
                        {!isEditing && (
                          <div className="flex gap-2 mb-3">
                            {hasImage ? (
                              <>
                                <Button variant="primary" style={{ flex: 1, fontSize: '12px', padding: '10px' }}>
                                  <Download className="w-3.5 h-3.5 inline mr-1.5" />
                                  Download
                                </Button>
                                <Button 
                                  variant="secondary" 
                                  onClick={() => setEditingConcept(concept.id)}
                                  style={{ fontSize: '12px', padding: '10px' }}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button 
                                  variant="secondary" 
                                  onClick={() => setEditingConcept(concept.id)}
                                  style={{ flex: 1, fontSize: '12px', padding: '10px' }}
                                >
                                  <Edit2 className="w-3.5 h-3.5 inline mr-1.5" />
                                  Edit
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  onClick={() => deleteConcept(concept.id)}
                                  style={{ fontSize: '12px', padding: '10px' }}
                                >
                                  <X className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                                </Button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Expandable details */}
                        {isExpanded && !isEditing && (
                          <div 
                            className="pt-4 mt-4"
                            style={{
                              borderTop: '1px solid rgba(var(--border-rgb), 0.14)'
                            }}
                          >
                            <div className="mb-4">
                              <Eyebrow>Interpretation</Eyebrow>
                              <div className="text-xs leading-relaxed italic mt-2" style={{ color: 'var(--muted-foreground)' }}>
                                {concept.interpretation}
                              </div>
                            </div>

                            <div>
                              <Eyebrow>Generation prompt</Eyebrow>
                              <div 
                                className="text-[11px] px-3 py-2.5 rounded-xl mt-2 font-mono leading-relaxed"
                                style={{
                                  background: '#efe3cf',
                                  color: 'var(--muted-foreground)',
                                  borderWidth: '1px',
                                  borderStyle: 'solid',
                                  borderColor: 'rgba(var(--border-rgb), 0.14)'
                                }}
                              >
                                {concept.prompt}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Toggle details button */}
                        {!isEditing && (
                          <button
                            onClick={() => setExpandedConcept(isExpanded ? null : concept.id)}
                            className="w-full flex items-center justify-center gap-2 py-2 mt-2 text-xs font-semibold transition-colors rounded-xl"
                            style={{
                              color: isExpanded ? 'var(--primary)' : 'var(--muted-foreground)',
                              background: 'transparent'
                            }}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Hide details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                View details
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Generate images action (show when concepts without images exist) */}
              {concepts.some(c => !c.image) && (
                <div 
                  className="mt-6 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  style={{
                    background: 'rgba(var(--primary-rgb), 0.06)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(var(--primary-rgb), 0.2)'
                  }}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-sm mb-1" style={{ color: 'var(--foreground)' }}>
                      {selectedForImageGen.size > 0 
                        ? `Generate images for ${selectedForImageGen.size} concept${selectedForImageGen.size > 1 ? 's' : ''}`
                        : 'Select concepts to generate images'
                      }
                    </div>
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {selectedForImageGen.size > 0
                        ? `Est. cost: $${(selectedForImageGen.size * 0.10).toFixed(2)} · ${selectedForImageGen.size * 30} seconds`
                        : 'Check the box on any concept card to select it for image generation'
                      }
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                      variant="secondary"
                      onClick={() => {
                        const conceptsWithoutImages = concepts.filter(c => !c.image).map(c => c.id);
                        setSelectedForImageGen(new Set(conceptsWithoutImages));
                      }}
                      className="flex-1 sm:flex-none"
                    >
                      Select all
                    </Button>
                    <Button 
                      variant="primary"
                      disabled={selectedForImageGen.size === 0}
                      onClick={handleGenerateImages}
                      className="flex-1 sm:flex-none"
                    >
                      <Sparkles className="w-4 h-4 inline mr-2" />
                      <span className="hidden sm:inline">Generate images</span>
                      <span className="sm:hidden">Generate</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Save to library action (show when any concept has an image) */}
              {concepts.some(c => c.image) && (
                <div 
                  className="mt-6 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  style={{
                    background: 'rgba(34, 197, 94, 0.08)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(34, 197, 94, 0.2)'
                  }}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-sm mb-1" style={{ color: 'var(--foreground)' }}>
                      {selectedConcepts.size > 0 
                        ? `Save ${selectedConcepts.size} thumbnail${selectedConcepts.size > 1 ? 's' : ''} to library`
                        : 'Select thumbnails to save'
                      }
                    </div>
                    <div className="text-xs" style={{ color: '#166534' }}>
                      {selectedConcepts.size > 0
                        ? 'Your selected thumbnails will be added to your library for reuse'
                        : 'Click the checkbox on any generated thumbnail to select it'
                      }
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                      variant="secondary"
                      onClick={() => {
                        const conceptsWithImages = concepts.filter(c => c.image).map(c => c.id);
                        setSelectedConcepts(new Set(conceptsWithImages));
                      }}
                      className="flex-1 sm:flex-none"
                    >
                      Select all
                    </Button>
                    <Button 
                      variant="primary"
                      disabled={selectedConcepts.size === 0 || concepts.filter(c => selectedConcepts.has(c.id) && c.image).length === 0}
                      onClick={handleSaveToLibrary}
                      className="flex-1 sm:flex-none"
                    >
                      Save to library
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {activeTab === "library" && (
        <div className="relative">
          {/* Success message */}
          {showSuccessMessage && (
            <div 
              className="mb-4 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300"
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'rgba(34, 197, 94, 0.3)'
              }}
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#22c55e' }}
              >
                <Check className="w-5 h-5" style={{ color: '#fff' }} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm mb-0.5" style={{ color: '#15803d' }}>
                  Successfully saved to library
                </div>
                <div className="text-xs" style={{ color: '#16a34a' }}>
                  Your selected thumbnails are now available in your library
                </div>
              </div>
            </div>
          )}

          {savedThumbnails.length === 0 ? (
            <Card>
              <div className="text-center py-16">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ background: 'rgba(var(--primary-rgb), 0.1)' }}
                >
                  <svg className="w-10 h-10" style={{ color: 'var(--primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 
                  className="text-lg mb-2"
                  style={{
                    fontFamily: '"Montserrat", "Inter", sans-serif',
                    fontWeight: 800,
                    color: 'var(--foreground)'
                  }}
                >
                  Your thumbnail library is empty
                </h3>
                <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--muted-foreground)' }}>
                  Generated thumbnails will be saved here for easy access and reuse across your content
                </p>
                <Button variant="secondary" onClick={() => setActiveTab("studio")}>
                  Go to studio
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              {/* Search header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex-1">
                  <Eyebrow>Thumbnail library</Eyebrow>
                  <SectionTitle className="mb-3">Your saved thumbnails</SectionTitle>
                  <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
                    Click any thumbnail to expand and view full details, download, or delete.
                  </p>
                </div>
              </div>
              
              <Input
                placeholder="Search by article title, URL, or concept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', marginBottom: '24px' }}
              />

              {filteredThumbnails.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    {searchQuery ? 'No thumbnails match your search' : 'No thumbnails in library'}
                  </div>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-xs font-semibold"
                      style={{ color: 'var(--primary)' }}
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Results count */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      {filteredThumbnails.length} thumbnail{filteredThumbnails.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                      Click to expand
                    </div>
                  </div>

                  {/* Gallery grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredThumbnails.map((thumbnail) => {
                      const isExpanded = expandedLibraryItem === thumbnail.id;
                      
                      return (
                        <div
                          key={thumbnail.id}
                          className="transition-all rounded-2xl overflow-hidden flex flex-col"
                          style={{
                            borderWidth: '2px',
                            borderStyle: 'solid',
                            borderColor: isExpanded ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.14)',
                            background: isExpanded ? 'rgba(var(--primary-rgb), 0.04)' : 'var(--card)',
                            height: '100%'
                          }}
                        >
                          {/* Thumbnail image */}
                          <div 
                            className="w-full aspect-[4/3] bg-cover bg-center cursor-pointer flex-shrink-0"
                            style={{ 
                              backgroundImage: `url(${thumbnail.image})`,
                              backgroundColor: '#efe3cf'
                            }}
                            onClick={() => setExpandedLibraryItem(isExpanded ? null : thumbnail.id)}
                          />
                          
                          {/* Card content */}
                          <div className="p-4 flex flex-col flex-grow">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="font-semibold text-sm flex-1" style={{ color: 'var(--foreground)' }}>
                                {thumbnail.title}
                              </div>
                              <div className="text-[10px] uppercase tracking-wider font-bold whitespace-nowrap flex-shrink-0" style={{ color: 'var(--primary)' }}>
                                {formatRelativeTime(thumbnail.savedAt)}
                              </div>
                            </div>
                            
                            <div className="text-xs leading-relaxed mb-3 flex-grow" style={{ color: 'var(--muted-foreground)' }}>
                              {thumbnail.description}
                            </div>

                            {/* Quick actions (collapsed state) */}
                            {!isExpanded && (
                              <div className="flex gap-2 mb-3 mt-auto">
                                <Button variant="primary" style={{ flex: 1, fontSize: '12px', padding: '10px' }}>
                                  <Download className="w-3.5 h-3.5 inline mr-1.5" />
                                  Download
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeThumbnail(thumbnail.id);
                                  }}
                                  style={{ fontSize: '12px', padding: '10px' }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                                </Button>
                              </div>
                            )}

                            {/* Expanded details */}
                            {isExpanded && (
                              <div 
                                className="pt-4 mt-auto"
                                style={{
                                  borderTop: '1px solid rgba(var(--border-rgb), 0.14)'
                                }}
                              >
                                <div className="mb-4">
                                  <Eyebrow>Source article</Eyebrow>
                                  <div className="text-sm font-medium mt-2 mb-1" style={{ color: 'var(--foreground)' }}>
                                    {thumbnail.articleTitle}
                                  </div>
                                  <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                                    Saved {thumbnail.savedAt.toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: 'numeric',
                                      minute: 'numeric',
                                      hour12: true
                                    })}
                                  </div>
                                </div>

                                {/* Extended actions */}
                                <div className="flex gap-2 mb-3">
                                  <Button variant="primary" style={{ flex: 1, fontSize: '12px', padding: '10px' }}>
                                    <Download className="w-3.5 h-3.5 inline mr-1.5" />
                                    Download
                                  </Button>
                                  <Button 
                                    variant="secondary" 
                                    style={{ fontSize: '12px', padding: '10px' }}
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    onClick={() => removeThumbnail(thumbnail.id)}
                                    style={{ fontSize: '12px', padding: '10px' }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Toggle details button */}
                            <button
                              onClick={() => setExpandedLibraryItem(isExpanded ? null : thumbnail.id)}
                              className="w-full flex items-center justify-center gap-2 py-2 mt-2 text-xs font-semibold transition-colors rounded-xl"
                              style={{
                                color: isExpanded ? 'var(--primary)' : 'var(--muted-foreground)',
                                background: 'transparent'
                              }}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-4 h-4" />
                                  Collapse
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4" />
                                  View details
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </Card>
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
    </div>
  );
}