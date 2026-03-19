import { useState } from "react";
import { BookOpen, Upload, FileText, Loader2, CheckCircle, ChevronUp, ChevronDown, ChevronLeft } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { Card, CardSection, Eyebrow, SectionTitle } from "./Card";
import { Field, Label, Input, Dropzone, Button, Toggle, CardButton, SegmentedControl } from "./FormComponents";
import { WYSIWYGEditor } from "./WYSIWYGEditor";
import { pipeline } from "../../lib/api";

type RunStatus = "ready" | "generating" | "done" | "error";

export function CompanionView() {
  const [runStatus, setRunStatus] = useState<RunStatus>("ready");
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [generateSpanish, setGenerateSpanish] = useState(true);
  const [reflectionText, setReflectionText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [reflectionTitle, setReflectionTitle] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [showFullArticle, setShowFullArticle] = useState(false);
  const [companionData, setCompanionData] = useState<{ title: string; title_es: string; en: string; es: string } | null>(null);
  const [tokenSummary, setTokenSummary] = useState<any>(null);
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setUploadedFileName(file.name);
    try {
      const text = await file.text();
      setReflectionText(text);
      const filenameWithoutExt = file.name.replace(/\.(md|markdown|txt)$/i, "");
      const h1Match = text.match(/^#\s+(.+)$/m);
      setReflectionTitle(h1Match ? h1Match[1].trim() : filenameWithoutExt);
    } catch {
      // ignore
    }
  };

  const handleGenerate = async () => {
    if (!reflectionText || !reflectionTitle) return;
    setRunStatus("generating");
    setError(null);
    try {
      const result = await pipeline.companion({
        text: reflectionText,
        title: reflectionTitle,
        article_url: articleUrl,
        include_spanish: generateSpanish,
      });
      setCompanionData(result.companion);
      setTokenSummary(result.tokens);
      setRunStatus("done");
    } catch (err: any) {
      setError(err.message ?? "Generation failed");
      setRunStatus("error");
    }
  };

  const handleNew = () => {
    setRunStatus("ready");
    setInputMode("file");
    setGenerateSpanish(true);
    setReflectionText("");
    setUploadedFileName("");
    setReflectionTitle("");
    setArticleUrl("");
    setShowFullArticle(false);
    setCompanionData(null);
    setTokenSummary(null);
    setError(null);
  };

  const displayContent = language === "es" ? (companionData?.es ?? "") : (companionData?.en ?? "");
  const canGenerate = !!reflectionText && !!reflectionTitle;
  const showMobileModal = runStatus === "generating" || runStatus === "done";

  // ── Shared form ────────────────────────────────────────────────────────────
  const Form = () => (
    <Card>
      <Eyebrow>Reflection source</Eyebrow>
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
              style={{ background: "var(--secondary)", border: "1px solid rgba(var(--border-rgb),0.12)" }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: "rgba(var(--primary-rgb),0.1)" }}>
                  <FileText className="w-5 h-5" style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <div className="text-sm font-semibold mb-0.5" style={{ color: "var(--foreground)" }}>
                    {reflectionTitle || "Untitled"}
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{uploadedFileName}</div>
                </div>
              </div>
              <button
                onClick={() => setShowFullArticle(!showFullArticle)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ color: "var(--primary)" }}
              >
                {showFullArticle ? <><ChevronUp className="w-4 h-4" />Hide</> : <><ChevronDown className="w-4 h-4" />Show</>}
              </button>
            </div>
            {showFullArticle && reflectionText && (
              <div
                className="p-4 rounded-xl text-sm max-h-60 overflow-y-auto mb-4"
                style={{ background: "var(--secondary)", border: "1px solid rgba(var(--border-rgb),0.12)", color: "var(--muted-foreground)" }}
              >
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{reflectionText}</pre>
              </div>
            )}
          </div>
        ) : (
          <Dropzone
            label="Drop reflection markdown here"
            description="Title is extracted from the file automatically."
            onFileUpload={handleFileUpload}
          />
        )
      ) : (
        <div style={{ height: "350px" }}>
          <Label className="mb-2 block">Reflection text</Label>
          <WYSIWYGEditor
            value={reflectionText}
            onChange={setReflectionText}
            placeholder="Paste your reflection text here..."
          />
        </div>
      )}

      <CardSection>
        <Eyebrow>Article metadata</Eyebrow>
        <SectionTitle className="mb-4">Reflection details</SectionTitle>
        <Field>
          <Label htmlFor="comp-title">Reflection title</Label>
          <Input
            id="comp-title"
            placeholder="Enter your reflection title..."
            value={reflectionTitle}
            onChange={(e) => setReflectionTitle(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="comp-url">Reflection URL</Label>
          <Input
            id="comp-url"
            placeholder="https://www.self-disciplined.com/p/..."
            value={articleUrl}
            onChange={(e) => setArticleUrl(e.target.value)}
          />
        </Field>
      </CardSection>

      <CardSection>
        <Eyebrow>Generation options</Eyebrow>
        <SectionTitle className="mb-5">Configure output</SectionTitle>
        <Toggle
          label="Generate Spanish version"
          description="Create a translated version of the companion content in Spanish."
          checked={generateSpanish}
          onChange={setGenerateSpanish}
        />
      </CardSection>

      <div className="mt-6 pt-6 border-t" style={{ borderTopColor: "rgba(var(--border-rgb),0.14)" }}>
        <Button variant="primary" onClick={handleGenerate} className="w-full mb-2.5" disabled={!canGenerate}>
          Generate companion
        </Button>
        {error && (
          <p className="text-center text-xs mt-2" style={{ color: "var(--destructive)" }}>{error}</p>
        )}
        <p className="text-center text-xs mt-3" style={{ color: "var(--muted-foreground)" }}>
          Estimated time: 45–60 seconds · Cost: ~$0.15
        </p>
      </div>
    </Card>
  );

  return (
    <div className="pb-6 lg:pb-0">
      <PageHeader
        kicker="Paid content"
        title="Companion article generation"
        description="Generate paid companion content independently from the full pipeline."
        action={
          <Button variant="secondary" onClick={handleNew}>
            New companion
          </Button>
        }
      />

      {/* ── MOBILE: full-screen modal when generating / done ─────────────── */}
      {showMobileModal && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col"
          style={{
            background: "var(--background)",
            animation: "slideInRight 0.22s cubic-bezier(0.22,1,0.36,1)",
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
              onClick={handleNew}
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
                {reflectionTitle || "Companion"}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                {runStatus === "generating" ? (
                  <span className="text-[12px] flex items-center gap-1" style={{ color: "var(--primary)" }}>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Generating companion…
                  </span>
                ) : (
                  <span className="text-[12px] flex items-center gap-1" style={{ color: "var(--text-subtle)" }}>
                    <CheckCircle className="w-3 h-3" style={{ color: "#22c55e" }} />
                    Complete
                    {tokenSummary?.estimated_cost_usd && (
                      <span
                        className="font-bold px-1.5 py-0.5 rounded ml-1"
                        style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}
                      >
                        ${Number(tokenSummary.estimated_cost_usd).toFixed(4)}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Language toggle — only show when Spanish was requested and done */}
            {runStatus === "done" && generateSpanish && companionData?.es && (
              <div
                className="flex items-center gap-1 rounded-lg p-1 flex-shrink-0"
                style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)" }}
              >
                {(["en", "es"] as const).map((lang) => (
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
            )}
          </div>

          {/* Thin progress bar while generating */}
          {runStatus === "generating" && (
            <div className="h-1 flex-shrink-0" style={{ background: "rgba(var(--primary-rgb),0.12)" }}>
              <div
                className="h-full"
                style={{ width: "60%", background: "var(--primary)", animation: "pulse 1.5s ease-in-out infinite" }}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" as any }}>
            {runStatus === "generating" ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                <Loader2 className="w-12 h-12 animate-spin mb-4" style={{ color: "var(--primary)" }} />
                <h3 className="text-base font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  Creating companion content
                </h3>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Analyzing your reflection and generating complementary paid content…
                </p>
              </div>
            ) : (
              <div style={{ height: "100%" }}>
                <WYSIWYGEditor
                  value={displayContent}
                  onChange={() => {}}
                  placeholder="Companion article content will appear here."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DESKTOP: two-column layout (always visible on lg+) ───────────── */}
      <div className={`${showMobileModal ? "hidden lg:block" : ""}`}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Left: form */}
          <div>
            {(runStatus === "ready" || runStatus === "error") ? (
              <Form />
            ) : (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Eyebrow>Source article</Eyebrow>
                    <SectionTitle>{reflectionTitle || "Companion run"}</SectionTitle>
                  </div>
                  {runStatus === "generating" ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-xs font-semibold">Generating</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(34,197,94,0.1)", color: "#166534" }}>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">Done</span>
                    </div>
                  )}
                </div>
                <div
                  className="p-4 rounded-xl mb-4"
                  style={{ background: "var(--secondary)", border: "1px solid rgba(var(--border-rgb),0.12)" }}
                >
                  <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-subtle)" }}>ARTICLE</div>
                  <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{reflectionTitle}</div>
                  {articleUrl && (
                    <div className="text-xs mt-1 truncate" style={{ color: "var(--muted-foreground)" }}>{articleUrl}</div>
                  )}
                </div>
                <Button variant="ghost" onClick={handleNew} className="w-full">
                  New companion
                </Button>
              </Card>
            )}
          </div>

          {/* Right: output — desktop only, mobile uses the full-screen modal */}
          <div className="hidden lg:block">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Eyebrow>Generated content</Eyebrow>
                  <SectionTitle>
                    {companionData
                      ? (language === "es" ? (companionData.title_es || companionData.title) : companionData.title)
                      : "Paid companion article"}
                  </SectionTitle>
                </div>
                <div className="flex items-center gap-2">
                  {tokenSummary?.estimated_cost_usd && (
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-lg"
                      style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}
                    >
                      ${Number(tokenSummary.estimated_cost_usd).toFixed(4)}
                    </span>
                  )}
                  {(runStatus === "ready" || runStatus === "error") && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(var(--border-rgb),0.06)", color: "var(--muted-foreground)" }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: "var(--text-subtle)" }} />
                      <span className="text-xs font-semibold">Ready</span>
                    </div>
                  )}
                  {runStatus === "generating" && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(var(--primary-rgb),0.1)", color: "var(--primary)" }}>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-xs font-semibold">Generating</span>
                    </div>
                  )}
                  {runStatus === "done" && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(34,197,94,0.1)", color: "#166534" }}>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">Done</span>
                    </div>
                  )}
                </div>
              </div>

              {runStatus === "done" && generateSpanish && companionData?.es && (
                <div className="flex items-center justify-end mb-4">
                  <SegmentedControl
                    options={[{ id: "en", label: "EN" }, { id: "es", label: "ES" }]}
                    value={language}
                    onChange={(v) => setLanguage(v as "en" | "es")}
                  />
                </div>
              )}

              {(runStatus === "ready" || runStatus === "error") && (
                <div
                  className="flex flex-col items-center justify-center py-16 px-6 rounded-xl text-center"
                  style={{ background: "var(--secondary)", border: "2px dashed rgba(var(--border-rgb),0.2)" }}
                >
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(var(--primary-rgb),0.1)" }}>
                    <BookOpen className="w-8 h-8" style={{ color: "var(--primary)" }} />
                  </div>
                  <h3 className="text-base font-semibold mb-2" style={{ color: "var(--foreground)" }}>Ready to generate</h3>
                  <p className="text-sm max-w-sm" style={{ color: "var(--muted-foreground)" }}>
                    Configure your reflection on the left and click "Generate companion" to create your paid content.
                  </p>
                </div>
              )}

              {runStatus === "generating" && (
                <div
                  className="flex flex-col items-center justify-center py-16 px-6 rounded-xl text-center"
                  style={{ background: "var(--secondary)", border: "1px solid rgba(var(--border-rgb),0.12)" }}
                >
                  <Loader2 className="w-12 h-12 animate-spin mb-4" style={{ color: "var(--primary)" }} />
                  <h3 className="text-base font-semibold mb-2" style={{ color: "var(--foreground)" }}>Creating companion content</h3>
                  <p className="text-sm max-w-sm" style={{ color: "var(--muted-foreground)" }}>
                    Analyzing your reflection and generating complementary paid content…
                  </p>
                </div>
              )}

              {runStatus === "done" && companionData && (
                <div style={{ height: "600px", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
                  <WYSIWYGEditor
                    value={displayContent}
                    onChange={() => {}}
                    placeholder="Companion article content will appear here."
                  />
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
