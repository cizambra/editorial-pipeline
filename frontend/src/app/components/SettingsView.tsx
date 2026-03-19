import { useState } from "react";
import { Settings2, User, Link2, Pen, MessageSquare, ChevronDown, ChevronUp, ChevronRight, ChevronLeft } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { Tabs } from "./Tabs";
import { Card, CardSection, Eyebrow, SectionTitle } from "./Card";
import { Field, Label, Input, Button, Dropzone } from "./FormComponents";
import { CustomSelect } from "./CustomSelect";
import { WYSIWYGEditor } from "./WYSIWYGEditor";

const SECTIONS = [
  { id: "companion", icon: Settings2, label: "Companion template", desc: "Structural brief for the paid companion lane" },
  { id: "index",     icon: Link2,     label: "Article index",       desc: "Refresh the source archive for retrieval" },
  { id: "users",     icon: User,      label: "Access control",      desc: "Create and manage internal accounts" },
  { id: "substack",  icon: MessageSquare, label: "Substack",        desc: "Session cookie for Notes scheduling" },
  { id: "prompts",   icon: Pen,       label: "Prompt system",       desc: "Voice, style, and thumbnail guidance" },
] as const;

// Reusable expandable prompt card (shared between mobile + desktop)
function PromptCard({
  title, desc, value, editing, expanded,
  onToggleEdit, onToggleExpand, onChange,
}: {
  title: string; desc: string; value: string; editing: boolean; expanded: boolean;
  onToggleEdit: () => void; onToggleExpand: () => void; onChange: (v: string) => void;
}) {
  return (
    <div
      className="rounded-2xl p-4 lg:p-5 mb-3"
      style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)", boxShadow: "0 1px 3px rgba(var(--border-rgb),0.05)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="font-bold text-sm leading-tight mb-0.5" style={{ color: "var(--foreground)" }}>{title}</div>
          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>{desc}</div>
        </div>
        <button
          onClick={onToggleEdit}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0"
          style={{ background: editing ? "var(--primary)" : "rgba(var(--primary-rgb),0.1)", color: editing ? "#fff" : "var(--primary)" }}
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      {editing ? (
        <div style={{ minHeight: 240 }}>
          <WYSIWYGEditor value={value} onChange={onChange} />
        </div>
      ) : (
        <>
          <div className="text-sm whitespace-pre-wrap leading-relaxed relative" style={{ color: "var(--foreground)", maxHeight: expanded ? "none" : 72, overflow: "hidden" }}>
            {value}
            {!expanded && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 36, background: "linear-gradient(to bottom, transparent, white)" }} />
            )}
          </div>
          <button onClick={onToggleExpand} className="flex items-center gap-1 text-xs font-semibold mt-2" style={{ color: "var(--primary)" }}>
            {expanded ? <><ChevronUp className="w-3.5 h-3.5" />Show less</> : <><ChevronDown className="w-3.5 h-3.5" />Show more</>}
          </button>
        </>
      )}
    </div>
  );
}

export function SettingsView() {
  const [activeTab, setActiveTab] = useState("companion");
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const [newUserRole, setNewUserRole] = useState("Operator");
  const [editingSocialVoice, setEditingSocialVoice] = useState(false);
  const [editingCompanionVoice, setEditingCompanionVoice] = useState(false);
  const [editingSpanishGuide, setEditingSpanishGuide] = useState(false);
  const [editingThumbnailPrompt, setEditingThumbnailPrompt] = useState(false);
  const [expandedSocialVoice, setExpandedSocialVoice] = useState(false);
  const [expandedCompanionVoice, setExpandedCompanionVoice] = useState(false);
  const [expandedSpanishGuide, setExpandedSpanishGuide] = useState(false);
  const [expandedThumbnailPrompt, setExpandedThumbnailPrompt] = useState(false);
  
  const [socialVoiceBrief, setSocialVoiceBrief] = useState(`VOICE & STYLE — read this carefully before writing:

This author writes for three overlapping audiences: 1. Parents trying to model better behavior for their kids and become better partners in relationships. 2. People in the AuDHD space who relate to executive dysfunction — the gap between knowing what to do and actually doing it. 3. Professionals who feel the tension between performing at work and struggling at home, in relationships, or with their own brain wiring.

The writing speaks to that tension without being preachy, clinical, or motivational. It sounds like a smart, honest friend explaining something at dinner.

What the writing does:

• Opens with a bold, counterintuitive claim or a sharp observation. No wind-up, no preamble.
• Uses short paragraphs. Often 1-3 sentences. Sometimes a single sentence on its own line for weight.
• Names things concretely — specific rules, analogies, mechanisms ("The Two-Day Rule", "the thermostat vs. the on/off switch"). Not vague concepts.
• Shows the contrast between the common approach and the better one — without lecturing.
• Trusts the reader. Doesn't over-explain. Doesn't repeat the same point in three ways.
• Ends with one clean takeaway or a question that earns itself — not a generic CTA.

No filler openers ("In today's fast-paced world...", "Have you ever wondered...", "I'm excited to share...")
No bullet lists of tips — ideas live in prose
No summarizing the article — pick one angle and develop it fully
No manufactured urgency or false intimacy
No explicitly naming diagnoses or demographics — the reader should recognize themselves, not be labeled`);
  
  const [companionVoiceBrief, setCompanionVoiceBrief] = useState(`VOICE, TONE & STYLE — read before writing:

This is a paid companion for a self-discipline newsletter. It is practical, dense, and research-backed. It is NOT motivational. It does not cheer the reader on. It gives them tools and explains why they work.

Voice characteristics:

• Speaks directly to the reader as "you" — from their experience, not the author's perspective
• Clinical but warm. Like a sharp coach who explains the mechanism, not the feeling.
• Short sentences. Concrete nouns. Active verbs. No filler.
• Names things concretely: katas have names, mental models cite actual researchers (name + institution), sequences have rationale
• The "Struggle" section must feel like the reader's own interior monologue — not an explanation of a problem, but a recognition
• "What You're Training" frames ONE specific meta-skill, not a list
• Each kata includes: a specific use case ("Use it when..."), a numbered practice steps, a "Why it works" paragraph, and a Moment → Action → Effect example
• The sequence section explains WHY the katas go in that order — one paragraph per kata, with logic
• Mental models cite real research (Bandura, Goliwitzer, Neff, Cladin, Mariat, etc.) — actual names, actual institutions`);
  
  const [spanishGuide, setSpanishGuide] = useState(`TRANSLATION RULES — follow every rule exactly:

ACCURACY:

• Translate VERBATIM. Render every sentence, every idea, every detail faithfully.
• Do NOT add content that is not in the original.
• Do NOT remove or omit any content from the original.
• Do NOT paraphrase, summarize, or reorder ideas.
• Do NOT alter facts, names of concepts, researchers, or practices.
• The translation must be a complete, faithful mirror of the source.

SECTION HEADERS — translate these exactly:

• 🎯 The Struggle → 🎯 La Lucha
• 🔧 What You're Training → 🔧 Lo Que Estás Entrenando
• ⚡ The Katas → ⚡ Los Katas
• 📖 The Sequence → 📖 La Secuencia
• 💭 Daily Dojo → 💭 Dojo Diario
• 💡 Food for Thought → 💡 Para Reflexionar
• 🧠 Mental Models → 🧠 Modelos Mentales
• 🔍 Actionable Insights → 🔍 Perspectivas Accionables
• 📅 Weekly Challenge → 📅 Desafío Semanal

• Latin American neutral Spanish — no vosotros, no regional slang
• Aim for natural phrasing while remaining faithful to the source meaning
• Preserve ALL markdown formatting exactly: headings, bold, italic, emoji, lists, horizontal rules
• Do not add translator notes or any extra text
• Return only the translated content, nothing else`);
  
  const [thumbnailPrompt, setThumbnailPrompt] = useState(`You are operating as a 3-stage creative studio for a self-discipline newsletter.

Given an article, generate exactly 3 thumbnail scene concepts as a JSON array.

CRITICAL OUTPUT REQUIREMENT:

• You MUST include "dalle_prompt" for every concept.
• "dalle_prompt" must be a single plain string that can be sent directly to the OpenAI images generation endpoint.
• No missing fields.
• If you cannot generate a valid dalle_prompt for all three concepts, return an empty array [].
• Do NOT include markdown fences.
• Return only valid JSON.

Internally follow these stages for each concept:

STAGE 1 - STORYTELLER

1) Identify the article's core idea in one sentence.
2) Choose one of these lenses: Parent reframe, Executive dysfunction parallel, Work/life contrast, Mental model in action.
3) Surface one concrete moment or scenario.

STAGE 2 - ART DIRECTOR

1) No floating objects.
2) No oversized symbolic props.
3) No surreal environments.
4) Maximum 3 to 5 visible elements.

3) Clearly describe position, orientation, spatial layout, and object positioning.

4) OBJECT STATE ENFORCEMENT: If any object requires a specific state (e.g., closed laptop, phone face-down, half-open door), explicitly describe its physical condition and what is NOT visible. Example: "laptop lid fully shut flat, no screen visible"

5) End exactly with: Undraw.co style: rounded geometric shapes, solid fills, subtle drop shadows. No text overlays, no labels, no UI elements. Minimal or simplified faces only. 16:9 widescreen ratio.

Style constraints:

• Flat editorial vector illustration.
• Clean rounded geometry.
• Warm but controlled color palette.
• Subtle grounding shadows only.
• No dramatic lighting.
• No complex decorative backgrounds.
• Must feel like a stylized real-life moment.`);

  // Shared section content renderer
  const renderSectionContent = (section: string) => {
    if (section === "companion") return (
      <div className="rounded-2xl p-4 lg:p-0" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)", boxShadow: "0 1px 3px rgba(var(--border-rgb),0.05)" }}>
        <Card>
          <Eyebrow>Companion template</Eyebrow>
          <SectionTitle className="mb-2">The structural brief for the paid companion lane</SectionTitle>
          <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>Upload a template file that defines the structure and format for companion content generation.</p>
          <div className="p-4 rounded-xl mb-4" style={{ background: "var(--secondary)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Template loaded.</p>
          </div>
          <Dropzone label="Upload template file" description="Markdown or text file that defines the companion structure" />
          <div className="mt-5 pt-5 border-t" style={{ borderTopColor: "rgba(var(--border-rgb),0.14)" }}>
            <Button variant="primary">Upload template</Button>
          </div>
        </Card>
      </div>
    );

    if (section === "index") return (
      <Card>
        <Eyebrow>Article index</Eyebrow>
        <SectionTitle className="mb-2">Refresh the source archive used for related article retrieval</SectionTitle>
        <p className="text-sm mb-5" style={{ color: "var(--muted-foreground)" }}>The index powers the "Related Articles" stage by providing context from your existing content library.</p>
        <div className="p-4 rounded-xl mb-5" style={{ background: "rgba(var(--primary-rgb),0.08)", border: "1px solid rgba(var(--primary-rgb),0.2)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base mb-1" style={{ color: "var(--foreground)" }}>116 articles indexed.</div>
              <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>Ready for retrieval in companion generation</div>
            </div>
            <div className="text-[36px] leading-none" style={{ fontFamily: '"Montserrat","Inter",sans-serif', fontWeight: 800, color: "var(--primary)" }}>116</div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="primary">Full refresh</Button>
          <Button variant="secondary">Index only new articles</Button>
        </div>
      </Card>
    );

    if (section === "users") return (
      <div className="space-y-3">
        <Card>
          <Eyebrow>Access control</Eyebrow>
          <SectionTitle className="mb-2">Create and review internal accounts</SectionTitle>
          <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>Manage internal operators from here.</p>
          <div className="space-y-3 mb-4">
            <Field><Label htmlFor="operator-email">Email</Label><Input id="operator-email" placeholder="operator@epicureanmedia.com" /></Field>
            <Field><Label htmlFor="display-name">Display name</Label><Input id="display-name" placeholder="Operator" /></Field>
            <Field><Label htmlFor="role">Role</Label>
              <CustomSelect id="role" options={[{ value: "Operator", label: "Operator" }, { value: "Admin", label: "Admin" }, { value: "Superadmin", label: "Superadmin" }]} value={newUserRole} onChange={setNewUserRole} />
            </Field>
            <Field><Label htmlFor="temp-password">Temporary password</Label><Input id="temp-password" placeholder="Set an initial password" /></Field>
          </div>
          <Button variant="primary">Create account</Button>
        </Card>
        <div className="space-y-2">
          {[
            { name: "Admin Tester", email: "admin-test@epicurean.local", login: "1d ago", role: "ADMIN", roleColor: "rgba(var(--primary-rgb),0.15)", roleText: "var(--primary)" },
            { name: "Epicurean Admin", email: "camilo@self-disciplined.com", login: "5h ago", role: "SUPERADMIN", roleColor: "var(--primary)", roleText: "#fff" },
            { name: "Camilo", email: "cjzambra@gmail.com", login: "never", role: "OPERATOR", roleColor: "rgba(var(--primary-rgb),0.15)", roleText: "var(--primary)" },
            { name: "Operator Tester", email: "operator-test@epicurean.local", login: "1d ago", role: "OPERATOR", roleColor: "rgba(var(--primary-rgb),0.15)", roleText: "var(--primary)" },
          ].map(u => (
            <div key={u.email} className="flex items-center justify-between p-4 rounded-2xl" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
              <div>
                <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--foreground)" }}>{u.name}</div>
                <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{u.email} · {u.login}</div>
              </div>
              <span className="px-2.5 py-1 text-[10px] font-bold tracking-[0.06em] uppercase rounded-lg" style={{ background: u.roleColor, color: u.roleText }}>{u.role}</span>
            </div>
          ))}
        </div>
      </div>
    );

    if (section === "substack") return (
      <Card>
        <Eyebrow>Substack</Eyebrow>
        <SectionTitle className="mb-2">Session cookie for Notes scheduling</SectionTitle>
        <p className="text-sm mb-5" style={{ color: "var(--muted-foreground)" }}>
          Get your <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--secondary)", color: "var(--primary)" }}>connect.sid</code> cookie from Substack via Chrome DevTools → Application → Cookies → substack.com, then add it to your <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--secondary)", color: "var(--primary)" }}>.env</code> as <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--secondary)", color: "var(--primary)" }}>SUBSTACK_SESSION_COOKIE</code>.
        </p>
        <div className="p-4 rounded-xl mb-5" style={{ background: "var(--secondary)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Not tested.</p>
        </div>
        <Button variant="secondary">Test connection</Button>
      </Card>
    );

    if (section === "prompts") return (
      <div className="space-y-3">
        <PromptCard title="Social voice brief" desc="Tone and style applied to all social post generation"
          value={socialVoiceBrief} editing={editingSocialVoice} expanded={expandedSocialVoice}
          onToggleEdit={() => setEditingSocialVoice(e => !e)} onToggleExpand={() => setExpandedSocialVoice(e => !e)} onChange={setSocialVoiceBrief} />
        <PromptCard title="Companion voice brief" desc="Editorial guidance shaping the paid companion writing style"
          value={companionVoiceBrief} editing={editingCompanionVoice} expanded={expandedCompanionVoice}
          onToggleEdit={() => setEditingCompanionVoice(e => !e)} onToggleExpand={() => setExpandedCompanionVoice(e => !e)} onChange={setCompanionVoiceBrief} />
        <PromptCard title="Spanish style guide" desc="Stylistic rules applied to Spanish translation and social posts"
          value={spanishGuide} editing={editingSpanishGuide} expanded={expandedSpanishGuide}
          onToggleEdit={() => setEditingSpanishGuide(e => !e)} onToggleExpand={() => setExpandedSpanishGuide(e => !e)} onChange={setSpanishGuide} />
        <PromptCard title="Thumbnail prompt" desc="Base context injected into every thumbnail concept generation"
          value={thumbnailPrompt} editing={editingThumbnailPrompt} expanded={expandedThumbnailPrompt}
          onToggleEdit={() => setEditingThumbnailPrompt(e => !e)} onToggleExpand={() => setExpandedThumbnailPrompt(e => !e)} onChange={setThumbnailPrompt} />
        <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--foreground)" }}>Ready to save changes.</p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Takes effect on the next generation run.</p>
          </div>
          <Button variant="primary">Save all</Button>
        </div>
      </div>
    );

    return null;
  };

  return (
    <>
    {/* ── Mobile Layout ──────────────────────────────── */}
    <div className="lg:hidden pb-8">
      {mobileSection === null ? (
        <>
          {/* Page header */}
          <div className="mb-5">
            <Eyebrow>Manage</Eyebrow>
            <div className="text-[22px] leading-tight -tracking-[0.02em]" style={{ fontFamily: '"Montserrat","Inter",sans-serif', fontWeight: 800, color: "var(--foreground)" }}>
              Settings
            </div>
          </div>

          {/* Section menu */}
          <div className="space-y-2">
            {SECTIONS.map(({ id, icon: Icon, label, desc }) => (
              <button
                key={id}
                onClick={() => setMobileSection(id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl text-left active:scale-[0.99] transition-all"
                style={{ background: "white", border: "1px solid rgba(var(--border-rgb),0.12)", boxShadow: "0 1px 3px rgba(var(--border-rgb),0.04)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(var(--primary-rgb),0.1)" }}>
                  <Icon size={18} style={{ color: "var(--primary)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{label}</div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-subtle)" }}>{desc}</div>
                </div>
                <ChevronRight size={16} style={{ color: "#c4b89a", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Section header with back */}
          <div className="mb-5">
            <button
              onClick={() => setMobileSection(null)}
              className="flex items-center gap-1 text-sm font-bold mb-3 active:opacity-70 transition-opacity"
              style={{ color: "var(--primary)" }}
            >
              <ChevronLeft size={16} />
              Settings
            </button>
            <Eyebrow>Manage</Eyebrow>
            <div className="text-[22px] leading-tight -tracking-[0.02em]" style={{ fontFamily: '"Montserrat","Inter",sans-serif', fontWeight: 800, color: "var(--foreground)" }}>
              {SECTIONS.find(s => s.id === mobileSection)?.label}
            </div>
          </div>

          {renderSectionContent(mobileSection)}
        </>
      )}
    </div>

    {/* ── Desktop Layout ─────────────────────────────── */}
    <div className="hidden lg:block">
      <PageHeader
        kicker="System configuration"
        title="Settings should shape output quality, not feel like a leftover admin page"
        description="Template control, index maintenance, and prompt guidance live here because they materially influence production quality."
      />

      <Tabs
        tabs={[
          { id: "companion", label: "Companion template", icon: Settings2 },
          { id: "index", label: "Article index", icon: Link2 },
          { id: "users", label: "Access control", icon: User },
          { id: "substack", label: "Substack", icon: MessageSquare },
          { id: "prompts", label: "Prompt system", icon: Pen }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {renderSectionContent(activeTab)}
    </div>
    </>
  );
}