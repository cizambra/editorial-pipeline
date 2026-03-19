import { useState, useRef, useEffect, useCallback } from "react";
import { notes as notesApi } from "../../lib/api";

export type Note = {
  id: number;
  issue: string;
  intent: string;
  note_text: string;
  shared: number | boolean;
  signal: string | null;
  linkedin_post?: string;
  threads_post?: string;
  instagram_post?: string;
  timestamp: string;
  batch_id: number;
};

type Batch = {
  id: number;
  timestamp: string;
  note_count?: number;
};

const INTENT_COLORS: Record<string, { bg: string; text: string }> = {
  Validation: { bg: "rgba(var(--primary-rgb), 0.15)", text: "var(--primary)" },
  Education: { bg: "rgba(59, 130, 246, 0.15)", text: "#2563eb" },
  "Practice (Kata)": { bg: "rgba(16, 185, 129, 0.15)", text: "#059669" },
  Reflection: { bg: "rgba(var(--primary-rgb), 0.15)", text: "var(--primary)" },
  Metaphor: { bg: "rgba(245, 158, 11, 0.15)", text: "#d97706" },
  "Positive Alignment": { bg: "rgba(147, 51, 234, 0.15)", text: "#7c3aed" },
  "Universal Model": { bg: "rgba(59, 130, 246, 0.15)", text: "#2563eb" },
  CDT: { bg: "rgba(16, 185, 129, 0.15)", text: "#059669" },
};

function getIntentColor(intent: string) {
  const key = Object.keys(INTENT_COLORS).find((k) =>
    intent.toLowerCase().includes(k.toLowerCase())
  );
  return key ? INTENT_COLORS[key] : { bg: "rgba(var(--border-rgb), 0.12)", text: "var(--muted-foreground)" };
}

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

type NotesInfiniteListProps = {
  selectedNote: string | null;
  onSelectNote: (note: Note) => void;
  onTotalCount?: (count: number) => void;
  reloadKey?: number;
};

export function NotesInfiniteList({
  selectedNote,
  onSelectNote,
  onTotalCount,
  reloadKey = 0,
}: NotesInfiniteListProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextBatchIdx, setNextBatchIdx] = useState(0);
  const nextBatchIdxRef = useRef(0);
  const batchesRef = useRef<Batch[]>([]);
  const loaderRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    setAllNotes([]);
    setNextBatchIdx(0);
    nextBatchIdxRef.current = 0;
    notesApi
      .batches()
      .then((res: any) => {
        const list: Batch[] = Array.isArray(res) ? res : (res.batches ?? []);
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setBatches(list);
        batchesRef.current = list;
      })
      .catch(() => {
        setBatches([]);
        batchesRef.current = [];
      })
      .finally(() => setIsLoading(false));
  }, [reloadKey]);

  const loadBatch = useCallback(async (idx: number) => {
    const list = batchesRef.current;
    if (idx >= list.length) return;
    setIsLoadingMore(true);
    try {
      const res = await (notesApi.batchNotes(String(list[idx].id)) as any);
      const batchNotes: Note[] = (Array.isArray(res) ? res : (res.notes ?? [])).map(
        (n: any) => ({ ...n, batch_id: list[idx].id })
      );
      setAllNotes((prev) => {
        const merged = [...prev, ...batchNotes];
        onTotalCount?.(merged.length);
        return merged;
      });
      setNextBatchIdx(idx + 1);
      nextBatchIdxRef.current = idx + 1;
    } catch {
      // ignore
    } finally {
      setIsLoadingMore(false);
    }
  }, [onTotalCount]);

  // Load first batch once batches are available
  useEffect(() => {
    if (batches.length > 0 && allNotes.length === 0 && !isLoading) {
      loadBatch(0);
    }
  }, [batches, isLoading]);

  const hasMore = nextBatchIdx < batches.length;

  useEffect(() => {
    if (!loaderRef.current || !hasMore || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadBatch(nextBatchIdxRef.current);
        }
      },
      { root: containerRef.current, rootMargin: "100px", threshold: 0.1 }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadBatch]);

  const getBatchLabel = (batchId: number) => {
    const idx = batches.findIndex((b) => b.id === batchId);
    return idx === -1 ? "" : `Batch #${batches.length - idx}`;
  };

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto rounded-xl"
      style={{
        maxHeight: "calc(100vh - 420px)",
        minHeight: "400px",
        background: "var(--card)",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "rgba(var(--border-rgb), 0.08)",
      }}
    >
      {isLoading ? (
        <div className="flex flex-col gap-2 p-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg animate-pulse"
              style={{ background: "rgba(var(--border-rgb), 0.06)", opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>
      ) : allNotes.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-subtle)" }}>
          No notes yet. Click Generate to create some!
        </div>
      ) : (
        allNotes.map((note) => {
          const color = getIntentColor(note.intent);
          const batchLabel = getBatchLabel(note.batch_id);
          const ts = timeAgo(note.timestamp);
          const isSelected = String(selectedNote) === String(note.id);
          return (
            <button
              key={note.id}
              onClick={() => onSelectNote(note)}
              className="w-full text-left px-4 py-3 transition-all border-l-2"
              style={{
                background: isSelected ? "rgba(var(--primary-rgb), 0.06)" : "transparent",
                borderLeftColor: isSelected ? "var(--primary)" : "transparent",
                borderBottom: "1px solid rgba(var(--border-rgb), 0.06)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase"
                  style={{ background: color.bg, color: color.text }}
                >
                  {note.intent}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}>
                  {batchLabel} • {ts}
                </span>
              </div>
              <p className="text-xs leading-snug line-clamp-2 font-normal" style={{ color: "var(--muted-foreground)" }}>
                {note.issue}
              </p>
            </button>
          );
        })
      )}

      {hasMore && (
        <div ref={loaderRef} className="px-4 py-4 text-center">
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2">
              <div
                className="w-4 h-4 rounded-full animate-pulse"
                style={{ background: "rgba(var(--primary-rgb), 0.3)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                Loading more notes...
              </span>
            </div>
          )}
        </div>
      )}

      {!hasMore && allNotes.length > 0 && (
        <div className="px-4 py-3 text-center">
          <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
            {allNotes.length} notes loaded
          </span>
        </div>
      )}
    </div>
  );
}
