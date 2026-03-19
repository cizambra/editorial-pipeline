# Mobile Component Specifications
**Detailed specs for every mobile component**

---

## Layout Components

### MobilePageContainer

**Purpose**: Root wrapper for all mobile pages

**Visual Specs**:
- Background: `#f5efe3` (warm beige)
- Bottom padding: `80px` when `hasBottomNav={true}` (clears bottom nav)
- Safe area: Respects top/bottom insets

**Props**:
```tsx
interface MobilePageContainerProps {
  children: ReactNode;
  hasBottomNav?: boolean;        // Default: true
  backgroundColor?: string;       // Default: #f5efe3
  onRefresh?: () => Promise<void>; // Pull-to-refresh callback
  className?: string;
}
```

**Usage**:
```tsx
<MobilePageContainer hasBottomNav onRefresh={handleRefresh}>
  {/* Page content */}
</MobilePageContainer>
```

**Implementation Notes**:
- Only visible on mobile (`lg:hidden`)
- Desktop version should just render children without wrapper
- Pull-to-refresh: Show spinner at top when pulling down

---

### MobileHeader

**Purpose**: Consistent top bar for all pages

**Visual Specs**:
- Height: `56px` (minimum)
- Background: `#f5efe3` (default)
- Border bottom: `1px solid rgba(78, 57, 32, 0.14)` (optional)
- Padding: `0 16px`
- Title font: Montserrat, 16px, 700 weight
- Title color: `#20180f`
- Subtitle: 12px, `#6e6256`

**Layout**:
```
┌─────────────────────────────────────┐
│ [Left] │  Title     │ [Right]       │
│        │  Subtitle  │               │
└─────────────────────────────────────┘
```

**Props**:
```tsx
interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  left?: ReactNode;    // Usually back button
  right?: ReactNode;   // Usually icon button(s)
  sticky?: boolean;    // Default: false
  showBorder?: boolean; // Default: true
  blurOnScroll?: boolean; // Adds backdrop blur when scrolled
}
```

**Usage**:
```tsx
<MobileHeader
  title="Campaigns"
  left={<BackButton />}
  right={<IconButton icon={Search} />}
  sticky
/>
```

**Sticky Behavior**:
- When `sticky={true}`, position fixed to top
- z-index: `var(--mobile-z-sticky)` (1010)
- Safe area top inset applied

**Blur on Scroll**:
- When `blurOnScroll={true}`, add backdrop filter when scrolled > 10px
- Background becomes semi-transparent with blur
- Smooth transition

---

### MobileSection

**Purpose**: Card-like container for content sections (already exists, enhance)

**Current Implementation**: `/src/app/components/MobileSection.tsx`

**Visual Specs** (current):
- Background: `linear-gradient(180deg, #fffaf1, rgba(255, 251, 243, 0.95))`
- Border: `1px solid rgba(78, 57, 32, 0.12)`
- Border radius: `16px`
- Box shadow: `0 2px 8px rgba(54, 32, 12, 0.04)`
- Padding: `20px` (when not `noPadding`)
- Margin bottom: `16px`

**Enhancements Needed**:
1. Add loading skeleton variant
2. Add collapsible variant
3. Add header/footer slots

**Enhanced Props**:
```tsx
interface MobileSectionProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;          // Existing
  loading?: boolean;            // NEW: Show skeleton
  collapsible?: boolean;        // NEW: Can collapse
  collapsed?: boolean;          // NEW: Collapsed state
  onToggle?: () => void;        // NEW: Toggle callback
  header?: ReactNode;           // NEW: Header slot
  footer?: ReactNode;           // NEW: Footer slot
}
```

**New Usage**:
```tsx
<MobileSection
  loading={isLoading}
  collapsible
  collapsed={isCollapsed}
  onToggle={() => setCollapsed(!isCollapsed)}
  header={<SectionHeader title="Details" />}
  footer={<SectionActions />}
>
  {content}
</MobileSection>
```

---

### MobileSafeArea

**Purpose**: Handle safe area insets for notches/home indicators

**Visual Specs**:
- Adds padding for safe areas
- Top: Status bar, notch
- Bottom: Home indicator
- Left/Right: Curved edges (rare)

**Props**:
```tsx
interface MobileSafeAreaProps {
  children: ReactNode;
  top?: boolean;    // Apply top safe area
  bottom?: boolean; // Apply bottom safe area
  left?: boolean;   // Apply left safe area (rare)
  right?: boolean;  // Apply right safe area (rare)
}
```

**Implementation**:
```tsx
// Uses CSS env() variables
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

**Usage**:
```tsx
<MobileSafeArea top bottom>
  {content}
</MobileSafeArea>
```

---

## Navigation Components

### MobileBottomNav

**Purpose**: Primary app navigation (already exists, enhance)

**Current Implementation**: `/src/app/components/MobileBottomNav.tsx`

**Visual Specs** (current):
- Background: `#fffaf1`
- Border top: `1px solid rgba(78, 57, 32, 0.12)`
- Box shadow: `0 -2px 8px rgba(0, 0, 0, 0.04)`
- Height: `64px` minimum
- Icon size: `24px`
- Icon color (inactive): `#9e8f7f`
- Icon color (active): `#c4522a`
- Active indicator: `32px` wide, `2px` height, `#c4522a`

**Enhancements Needed**:
1. Add spring animation on tab change
2. Add haptic feedback (web vibration API)
3. Better badge positioning/animation
4. Safe area bottom inset

**Enhanced Props**:
```tsx
interface MobileBottomNavProps {
  items: NavItem[];
  activeItem: string;
  onItemChange: (itemId: string) => void;
  haptics?: boolean;  // NEW: Enable haptic feedback (default: true)
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  disabled?: boolean; // NEW
}
```

**Navigation Items** (for our app):
```tsx
const navItems: NavItem[] = [
  { id: 'pipeline', label: 'Pipeline', icon: Home },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'companion', label: 'Companion', icon: BookOpen },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];
```

---

### MobileTabBar

**Purpose**: Horizontal tabs for section-level navigation (like Marketing's 5 tabs)

**Visual Specs**:
- Background: `#f5efe3` (matches page)
- Border bottom: `1px solid rgba(78, 57, 32, 0.14)`
- Tab height: `48px`
- Tab padding: `0 16px`
- Tab font: 14px, 600 weight
- Tab color (inactive): `#9e8f7f`
- Tab color (active): `#c4522a`
- Indicator: Full width of tab, `3px` height, `#c4522a`, bottom positioned
- Sticky top: `-24px` when sticky

**Props**:
```tsx
interface MobileTabBarProps {
  tabs: MobileTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  sticky?: boolean;        // Sticky positioning
  scrollable?: boolean;    // Horizontal scroll (default: true for 4+ tabs)
  showBorder?: boolean;    // Bottom border (default: true)
  smartPadding?: boolean;  // Dynamic padding when stuck (default: true)
}

interface MobileTab {
  id: string;
  label: string;
  badge?: number;
  disabled?: boolean;
}
```

**Usage**:
```tsx
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
  smartPadding
/>
```

**Smart Padding** (like Publishing):
- Uses IntersectionObserver to detect when stuck
- Top padding: `4px` when not stuck, `16px` when stuck
- Smooth transition: `200ms`

---

### MobileSegmentedControl

**Purpose**: 2-3 option toggle (like Publishing's Queue/Published)

**Visual Specs**:
- Container background: `rgba(0, 0, 0, 0.06)`
- Container padding: `4px`
- Container radius: `12px`
- Segment height: `36px`
- Active segment background: `white`
- Active segment shadow: `0 1px 3px rgba(0,0,0,0.1)`
- Active segment color: `#1f2937`
- Inactive segment color: `#6b7280`
- Font: 14px, 700 weight

**Props**:
```tsx
interface MobileSegmentedControlProps {
  segments: MobileSegment[];
  value: string;
  onChange: (value: string) => void;
  sticky?: boolean;
  smartPadding?: boolean;
  fullWidth?: boolean;  // Default: true
}

interface MobileSegment {
  value: string;
  label: string;
  badge?: number;
}
```

**Usage**:
```tsx
<MobileSegmentedControl
  segments={[
    { value: 'queue', label: 'Queue' },
    { value: 'published', label: 'Published', badge: 12 },
  ]}
  value={selectedSegment}
  onChange={setSelectedSegment}
  sticky
  smartPadding
/>
```

---

### MobileDrawer

**Purpose**: Slide-in panel from bottom/left/right

**Visual Specs**:
- Backdrop: `rgba(0, 0, 0, 0.4)` with backdrop blur
- Panel background: `white`
- Panel radius: `20px 20px 0 0` (for bottom drawer)
- Handle: `40px` wide, `4px` height, `#d1d5db`, centered, `8px` from top
- Max height: `90vh` (for bottom)
- Shadow: `0 -4px 20px rgba(0, 0, 0, 0.15)`

**Props**:
```tsx
interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  position?: 'bottom' | 'left' | 'right'; // Default: bottom
  snapPoints?: number[];  // e.g., [0.4, 0.9] for 40% and 90% of screen
  dismissible?: boolean;  // Can close by backdrop tap or swipe (default: true)
  showHandle?: boolean;   // Show drag handle (default: true for bottom)
  title?: string;         // Optional title
}
```

**Usage**:
```tsx
<MobileDrawer
  isOpen={showFilter}
  onClose={() => setShowFilter(false)}
  position="bottom"
  snapPoints={[0.5, 0.9]}
  title="Filter Posts"
>
  <div className="p-4">
    <FilterForm />
  </div>
</MobileDrawer>
```

**Behavior**:
- Slide in animation: `cubic-bezier(0.22, 1, 0.36, 1)`, 300ms
- Swipe down to dismiss (when position="bottom")
- Snap to defined snap points
- Backdrop click to dismiss
- Locks body scroll when open

---

## Action Components

### MobileButton

**Purpose**: Consistent button component

**Visual Specs**:

**Primary**:
- Background: `#c4522a`
- Color: `white`
- Height: Large 48px, Medium 40px, Small 36px
- Radius: `12px`
- Font: 15px (large), 14px (medium), 13px (small), 600 weight
- Shadow: `0 2px 8px rgba(196, 82, 42, 0.25)`
- Active: Scale 0.96

**Secondary**:
- Background: `#fbf7ef`
- Color: `#6e6256`
- Rest same as primary

**Ghost**:
- Background: `transparent`
- Color: `#c4522a`
- No shadow

**Destructive**:
- Background: `rgba(220, 38, 38, 0.1)`
- Color: `#dc2626`

**Props**:
```tsx
interface MobileButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'large' | 'medium' | 'small';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}
```

**Usage**:
```tsx
<MobileButton
  variant="primary"
  size="large"
  fullWidth
  loading={isSubmitting}
  icon={Check}
  onClick={handleSubmit}
>
  Save Changes
</MobileButton>
```

---

### MobileFAB

**Purpose**: Floating action button for primary actions

**Visual Specs**:
- Size: `56px × 56px`
- Radius: `28px` (full circle)
- Background: `#c4522a`
- Icon color: `white`
- Icon size: `24px`
- Shadow: `0 4px 20px rgba(196, 82, 42, 0.4)`
- Position: Fixed, `16px` from bottom, `16px` from right
- Active: Scale 0.92

**Props**:
```tsx
interface MobileFABProps {
  icon: LucideIcon;
  label?: string;  // Accessibility label
  onClick: () => void;
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  hideOnScroll?: boolean;  // Hide when scrolling down (default: true)
  variant?: 'primary' | 'secondary';
}
```

**Usage**:
```tsx
<MobileFAB
  icon={Plus}
  label="Create campaign"
  onClick={handleCreate}
  hideOnScroll
/>
```

**Hide on Scroll Behavior**:
- Detect scroll direction
- When scrolling down: translateY(80px) + opacity 0
- When scrolling up: translateY(0) + opacity 1
- Transition: 200ms

---

### MobileActionSheet

**Purpose**: iOS-style action menu

**Visual Specs**:
- Similar to MobileDrawer
- Action height: `56px`
- Action font: 16px
- Action color: `#1f2937` (normal), `#dc2626` (destructive)
- Divider: `1px solid rgba(0, 0, 0, 0.08)`
- Cancel button: Separated, bolder

**Props**:
```tsx
interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: MobileAction[];
}

interface MobileAction {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}
```

**Usage**:
```tsx
<MobileActionSheet
  isOpen={showActions}
  onClose={() => setShowActions(false)}
  title="Campaign Actions"
  actions={[
    { label: 'Edit', icon: Edit2, onClick: handleEdit },
    { label: 'Duplicate', icon: Copy, onClick: handleDuplicate },
    { label: 'Delete', icon: Trash2, destructive: true, onClick: handleDelete },
  ]}
/>
```

---

## Form Components

### MobileInput

**Purpose**: Text input optimized for mobile

**Visual Specs**:
- Height: `48px`
- Background: `white`
- Border: `1px solid rgba(78, 57, 32, 0.12)`
- Border (focus): `2px solid #c4522a`
- Radius: `12px`
- Padding: `0 16px`
- Font: 16px (prevents zoom on iOS)
- Label: 13px, `#6e6256`, 6px above input
- Error: 12px, `#dc2626`, 4px below input

**Props**:
```tsx
interface MobileInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel' | 'url' | 'password' | 'number';
  error?: string;
  disabled?: boolean;
  clearable?: boolean;  // Show clear button when has value
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  inputMode?: 'text' | 'numeric' | 'email' | 'tel' | 'url';
}
```

**Usage**:
```tsx
<MobileInput
  label="Email address"
  placeholder="you@example.com"
  type="email"
  value={email}
  onChange={setEmail}
  error={emailError}
  clearable
  leftIcon={Mail}
/>
```

---

### MobileSelect

**Purpose**: Mobile-optimized select dropdown (enhance existing CustomSelect)

**Current**: `/src/app/components/CustomSelect.tsx`

**Enhancements Needed**:
1. Open options in bottom sheet on mobile (not native select)
2. Add search functionality for long lists
3. Add grouped options support
4. Add multi-select mode

**Enhanced Props**:
```tsx
interface MobileSelectProps {
  label?: string;
  value: string | string[];  // Multi-select support
  onChange: (value: string | string[]) => void;
  options: MobileSelectOption[] | MobileSelectGroup[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;  // NEW: Show search in bottom sheet
  multiple?: boolean;    // NEW: Multi-select mode
  clearable?: boolean;   // NEW: Can clear selection
}

interface MobileSelectOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

interface MobileSelectGroup {
  label: string;
  options: MobileSelectOption[];
}
```

**Mobile Behavior**:
- Tap → Open MobileDrawer with options
- Search bar at top if `searchable`
- Options as large touch targets (56px)
- Checkmark for selected option
- "Done" button to close (multi-select) or auto-close (single)

---

### MobileDateTimePicker

**Purpose**: Native date/time selection

**Visual Specs**:
- Similar to MobileInput (trigger)
- Opens native date/time picker or custom bottom sheet
- Shows formatted value when selected

**Props**:
```tsx
interface MobileDateTimePickerProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  mode?: 'date' | 'time' | 'datetime';
  min?: Date;
  max?: Date;
  error?: string;
  disabled?: boolean;
}
```

**Usage**:
```tsx
<MobileDateTimePicker
  label="Schedule for"
  mode="datetime"
  value={scheduledDate}
  onChange={setScheduledDate}
  min={new Date()}
/>
```

---

## Content Components

### MobileList

**Purpose**: Optimized list with refresh/infinite scroll

**Props**:
```tsx
interface MobileListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  onRefresh?: () => Promise<void>;
  onLoadMore?: () => Promise<void>;
  loading?: boolean;
  refreshing?: boolean;
  hasMore?: boolean;
  emptyState?: ReactNode;
  skeleton?: ReactNode;
  className?: string;
}
```

**Usage**:
```tsx
<MobileList
  items={campaigns}
  renderItem={(campaign) => (
    <CampaignCard campaign={campaign} onClick={() => handleSelect(campaign.id)} />
  )}
  onRefresh={handleRefresh}
  onLoadMore={handleLoadMore}
  hasMore={hasMore}
  emptyState={
    <MobileEmptyState
      icon={Inbox}
      title="No campaigns"
      description="Create your first campaign"
    />
  }
/>
```

**Features**:
- Pull to refresh
- Infinite scroll (load more at bottom)
- Loading skeletons
- Empty state
- Optimized rendering

---

### MobileCard

**Purpose**: Interactive card component (enhance existing Card)

**Current**: `/src/app/components/Card.tsx`

**Enhancements**:
1. Swipe left/right for actions
2. Long press for context menu
3. Loading skeleton state

**Enhanced Props**:
```tsx
interface MobileCardProps {
  children: ReactNode;
  onClick?: () => void;
  onLongPress?: () => void;
  swipeActions?: MobileCardSwipeActions;
  loading?: boolean;
  className?: string;
}

interface MobileCardSwipeActions {
  left?: MobileCardAction[];   // Swipe right to reveal
  right?: MobileCardAction[];  // Swipe left to reveal
}

interface MobileCardAction {
  icon: LucideIcon;
  label: string;
  color: string;
  backgroundColor: string;
  onClick: () => void;
}
```

**Usage**:
```tsx
<MobileCard
  onClick={handleTap}
  onLongPress={handleLongPress}
  swipeActions={{
    right: [
      {
        icon: Edit2,
        label: 'Edit',
        color: 'white',
        backgroundColor: '#3b82f6',
        onClick: handleEdit
      },
      {
        icon: Trash2,
        label: 'Delete',
        color: 'white',
        backgroundColor: '#dc2626',
        onClick: handleDelete
      }
    ]
  }}
>
  <CardContent />
</MobileCard>
```

---

### MobileEmptyState

**Purpose**: Consistent empty states

**Visual Specs**:
- Icon container: `64px` circle, `rgba(196, 82, 42, 0.1)` background
- Icon: `32px`, `#c4522a`
- Title: 17px, 700 weight, `#20180f`
- Description: 14px, `#6e6256`
- Spacing: 16px between elements
- Action button: 8px below description

**Props**:
```tsx
interface MobileEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}
```

**Usage**:
```tsx
<MobileEmptyState
  icon={Calendar}
  title="No posts scheduled"
  description="Create a campaign or compose a new post to get started"
  action={
    <MobileButton variant="primary" onClick={handleCreate}>
      Create Campaign
    </MobileButton>
  }
/>
```

---

## Feedback Components

### MobileModal

**Purpose**: Full-screen modal for complex content

**Visual Specs**:
- Background: `#f5efe3`
- Header height: `56px`
- Header background: `white` (or transparent)
- Header border: `1px solid rgba(78, 57, 32, 0.14)`
- Close button: Top left, 44x44 touch target
- Title: Center or left-aligned, 16px, 700 weight
- Action: Top right (optional)

**Props**:
```tsx
interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  headerLeft?: ReactNode;   // Override default back button
  headerRight?: ReactNode;  // Additional actions
  showHeader?: boolean;     // Default: true
  closeOnBackdrop?: boolean; // Default: false (full-screen shouldn't close on backdrop)
}
```

**Usage**:
```tsx
<MobileModal
  isOpen={!!selectedId}
  onClose={handleClose}
  title="Campaign Details"
  headerRight={<Button onClick={handleSave}>Save</Button>}
>
  <div className="p-4">
    <CampaignDetailForm />
  </div>
</MobileModal>
```

**Animation**:
- Enter: Slide up from bottom, 300ms
- Exit: Slide down to bottom, 250ms
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`

---

### MobileBottomSheet

**Purpose**: Base component for drawers/action sheets

**Technical Component** - Used internally by MobileDrawer and MobileActionSheet

**Props**:
```tsx
interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: number | string | 'auto';
  snapPoints?: number[];  // [0.4, 0.9] = 40% and 90% of viewport
  initialSnap?: number;   // Index of snapPoints
  dismissible?: boolean;
  backdrop?: boolean;
  onSnapChange?: (index: number) => void;
}
```

---

### MobileToast

**Purpose**: Brief notification

**Visual Specs**:
- Background: `white`
- Border radius: `12px`
- Shadow: `0 4px 20px rgba(0, 0, 0, 0.15)`
- Padding: `16px`
- Font: 15px
- Icon size: `20px`
- Position: Bottom `80px` (above bottom nav)
- Max width: `calc(100vw - 32px)`

**Toast Types**:
- Success: Green icon, white background
- Error: Red icon, white background
- Info: Blue icon, white background

**API**:
```tsx
// Global function
showToast({
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;  // Default: 4000ms
  action?: {
    label: string;
    onClick: () => void;
  };
});

// Component (for provider)
interface MobileToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

**Usage**:
```tsx
// In component
import { showToast } from '../components/mobile/feedback/MobileToast';

const handleSave = () => {
  // ... save logic
  showToast({
    message: 'Campaign saved successfully',
    type: 'success',
    action: {
      label: 'View',
      onClick: () => navigate(`/campaign/${id}`)
    }
  });
};
```

---

### MobileSpinner

**Purpose**: Loading indicator

**Visual Specs**:
- Size: Small 16px, Medium 24px, Large 32px
- Color: `#c4522a` (can be customized)
- Animation: Spin 1s linear infinite

**Props**:
```tsx
interface MobileSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}
```

**Usage**:
```tsx
<MobileSpinner size="large" />
```

---

## Utility Hooks

### useMobileGestures

**Purpose**: Handle swipe, long press, pan gestures

```tsx
interface UseMobileGesturesOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLongPress?: () => void;
  threshold?: number;  // Swipe threshold in px (default: 50)
  longPressDuration?: number;  // Long press duration in ms (default: 500)
}

function useMobileGestures(options: UseMobileGesturesOptions) {
  // Returns ref to attach to element
  return {
    ref: RefObject<HTMLElement>;
  };
}
```

**Usage**:
```tsx
const { ref } = useMobileGestures({
  onSwipeLeft: handleSwipeLeft,
  onLongPress: handleLongPress
});

return <div ref={ref}>Swipe or long press me</div>;
```

---

### useMobileScrollPosition

**Purpose**: Track scroll position and direction

```tsx
interface UseMobileScrollPositionReturn {
  scrollY: number;
  scrollDirection: 'up' | 'down' | null;
  isAtTop: boolean;
  isAtBottom: boolean;
}

function useMobileScrollPosition(): UseMobileScrollPositionReturn;
```

**Usage**:
```tsx
const { scrollY, scrollDirection } = useMobileScrollPosition();

// Hide FAB when scrolling down
const showFAB = scrollDirection !== 'down';
```

---

### useMobileSafeArea

**Purpose**: Get safe area inset values

```tsx
interface UseMobileSafeAreaReturn {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function useMobileSafeArea(): UseMobileSafeAreaReturn;
```

**Usage**:
```tsx
const { top, bottom } = useMobileSafeArea();

return (
  <div style={{ paddingTop: top, paddingBottom: bottom }}>
    Content
  </div>
);
```

---

## Animation Utilities

### mobileAnimations.ts

**Predefined Animations**:

```tsx
// Slide animations
export const slideInFromBottom = {
  initial: { y: '100%', opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: '100%', opacity: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
};

export const slideInFromRight = {
  initial: { x: '100%', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '100%', opacity: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
};

// Fade animations
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 }
};

// Scale animations
export const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 },
  transition: { duration: 0.2 }
};

// Spring animations
export const springBounce = {
  type: 'spring',
  stiffness: 500,
  damping: 30
};
```

**Usage with Motion**:
```tsx
import { motion } from 'motion/react';
import { slideInFromBottom } from '../mobile/utils/mobileAnimations';

<motion.div {...slideInFromBottom}>
  Content
</motion.div>
```

---

## Component Checklist Template

Use this for every component you build:

```markdown
## Component: [Name]

### Visual Design
- [ ] Matches specs (spacing, colors, typography)
- [ ] Responsive on all screen sizes
- [ ] Looks good in light/dark mode (if applicable)

### Touch Interactions
- [ ] All touch targets ≥ 44px
- [ ] Active states feel snappy (0.96 scale, 100ms)
- [ ] No accidental taps (proper spacing)

### Animations
- [ ] Runs at 60fps
- [ ] Uses CSS transforms (not left/top)
- [ ] Respects prefers-reduced-motion
- [ ] Duration feels natural (150-300ms)

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Focus states visible
- [ ] Color contrast ≥ 4.5:1

### Code Quality
- [ ] TypeScript types complete
- [ ] Props documented with JSDoc
- [ ] No console errors
- [ ] No unnecessary re-renders
- [ ] Mobile-only (lg:hidden or conditional)

### Testing
- [ ] Works on iPhone SE (small)
- [ ] Works on iPhone Pro Max (large)
- [ ] Works on Android (Chrome)
- [ ] Works in landscape
- [ ] Safe areas respected
```

---

**End of Component Specifications**
