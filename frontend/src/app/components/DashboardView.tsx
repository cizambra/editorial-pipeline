import { useEffect, useState } from "react";
import { format, startOfDay, endOfDay, startOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import { PageHeader } from "./PageHeader";
import { Card, Eyebrow, SectionTitle } from "./Card";
import { settings } from "../../lib/api";
import { DollarSign, Activity } from "lucide-react";
import { DateRangePicker } from "./DateRangePicker";

interface MonthEntry {
  runs: number;
  cost_usd: number;
  image_cost_usd: number;
  tokens_in: number;
  tokens_out: number;
}

interface RunCost { timestamp: string; cost_usd: number; tokens_in: number; tokens_out: number; }
interface ImgCost  { timestamp: string; cost_usd: number; }
interface DailySpendEntry { run_cost_usd: number; image_cost_usd: number; total_cost_usd: number; }

interface DashboardData {
  articles_total: number;
  articles_covered: number;
  articles_remaining: number;
  total_runs: number;
  monthly_runs: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  total_image_cost_usd: number;
  total_image_count: number;
  platform_counts: Record<string, number>;
  tag_primary_counts: Record<string, number>;
  repurpose_queue: { title: string; url: string }[];
  recent_runs: { id: number; title: string; timestamp: string; cost_usd: number; tags: string }[];
  monthly_breakdown: Record<string, MonthEntry>;
  daily_spend: Record<string, DailySpendEntry>;
  run_costs: RunCost[];
  image_cost_records: ImgCost[];
}

function fmtUsd(n: number) {
  return "$" + n.toFixed(2);
}

function fmtK(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function dayKey(ts: string | undefined | null): string {
  if (!ts) return "";
  return String(ts).replace(" ", "T").slice(0, 10);
}

function timeAgo(ts: string): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  if (isNaN(diff) || diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface StatBoxProps {
  label: string;
  value: string | number;
  secondary?: string;
}

function StatBox({ label, value, secondary }: StatBoxProps) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div
        className="text-[32px] leading-none mb-1"
        style={{ fontFamily: '"Montserrat", "Inter", sans-serif', fontWeight: 800, color: "var(--foreground)" }}
      >
        {value}
      </div>
      {secondary && <div className="text-xs" style={{ color: "var(--text-subtle)" }}>{secondary}</div>}
    </div>
  );
}

interface ProgressBarProps {
  label: string;
  value: number;
  total: number;
}

function ProgressBar({ label, value, total }: ProgressBarProps) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm" style={{ color: "var(--foreground)" }}>{label}</span>
        <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>{value}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(var(--border-rgb),0.12)" }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ background: "var(--primary)", width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  }));

  useEffect(() => {
    settings.getDashboard().then((d) => {
      if (d?.run_costs?.length) {
        const ts = d.run_costs[0].timestamp;
        console.debug("[Dashboard] first run_cost ts:", ts, "→ Date:", new Date(ts).toISOString());
      }
      setData(d);
    }).catch(console.error);
  }, []);

  const effectiveFrom = dateRange?.from ? startOfDay(dateRange.from) : null;
  const effectiveTo = dateRange?.from ? endOfDay(dateRange.to ?? dateRange.from) : null;
  const hasRange = !!effectiveFrom;

  // Filter individual cost records by date range for accurate day-level stats
  const filteredStats = (() => {
    if (!data) return null;

    const runCosts = data.run_costs ?? [];
    const imgCosts = data.image_cost_records ?? [];
    const dailySpend = data.daily_spend ?? {};
    const fromDay = effectiveFrom ? format(effectiveFrom, "yyyy-MM-dd") : null;
    const toDay = effectiveTo ? format(effectiveTo, "yyyy-MM-dd") : null;

    if (Object.keys(dailySpend).length > 0) {
      const dayRows = Object.entries(dailySpend).filter(([day]) => {
        if (!fromDay || !toDay) return true;
        return day >= fromDay && day <= toDay;
      });

      const cost_usd = dayRows.reduce((sum, [, row]) => sum + row.run_cost_usd, 0);
      const image_cost_usd = dayRows.reduce((sum, [, row]) => sum + row.image_cost_usd, 0);

      const filteredRuns = runCosts.filter((r) => {
        if (!fromDay || !toDay) return true;
        const key = dayKey(r.timestamp);
        return !!key && key >= fromDay && key <= toDay;
      });

      return {
        runs: filteredRuns.length,
        cost_usd: Math.round(cost_usd * 100) / 100,
        image_cost_usd: Math.round(image_cost_usd * 100) / 100,
        total: Math.round((cost_usd + image_cost_usd) * 100) / 100,
        tokens_in: filteredRuns.reduce((s, r) => s + r.tokens_in, 0),
        tokens_out: filteredRuns.reduce((s, r) => s + r.tokens_out, 0),
      };
    }

    // Fallback: old cached response missing daily and per-record arrays
    if (runCosts.length === 0 && imgCosts.length === 0) {
      return {
        runs: data.total_runs,
        cost_usd: data.total_cost_usd,
        image_cost_usd: data.total_image_cost_usd,
        total: Math.round((data.total_cost_usd + data.total_image_cost_usd) * 100) / 100,
        tokens_in: data.total_tokens_in,
        tokens_out: data.total_tokens_out,
      };
    }

    const filteredRuns = runCosts.filter((r) => {
      if (!fromDay || !toDay) return true;
      const key = dayKey(r.timestamp);
      return !!key && key >= fromDay && key <= toDay;
    });
    const filteredImgs = imgCosts.filter((r) => {
      if (!fromDay || !toDay) return true;
      const key = dayKey(r.timestamp);
      return !!key && key >= fromDay && key <= toDay;
    });

    const cost_usd       = filteredRuns.reduce((s, r) => s + r.cost_usd, 0);
    const image_cost_usd = filteredImgs.reduce((s, r) => s + r.cost_usd, 0);
    const tokens_in      = filteredRuns.reduce((s, r) => s + r.tokens_in, 0);
    const tokens_out     = filteredRuns.reduce((s, r) => s + r.tokens_out, 0);

    return {
      runs: filteredRuns.length,
      cost_usd:       Math.round(cost_usd       * 100) / 100,
      image_cost_usd: Math.round(image_cost_usd * 100) / 100,
      total:          Math.round((cost_usd + image_cost_usd) * 100) / 100,
      tokens_in,
      tokens_out,
    };
  })();

  // Monthly cost rows sorted descending for the breakdown table
  const monthlyCostRows = (() => {
    if (!data) return [];
    return Object.entries(data.monthly_breakdown ?? {})
      .map(([month, m]) => ({
        month,
        runs: m.runs,
        run_cost: m.cost_usd,
        image_cost: m.image_cost_usd,
        total: Math.round((m.cost_usd + m.image_cost_usd) * 100) / 100,
        tokens_in: m.tokens_in,
        tokens_out: m.tokens_out,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  })();

  const dailySpendRows = (() => {
    if (!data) return [];
    return Object.entries(data.daily_spend ?? {})
      .map(([day, value]) => ({
        day,
        run_cost: value.run_cost_usd,
        image_cost: value.image_cost_usd,
        total: value.total_cost_usd,
      }))
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, 10);
  })();

  const articles_total = data?.articles_total ?? 0;
  const articles_covered = data?.articles_covered ?? 0;
  const articles_remaining = data?.articles_remaining ?? 0;
  const platform_counts = data?.platform_counts ?? {};
  const tag_primary = data?.tag_primary_counts ?? {};
  const queue = data?.repurpose_queue ?? [];
  const recent = data?.recent_runs ?? [];

  const rangeLabel = hasRange
    ? effectiveFrom && effectiveTo && format(effectiveFrom, "yyyy-MM-dd") === format(effectiveTo, "yyyy-MM-dd")
      ? format(effectiveFrom, "MMM d, yyyy")
      : `${format(effectiveFrom!, "MMM d")} – ${format(effectiveTo!, "MMM d, yyyy")}`
    : "All time";

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:block">
        <div className="flex items-start justify-between mb-6">
          <PageHeader
            kicker="Operating picture"
            title="Dashboard"
            description="Track article coverage, spending, platform reach, and the backlog awaiting processing."
          />
          <DateRangePicker dateRange={dateRange} onSelect={setDateRange} align="right" numberOfMonths={2} />
        </div>

        {/* Cost Overview — time-filtered */}
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Eyebrow>Production costs</Eyebrow>
              <SectionTitle>{rangeLabel}</SectionTitle>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatBox label="Total spend" value={filteredStats ? fmtUsd(filteredStats.total) : "—"} />
            <StatBox label="Run cost" value={filteredStats ? fmtUsd(filteredStats.cost_usd) : "—"} />
            <StatBox label="Image cost" value={filteredStats ? fmtUsd(filteredStats.image_cost_usd) : "—"} />
            <StatBox
              label="Tokens"
              value={filteredStats ? fmtK(filteredStats.tokens_in + filteredStats.tokens_out) : "—"}
              secondary={filteredStats ? `${fmtK(filteredStats.tokens_in)} in / ${fmtK(filteredStats.tokens_out)} out` : ""}
            />
          </div>
        </Card>

        {/* Monthly cost breakdown */}
        {monthlyCostRows.length > 0 && (
          <Card className="mb-4">
            <Eyebrow>Monthly breakdown</Eyebrow>
            <SectionTitle className="mb-4">Cost per month</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.1)" }}>
                    {["Month", "Runs", "Run cost", "Image cost", "Total", "Tokens"].map((h) => (
                      <th key={h} className="text-left pb-2 pr-6 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-subtle)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyCostRows.map((row) => (
                    <tr
                      key={row.month}
                      style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.06)" }}
                    >
                      <td className="py-2.5 pr-6 font-semibold" style={{ color: "var(--foreground)" }}>{row.month}</td>
                      <td className="py-2.5 pr-6" style={{ color: "var(--muted-foreground)" }}>{row.runs}</td>
                      <td className="py-2.5 pr-6" style={{ color: "var(--foreground)" }}>{fmtUsd(row.run_cost)}</td>
                      <td className="py-2.5 pr-6" style={{ color: "var(--foreground)" }}>{fmtUsd(row.image_cost)}</td>
                      <td className="py-2.5 pr-6 font-semibold" style={{ color: "var(--primary)" }}>{fmtUsd(row.total)}</td>
                      <td className="py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{fmtK(row.tokens_in + row.tokens_out)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {dailySpendRows.length > 0 && (
          <Card className="mb-4">
            <Eyebrow>Daily spend</Eyebrow>
            <SectionTitle className="mb-4">Cost per day</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.1)" }}>
                    {["Day", "Run cost", "Image cost", "Total"].map((h) => (
                      <th key={h} className="text-left pb-2 pr-6 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-subtle)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailySpendRows.map((row) => (
                    <tr key={row.day} style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.06)" }}>
                      <td className="py-2.5 pr-6 font-semibold" style={{ color: "var(--foreground)" }}>{row.day}</td>
                      <td className="py-2.5 pr-6" style={{ color: "var(--foreground)" }}>{fmtUsd(row.run_cost)}</td>
                      <td className="py-2.5 pr-6" style={{ color: "var(--foreground)" }}>{fmtUsd(row.image_cost)}</td>
                      <td className="py-2.5 pr-6 font-semibold" style={{ color: "var(--primary)" }}>{fmtUsd(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Article + platform overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <Card><StatBox label="Articles indexed" value={articles_total} /></Card>
          <Card><StatBox label="Articles covered" value={articles_covered} /></Card>
          <Card><StatBox label="Remaining" value={articles_remaining} secondary="Ready to process" /></Card>
          <Card><StatBox label="Total runs" value={data?.total_runs ?? "—"} /></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Card>
            <Eyebrow>Platform coverage</Eyebrow>
            <SectionTitle className="mb-4">Published posts by platform</SectionTitle>
            {Object.entries(platform_counts).map(([p, n]) => (
              <ProgressBar key={p} label={p.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} value={n} total={Math.max(...Object.values(platform_counts), 1)} />
            ))}
          </Card>
          <Card>
            <Eyebrow>Pillar distribution</Eyebrow>
            <SectionTitle className="mb-4">Articles by primary tag</SectionTitle>
            {Object.entries(tag_primary).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, n]) => (
              <ProgressBar key={tag} label={tag} value={n} total={Math.max(...Object.values(tag_primary), 1)} />
            ))}
          </Card>
        </div>

        {queue.length > 0 && (
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Eyebrow>Repurpose queue</Eyebrow>
                <SectionTitle>Articles awaiting campaign processing</SectionTitle>
              </div>
              <div className="text-xs" style={{ color: "var(--text-subtle)" }}>{queue.length} items</div>
            </div>
            {queue.slice(0, 5).map((item, i) => (
              <div key={i} className="p-4 rounded-xl mb-3 last:mb-0" style={{ border: "1px solid rgba(var(--border-rgb),0.12)", background: "rgba(var(--border-rgb),0.03)" }}>
                <div className="font-bold mb-1 text-[15px]" style={{ color: "var(--foreground)" }}>{item.title}</div>
                <div className="text-xs mb-3" style={{ color: "var(--text-subtle)" }}>{item.url}</div>
              </div>
            ))}
          </Card>
        )}

        {recent.length > 0 && (
          <Card>
            <Eyebrow>Recent activity</Eyebrow>
            <SectionTitle className="mb-4">Latest pipeline runs</SectionTitle>
            {recent.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-4 rounded-2xl mb-3 last:mb-0"
                style={{ border: "1px solid rgba(var(--border-rgb),0.12)", background: "rgba(var(--border-rgb),0.02)" }}
              >
                <div className="flex-1">
                  <div className="font-semibold mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>{run.title}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-subtle)" }}>{timeAgo(run.timestamp)}</div>
                </div>
                <div className="font-semibold ml-4" style={{ color: "var(--foreground)" }}>{fmtUsd(run.cost_usd ?? 0)}</div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden pb-8">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <Eyebrow>Operating picture</Eyebrow>
            <div
              className="text-[22px] leading-tight -tracking-[0.02em]"
              style={{ fontFamily: '"Montserrat", "Inter", sans-serif', fontWeight: 800, color: "var(--foreground)" }}
            >
              Dashboard
            </div>
          </div>
          <DateRangePicker dateRange={dateRange} onSelect={setDateRange} align="right" numberOfMonths={1} />
        </div>

        <div className="space-y-3 mb-6">
          <div className="p-5 rounded-2xl" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <Eyebrow>Production costs · {rangeLabel}</Eyebrow>
            </div>
            <div className="flex justify-between items-baseline">
              <div>
                <div className="text-[36px] leading-none mb-1" style={{ fontFamily: '"Montserrat","Inter",sans-serif', fontWeight: 800, color: "var(--foreground)" }}>
                  {filteredStats ? fmtUsd(filteredStats.total) : "—"}
                </div>
                <div className="text-xs" style={{ color: "var(--text-subtle)" }}>total spend</div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-sm"><span className="font-semibold" style={{ color: "var(--foreground)" }}>{filteredStats ? fmtUsd(filteredStats.cost_usd) : "—"}</span><span className="text-xs ml-1" style={{ color: "var(--text-subtle)" }}>runs</span></div>
                <div className="text-sm"><span className="font-semibold" style={{ color: "var(--foreground)" }}>{filteredStats ? fmtUsd(filteredStats.image_cost_usd) : "—"}</span><span className="text-xs ml-1" style={{ color: "var(--text-subtle)" }}>images</span></div>
              </div>
            </div>
            {filteredStats && (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(var(--border-rgb),0.1)" }}>
                <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>{fmtK(filteredStats.tokens_in + filteredStats.tokens_out)}</span> tokens · {fmtK(filteredStats.tokens_in)} in / {fmtK(filteredStats.tokens_out)} out
                </div>
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <Eyebrow>Articles</Eyebrow>
            <div className="flex items-end justify-between mt-2">
              <div>
                <div className="text-[36px] leading-none mb-1" style={{ fontFamily: '"Montserrat","Inter",sans-serif', fontWeight: 800, color: "var(--foreground)" }}>{articles_total}</div>
                <div className="text-xs" style={{ color: "var(--text-subtle)" }}>indexed</div>
              </div>
              <div className="text-right">
                <div className="text-[28px] leading-none mb-1" style={{ fontFamily: '"Montserrat","Inter",sans-serif', fontWeight: 800, color: "var(--primary)" }}>{articles_remaining}</div>
                <div className="text-xs" style={{ color: "var(--text-subtle)" }}>remaining</div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <Eyebrow>Runs · {rangeLabel}</Eyebrow>
            </div>
            <div className="text-[36px] leading-none" style={{ fontFamily: '"Montserrat","Inter",sans-serif', fontWeight: 800, color: "var(--foreground)" }}>{filteredStats?.runs ?? "—"}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>pipeline runs</div>
          </div>
        </div>

        {/* Mobile monthly table */}
        {monthlyCostRows.length > 0 && (
          <div className="mb-5">
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5 block" style={{ color: "var(--text-subtle)" }}>Monthly breakdown</span>
            <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
              {monthlyCostRows.slice(0, 6).map((row, i) => (
                <div key={row.month} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i < monthlyCostRows.length - 1 ? "1px solid rgba(var(--border-rgb),0.08)" : undefined }}>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{row.month}</div>
                    <div className="text-[11px]" style={{ color: "var(--text-subtle)" }}>{row.runs} runs · {fmtK(row.tokens_in + row.tokens_out)} tokens</div>
                  </div>
                  <div className="font-bold" style={{ color: "var(--primary)" }}>{fmtUsd(row.total)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {dailySpendRows.length > 0 && (
          <div className="mb-5">
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5 block" style={{ color: "var(--text-subtle)" }}>Daily spend</span>
            <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
              {dailySpendRows.slice(0, 6).map((row, i) => (
                <div key={row.day} className="px-4 py-3" style={{ borderBottom: i < Math.min(dailySpendRows.length, 6) - 1 ? "1px solid rgba(var(--border-rgb),0.08)" : undefined }}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{row.day}</div>
                    <div className="font-bold" style={{ color: "var(--primary)" }}>{fmtUsd(row.total)}</div>
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: "var(--text-subtle)" }}>
                    {fmtUsd(row.run_cost)} runs · {fmtUsd(row.image_cost)} images
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div>
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5 block" style={{ color: "var(--text-subtle)" }}>Recent activity</span>
            <div className="space-y-3">
              {recent.map((run) => (
                <div key={run.id} className="p-4 rounded-2xl" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="font-semibold text-sm leading-tight flex-1" style={{ color: "var(--foreground)" }}>{run.title}</div>
                    <div className="font-bold" style={{ color: "var(--foreground)" }}>{fmtUsd(run.cost_usd ?? 0)}</div>
                  </div>
                  <div className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-subtle)" }}>{timeAgo(run.timestamp)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
