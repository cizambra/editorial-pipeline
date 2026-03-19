import { useState, useEffect, useCallback } from "react";
import { Copy, ChevronDown, ChevronLeft, X, Loader2 } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "./ui/carousel";

function ConceptBody({ concept }: { concept: any }) {
  return (
    <>
      {concept.image_b64 ? (
        <img
          src={`data:image/png;base64,${concept.image_b64}`}
          alt={concept.name}
          className="w-full rounded-xl"
          style={{ border: "1px solid rgba(var(--border-rgb),0.12)" }}
        />
      ) : (
        <div
          className="w-full rounded-xl flex items-center justify-center py-10 text-xs"
          style={{ background: "var(--secondary)", color: "var(--text-subtle)", border: "1px solid rgba(var(--border-rgb),0.12)" }}
        >
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating image…
        </div>
      )}
      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: "var(--text-subtle)" }}>Scene</p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{concept.scene}</p>
      </div>
      {concept.why && (
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: "var(--text-subtle)" }}>Why it works</p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{concept.why}</p>
        </div>
      )}
      {concept.dalle_prompt && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--text-subtle)" }}>Image prompt</p>
            <button
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all hover:opacity-80"
              style={{ color: "var(--primary)", background: "rgba(var(--primary-rgb), 0.08)" }}
              onClick={() => navigator.clipboard.writeText(concept.dalle_prompt)}
            >
              <Copy size={10} /> Copy
            </button>
          </div>
          <p
            className="text-xs leading-relaxed p-3 rounded-xl"
            style={{ color: "var(--muted-foreground)", background: "var(--secondary)", border: "1px solid rgba(var(--border-rgb),0.12)", fontFamily: "monospace" }}
          >
            {concept.dalle_prompt}
          </p>
        </div>
      )}
    </>
  );
}

interface ThumbnailConceptsPanelProps {
  concepts: any[];
  /** Shown instead of the empty state when there are no concepts yet */
  emptyLabel?: string;
}

export function ThumbnailConceptsPanel({ concepts, emptyLabel = "No thumbnail concepts generated." }: ThumbnailConceptsPanelProps) {
  const [selectedConcept, setSelectedConcept] = useState<any>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const onCarouselSelect = useCallback((api: CarouselApi) => {
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.on("select", onCarouselSelect);
    return () => { carouselApi.off("select", onCarouselSelect); };
  }, [carouselApi, onCarouselSelect]);

  return (
    <>
      {concepts.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: "var(--text-subtle)" }}>{emptyLabel}</p>
      ) : (
        <>
          {/* Mobile: swipeable carousel */}
          <div className="lg:hidden">
            <Carousel opts={{ align: "start", loop: false }} setApi={setCarouselApi}>
              <CarouselContent className="-ml-3">
                {concepts.map((concept: any, idx: number) => (
                  <CarouselItem key={idx} className="pl-3">
                    <button
                      className="w-full text-left rounded-xl overflow-hidden transition-all active:scale-[0.98]"
                      style={{ background: "#fff", border: "1px solid rgba(var(--border-rgb), 0.12)" }}
                      onClick={() => setSelectedConcept(concept)}
                    >
                      {concept.image_b64 ? (
                        <img
                          src={`data:image/png;base64,${concept.image_b64}`}
                          alt={concept.name}
                          className="w-full object-cover"
                          style={{ maxHeight: "180px" }}
                        />
                      ) : (
                        <div
                          className="w-full flex items-center justify-center py-10"
                          style={{ background: "var(--secondary)" }}
                        >
                          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-subtle)" }} />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded flex-shrink-0"
                            style={{ background: "rgba(var(--primary-rgb), 0.1)", color: "var(--primary)" }}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{concept.name}</span>
                          <ChevronDown size={14} className="ml-auto flex-shrink-0" style={{ color: "var(--text-subtle)", transform: "rotate(-90deg)" }} />
                        </div>
                        <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--muted-foreground)" }}>{concept.scene}</p>
                      </div>
                    </button>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
            {concepts.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-3">
                {concepts.map((_: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => carouselApi?.scrollTo(idx)}
                    className="rounded-full transition-all"
                    style={{
                      width: idx === currentSlide ? "16px" : "6px",
                      height: "6px",
                      background: idx === currentSlide ? "var(--primary)" : "rgba(var(--border-rgb), 0.4)",
                    }}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Desktop: list */}
          <div className="hidden lg:block space-y-3">
            {concepts.map((concept: any, idx: number) => (
              <button
                key={idx}
                className="w-full text-left p-4 rounded-xl transition-all active:scale-[0.99]"
                style={{ background: "#fff", border: "1px solid rgba(var(--border-rgb), 0.12)" }}
                onClick={() => setSelectedConcept(concept)}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded flex-shrink-0"
                      style={{ background: "rgba(var(--primary-rgb), 0.1)", color: "var(--primary)" }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{concept.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {concept.image_b64 && (
                      <img
                        src={`data:image/png;base64,${concept.image_b64}`}
                        alt={concept.name}
                        className="w-10 h-10 rounded-lg object-cover"
                        style={{ border: "1px solid rgba(var(--border-rgb),0.12)" }}
                      />
                    )}
                    <ChevronDown size={14} style={{ color: "var(--text-subtle)", transform: "rotate(-90deg)" }} />
                  </div>
                </div>
                <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--muted-foreground)" }}>{concept.scene}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Concept detail modal */}
      {selectedConcept && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setSelectedConcept(null)}
          />

          {/* Mobile: full-screen slide-over */}
          <div
            className="lg:hidden fixed inset-0 z-50 flex flex-col"
            style={{ background: "var(--background)", animation: "slideInRight 0.2s cubic-bezier(0.22,1,0.36,1)" }}
          >
            <div
              className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3"
              style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.12)" }}
            >
              <button onClick={() => setSelectedConcept(null)} className="p-2 -ml-1 rounded-xl" style={{ color: "var(--muted-foreground)" }}>
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--text-subtle)" }}>Thumbnail Concept</p>
                <h3 className="text-[16px] font-bold truncate" style={{ color: "var(--foreground)" }}>{selectedConcept.name}</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
              <ConceptBody concept={selectedConcept} />
            </div>
          </div>

          {/* Desktop: centered modal */}
          <div className="hidden lg:flex fixed inset-0 z-50 items-center justify-center p-6">
            <div
              className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
              style={{ background: "var(--card)", boxShadow: "0 24px 80px rgba(20,12,4,0.25)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex-shrink-0 flex items-start justify-between px-6 py-5"
                style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.1)" }}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: "var(--text-subtle)" }}>Thumbnail Concept</p>
                  <h2 className="text-xl font-bold leading-tight" style={{ color: "var(--foreground)" }}>{selectedConcept.name}</h2>
                </div>
                <button onClick={() => setSelectedConcept(null)} className="p-2 rounded-xl hover:bg-black/5 transition-colors flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <ConceptBody concept={selectedConcept} />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
