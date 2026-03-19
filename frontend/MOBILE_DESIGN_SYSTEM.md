# SelfDisciplined Mobile Design System
**Version 1.0 - Comprehensive Mobile-First Redesign**

---

## Executive Summary

This document outlines a complete mobile UI redesign for the SelfDisciplined editorial pipeline webapp. The goal is to create a consistent, mobile-native experience that follows iOS and Android best practices while maintaining the brand identity.

### Core Principles
1. **Mobile-First**: Design for thumb zones and one-handed use
2. **Component Reusability**: Build once, use everywhere
3. **Native Feel**: Match OS patterns users expect
4. **Performance**: Smooth 60fps animations and transitions
5. **Accessibility**: 44px minimum touch targets, clear focus states

---

## Current State Audit

### ✅ What's Working
- **MobileSection**: Edge-to-edge card component
- **CustomSelect**: Native dropdown styling
- **MobileBottomNav**: Bottom navigation component exists
- **Mobile/Desktop Separation**: Clean lg: breakpoint usage
- **Brand Colors**: Consistent #c4522a accent, warm backgrounds

### ❌ Pain Points
- **Inconsistent Navigation**: Desktop sidebar vs no mobile nav structure
- **Scattered Actions**: Create buttons in different locations per section
- **No Modal System**: Each section implements its own overlays
- **Inconsistent Spacing**: Some sections have pt-6, others don't
- **No Touch Optimization**: Many buttons below 44px target size
- **Mixed Patterns**: Sticky tabs in Publishing, inline tabs in Marketing
- **No Transition System**: Jarring page changes

### 📊 Section-by-Section Analysis

#### Marketing Section
- **Campaigns**: Has pt-6, uses MobileSection, search inline
- **Repurpose**: Has pt-6, custom mobile layout with fixed header
- **Compose**: Has pt-6, full-screen modal for note editing, starts empty
- **Quotes**: Has pt-6, upload modal pattern
- **Publishing**: NO pt-6 (intentional), sticky segmented tabs, uses IntersectionObserver

#### Pipeline Section
- Mixed desktop/mobile patterns
- Content selector dropdown
- No consistent spacing

#### Other Sections
- Dashboard, Companion, Settings: Needs mobile audit

---

## Mobile Design System Components

### 1. Layout Components

#### MobilePageContainer
**Purpose**: Wrapper for all mobile pages with consistent spacing and bottom nav padding
```tsx
<MobilePageContainer hasBottomNav>
  {children}
</MobilePageContainer>
```
**Features**:
- Automatic pb-20 for bottom nav clearance
- Safe area insets
- Scroll restoration
- Pull-to-refresh hooks

#### MobileHeader
**Purpose**: Consistent top bar for all pages
```tsx
<MobileHeader
  title="Page Title"
  left={<BackButton />}
  right={<IconButton icon={Search} />}
/>
```
**Specs**:
- 56px height
- Safe area top inset
- Sticky positioning option
- Blur background when scrolling

#### MobileSection (Enhanced)
**Current**: Already implemented
**Enhancements Needed**:
- Add loading skeleton state
- Add empty state variant
- Add collapsible variant
- Add header/footer slots

### 2. Navigation Components

#### MobileBottomNav (Enhanced)
**Current**: Already implemented at `/src/app/components/MobileBottomNav.tsx`
**Enhancements Needed**:
- Safe area insets (already has class, verify implementation)
- Haptic feedback hooks
- Active route auto-detection
- Badge animations

**Navigation Structure**:
```
- Pipeline (home icon)
- Marketing (megaphone icon)
- Companion (book icon)
- More (grid icon → opens drawer with: Dashboard, Audience, History, Ideas, Settings)
```

#### MobileTabBar
**Purpose**: Segmented control for section-level tabs
```tsx
<MobileTabBar
  tabs={[
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'repurpose', label: 'Repurpose' }
  ]}
  activeTab={activeTab}
  onChange={setActiveTab}
  sticky
/>
```
**Features**:
- Sticky positioning with dynamic padding (like Publishing)
- Smooth indicator animation
- Equal width distribution
- Badge support

#### MobileDrawer
**Purpose**: Slide-in panel for menus, filters, forms
```tsx
<MobileDrawer
  isOpen={isOpen}
  onClose={onClose}
  position="bottom" // or "right", "left"
  snapPoints={[0.4, 0.9]}
>
  {content}
</MobileDrawer>
```
**Features**:
- Backdrop blur
- Swipe to dismiss
- Spring animations
- Keyboard avoidance

### 3. Action Components

#### MobileFAB
**Purpose**: Primary action button, consistent across app
```tsx
<MobileFAB
  icon={Plus}
  label="Create"
  onClick={handleCreate}
  position="bottom-right"
/>
```
**Specs**:
- 56px × 56px minimum
- Brand accent color (#c4522a)
- Shadow elevation
- Bounce animation on mount
- Hide on scroll down, show on scroll up

#### MobileActionSheet
**Purpose**: iOS-style action menu
```tsx
<MobileActionSheet
  isOpen={isOpen}
  onClose={onClose}
  actions={[
    { label: 'Edit', icon: Edit2, onClick: handleEdit },
    { label: 'Delete', icon: Trash2, destructive: true, onClick: handleDelete }
  ]}
/>
```

#### MobileButton
**Purpose**: Consistent button component
```tsx
<MobileButton
  variant="primary" // primary, secondary, ghost, destructive
  size="large" // large (48px), medium (40px), small (36px)
  fullWidth
>
  Label
</MobileButton>
```
**Specs**:
- Minimum 44px height (all sizes meet this)
- Active state scaling (0.96)
- Loading state with spinner
- Disabled state with opacity

### 4. Form Components

#### MobileInput
**Purpose**: Mobile-optimized text input
```tsx
<MobileInput
  label="Email"
  placeholder="Enter your email"
  type="email"
  error="Invalid email"
/>
```
**Features**:
- 48px height
- Large tap target for label
- Floating label animation
- Clear button
- Error state

#### MobileSelect (Enhanced CustomSelect)
**Current**: Already exists at `/src/app/components/CustomSelect.tsx`
**Enhancements**:
- Bottom sheet picker on mobile
- Search within options
- Multi-select mode
- Grouped options

#### MobileDateTimePicker
**Purpose**: Native date/time selection
```tsx
<MobileDateTimePicker
  label="Schedule for"
  value={date}
  onChange={setDate}
  mode="datetime" // date, time, datetime
/>
```

### 5. Content Components

#### MobileCard (Enhanced Card)
**Current**: Card exists at `/src/app/components/Card.tsx`
**Mobile Enhancements**:
- Swipe actions (left/right)
- Long press menu
- Skeleton loading state
- Expandable content

#### MobileList
**Purpose**: Optimized list rendering
```tsx
<MobileList
  items={items}
  renderItem={(item) => <ItemComponent />}
  onRefresh={handleRefresh}
  onLoadMore={handleLoadMore}
  emptyState={<EmptyState />}
/>
```
**Features**:
- Virtual scrolling for performance
- Pull to refresh
- Infinite scroll
- Loading states
- Empty states

#### MobileEmptyState
**Purpose**: Consistent empty states
```tsx
<MobileEmptyState
  icon={Calendar}
  title="No posts scheduled"
  description="Create your first campaign to get started"
  action={<MobileButton>Create Campaign</MobileButton>}
/>
```

### 6. Feedback Components

#### MobileToast
**Purpose**: Brief notifications
```tsx
showToast({
  message: 'Post scheduled successfully',
  type: 'success', // success, error, info
  action: { label: 'View', onClick: handleView }
})
```
**Specs**:
- Bottom position (thumb reachable)
- Auto dismiss (4s default)
- Swipe to dismiss
- Queue management

#### MobileModal
**Purpose**: Full-screen modal for complex flows
```tsx
<MobileModal
  isOpen={isOpen}
  onClose={onClose}
  title="Create Campaign"
  headerRight={<Button>Save</Button>}
>
  {content}
</MobileModal>
```
**Features**:
- Slide-up animation
- Header with close/back
- Safe area insets
- Keyboard handling
- Scroll lock on body

#### MobileSpinner
**Purpose**: Loading indicator
```tsx
<MobileSpinner size="large" />
```

### 7. Utility Components

#### MobileBottomSheet
**Purpose**: Reusable bottom sheet (used by drawer, action sheet, select)
```tsx
<MobileBottomSheet
  isOpen={isOpen}
  onClose={onClose}
  height="auto" // or percentage, or pixel value
  snapPoints={[0.5, 0.9]}
>
  {content}
</MobileBottomSheet>
```

#### MobileSafeArea
**Purpose**: Handle safe area insets
```tsx
<MobileSafeArea top bottom>
  {children}
</MobileSafeArea>
```

---

## Design Tokens (Mobile-Specific)

### Spacing Scale
```css
--mobile-spacing-xs: 8px;
--mobile-spacing-sm: 12px;
--mobile-spacing-md: 16px;
--mobile-spacing-lg: 24px;
--mobile-spacing-xl: 32px;
--mobile-spacing-2xl: 48px;
```

### Touch Targets
```css
--mobile-touch-min: 44px;    /* Minimum interactive element */
--mobile-touch-comfortable: 48px; /* Comfortable size */
--mobile-touch-large: 56px;   /* Primary actions */
```

### Animation Timing
```css
--mobile-duration-fast: 150ms;
--mobile-duration-base: 200ms;
--mobile-duration-slow: 300ms;
--mobile-easing-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
--mobile-easing-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1);
--mobile-easing-accelerate: cubic-bezier(0.4, 0.0, 1, 1);
--mobile-easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Z-Index Scale
```css
--mobile-z-dropdown: 1000;
--mobile-z-sticky: 1010;
--mobile-z-drawer: 1020;
--mobile-z-modal: 1030;
--mobile-z-toast: 1040;
--mobile-z-tooltip: 1050;
```

### Border Radius
```css
--mobile-radius-sm: 8px;   /* Small elements */
--mobile-radius-md: 12px;  /* Cards, buttons */
--mobile-radius-lg: 16px;  /* Sections */
--mobile-radius-xl: 20px;  /* Modals */
```

---

## Page-Level Patterns

### Pattern 1: List-Detail Flow
**Used in**: Campaigns, Companion Notes, Pipeline Stages

**Mobile Structure**:
1. List view with search/filter
2. Tap card → Full-screen modal
3. Modal has back button (top left)
4. Modal has actions (top right or bottom)

**Example: Campaigns**
```tsx
// List View
<MobilePageContainer hasBottomNav>
  <MobileHeader title="Campaigns" right={<SearchButton />} />
  <MobileList items={campaigns} onTap={handleTap} />
  <MobileFAB icon={Plus} onClick={handleCreate} />
</MobilePageContainer>

// Detail View (Modal)
<MobileModal isOpen={!!selectedId} onClose={handleClose} title={campaign.title}>
  <CampaignDetailContent />
</MobileModal>
```

### Pattern 2: Eyebrow + SectionTitle (for Mobile Modals & Forms)

**Purpose**: For mobile modals and forms that need section organization and gentle guidance without the formality of desktop labels.

**When to use:**
- Mobile modals with multiple form sections
- Settings or configuration screens on mobile
- Any mobile form where you need to break up sections with friendly context

**Tone Guidelines:**
- **Conversational and friendly** - Ask questions like "What should we call this?" instead of commands
- **Concise** - Avoid redundancy; the modal title already provides context
- **Helpful, not bossy** - Guide users without feeling instructional
- Keep it short (under 8 words ideally)

**Components:**
- `<Eyebrow>` - All-caps, small, muted label (e.g., "ARTICLE INFORMATION")
- `<SectionTitle>` - Larger, conversational description in sentence case

**Visual Style:**
- Eyebrow: 10px, bold, uppercase, tracking-wider, #9e8f7f (muted)
- SectionTitle: 15px, font-semibold, #6e6256, mb-4
- Clear visual hierarchy through size/weight contrast

### Usage Example: QuotesView Mobile Extract Modal

```tsx
{/* Article Title Section */}
<div>
  <Eyebrow>Article information</Eyebrow>
  <SectionTitle className="mb-4">What should we call this?</SectionTitle>
  <input
    type="text"
    value={articleTitle}
    onChange={(e) => setArticleTitle(e.target.value)}
    placeholder="Enter article title..."
    className="w-full px-4 py-3.5 rounded-2xl text-[16px]"
    style={{
      background: 'white',
      border: '1px solid rgba(78, 57, 32, 0.15)',
      color: '#20180f'
    }}
  />
</div>

{/* Article Source Section - Paste */}
<div>
  <Eyebrow>Article source</Eyebrow>
  <SectionTitle className="mb-4">
    Paste your article text
  </SectionTitle>
  <textarea ... />
</div>

{/* Article Source Section - Upload */}
<div>
  <Eyebrow>Article source</Eyebrow>
  <SectionTitle className="mb-4">
    Upload your article file
  </SectionTitle>
  <input type="file" ... />
</div>
```

**Good SectionTitle Examples:**
- ✅ "What should we call this?" (friendly question)
- ✅ "Paste your article text" (concise, clear)
- ✅ "Upload your article file" (simple, direct)
- ✅ "Configure translation and automation" (from Pipeline - clear action)

**Bad SectionTitle Examples:**
- ❌ "Give this article a title" (commanding)
- ❌ "Paste your article content to extract quotes" (redundant, too long)
- ❌ "Title that identifies this article" (formal, stiff)
- ❌ "Drop your file or tap to browse from device" (too wordy)

### Pattern 3: Segmented Section
**Used in**: Publishing (Queue vs Published)

**Mobile Structure**:
1. Segmented control at top (sticky with dynamic padding)
2. Content toggles based on selection
3. Filters in bottom sheet (not inline)

**Example: Publishing**
```tsx
<MobilePageContainer hasBottomNav>
  <MobileHeader title="Publishing" right={<FilterButton />} />
  <MobileSegmentedControl
    segments={['Queue', 'Published']}
    value={segment}
    onChange={setSegment}
    sticky
  />
  {segment === 'queue' && <QueueContent />}
  {segment === 'published' && <PublishedContent />}
</MobilePageContainer>
```

### Pattern 4: Form Flow
**Used in**: Settings, Create/Edit forms

**Mobile Structure**:
1. Full-screen modal
2. Scrollable form fields
3. Sticky bottom actions
4. Keyboard avoidance

---

## Interaction Patterns

### Gestures
- **Pull to refresh**: All list views
- **Swipe to dismiss**: Modals, toasts, cards (contextual)
- **Long press**: Context menus on cards
- **Swipe left/right on cards**: Quick actions (edit, delete)
- **Swipe between tabs**: Optional enhancement

### Transitions
- **Page transitions**: Slide left/right (horizontal navigation)
- **Modal open**: Slide up from bottom
- **Drawer open**: Slide from edge
- **Tab change**: Crossfade content
- **List items**: Fade in on scroll
- **FAB**: Scale + fade on scroll position

### Loading States
- **Initial load**: Full-screen skeleton
- **Refresh**: Pull indicator + list skeleton
- **Infinite scroll**: Bottom spinner
- **Button action**: Inline spinner + disabled state
- **Optimistic updates**: Immediate UI update with rollback

---

## Section-Specific Redesigns

### Marketing Section

#### Mobile Navigation
```
[Marketing] (Header)
┌─────────────────────────────────┐
│ [Campaigns][Repurpose][Compose] │ ← Horizontal scroll tabs
│ [Quotes][Publishing]            │
└─────────────────────────────────┘
```

#### Campaigns Tab
- **Header**: Search button (opens drawer)
- **Content**: List of campaign cards
- **FAB**: Create new campaign
- **Tap card**: Full-screen campaign detail modal

#### Repurpose Tab
- **Header**: Platform filter button
- **Content**: Scrollable content queue
- **FAB**: Add to queue
- **Card actions**: Swipe for quick edit/delete

#### Compose Tab
- **Header**: Nothing (clean)
- **Content**: List of notes (empty state: "Create your first note")
- **FAB**: Create new note
- **Tap card**: Full-screen editor modal

#### Quotes Tab
- **Header**: Extract button
- **Content**: List of articles with quotes
- **Tap article**: Expand to show quotes
- **FAB**: Extract from article

#### Publishing Tab
- **Header**: Filter button
- **Segmented Control**: Queue | Published (sticky)
- **Content**: Post cards with engagement stats
- **No FAB**: Publishing happens from other tabs

### Pipeline Section

#### Mobile Structure
```
[Pipeline] (Header)
┌─────────────────────────────────┐
│ Stage Selector (Dropdown)       │
├─────────────────────────────────┤
│ Content Type Selector           │
├─────────────────────────────────┤
│ [Card: Content Preview]         │
│ [Card: Content Preview]         │
└─────────────────────────────────┘
[FAB: Run Pipeline]
```

### Bottom Navigation Structure
```
┌────────┬────────┬────────┬────────┐
│Pipeline│Marketing│Companion│ More  │
│   🏠   │   📢   │   📖   │   ⋯   │
└────────┴────────┴────────┴────────┘
```

**More menu** opens drawer with:
- Dashboard
- Audience
- History
- Ideas
- Settings

---

## Implementation Strategy

### Phase 1: Foundation (Week 1)
**Goal**: Build reusable component library

1. ✅ **Audit existing components** (DONE via this doc)
2. **Create mobile primitives**:
   - MobileButton
   - MobileInput
   - MobileCard (enhance existing)
   - MobileEmptyState
   - MobileSpinner
3. **Create layout components**:
   - MobilePageContainer
   - MobileHeader
   - MobileSafeArea
4. **Create navigation components**:
   - Enhance MobileBottomNav
   - MobileTabBar
   - MobileSegmentedControl
5. **Create modal system**:
   - MobileBottomSheet (base)
   - MobileDrawer
   - MobileModal
   - MobileActionSheet

### Phase 2: Marketing Section (Week 2)
**Goal**: Redesign Marketing as proof of concept

1. **Implement bottom nav** in Root.tsx
2. **Add MobileHeader** to Marketing
3. **Rebuild Campaigns tab**:
   - List view with MobileList
   - Search in drawer
   - FAB for create
   - Detail modal
4. **Rebuild other tabs** using same patterns
5. **Add transitions** between tabs

### Phase 3: Pipeline & Other Sections (Week 3)
**Goal**: Apply patterns to remaining sections

1. **Pipeline**: Dropdown selectors + FAB
2. **Companion**: List-detail pattern
3. **Dashboard**: Card grid layout
4. **Settings**: Form pattern

### Phase 4: Polish & Optimization (Week 4)
**Goal**: Animations, gestures, performance

1. **Add transitions**: Page, modal, tab animations
2. **Add gestures**: Swipe actions, pull to refresh
3. **Optimize rendering**: Virtual scrolling, lazy loading
4. **Test performance**: 60fps target
5. **Accessibility audit**: Touch targets, focus states, screen readers

---

## File Structure

```
/src/app/components/
├── mobile/
│   ├── layout/
│   │   ├── MobilePageContainer.tsx
│   │   ├── MobileHeader.tsx
│   │   ├── MobileSafeArea.tsx
│   │   └── MobileSection.tsx (move existing)
│   ├── navigation/
│   │   ├── MobileBottomNav.tsx (enhance existing)
│   │   ├── MobileTabBar.tsx
│   │   ├── MobileSegmentedControl.tsx
│   │   └── MobileDrawer.tsx
│   ├── actions/
│   │   ├── MobileButton.tsx
│   │   ├── MobileFAB.tsx
│   │   └── MobileActionSheet.tsx
│   ├── forms/
│   │   ├── MobileInput.tsx
│   │   ├── MobileSelect.tsx (enhance CustomSelect)
│   │   ├── MobileDateTimePicker.tsx
│   │   └── MobileTextarea.tsx
│   ├── content/
│   │   ├── MobileCard.tsx (enhance Card)
│   │   ├── MobileList.tsx
│   │   ├── MobileListItem.tsx (move from MobileSection)
│   │   └── MobileEmptyState.tsx
│   ├── feedback/
│   │   ├── MobileToast.tsx
│   │   ├── MobileModal.tsx
│   │   ├── MobileBottomSheet.tsx
│   │   └── MobileSpinner.tsx
│   ├── utils/
│   │   ├── useMobileGestures.ts
│   │   ├── useMobileSafeArea.ts
│   │   ├── useMobileScrollPosition.ts
│   │   └── mobileAnimations.ts
│   └── index.ts (barrel export)
```

---

## Success Metrics

### User Experience
- ✅ All touch targets ≥ 44px
- ✅ Animations run at 60fps
- ✅ Consistent component usage across all sections
- ✅ Zero mobile-specific bugs

### Developer Experience
- ✅ Single source of truth for mobile components
- ✅ Clear documentation for each component
- ✅ Storybook/examples for all components
- ✅ TypeScript types for all props

### Design Consistency
- ✅ Same navigation pattern everywhere
- ✅ Same modal pattern everywhere
- ✅ Same action pattern (FAB) everywhere
- ✅ Same spacing/sizing scale everywhere

---

## Next Steps

**To begin implementation, we should**:

1. **Review and approve** this design system
2. **Prioritize components** (which ones to build first?)
3. **Choose a pilot section** (Marketing recommended)
4. **Set up component directory** structure
5. **Start building** foundation components

**Questions to answer**:
- Do you want to start with Phase 1 (build all components first)?
- Or do you prefer iterative approach (build components as needed per section)?
- Any specific mobile behaviors you've seen in other apps that you love?
- Any patterns from this doc you want to modify?

---

## Mobile-First Design Patterns (Established)

### ✅ True Mobile-First Principles

Based on successful implementation in DashboardView and MarketingView:

#### 1. **Vertical Scrolling Lists** (No Grids on Mobile)
**Bad** ❌:
```tsx
// Desktop thinking - 2x2 grid on mobile
<div className="grid grid-cols-2 gap-3">
  <StatCard />
  <StatCard />
</div>
```

**Good** ✅:
```tsx
// Mobile-first - single column vertical stack
<div className="space-y-3">
  <StatCard />
  <StatCard />
</div>
```

**Why**: Thumbs scroll vertically, not horizontally. Single column is easier to scan and tap.

#### 2. **Icon + Label Buttons** (Not Just Labels)
**Bad** ❌:
```tsx
<button>Pipeline</button>
<button>Marketing</button>
```

**Good** ✅:
```tsx
<button className="flex items-center gap-1.5">
  <ArrowRight className="w-4 h-4" />
  <span>Pipeline</span>
</button>
<button className="flex items-center gap-1.5">
  <FileText className="w-4 h-4" />
  <span>Marketing</span>
</button>
```

**Why**: Icons provide visual scanning, especially for non-native speakers. They add personality and quicker recognition.

#### 3. **Touch-Optimized Interactions**
```tsx
<button className="active:scale-[0.98] transition-transform">
  {/* Card content */}
</button>
```

**Required**:
- `active:scale-[0.98]` or `active:scale-95` for tactile feedback
- Minimum 44px touch targets
- Full-width tappable areas on list items
- Clear visual pressed states

#### 4. **Proper Spacing with space-y-* Utilities**
**Bad** ❌:
```tsx
// Using MobileList wrapper when not needed
<MobileList items={items} renderItem={...} />
// Creates no gaps between items
```

**Good** ✅:
```tsx
// Direct rendering with proper spacing
<div className="space-y-3">
  {items.map(item => (
    <Card key={item.id}>{item.content}</Card>
  ))}
</div>
```

**Why**: `space-y-3` (12px) or `space-y-4` (16px) provides breathing room. Never let cards touch.

#### 5. **Consolidated Information Cards**
**Desktop**: Separate cards for each metric
```tsx
<Card>Articles: 116</Card>
<Card>Covered: 116</Card>
<Card>Remaining: 0</Card>
```

**Mobile**: Combine related metrics into rich cards
```tsx
<Card>
  <div className="flex justify-between">
    <div>
      <div>116</div>
      <div>indexed & covered</div>
    </div>
    <div>
      <div>0</div>
      <div>remaining</div>
    </div>
  </div>
</Card>
```

**Why**: Reduces scrolling, creates context, feels more native (like iOS Health/Fitness apps).

#### 6. **Component Usage Guidelines**

**Use MobileList ONLY when**:
- You need virtual scrolling (100+ items)
- You need pull-to-refresh
- You need infinite scroll
- You need loading/empty states management

**Use Direct Rendering when**:
- You have < 20 items
- Items are static (no dynamic loading)
- You want simple spacing control with `space-y-*`

**Use MobileSection for**:
- Edge-to-edge content blocks
- Sections with titles/subtitles
- Grouped content that needs visual separation
- Inside sections, use `space-y-3` for child elements

#### 7. **Button Patterns on Mobile**

**Action Buttons in Cards**:
```tsx
<div className="flex gap-2">
  <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5">
    <Icon className="w-4 h-4" />
    <span>Label</span>
  </button>
</div>
```

**Required**:
- `flex-1` for equal width distribution
- `flex items-center gap-1.5` for icon + label alignment
- `py-2.5` minimum (40px height) for comfortable tapping
- `active:scale-95` for press feedback

#### 8. **Mobile/Desktop Separation Pattern**

**Always use this structure**:
```tsx
export function ViewName() {
  return (
    <>
      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobilePageContainer>
          <MobileHeader title="..." showBack={false} />
          <div className="px-4 pt-4 pb-20">
            {/* Mobile-specific vertical layout */}
          </div>
        </MobilePageContainer>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">
        <PageHeader kicker="..." title="..." />
        {/* Desktop-specific grid/multi-column layout */}
      </div>
    </>
  );
}
```

**Never**:
- Dual-render the same component for mobile and desktop
- Try to make one layout "responsive" with Tailwind breakpoints
- Share complex layout logic between mobile/desktop

**Why**: Each platform needs its own UX. Mobile is not "small desktop".

---

## Implementation Progress

### ✅ Completed Views
- **MarketingView**: Full mobile/desktop separation with proper mobile UX
- **DashboardView**: True mobile-first vertical layout with icon buttons and proper spacing
- **CampaignDetailView**: Mobile/desktop separation established

### 🔄 In Progress
- **PipelineView**: Has partial mobile handling, needs complete separation
- **CompanionView**: Needs mobile implementation
- **ThumbnailView**: Needs mobile implementation
- **SettingsView**: Needs mobile implementation

### 📋 Pattern Checklist for Each View

When creating mobile version of any view, verify:
- [ ] Uses `lg:hidden` and `hidden lg:block` pattern
- [ ] Mobile uses MobilePageContainer + MobileHeader
- [ ] All buttons have icons + labels (not just labels)
- [ ] All cards/sections have `space-y-3` or `space-y-4` spacing
- [ ] Touch targets are minimum 44px height
- [ ] Buttons use `active:scale-95` or `active:scale-[0.98]`
- [ ] No grids - everything is single column vertical
- [ ] Information is consolidated into rich cards (not separated)
- [ ] Uses MobileSection for content blocks with titles
- [ ] Uses direct rendering with `space-y-*` for simple lists
- [ ] Bottom padding `pb-20` for bottom nav clearance

---

## Form Pattern: Field/Label/Description

**Established**: All forms (mobile and desktop) use the Field/Label/Description pattern from Pipeline.

### Pattern Structure
```tsx
<Field>
  <Label htmlFor="input-id">Input Label</Label>
  <Description>
    Helpful description text that explains what this field does.
  </Description>
  <Input id="input-id" type="text" />
</Field>
```

### Usage in Modals

**Example: ScheduleModal**
```tsx
<Field>
  <Label htmlFor="schedule-date">Publication date</Label>
  <Description>
    Choose when you want this post to go live.
  </Description>
  <Input
    id="schedule-date"
    type="date"
    value={scheduleDate}
    onChange={(e) => setScheduleDate(e.target.value)}
  />
</Field>
```

### Why This Pattern?
1. **Accessibility**: Labels are properly associated with inputs
2. **Clarity**: Users understand what each field expects
3. **Consistency**: Same pattern everywhere reduces cognitive load
4. **Mobile-friendly**: Descriptions help reduce errors on small screens

### Component Specs

**Field**:
- Wraps each form input group
- Provides consistent spacing (`mb-6` mobile, `mb-3.5` desktop)

**Label**:
- Bold, uppercase, small tracking
- Color: `#6e6256`
- Always paired with htmlFor

**Description**:
- Appears AFTER label, BEFORE input
- Color: `#6e6256`
- Leading relaxed for readability
- Optional but recommended for all inputs

### Checklist for Forms
- [ ] Every input wrapped in `<Field>`
- [ ] Every input has a `<Label>` with matching `htmlFor`
- [ ] Complex/unclear inputs have `<Description>`
- [ ] Description explains purpose or format
- [ ] Description appears before the input, not after

### ✅ Implemented In
- **ScheduleModal**: All fields use Field/Label/Description pattern
- **PipelineView Desktop Forms**: Original implementation with eyebrow + label + description

---

## Mobile Modal Pattern: Eyebrow + SectionTitle

**Established**: Mobile full-screen modals use the Eyebrow + SectionTitle pattern for sections, not Field/Label/Description.

### Pattern Structure
```tsx
<div>
  <Eyebrow>Section category</Eyebrow>
  <SectionTitle className="mb-4">
    Clear description of what this section does
  </SectionTitle>
  {/* Direct input elements without Field wrapper */}
  <input ... />
</div>
```

### Why This Pattern for Mobile Modals?
1. **Visual hierarchy**: Eyebrow creates clear section breaks in long forms
2. **Scannable**: Mobile users can quickly identify sections
3. **Native feel**: Matches iOS/Android settings patterns
4. **Space efficient**: Uses large, readable titles instead of repeated labels

### Usage Example: QuotesView Mobile Extract Modal

```tsx
{/* Article Title Section */}
<div>
  <Eyebrow>Article information</Eyebrow>
  <SectionTitle className="mb-4">Give this article a title</SectionTitle>
  <input
    type="text"
    value={articleTitle}
    onChange={(e) => setArticleTitle(e.target.value)}
    placeholder="Enter article title..."
    className="w-full px-4 py-3.5 rounded-2xl text-[16px]"
    style={{
      background: 'white',
      border: '1px solid rgba(78, 57, 32, 0.15)',
      color: '#20180f'
    }}
  />
</div>

{/* Article Source Section - Paste */}
<div>
  <Eyebrow>Article source</Eyebrow>
  <SectionTitle className="mb-4">
    Paste your article content to extract quotes
  </SectionTitle>
  <textarea ... />
</div>

{/* Article Source Section - Upload */}
<div>
  <Eyebrow>Article source</Eyebrow>
  <SectionTitle className="mb-4">
    Upload your article file to extract quotes
  </SectionTitle>
  <input type="file" ... />
</div>
```

### Component Specs

**Eyebrow**:
- Small uppercase label (10px desktop, 12px mobile)
- Color: `#6e6256`
- Tracking: `0.12em`
- Margin bottom: `mb-2` desktop, variable mobile

**SectionTitle**:
- Large descriptive title (15px desktop, 20px mobile)
- Font: Montserrat
- Color: inherits from theme
- Line height: `1.18`
- Includes description text inline

### When to Use Each Pattern

**Use Field/Label/Description for**:
- Desktop forms (Pipeline, Settings)
- Simple modals with 1-2 inputs (ScheduleModal)
- When inputs need explicit htmlFor associations

**Use Eyebrow + SectionTitle for**:
- Mobile full-screen modals with multiple sections
- Complex forms with multiple steps
- When you need strong visual section breaks
- Upload flows, multi-step wizards

### ✅ Implemented In
- **QuotesView Mobile Extract Modal**: Uses Eyebrow + SectionTitle pattern

---

## Next Steps

**To begin implementation, we should**:

1. **Review and approve** this design system
2. **Prioritize components** (which ones to build first?)
3. **Choose a pilot section** (Marketing recommended)
4. **Set up component directory** structure
5. **Start building** foundation components

**Questions to answer**:
- Do you want to start with Phase 1 (build all components first)?
- Or do you prefer iterative approach (build components as needed per section)?
- Any specific mobile behaviors you've seen in other apps that you love?
- Any patterns from this doc you want to modify?