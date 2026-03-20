import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { useEffect, useState } from "react";

const GEO_URL = "/countries-110m.json";
const TOP_N = 10;

// ISO 3166-1 alpha-2 → numeric (world-atlas uses numeric codes as string IDs)
const A2_TO_NUMERIC: Record<string, string> = {
  AD:"020",AE:"784",AF:"004",AG:"028",AL:"008",AM:"051",AO:"024",AR:"032",AT:"040",AU:"036",
  AZ:"031",BA:"070",BB:"052",BD:"050",BE:"056",BF:"854",BG:"100",BH:"048",BI:"108",BJ:"204",
  BN:"096",BO:"068",BR:"076",BS:"044",BT:"064",BW:"072",BY:"112",BZ:"084",CA:"124",CD:"180",
  CF:"140",CG:"178",CH:"756",CI:"384",CL:"152",CM:"120",CN:"156",CO:"170",CR:"188",CU:"192",
  CV:"132",CY:"196",CZ:"203",DE:"276",DJ:"262",DK:"208",DO:"214",DZ:"012",EC:"218",EE:"233",
  EG:"818",ER:"232",ES:"724",ET:"231",FI:"246",FJ:"242",FR:"250",GA:"266",GB:"826",GE:"268",
  GH:"288",GM:"270",GN:"324",GQ:"226",GR:"300",GT:"320",GW:"624",GY:"328",HN:"340",HR:"191",
  HT:"332",HU:"348",ID:"360",IE:"372",IL:"376",IN:"356",IQ:"368",IR:"364",IS:"352",IT:"380",
  JM:"388",JO:"400",JP:"392",KE:"404",KG:"417",KH:"116",KI:"296",KM:"174",KN:"659",KP:"408",
  KR:"410",KW:"414",KZ:"398",LA:"418",LB:"422",LC:"662",LI:"438",LK:"144",LR:"430",LS:"426",
  LT:"440",LU:"442",LV:"428",LY:"434",MA:"504",MC:"492",MD:"498",ME:"499",MG:"450",MK:"807",
  ML:"466",MM:"104",MN:"496",MR:"478",MT:"470",MU:"480",MV:"462",MW:"454",MX:"484",MY:"458",
  MZ:"508",NA:"516",NE:"562",NG:"566",NI:"558",NL:"528",NO:"578",NP:"524",NR:"520",NZ:"554",
  OM:"512",PA:"591",PE:"604",PG:"598",PH:"608",PK:"586",PL:"616",PT:"620",PW:"585",PY:"600",
  QA:"634",RO:"642",RS:"688",RU:"643",RW:"646",SA:"682",SB:"090",SC:"690",SD:"729",SE:"752",
  SG:"702",SI:"705",SK:"703",SL:"694",SM:"674",SN:"686",SO:"706",SR:"740",SS:"728",ST:"678",
  SV:"222",SY:"760",SZ:"748",TD:"148",TG:"768",TH:"764",TJ:"762",TL:"626",TM:"795",TN:"788",
  TO:"776",TR:"792",TT:"780",TV:"798",TZ:"834",UA:"804",UG:"800",US:"840",UY:"858",UZ:"860",
  VC:"670",VE:"862",VN:"704",VU:"548",WS:"882",YE:"887",ZA:"710",ZM:"894",ZW:"716",
  HK:"344",TW:"158",
};

const NUMERIC_TO_A2 = Object.fromEntries(
  Object.entries(A2_TO_NUMERIC).map(([alpha2, numeric]) => [numeric, alpha2]),
);

const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  uk: "GB",
  "united kingdom": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  uae: "AE",
  "united arab emirates": "AE",
  russia: "RU",
  "south korea": "KR",
  korea: "KR",
  "north korea": "KP",
  vietnam: "VN",
  czechia: "CZ",
  "czech republic": "CZ",
  "ivory coast": "CI",
  "cote d'ivoire": "CI",
  "côte d’ivoire": "CI",
};

const COUNTRY_NAME_TO_A2: Record<string, string> = (() => {
  const map: Record<string, string> = { ...COUNTRY_ALIASES };
  if (typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined") {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    for (const alpha2 of Object.keys(A2_TO_NUMERIC)) {
      const name = displayNames.of(alpha2);
      if (name) map[name.toLowerCase()] = alpha2;
    }
  }
  return map;
})();

function normalizeCountryCode(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  if (A2_TO_NUMERIC[upper]) return upper;
  if (NUMERIC_TO_A2[upper]) return NUMERIC_TO_A2[upper];
  return COUNTRY_NAME_TO_A2[value.toLowerCase()] ?? null;
}

function accent(intensity: number) {
  const r = 196;
  const g = Math.round(186 - (186 - 82) * intensity);
  const b = Math.round(154 - (154 - 26) * intensity);
  return `rgb(${r},${g},${b})`;
}

interface SubscriberMapProps {
  /** All countries sorted descending by count */
  allCountries: [string, number][];
  mobile?: boolean;
}

export function SubscriberMap({ allCountries, mobile }: SubscriberMapProps) {
  const [view, setView] = useState<"all" | "top">("all");
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null);
  const [geography, setGeography] = useState<any | null>(null);
  const [geoFailed, setGeoFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setGeoFailed(false);
    fetch(GEO_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setGeography(data);
      })
      .catch(() => {
        if (!cancelled) setGeoFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (allCountries.length === 0) return null;

  if (geoFailed) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
      >
        <div className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
          Map unavailable
        </div>
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
          The geographic data could not be loaded. Country totals are still listed below.
        </div>
      </div>
    );
  }
  if (!geography) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
      >
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
          Loading map…
        </div>
      </div>
    );
  }

  const normalizedCountries = allCountries.reduce<[string, number][]>((acc, [rawCode, count]) => {
    const code = normalizeCountryCode(rawCode);
    if (!code) return acc;
    const existing = acc.findIndex(([existingCode]) => existingCode === code);
    if (existing >= 0) {
      acc[existing] = [code, acc[existing][1] + count];
    } else {
      acc.push([code, count]);
    }
    return acc;
  }, []);

  const topSet = new Set(normalizedCountries.slice(0, TOP_N).map(([c]) => c));

  // Build numeric → count lookup (only for the active view)
  const countByNumeric: Record<string, number> = {};
  for (const [code, count] of normalizedCountries) {
    const num = A2_TO_NUMERIC[code];
    if (!num) continue;
    if (view === "top" && !topSet.has(code)) continue;
    countByNumeric[num] = count;
  }

  const maxCount = Math.max(...Object.values(countByNumeric), 1);

  const getColor = (numericId: string) => {
    const count = countByNumeric[numericId];
    if (!count) return "rgba(var(--border-rgb),0.09)";
    const intensity = Math.pow(count / maxCount, 0.4);
    return accent(intensity);
  };

  return (
    <div className="relative w-full" style={mobile ? { height: 300 } : { aspectRatio: "2/1" }}>

      {/* All / Top toggle */}
      <div className="absolute top-0 left-0 z-10 flex rounded-lg overflow-hidden"
        style={{ border: "1px solid rgba(var(--border-rgb),0.14)" }}>
        {(["all", "top"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="text-[10px] font-bold px-2.5 py-1 transition-all"
            style={{
              background: view === v ? "var(--primary)" : "var(--card)",
              color: view === v ? "white" : "var(--muted-foreground)",
            }}
          >
            {v === "all" ? "All" : `Top ${TOP_N}`}
          </button>
        ))}
      </div>

      <ComposableMap
        projectionConfig={{ scale: mobile ? 120 : 147, center: [0, 15] }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={mobile ? 1.6 : 1} minZoom={1} maxZoom={8}>
          <Geographies geography={geography}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const numericId = String(geo.id);
                const count = countByNumeric[numericId] ?? 0;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getColor(numericId)}
                    stroke="rgba(var(--border-rgb),0.18)"
                    strokeWidth={0.3}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", opacity: count ? 0.8 : 1, cursor: count ? "pointer" : "default" },
                      pressed: { outline: "none" },
                    }}
                    onMouseEnter={(e) => {
                      if (!count) return;
                      setTooltip({ name: geo.properties?.name ?? "", count, x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={(e) => {
                      if (!count) return;
                      setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : t);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2.5 py-1.5 rounded-lg text-xs font-bold pointer-events-none"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: "var(--card)",
            border: "1px solid rgba(var(--border-rgb),0.15)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            color: "var(--foreground)",
          }}
        >
          {tooltip.name} · {tooltip.count.toLocaleString()}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-subtle)" }}>Less</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 1.0].map((v) => (
            <div key={v} className="w-3 h-3 rounded-sm" style={{ background: accent(Math.pow(v, 0.4)) }} />
          ))}
        </div>
        <span className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-subtle)" }}>More</span>
      </div>
    </div>
  );
}
