import { useEffect, useRef, useState } from "react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { CalendarDays, X } from "lucide-react";

const PRESETS = [
  { label: "Today", range: (): DateRange => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: "Yesterday", range: (): DateRange => { const d = subDays(new Date(), 1); return { from: startOfDay(d), to: endOfDay(d) }; } },
  { label: "Last 7 days", range: (): DateRange => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: "Last 30 days", range: (): DateRange => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { label: "This month", range: (): DateRange => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  { label: "Last month", range: (): DateRange => { const d = subMonths(new Date(), 1); return { from: startOfMonth(d), to: endOfMonth(d) }; } },
  { label: "Last 3 months", range: (): DateRange => ({ from: startOfDay(subMonths(new Date(), 3)), to: endOfDay(new Date()) }) },
  { label: "Last 6 months", range: (): DateRange => ({ from: startOfDay(subMonths(new Date(), 6)), to: endOfDay(new Date()) }) },
];

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
  align?: "left" | "right";
  numberOfMonths?: number;
}

export function DateRangePicker({ dateRange, onSelect, align = "right", numberOfMonths = 2 }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const hasRange = !!dateRange?.from;
  const label = hasRange
    ? dateRange?.to
      ? `${format(dateRange.from!, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`
      : format(dateRange!.from!, "MMM d, yyyy")
    : "All time";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (range: DateRange | undefined) => {
    onSelect(range);
    if (range?.from && range?.to) setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
        style={{
          background: hasRange ? "rgba(var(--primary-rgb),0.08)" : "rgba(var(--border-rgb),0.07)",
          border: `1px solid ${hasRange ? "rgba(var(--primary-rgb),0.2)" : "rgba(var(--border-rgb),0.12)"}`,
          color: hasRange ? "var(--primary)" : "var(--muted-foreground)",
        }}
      >
        <CalendarDays size={13} />
        {label}
        {hasRange && (
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(undefined); }}
            className="ml-0.5 opacity-60 hover:opacity-100"
          >
            <X size={11} />
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute z-50 mt-2 rounded-2xl shadow-xl overflow-hidden flex"
          style={{
            background: "var(--card)",
            border: "1px solid rgba(var(--border-rgb),0.14)",
            [align === "right" ? "right" : "left"]: 0,
            top: "100%",
          }}
        >
          {/* Preset column */}
          <div
            className="flex flex-col gap-0.5 p-3 min-w-[140px]"
            style={{ borderRight: "1px solid rgba(var(--border-rgb),0.1)" }}
          >
            <span
              className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 pb-1.5 block"
              style={{ color: "var(--text-subtle)" }}
            >
              Quick select
            </span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => { onSelect(preset.range()); setOpen(false); }}
                className="text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                style={{ color: "var(--foreground)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(var(--primary-rgb),0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {preset.label}
              </button>
            ))}
            <div style={{ borderTop: "1px solid rgba(var(--border-rgb),0.1)", marginTop: 4, paddingTop: 4 }}>
              <button
                onClick={() => { onSelect(undefined); setOpen(false); }}
                className="text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg w-full transition-all"
                style={{ color: "var(--text-subtle)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(var(--border-rgb),0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                All time
              </button>
            </div>
          </div>

          {/* Calendar column */}
          <div className="p-3">
            <style>{`
              .rdp { --rdp-accent-color: var(--primary); --rdp-background-color: rgba(var(--primary-rgb),0.08); }
              .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background: rgba(var(--primary-rgb),0.06); }
            `}</style>
            <DayPicker
              mode="range"
              selected={dateRange}
              onSelect={handleSelect}
              numberOfMonths={numberOfMonths}
              defaultMonth={new Date()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
