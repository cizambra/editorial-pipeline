# Mobile Component Library

A comprehensive, reusable mobile-first component library for the SelfDisciplined editorial pipeline webapp.

## 📦 Installation Complete

All foundation components have been built and are ready to use!

## 🎯 Component Inventory

### ✅ Layout Components (4/4)
- [x] **MobilePageContainer** - Root wrapper with bottom nav padding & pull-to-refresh
- [x] **MobileHeader** - Consistent top bar with sticky/blur options
- [x] **MobileSafeArea** - Handle safe area insets
- [x] **MobileSection** - Enhanced card containers (loading, collapsible, header/footer slots)

### ✅ Navigation Components (3/4)
- [x] **MobileDrawer** - Slide-in panels from bottom/left/right
- [x] **MobileTabBar** - Horizontal scrollable tabs with sticky support
- [x] **MobileSegmentedControl** - 2-3 option toggle with smart padding
- [ ] **MobileBottomNav** - App-level navigation (already exists, needs enhancement)

### ✅ Action Components (3/3)
- [x] **MobileButton** - All button variants (primary, secondary, ghost, destructive)
- [x] **MobileFAB** - Floating action button with hide-on-scroll
- [x] **MobileActionSheet** - iOS-style action menu

### ✅ Content Components (2/4)
- [x] **MobileList** - Optimized lists with refresh/infinite scroll
- [x] **MobileEmptyState** - Consistent empty states
- [ ] **MobileCard** - Interactive cards (existing Card needs enhancement)
- [ ] **MobileListItem** - Already exists in MobileSection.tsx

### ✅ Feedback Components (3/3)
- [x] **MobileModal** - Full-screen modals
- [x] **MobileBottomSheet** - Base component for overlays
- [x] **MobileSpinner** - Loading indicators

### ✅ Utility Hooks (3/3)
- [x] **useMobileGestures** - Swipe, long press, pan gestures
- [x] **useMobileSafeArea** - Get safe area inset values
- [x] **useMobileScrollPosition** - Track scroll position & direction

### ✅ Animation Utilities (1/1)
- [x] **mobileAnimations** - Predefined Motion animations

## 🚀 Quick Start

### Import Components

```tsx
// Clean barrel import
import { 
  MobilePageContainer,
  MobileHeader,
  MobileButton,
  MobileFAB,
  MobileList,
  MobileEmptyState,
} from './components/mobile';

// Or import individually
import { MobileButton } from './components/mobile/actions/MobileButton';
```

### Basic Page Structure

```tsx
import { MobilePageContainer, MobileHeader, MobileFAB } from './components/mobile';
import { Plus } from 'lucide-react';

function MyPage() {
  return (
    <MobilePageContainer hasBottomNav>
      <MobileHeader 
        title="My Page"
        right={<IconButton icon={Search} />}
      />
      
      {/* Your content */}
      
      <MobileFAB icon={Plus} onClick={handleCreate} />
    </MobilePageContainer>
  );
}
```

## 📖 Component Examples

### List with Empty State

```tsx
<MobileList
  items={items}
  renderItem={(item) => <ItemCard item={item} />}
  onRefresh={handleRefresh}
  onLoadMore={handleLoadMore}
  hasMore={hasMore}
  emptyState={
    <MobileEmptyState
      icon={Inbox}
      title="No items"
      description="Get started by creating your first item"
      action={<MobileButton onClick={handleCreate}>Create Item</MobileButton>}
    />
  }
/>
```

### Modal with Form

```tsx
<MobileModal
  isOpen={isOpen}
  onClose={onClose}
  title="Edit Item"
  headerRight={<Button onClick={handleSave}>Save</Button>}
>
  <div className="p-4 space-y-4">
    <MobileInput label="Title" value={title} onChange={setTitle} />
    <MobileButton variant="primary" fullWidth onClick={handleSave}>
      Save Changes
    </MobileButton>
  </div>
</MobileModal>
```

### Drawer with Filters

```tsx
<MobileDrawer
  isOpen={showFilters}
  onClose={() => setShowFilters(false)}
  title="Filter Posts"
  snapPoints={[0.5, 0.9]}
>
  <div className="p-4 space-y-4">
    {/* Filter form */}
    <MobileButton variant="primary" fullWidth onClick={handleApply}>
      Apply Filters
    </MobileButton>
  </div>
</MobileDrawer>
```

### Tabs with Sticky Behavior

```tsx
<MobileTabBar
  tabs={[
    { id: 'all', label: 'All', badge: 12 },
    { id: 'active', label: 'Active', badge: 5 },
    { id: 'archived', label: 'Archived' },
  ]}
  activeTab={activeTab}
  onChange={setActiveTab}
  sticky
  smartPadding
/>
```

### Segmented Control

```tsx
<MobileSegmentedControl
  segments={[
    { value: 'queue', label: 'Queue' },
    { value: 'published', label: 'Published', badge: 24 },
  ]}
  value={view}
  onChange={setView}
  sticky
  smartPadding
/>
```

### Action Sheet

```tsx
<MobileActionSheet
  isOpen={showActions}
  onClose={() => setShowActions(false)}
  title="Post Actions"
  actions={[
    { label: 'Edit', icon: Edit2, onClick: handleEdit },
    { label: 'Duplicate', icon: Copy, onClick: handleDuplicate },
    { label: 'Delete', icon: Trash2, destructive: true, onClick: handleDelete },
  ]}
/>
```

## 🎨 Design Tokens

All components use consistent design tokens:

```tsx
// Colors
--mobile-primary: #c4522a
--mobile-bg: #f5efe3
--mobile-card: #fffaf1
--mobile-text-dark: #20180f
--mobile-text-medium: #6e6256
--mobile-text-light: #9e8f7f

// Spacing
--mobile-spacing-xs: 8px
--mobile-spacing-sm: 12px
--mobile-spacing-md: 16px
--mobile-spacing-lg: 24px
--mobile-spacing-xl: 32px

// Touch Targets
--mobile-touch-min: 44px
--mobile-touch-comfortable: 48px
--mobile-touch-large: 56px

// Animations
--mobile-duration-fast: 150ms
--mobile-duration-base: 200ms
--mobile-duration-slow: 300ms
```

## 🎭 Animations

Use predefined animations with Motion:

```tsx
import { motion } from 'motion/react';
import { slideInFromBottom, tapScale } from './components/mobile';

<motion.div {...slideInFromBottom}>
  Slides in from bottom
</motion.div>

<motion.button {...tapScale}>
  Scales on tap
</motion.button>
```

## 🪝 Hooks

### Gestures

```tsx
const { ref } = useMobileGestures({
  onSwipeLeft: () => console.log('Swiped left'),
  onSwipeRight: () => console.log('Swiped right'),
  onLongPress: () => console.log('Long pressed'),
});

return <div ref={ref}>Swipe or long press me</div>;
```

### Scroll Position

```tsx
const { scrollY, scrollDirection, isAtTop, isAtBottom } = useMobileScrollPosition();

// Hide FAB when scrolling down
const showFAB = scrollDirection !== 'down';
```

### Safe Area

```tsx
const { top, bottom } = useMobileSafeArea();

return (
  <div style={{ paddingTop: top, paddingBottom: bottom }}>
    Content with safe areas
  </div>
);
```

## ✅ Checklist for Using Components

- [ ] All touch targets are ≥ 44px
- [ ] Components only render on mobile (`lg:hidden`)
- [ ] Animations run at 60fps (use transforms, not position)
- [ ] Safe areas are respected
- [ ] Loading states are handled
- [ ] Empty states are shown
- [ ] Error states are handled
- [ ] Keyboard interaction works
- [ ] Screen reader announces correctly

## 📂 File Structure

```
mobile/
├── layout/
│   ├── MobilePageContainer.tsx
│   ├── MobileHeader.tsx
│   └── MobileSafeArea.tsx
├── navigation/
│   ├── MobileDrawer.tsx
│   ├── MobileTabBar.tsx
│   └── MobileSegmentedControl.tsx
├── actions/
│   ├── MobileButton.tsx
│   ├── MobileFAB.tsx
│   └── MobileActionSheet.tsx
├── content/
│   ├── MobileList.tsx
│   └── MobileEmptyState.tsx
├── feedback/
│   ├── MobileModal.tsx
│   ├── MobileBottomSheet.tsx
│   └── MobileSpinner.tsx
├── utils/
│   ├── useMobileGestures.ts
│   ├── useMobileSafeArea.ts
│   ├── useMobileScrollPosition.ts
│   └── mobileAnimations.ts
├── index.ts (barrel export)
└── README.md (this file)
```

## 🚧 Next Steps

1. **Enhance MobileBottomNav** - Add haptics, better animations
2. **Enhance Card component** - Add swipe actions, long press
3. **Build form components** - MobileInput, MobileSelect, etc.
4. **Apply to sections** - Start with Marketing section
5. **Add transitions** - Page transitions, tab changes
6. **Performance testing** - Ensure 60fps everywhere

## 📚 Documentation

For detailed specs, see:
- `/MOBILE_DESIGN_SYSTEM.md` - Complete design system
- `/MOBILE_COMPONENT_SPECS.md` - Technical specifications
- `/MOBILE_IMPLEMENTATION_ROADMAP.md` - Implementation guide

## 🎉 Foundation Complete!

All Priority 1-5 components are built. Ready to apply to sections!
