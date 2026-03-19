# Mobile Implementation Roadmap
**Practical step-by-step guide for implementing the mobile design system**

---

## Quick Start Decision Tree

**Question 1**: Do you want to build all foundation components first, then apply them?
- ✅ **YES** → Follow **Strategy A: Foundation-First** (recommended for consistency)
- ❌ **NO** → Follow **Strategy B: Iterative Section-by-Section** (faster to see results)

**Question 2**: Which section should be the pilot/proof-of-concept?
- **Marketing** (recommended - has all patterns)
- **Publishing** (simpler - only 2 tabs)
- **Pipeline** (different pattern - good test)

**Question 3**: Do you want to ship incrementally or all at once?
- **Incremental**: Ship each section as completed (users see gradual improvement)
- **All at once**: Big-bang release (users see complete redesign)

---

## Strategy A: Foundation-First (Recommended)

### Step 1: Create Component Library (2-3 days)
**Build all reusable components first**

#### 1.1 Set up directory structure
```bash
/src/app/components/mobile/
├── layout/
├── navigation/
├── actions/
├── forms/
├── content/
├── feedback/
├── utils/
└── index.ts
```

#### 1.2 Build primitive components (Day 1)
**Order**: Build from most basic to most complex

1. **MobileSafeArea** (30 min)
   - Handles top/bottom safe areas
   - Used by: everything

2. **MobileSpinner** (20 min)
   - Loading indicator
   - Used by: buttons, lists, pages

3. **MobileButton** (1 hour)
   - Primary, secondary, ghost, destructive variants
   - Loading states, disabled states
   - Used by: everywhere

4. **MobileEmptyState** (45 min)
   - Icon, title, description, optional action
   - Used by: all list views

#### 1.3 Build layout components (Day 1-2)
5. **MobilePageContainer** (1 hour)
   - Safe areas, bottom nav padding
   - Pull-to-refresh support
   - Used by: all pages

6. **MobileHeader** (1.5 hours)
   - Title, subtitle, left/right slots
   - Sticky variant, blur on scroll
   - Used by: all pages

7. **MobileSection** (enhance existing) (30 min)
   - Already exists, just add variants
   - Loading skeleton state
   - Collapsible variant

#### 1.4 Build modal system (Day 2)
8. **MobileBottomSheet** (2 hours)
   - Base component for all overlays
   - Snap points, drag to dismiss
   - Used by: drawer, action sheet, modal

9. **MobileDrawer** (45 min)
   - Uses BottomSheet
   - Slide from bottom/left/right
   - Used by: filters, menus

10. **MobileModal** (1 hour)
    - Full-screen overlay
    - Header with close/actions
    - Used by: all detail views

11. **MobileActionSheet** (45 min)
    - iOS-style action menu
    - Uses BottomSheet
    - Used by: context menus

#### 1.5 Build navigation components (Day 2-3)
12. **MobileSegmentedControl** (1 hour)
    - 2-3 options toggle
    - Sticky variant with smart padding
    - Used by: Publishing

13. **MobileTabBar** (1.5 hours)
    - Horizontal scrollable tabs
    - Sticky variant
    - Badge support
    - Used by: Marketing

14. **MobileBottomNav** (enhance existing) (1 hour)
    - Already exists
    - Add haptics, animations
    - Safe area support

#### 1.6 Build action components (Day 3)
15. **MobileFAB** (1.5 hours)
    - Floating action button
    - Hide/show on scroll
    - Positioning variants
    - Used by: most sections

#### 1.7 Build content components (Day 3)
16. **MobileList** (2 hours)
    - Pull-to-refresh
    - Infinite scroll
    - Loading states
    - Used by: all list views

17. **MobileCard** (enhance existing Card) (1 hour)
    - Swipe actions
    - Long press menu
    - Already mostly done

### Step 2: Implement Root Layout (1 day)
**Add bottom navigation to entire app**

#### 2.1 Update Root.tsx
- Add MobileBottomNav
- Connect to router
- Handle "More" menu drawer

#### 2.2 Create MoreMenuDrawer
- List of additional sections
- Navigation links
- User info at top

### Step 3: Redesign Marketing Section (2 days)
**Apply all components to Marketing as proof-of-concept**

#### 3.1 Marketing Container (2 hours)
- Add MobilePageContainer
- Add MobileHeader
- Add MobileTabBar (5 tabs)

#### 3.2 Campaigns Tab (3 hours)
- MobileList for campaigns
- Search in MobileDrawer
- MobileFAB for create
- MobileModal for detail view
- MobileEmptyState for no campaigns

#### 3.3 Repurpose Tab (2 hours)
- Current implementation is good
- Just wrap in new components
- Add MobileEmptyState

#### 3.4 Compose Tab (3 hours)
- MobileList for notes
- MobileEmptyState (already starts empty)
- MobileFAB for create
- MobileModal for editor (full screen)

#### 3.5 Quotes Tab (2 hours)
- MobileList for articles
- MobileFAB for extract
- MobileModal for extraction flow

#### 3.6 Publishing Tab (2 hours)
- Use MobileSegmentedControl (replace current sticky tabs)
- Apply smart padding pattern
- MobileDrawer for filters

### Step 4: Apply to Other Sections (3 days)
**Use Marketing as template**

#### 4.1 Pipeline (1 day)
- MobilePageContainer
- MobileSelect for dropdowns
- MobileFAB for run pipeline
- MobileCard for content previews

#### 4.2 Companion (1 day)
- MobileList for notes
- MobileFAB for create
- MobileModal for note detail

#### 4.3 Dashboard, Settings, Others (1 day)
- Apply consistent patterns
- Use components built

### Step 5: Polish & Test (2 days)
- Add transitions
- Test all touch targets
- Performance optimization
- Accessibility audit

**Total Time: ~10-12 days**

---

## Strategy B: Iterative Section-by-Section

### Week 1: Publishing Section (Pilot)
**Why Publishing?**
- Simplest section (2 tabs only)
- Already has sticky tabs pattern
- Good test case

#### Build only these components:
1. MobileSegmentedControl (sticky tabs)
2. MobileCard (for post cards)
3. MobileEmptyState
4. MobileDrawer (for filters)
5. MobilePageContainer

#### Apply to Publishing:
- Replace current sticky tabs
- Add filter drawer
- Add empty states
- Test on real devices

#### Outcome:
- ✅ Proof of concept complete
- ✅ Can demo to users/team
- ✅ Learn what works/doesn't work

### Week 2: Marketing Section
**Build as you go**

#### New components needed:
6. MobileTabBar (for 5 tabs)
7. MobileFAB
8. MobileModal
9. MobileList
10. MobileHeader

#### Apply to Marketing:
- All 5 tabs
- Consistent patterns
- Reuse components from Publishing

### Week 3: Remaining Sections
**Apply learnings**

#### New components needed:
11. MobileBottomNav enhancement
12. MobileActionSheet
13. Any missing pieces

#### Apply to:
- Pipeline
- Companion
- Dashboard
- Settings

**Total Time: ~15 days (slower but lower risk)**

---

## Component Build Order (Foundation-First)

### Priority 1: Can't build anything without these
1. MobileSafeArea
2. MobileSpinner
3. MobileButton

### Priority 2: Layout foundation
4. MobilePageContainer
5. MobileHeader
6. MobileSection (enhance)

### Priority 3: Modal system
7. MobileBottomSheet (base)
8. MobileDrawer
9. MobileModal
10. MobileActionSheet

### Priority 4: Navigation
11. MobileSegmentedControl
12. MobileTabBar
13. MobileBottomNav (enhance)

### Priority 5: Actions & Content
14. MobileFAB
15. MobileList
16. MobileCard (enhance)
17. MobileEmptyState

### Priority 6: Forms (as needed)
18. MobileInput
19. MobileSelect (enhance CustomSelect)
20. MobileDateTimePicker

---

## Testing Checklist (Per Component)

### Visual Testing
- [ ] Matches design specs (spacing, colors, sizing)
- [ ] Looks good on iPhone SE (small screen)
- [ ] Looks good on iPhone Pro Max (large screen)
- [ ] Looks good on Android (different aspect ratios)
- [ ] Light/dark mode support (if applicable)

### Interaction Testing
- [ ] All touch targets ≥ 44px
- [ ] Active states feel responsive
- [ ] Animations run at 60fps
- [ ] Gestures work (swipe, long press, etc.)
- [ ] Works with one hand / thumb

### Functional Testing
- [ ] All props work as expected
- [ ] Edge cases handled (empty, loading, error)
- [ ] TypeScript types are correct
- [ ] No console errors/warnings

### Accessibility Testing
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Focus states are visible
- [ ] Color contrast meets WCAG AA

### Performance Testing
- [ ] No unnecessary re-renders
- [ ] Large lists don't lag
- [ ] Animations don't drop frames
- [ ] Memory usage is reasonable

---

## File Template Examples

### Component Template
```tsx
// /src/app/components/mobile/[category]/ComponentName.tsx

import { ReactNode } from 'react';

interface ComponentNameProps {
  children?: ReactNode;
  // ... other props
}

/**
 * Brief description of what this component does
 * 
 * @example
 * <ComponentName>
 *   Content
 * </ComponentName>
 */
export function ComponentName({
  children,
  // ... other props
}: ComponentNameProps) {
  return (
    <div className="lg:hidden">
      {children}
    </div>
  );
}
```

### Hook Template
```tsx
// /src/app/components/mobile/utils/useHookName.ts

import { useState, useEffect } from 'react';

interface UseHookNameOptions {
  // ... options
}

/**
 * Brief description of what this hook does
 * 
 * @example
 * const { value, action } = useHookName({ ... });
 */
export function useHookName(options: UseHookNameOptions = {}) {
  const [value, setValue] = useState(null);
  
  useEffect(() => {
    // ... logic
  }, []);
  
  return { value, action: () => {} };
}
```

---

## Migration Checklist (Per Section)

### Before Migration
- [ ] Audit current mobile implementation
- [ ] List all unique patterns/components
- [ ] Identify which new components are needed
- [ ] Take screenshots for comparison

### During Migration
- [ ] Replace layout with MobilePageContainer
- [ ] Replace header with MobileHeader
- [ ] Replace tabs/segments with Mobile components
- [ ] Replace cards with MobileCard
- [ ] Replace modals with MobileModal/MobileDrawer
- [ ] Add MobileFAB if primary action exists
- [ ] Add MobileEmptyState to all lists
- [ ] Test each sub-section as you go

### After Migration
- [ ] Visual comparison (before/after)
- [ ] Test all user flows
- [ ] Test on real devices
- [ ] Check touch target sizes
- [ ] Check animation performance
- [ ] Get user feedback
- [ ] Document any custom patterns

---

## Decision Guide: What Component to Use When

### "I need to show a list of items"
→ **MobileList**
- Handles loading, empty, refresh, infinite scroll
- Wraps items in MobileCard automatically

### "I need a primary action button"
→ **MobileFAB**
- One per page
- Positioned bottom-right by default
- Hides on scroll down (optional)

### "I need to filter or configure options"
→ **MobileDrawer**
- Slides from bottom
- Good for forms, filters, menus
- Dismissible

### "I need to show detailed content"
→ **MobileModal**
- Full-screen
- For complex forms or content
- Has header with back button

### "I need quick actions on an item"
→ **MobileActionSheet**
- iOS-style action menu
- Triggered by tap or long-press
- Good for edit/delete/share actions

### "I need to toggle between 2-3 options"
→ **MobileSegmentedControl**
- Equal-width segments
- Visual feedback
- Can be sticky

### "I need to switch between many tabs"
→ **MobileTabBar**
- Horizontal scrollable
- Badge support
- Can be sticky

### "I have no content to show"
→ **MobileEmptyState**
- Icon, title, description
- Optional action button
- Encourages user action

---

## Common Patterns Cookbook

### Pattern: List with Search
```tsx
<MobilePageContainer hasBottomNav>
  <MobileHeader 
    title="Campaigns"
    right={
      <IconButton 
        icon={Search} 
        onClick={() => setSearchOpen(true)} 
      />
    }
  />
  
  <MobileList
    items={filteredCampaigns}
    renderItem={(campaign) => (
      <CampaignCard campaign={campaign} onClick={handleSelect} />
    )}
    emptyState={
      <MobileEmptyState
        icon={Inbox}
        title="No campaigns found"
        description="Try adjusting your search"
      />
    }
  />
  
  <MobileFAB icon={Plus} onClick={handleCreate} />
  
  <MobileDrawer isOpen={searchOpen} onClose={() => setSearchOpen(false)}>
    <SearchForm />
  </MobileDrawer>
</MobilePageContainer>
```

### Pattern: Tabbed Section
```tsx
<MobilePageContainer hasBottomNav>
  <MobileHeader title="Marketing" />
  
  <MobileTabBar
    tabs={[
      { id: 'campaigns', label: 'Campaigns' },
      { id: 'repurpose', label: 'Repurpose' },
      { id: 'compose', label: 'Compose' },
      { id: 'quotes', label: 'Quotes' },
      { id: 'publishing', label: 'Publishing' },
    ]}
    activeTab={activeTab}
    onChange={setActiveTab}
    sticky
  />
  
  {activeTab === 'campaigns' && <CampaignsTab />}
  {activeTab === 'repurpose' && <RepurposeTab />}
  {/* ... other tabs */}
  
  <MobileFAB 
    icon={Plus} 
    onClick={handleCreateForTab} 
  />
</MobilePageContainer>
```

### Pattern: Detail Modal
```tsx
<MobileModal
  isOpen={!!selectedId}
  onClose={handleClose}
  title={item.title}
  headerRight={
    <Button onClick={handleSave}>Save</Button>
  }
>
  <div className="p-4 space-y-4">
    <DetailContent item={item} />
  </div>
</MobileModal>
```

### Pattern: Form in Drawer
```tsx
<MobileDrawer
  isOpen={isOpen}
  onClose={onClose}
  height="auto"
>
  <div className="p-4 space-y-4">
    <h3 className="text-lg font-bold">Filter Posts</h3>
    
    <MobileSelect
      label="Platform"
      value={platform}
      onChange={setPlatform}
      options={platformOptions}
    />
    
    <MobileInput
      label="Search"
      value={search}
      onChange={setSearch}
      placeholder="Search posts..."
    />
    
    <MobileButton
      variant="primary"
      fullWidth
      onClick={handleApply}
    >
      Apply Filters
    </MobileButton>
  </div>
</MobileDrawer>
```

---

## Next Steps - Choose Your Path

### Option 1: Start with Foundation (Recommended)
**Action**: Begin building components in priority order
1. Create `/src/app/components/mobile/` directory
2. Build Priority 1 components (SafeArea, Spinner, Button)
3. Build Priority 2 components (Container, Header, Section)
4. Continue through priority list

### Option 2: Start with Pilot Section
**Action**: Pick Publishing as pilot
1. Build only components needed for Publishing
2. Implement Publishing redesign
3. Test and iterate
4. Move to next section

### Option 3: Hybrid Approach
**Action**: Build foundation for one section at a time
1. Build components for Publishing
2. Implement Publishing
3. Build additional components for Marketing
4. Implement Marketing
5. Continue...

---

## Questions Before Starting

1. **Which strategy do you prefer?** (Foundation-First, Iterative, or Hybrid)
2. **Which section should be the pilot?** (Publishing, Marketing, or Pipeline)
3. **Do you want to ship incrementally or all at once?**
4. **Any specific components you want to build first?**
5. **Any mobile apps whose patterns you love?** (for inspiration)

---

**Ready to start building?** Let me know which strategy you choose and I'll begin implementing!
