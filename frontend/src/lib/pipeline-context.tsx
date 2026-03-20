import { createContext, useContext, useRef, useState, useEffect, ReactNode } from "react";
import { pipelineFetch, thumbnailConceptsFetch, pipeline, history } from "./api";

const PIPELINE_STAGE_NAMES = [
  "Related Articles",
  "Reflection",
  "Translation",
  "Companion",
  "Social Posts",
  "Pillar Tags",
  "Quotes",
  "Thumbnail",
];

export interface PipelineStage {
  stage: string;
  label: string;
  status: "waiting" | "running" | "done" | "skipped";
}

interface StartOptions {
  generateSpanish: boolean;
  autoThumbnail: boolean;
  articleText: string;
  articleTitle: string;
  articleUrl: string;
  uploadedFileName: string;
  socialTone: number;
}

interface PipelineContextType {
  running: boolean;
  hasRun: boolean;
  pipelineStages: PipelineStage[];
  runData: any | null;
  runError: string | null;
  tokenSummary: any | null;
  startPipeline: (opts: StartOptions) => Promise<void>;
  cancelPipeline: () => Promise<void>;
  resetPipeline: () => void;
  pendingQueue: StartOptions[];
  queueRun: (opts: StartOptions) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

const PipelineContext = createContext<PipelineContextType | null>(null);
const ACTIVE_RUN_STORAGE_KEY = "ep_active_run";

function getPersistentStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function stageStatusFromCheckpoint(
  stageName: string,
  checkpoint: { completed_steps?: unknown; include_spanish?: boolean },
): PipelineStage["status"] {
  const completedSteps = Array.isArray(checkpoint.completed_steps) ? checkpoint.completed_steps : [];
  const completed = new Set(completedSteps.filter((step): step is string => typeof step === "string"));
  if (stageName === "Reflection") return "done";
  if (stageName === "Translation") {
    if (checkpoint.include_spanish === false) return "skipped";
    return completed.has("reflection_es") || completed.has("companion_es") ? "done" : "waiting";
  }
  if (stageName === "Related Articles") return completed.has("related_articles") ? "done" : "waiting";
  if (stageName === "Companion") return completed.has("companion_en") ? "done" : "waiting";
  if (stageName === "Social Posts") {
    return completed.has("reflection_social_en") || completed.has("companion_social_en") ? "done" : "waiting";
  }
  if (stageName === "Pillar Tags") return completed.has("tags") ? "done" : "waiting";
  if (stageName === "Quotes") return completed.has("quotes") ? "done" : "waiting";
  return "waiting";
}

function buildRunDataFromCheckpoint(checkpoint: any) {
  const data = checkpoint?.data ?? {};
  return {
    reflection_title: checkpoint?.reflection_title ?? checkpoint?.title ?? "",
    article_url: checkpoint?.article_url ?? "",
    _articleText: checkpoint?.reflection ?? "",
    reflection: {
      en: checkpoint?.reflection ?? "",
      ...(data.reflection_es ? { es: data.reflection_es.content ?? data.reflection_es } : {}),
      ...(data.reflection_social_en ? { repurposed_en: data.reflection_social_en } : {}),
      ...(data.reflection_social_es ? { repurposed_es: data.reflection_social_es } : {}),
    },
    companion: {
      ...(data.companion_en ? { en: data.companion_en.content ?? data.companion_en, title: data.companion_en.title } : {}),
      ...(data.companion_es ? { es: data.companion_es.content ?? data.companion_es } : {}),
      ...(data.companion_social_en ? { repurposed_en: data.companion_social_en } : {}),
      ...(data.companion_social_es ? { repurposed_es: data.companion_social_es } : {}),
    },
    related_articles: Array.isArray(data.related_articles) ? data.related_articles : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    quotes: Array.isArray(data.quotes) ? data.quotes : [],
  };
}

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [runData, setRunData] = useState<any>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [tokenSummary, setTokenSummary] = useState<any>(null);
  const [pendingQueue, setPendingQueue] = useState<StartOptions[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const startPipelineRef = useRef<((opts: StartOptions) => Promise<void>) | null>(null);
  const queueInitialized = useRef(false);

  useEffect(() => {
    const storage = getPersistentStorage();
    if (!storage) return;
    let saved: any = null;
    try {
      const raw = storage.getItem(ACTIVE_RUN_STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      storage.removeItem(ACTIVE_RUN_STORAGE_KEY);
      return;
    }

    const restoreFromStorage = () => {
      if (!saved) return;
      const wasRunning = saved.running === true;
      if (Array.isArray(saved.pipelineStages)) setPipelineStages(saved.pipelineStages);
      if (saved.runData) setRunData(saved.runData);
      setRunning(false);
      if (typeof saved.hasRun === "boolean") setHasRun(saved.hasRun);
      if (saved.runError) setRunError(saved.runError);
      else if (wasRunning) setRunError("Pipeline was interrupted. Resume if a checkpoint is available.");
      if (saved.tokenSummary) setTokenSummary(saved.tokenSummary);
    };

    restoreFromStorage();

    if (saved?.running !== true) return;

    pipeline.checkpoint().then((checkpoint) => {
      if (!checkpoint?.exists) return;
      const checkpointStages: PipelineStage[] = PIPELINE_STAGE_NAMES.map((name) => ({
        stage: name,
        label: name,
        status: stageStatusFromCheckpoint(name, checkpoint),
      }));
      setPipelineStages(checkpointStages);
      setRunData((prev: any) => ({
        ...(prev ?? {}),
        ...buildRunDataFromCheckpoint(checkpoint),
      }));
      setHasRun(false);
      setRunError("Pipeline was interrupted. Resume if a checkpoint is available.");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const storage = getPersistentStorage();
    if (!storage) return;
    const shouldPersist = !!runData && (running || hasRun || pipelineStages.length > 0 || !!runError);
    if (!shouldPersist) {
      storage.removeItem(ACTIVE_RUN_STORAGE_KEY);
      return;
    }
    storage.setItem(ACTIVE_RUN_STORAGE_KEY, JSON.stringify({
      running,
      hasRun,
      pipelineStages,
      runData,
      runError,
      tokenSummary,
    }));
  }, [running, hasRun, pipelineStages, runData, runError, tokenSummary]);

  // Persist queue to server on every change — skip the initial render (queue starts
  // empty; the on-mount effect loads the real value from the server)
  useEffect(() => {
    if (!queueInitialized.current) return;
    if (pendingQueue.length > 0) {
      pipeline.saveQueue(pendingQueue).catch(() => {});
    } else {
      pipeline.clearQueue().catch(() => {});
    }
  }, [pendingQueue]);

  // On mount: load queue from server, set state to remaining items, kick off first
  useEffect(() => {
    pipeline.getQueue().then(({ items }) => {
      if (items.length > 0) {
        const [first, ...rest] = items;
        setPendingQueue(rest);
        setTimeout(() => startPipelineRef.current?.(first), 150);
      }
    }).catch(() => {}).finally(() => {
      // Allow the save effect to run from this point onward
      queueInitialized.current = true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetPipeline = () => {
    setRunning(false);
    setHasRun(false);
    setPipelineStages([]);
    setRunData(null);
    setRunError(null);
    setTokenSummary(null);
    getPersistentStorage()?.removeItem(ACTIVE_RUN_STORAGE_KEY);
  };

  const cancelPipeline = async () => {
    setRunError("Pipeline cancelled.");
    setHasRun(false);
    setRunning(false);
    setPipelineStages(prev => prev.map((stage) =>
      stage.status === "running" ? { ...stage, status: "skipped" } : stage
    ));
    setRunData((prev: any) => prev ? { ...prev, status: "cancelled" } : prev);
    abortRef.current?.abort();
    await pipeline.cancel().catch(() => {});
  };

  const queueRun = (opts: StartOptions) => {
    if (!running) {
      startPipeline(opts);
    } else {
      setPendingQueue(prev => [...prev, opts]);
    }
  };

  const removeFromQueue = (index: number) => {
    setPendingQueue(prev => prev.filter((_, i) => i !== index));
  };

  const clearQueue = () => {
    setPendingQueue([]);
  };

  const startPipeline = async (opts: StartOptions) => {
    if (running) return;
    const { generateSpanish, autoThumbnail, articleText, articleTitle, articleUrl, uploadedFileName, socialTone } = opts;

    setRunning(true);
    setRunError(null);
    setRunData({ _articleText: articleText, reflection_title: articleTitle, article_url: articleUrl, _autoThumbnail: autoThumbnail, reflection: { en: articleText } });
    setHasRun(false);
    setTokenSummary(null);

    const initialStages: PipelineStage[] = PIPELINE_STAGE_NAMES.map(name => ({
      stage: name,
      label: name,
      status:
        name === "Reflection" ? "done"
        : name === "Thumbnail" ? (autoThumbnail ? "waiting" : "skipped")
        : name === "Translation" && !generateSpanish ? "skipped"
        : "waiting",
    }));
    setPipelineStages(initialStages);

    const markStage = (name: string, status: PipelineStage["status"]) => {
      setPipelineStages(prev => prev.map(s => s.stage === name ? { ...s, status } : s));
    };

    const socialEventsReceived = new Set<string>();
    const expectedSocial = generateSpanish
      ? ["reflection_social_en", "reflection_social_es", "companion_social_en", "companion_social_es"]
      : ["reflection_social_en", "companion_social_en"];

    const formData = new FormData();
    const blob = new Blob([articleText], { type: "text/plain" });
    formData.append("reflection", blob, uploadedFileName || "article.md");
    formData.append("title", articleTitle);
    formData.append("article_url", articleUrl);
    formData.append("queue_social", "false");
    formData.append("include_spanish", generateSpanish ? "true" : "false");
    formData.append("tone_level", String(socialTone));

    const abort = new AbortController();
    abortRef.current = abort;

    // Shared mutable boxes — written by SSE callbacks, read in finally
    const runIdRef = { current: null as string | null };
    const conceptsAccumulator: any[] = [];

    // Start thumbnail generation in parallel if requested
    let thumbnailPromise: Promise<void> | null = null;
    if (autoThumbnail) {
      markStage("Thumbnail", "running");
      thumbnailPromise = thumbnailConceptsFetch(
        articleTitle,
        articleText,
        (event, data) => {
          if (event === "concepts_ready") {
            conceptsAccumulator.push(...data.concepts);
            setRunData((prev: any) => ({ ...(prev ?? {}), thumbnailConcepts: data.concepts }));
          } else if (event === "concept_image") {
            const idx = conceptsAccumulator.findIndex((c: any) => c.index === data.index);
            if (idx !== -1) {
              conceptsAccumulator[idx] = { ...conceptsAccumulator[idx], image_b64: data.image_b64, revised_prompt: data.revised_prompt };
            }
            setRunData((prev: any) => {
              const concepts = (prev?.thumbnailConcepts ?? []).map((c: any) =>
                c.index === data.index ? { ...c, image_b64: data.image_b64, revised_prompt: data.revised_prompt } : c
              );
              return { ...(prev ?? {}), thumbnailConcepts: concepts };
            });
          } else if (event === "done") {
            markStage("Thumbnail", "done");
          } else if (event === "error") {
            markStage("Thumbnail", "skipped");
          }
        },
        abort.signal
      ).catch(err => {
        if (err.name !== "AbortError") {
          markStage("Thumbnail", "skipped");
        }
      });
    }

    // When thumbnail generation finishes, persist concepts to history.
    // This runs detached — does not block setRunning(false).
    if (thumbnailPromise) {
      thumbnailPromise.then(() => {
        if (runIdRef.current && conceptsAccumulator.length > 0) {
          history.saveThumbnailConcepts(runIdRef.current, conceptsAccumulator).catch(() => {});
        }
      });
    }

    try {
      await pipelineFetch(
        formData,
        (event, data) => {
          console.log("[pipeline event]", event, data);
          if (event === "progress") {
            const msg: string = data?.message ?? "";
            if (!data?.done) {
              if (/related/i.test(msg)) markStage("Related Articles", "running");
              else if (/translat.*reflection|reflection.*translat/i.test(msg)) markStage("Translation", "running");
              else if (/companion/i.test(msg) && !/social/i.test(msg)) markStage("Companion", "running");
              else if (/social/i.test(msg)) markStage("Social Posts", "running");
              else if (/tag/i.test(msg)) markStage("Pillar Tags", "running");
              else if (/quote/i.test(msg)) markStage("Quotes", "running");
              else if (/translat.*companion|companion.*translat/i.test(msg)) markStage("Translation", "running");
            }
          } else if (event === "related_articles") {
            markStage("Related Articles", "done");
            setRunData((prev: any) => ({ ...(prev ?? {}), related_articles: data }));
          } else if (event === "reflection_es") {
            markStage("Translation", "done");
            setRunData((prev: any) => ({ ...(prev ?? {}), reflection: { ...(prev?.reflection ?? {}), es: data?.content ?? data } }));
          } else if (event === "companion_en") {
            markStage("Companion", "done");
            setRunData((prev: any) => ({ ...(prev ?? {}), companion: { ...(prev?.companion ?? {}), en: data?.content ?? data, title: data?.title } }));
          } else if (event === "reflection_social_en") {
            socialEventsReceived.add(event);
            const allSocialDone = expectedSocial.every(e => socialEventsReceived.has(e));
            markStage("Social Posts", allSocialDone ? "done" : "running");
            setRunData((prev: any) => ({ ...(prev ?? {}), reflection: { ...(prev?.reflection ?? {}), repurposed_en: data } }));
          } else if (event === "reflection_social_es") {
            socialEventsReceived.add(event);
            const allSocialDone = expectedSocial.every(e => socialEventsReceived.has(e));
            markStage("Social Posts", allSocialDone ? "done" : "running");
            setRunData((prev: any) => ({ ...(prev ?? {}), reflection: { ...(prev?.reflection ?? {}), repurposed_es: data } }));
          } else if (event === "companion_social_en") {
            socialEventsReceived.add(event);
            const allSocialDone = expectedSocial.every(e => socialEventsReceived.has(e));
            markStage("Social Posts", allSocialDone ? "done" : "running");
            setRunData((prev: any) => ({ ...(prev ?? {}), companion: { ...(prev?.companion ?? {}), repurposed_en: data } }));
          } else if (event === "companion_social_es") {
            socialEventsReceived.add(event);
            const allSocialDone = expectedSocial.every(e => socialEventsReceived.has(e));
            markStage("Social Posts", allSocialDone ? "done" : "running");
            setRunData((prev: any) => ({ ...(prev ?? {}), companion: { ...(prev?.companion ?? {}), repurposed_es: data } }));
          } else if (event === "tags") {
            markStage("Pillar Tags", "done");
            setRunData((prev: any) => ({ ...(prev ?? {}), tags: data }));
          } else if (event === "quotes") {
            markStage("Quotes", "done");
            setRunData((prev: any) => ({ ...(prev ?? {}), quotes: data }));
          } else if (event === "result") {
            // Merge the title/url that the frontend submitted so the run view
            // can display them even if the component remounts later.
            // Preserve thumbnailConcepts if they arrived before this event.
            setRunData((prev: any) => ({
              ...data,
              run_id: prev?.run_id,
              reflection_title: articleTitle,
              article_url: articleUrl,
              thumbnailConcepts: prev?.thumbnailConcepts,
              _articleText: prev?._articleText,
              _autoThumbnail: prev?._autoThumbnail,
            }));
            setHasRun(true);
            setPipelineStages(prev => prev.map(s =>
              s.status !== "done" && s.status !== "skipped" ? { ...s, status: "done" } : s
            ));
          } else if (event === "run_pending") {
            // Run was persisted immediately at start — set run_id so history shows it right away
            runIdRef.current = String(data?.run_id);
            setRunData((prev: any) => ({ ...(prev ?? {}), run_id: data?.run_id }));
          } else if (event === "run_saved") {
            const runId = String(data?.run_id);
            runIdRef.current = runId;
            setRunData((prev: any) => ({ ...(prev ?? {}), run_id: data?.run_id }));
            // If thumbnail generation already finished before this event (race condition),
            // save the accumulated concepts now.
            if (conceptsAccumulator.length > 0) {
              history.saveThumbnailConcepts(runId, conceptsAccumulator).catch(() => {});
            }
          } else if (event === "tokens") {
            setTokenSummary(data);
          } else if (event === "cancelled") {
            setRunError("Pipeline cancelled.");
            setHasRun(false);
            setRunning(false);
            setPipelineStages(prev => prev.map((stage) =>
              stage.status === "running" ? { ...stage, status: "skipped" } : stage
            ));
            setRunData((prev: any) => prev ? { ...prev, status: "cancelled" } : prev);
          } else if (event === "save_error") {
            setRunError(`Run completed but failed to save: ${data?.message ?? "unknown error"}`);
            setRunData((prev: any) => prev ? { ...prev, status: "error" } : prev);
          } else if (event === "error") {
            setRunError(typeof data === "string" ? data : data?.message ?? data?.detail ?? "Pipeline error");
            setHasRun(false);
            setRunData((prev: any) => prev ? { ...prev, status: "error" } : prev);
          }
        },
        abort.signal
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setRunError(err.message ?? "Pipeline failed");
        setHasRun(false);
        setRunData((prev: any) => prev ? { ...prev, status: "error" } : prev);
      }
    } finally {
      // Clear running state as soon as the main pipeline stream ends.
      // Thumbnail generation continues independently in the background.
      setRunning(false);
      // Auto-start next queued run if any
      setPendingQueue(prev => {
        if (prev.length === 0) return prev;
        const [next, ...rest] = prev;
        // Use setTimeout to let state settle before starting next run
        setTimeout(() => startPipeline(next), 100);
        return rest;
      });
      abortRef.current = null;
    }
  };

  // Keep ref in sync so the on-mount effect can call startPipeline
  startPipelineRef.current = startPipeline;

  return (
    <PipelineContext.Provider value={{
      running, hasRun, pipelineStages, runData, runError, tokenSummary,
      startPipeline, cancelPipeline, resetPipeline, pendingQueue, queueRun, removeFromQueue, clearQueue,
    }}>
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline() {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within PipelineProvider");
  return ctx;
}

export { PIPELINE_STAGE_NAMES };
