# Selfdisciplined Design System

**Last Updated**: March 13, 2026  
**Version**: 1.0.1

---

## Philosophy

**Brand Voice**: Premium editorial platform with sophisticated, intentional design language  
**Core Values**: Warm but disciplined, thoughtful not rushed, information-dense without overwhelm

---

## Foundation

### Color System

#### Primary Palette
```
Primary Accent:     #c4522a (Terracotta)
Primary Hover:      #a63e1f (Darker terracotta)
Primary Light:      rgba(196, 82, 42, 0.1) (10% opacity)
Primary Border:     rgba(196, 82, 42, 0.3) (30% opacity)
```

#### Neutral Palette
```
Background:         #f5efe3 (Warm beige)
Card Background:    #fffaf1 (Cream)
Card Secondary:     #fbf7ef (Light cream)
White:              #ffffff

Text Primary:       #20180f (Deep brown)
Text Secondary:     #6e6256 (Medium brown)
Text Tertiary:      #9e8f7f (Light brown)
Text Label:         #8b5e3c (Warm brown for labels)

Border Light:       rgba(78, 57, 32, 0.08)
Border Default:     rgba(78, 57, 32, 0.12)
Border Medium:      rgba(78, 57, 32, 0.15)
Border Strong:      rgba(78, 57, 32, 0.24)
```

#### Sidebar Gradient
```
From: #2d2318 (Top)
To:   #1a1410 (Bottom)
```

#### Semantic Colors
```
Success:    #059669 (Green)
Success BG: rgba(16, 185, 129, 0.15)

Error:      #dc2626 (Red)
Error BG:   rgba(220, 38, 38, 0.1)

Warning:    #a16207 (Amber)
Warning BG: rgba(234, 179, 8, 0.15)

Info:       #2563eb (Blue)
Info BG:    rgba(59, 130, 246, 0.15)

Purple:     #7c3aed
Purple BG:  rgba(168, 85, 247, 0.15)
```

### Typography

#### Font Families
```
Primary: System font stack (default)
```

#### Type Scale

**Mobile:**
```
Heading 1:    text-[20px] font-bold
Heading 2:    text-[18px] font-bold
Heading 3:    text-[17px] font-bold
Body Large:   text-[16px]
Body:         text-[15px]
Body Small:   text-[14px]
Caption:      text-[13px]
Tiny:         text-[12px]
Micro:        text-[11px]
Mini:         text-[10px]

Label:        text-base (16px) font-bold uppercase tracking-wider
Description:  text-sm (14px)
```

**Desktop:**
```
Heading 1:    text-xl font-bold
Heading 2:    text-lg font-bold
Heading 3:    text-base font-bold
Body:         text-sm
Body Small:   text-xs
Caption:      text-[11px]

Label:        text-sm (14px) font-bold uppercase tracking-[0.08em]
Description:  text-xs (12px)
```

#### Font Weights
```
Regular:  font-normal (400)
Medium:   font-medium (500)
Semibold: font-semibold (600)
Bold:     font-bold (700)
```

#### Colors
```
Primary:    #20180f
Secondary:  #6e6256
Tertiary:   #9e8f7f
Label:      #8b5e3c (for form labels only)
```

### Spacing System

**Mobile Grid:**
```
xs:  8px   (2 Tailwind units)
sm:  12px  (3 units)
md:  16px  (4 units - base)
lg:  20px  (5 units)
xl:  24px  (6 units)
2xl: 32px  (8 units)
3xl: 40px  (10 units)
```

**Desktop Grid:**
```
xs:  8px   (2 units)
sm:  12px  (3 units - base)
md:  16px  (4 units)
lg:  20px  (5 units)
xl:  24px  (6 units)
2xl: 32px  (8 units)
```

### Border Radius

**Mobile:**
```
Small:   rounded-lg (8px)
Default: rounded-xl (12px)
Large:   rounded-2xl (16px)
Full:    rounded-full
```

**Desktop:**
```
Small:   rounded-lg (8px)
Default: rounded-xl (12px)
Large:   rounded-2xl (16px)
Full:    rounded-full
```

### Shadows

```
Card Mobile:    0 1px 3px rgba(54, 32, 12, 0.06)
Card Desktop:   0 1px 2px rgba(54, 32, 12, 0.05)
Button:         0 2px 8px rgba(196, 82, 42, 0.3)
Button Strong:  0 4px 12px rgba(196, 82, 42, 0.3)
```

---

## Components

### Core Form Components
**Location**: `/src/app/components/FormComponents.tsx`

#### Field
**Purpose**: Container wrapper for form inputs with consistent spacing  
**Usage**: Wrap Label + Description + Input together

```tsx
<Field>
  <Label>Title</Label>
  <Description>Helper text here</Description>
  <Input />
</Field>
```

**Specs:**
- Mobile margin: `mb-6`
- Desktop margin: `mb-3.5`
- Removes margin on last child

---

#### Label
**Purpose**: Form field labels with premium uppercase treatment

**Specs:**
- Mobile: `text-base` (16px), `font-bold`, `uppercase`, `tracking-wider`
- Desktop: `text-sm` (14px), `font-bold`, `uppercase`, `tracking-[0.08em]`
- Color: `#6e6256`
- Bottom margin: Mobile `mb-2`, Desktop `mb-1.5`

**Usage:**
```tsx
<Label htmlFor="field-id">Field Name</Label>
```

**Rules:**
- Always uppercase
- Always bold
- Always paired with Description (except in rare cases)
- Use htmlFor to link to input id for accessibility

---

#### Description
**Purpose**: Helper text under labels to provide context

**Specs:**
- Mobile: `text-sm` (14px)
- Desktop: `text-xs` (12px)
- Color: `#6e6256`
- Bottom margin: Mobile `mb-3`, Desktop `mb-2.5`
- Line height: `leading-relaxed`

**Usage:**
```tsx
<Description>Helpful context about this field</Description>
```

**Rules:**
- Should be concise (1 sentence preferred)
- Provides context or hints
- Never use for error messages (use validation messages instead)

---

#### Input
**Purpose**: Single-line text input with consistent styling

**Specs:**
- Mobile padding: `px-3.5 py-3`
- Desktop padding: `px-3.5 py-2.5`
- Border radius: `rounded-2xl`
- Font size: Mobile `text-base` (16px), Desktop `text-sm`
- Background: `#fffaf1`
- Border: `1px solid rgba(78, 57, 32, 0.24)`
- Focus border: `rgba(196, 82, 42, 0.5)`
- Focus ring: `0 0 0 3px rgba(196, 82, 42, 0.12)`

**Usage:**
```tsx
<Input 
  type="text" 
  placeholder="Enter text..." 
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

**Rules:**
- Mobile inputs MUST be 16px to prevent iOS zoom
- Desktop can be smaller (14px)
- Always use placeholder text
- Always controlled components with value/onChange

---

#### TextArea
**Purpose**: Multi-line text input

**Specs:**
- Same as Input, plus:
- Min height: `150px`
- Resize: `resize-y` (vertical only)
- Default rows can be customized

**Usage:**
```tsx
<TextArea 
  placeholder="Enter longer text..."
  rows={8}
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

---

#### Button
**Purpose**: Primary action buttons with three variants

**Variants:**

**Primary** (Main actions):
- Background: `#c4522a`
- Text: `#ffffff`
- Hover: `#a63e1f`
- Shadow: `0 2px 8px rgba(196, 82, 42, 0.3)`
- Mobile: `px-6 py-4`, `text-[17px]`, `rounded-2xl`
- Desktop: `px-5 py-2.5`, `text-sm`, `rounded-xl`

**Secondary** (Alternative actions):
- Background: `#fffaf1`
- Text: `#6e6256`
- Border: `1px solid rgba(78, 57, 32, 0.12)`
- Hover: Background `#fbf7ef`

**Ghost** (Tertiary actions):
- Background: `transparent`
- Text: `#6e6256`
- Hover: Background `rgba(0, 0, 0, 0.05)`

**Usage:**
```tsx
<Button variant="primary" onClick={handleClick}>
  Save Changes
</Button>
```

**Rules:**
- Only one primary button per view
- Use icons with gap-2 spacing
- Disabled state: opacity-50, no hover, no cursor-pointer
- Mobile: active:scale-[0.98] for touch feedback
- Desktop: hover states

---

#### Dropzone
**Purpose**: File upload area with drag-and-drop

**Specs:**
- Mobile: `min-h-[140px]`, `p-6`, `rounded-2xl`
- Desktop: `min-h-[100px]`, `p-5`, `rounded-xl`
- Default border: `2px dashed rgba(78, 57, 32, 0.2)`
- Background: `rgba(255, 255, 255, 0.4)`
- With file: Solid border `1px`, `rgba(196, 82, 42, 0.3)`, Background `rgba(196, 82, 42, 0.05)`

**Usage:**
```tsx
<Dropzone
  label="Drop file here"
  description="Supports .txt, .md files"
  onFileUpload={(file) => handleFile(file)}
  uploadedFileName={fileName}
/>
```

---

#### Toggle
**Purpose**: Switch control for boolean settings

**Specs:**
- Container: `p-5`, `rounded-2xl`, Border `1px solid rgba(78, 57, 32, 0.12)`
- Label: `text-base lg:text-sm font-semibold`
- Description: `text-sm lg:text-xs`
- Toggle size: Mobile `w-12 h-7`, Desktop `w-10 h-6`
- Active color: `#c4522a`

**Usage:**
```tsx
<Toggle
  label="Enable feature"
  description="Turn this on to enable"
  checked={isEnabled}
  onChange={setIsEnabled}
/>
```

---

### Layout Components

#### Card
**Location**: `/src/app/components/Card.tsx`  
**Purpose**: Primary content container

**Specs:**
- Mobile: `p-5`, `rounded-2xl`
- Desktop: `p-5`, `rounded-xl`
- Background: `#fffaf1`
- Border: `1px solid rgba(78, 57, 32, 0.08)`
- Shadow: Mobile `0 1px 3px rgba(54, 32, 12, 0.06)`, Desktop `0 1px 2px rgba(54, 32, 12, 0.05)`

**Usage:**
```tsx
<Card>
  {/* Content */}
</Card>

<Card className="mb-4">
  {/* Additional classes */}
</Card>
```

**Rules:**
- Default container for all desktop content sections
- Mobile: Use sparingly, prefer MobileSection for full-width content
- Can override className for custom spacing

---

#### MobileSection
**Location**: `/src/app/components/MobileSection.tsx`  
**Purpose**: Edge-to-edge mobile content sections

**Specs:**
- Full width edge-to-edge
- Background: `#fffaf1`
- Border top: `1px solid rgba(78, 57, 32, 0.08)`
- Border bottom: `1px solid rgba(78, 57, 32, 0.08)`
- Padding: `px-4 py-5`

**Usage:**
```tsx
<MobileSection>
  {/* Full-width mobile content */}
</MobileSection>
```

**Rules:**
- ONLY use on mobile (within `lg:hidden` blocks)
- Do not use Cards inside MobileSection
- For list items, use individual touch targets with proper padding

---

#### TabBar
**Location**: `/src/app/components/TabBar.tsx`  
**Purpose**: Fixed bottom navigation for mobile

**Specs:**
- Fixed position bottom
- Height: `80px + safe-area-inset-bottom`
- Background: `#fffaf1`
- Border top: `1px solid rgba(78, 57, 32, 0.12)`
- Items: Icon + Label, 4-5 items max
- Active color: `#c4522a`
- Inactive color: `#9e8f7f`

**Usage:**
```tsx
{/* Automatically included in app layout */}
```

**Rules:**
- Always visible on mobile
- Maximum 5 items
- Icons from lucide-react
- Active state with color + weight change

---

#### Tabs
**Location**: `/src/app/components/Tabs.tsx`  
**Purpose**: Horizontal tab navigation for sections

**Specs:**
- Mobile: `px-4 py-2.5`, `text-sm`, `rounded-xl`
- Desktop: `px-4 py-2.5`, `text-[13px]`, `rounded-xl`
- Active background: `rgba(196, 82, 42, 0.1)`
- Active border: `#c4522a`
- Inactive background: `#fbf7ef`
- Inactive border: `rgba(78, 57, 32, 0.12)`
- Hover (desktop): Background `#ffffff`, Border `rgba(78, 57, 32, 0.24)`

**Usage:**
```tsx
<Tabs
  tabs={[
    { id: 'tab1', label: 'Tab 1', icon: Icon },
    { id: 'tab2', label: 'Tab 2', count: 5 }
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

**Rules:**
- Mobile: Scrollable horizontal
- Desktop: Horizontal row with hover states
- Icons are optional
- Count badges show notification numbers
- Active state uses primary color

---

### Custom Components

#### CustomSelect
**Location**: `/src/app/components/CustomSelect.tsx`  
**Purpose**: Custom dropdown for mobile (REQUIRED for mobile platform selectors)

**Specs:**
- Mobile only implementation
- Native appearance
- Border: `1px solid rgba(78, 57, 32, 0.15)`
- Background: `white`
- Padding: `px-4 py-3.5`
- Border radius: `rounded-2xl`
- Font size: `text-[16px]`

**Usage:**
```tsx
<CustomSelect
  value={platform}
  onChange={(e) => setPlatform(e.target.value)}
  options={[
    { value: 'twitter', label: 'Twitter' },
    { value: 'linkedin', label: 'LinkedIn' }
  ]}
/>
```

**Rules:**
- MUST be used for all mobile platform/option selectors
- Ensures consistent mobile dropdown styling
- 16px font size prevents iOS zoom
- Desktop uses standard select or custom components

---

#### PlatformIcon
**Location**: Inline in components  
**Purpose**: Display social media platform icons

**Specs:**
- Size: Mobile `w-6 h-6`, Desktop `w-5 h-5`
- Color: Platform brand color
- Background: `rgba(brand-color, 0.1)`, `rounded-lg`, `p-2`

**Platforms:**
```
Twitter:    #1DA1F2
LinkedIn:   #0A66C2
Instagram:  #E4405F (with gradient option)
Facebook:   #1877F2
YouTube:    #FF0000
TikTok:     #000000
Threads:    #000000
```

**Usage:**
```tsx
{platform === 'twitter' && (
  <div style={{ background: 'rgba(29, 161, 242, 0.1)' }} className="p-2 rounded-lg">
    <Twitter className="w-5 h-5" style={{ color: '#1DA1F2' }} />
  </div>
)}
```

---

## Patterns

### Mobile Patterns

#### Full-Screen Modals
**When to use**: Forms, detailed views, composition flows

**Structure:**
```tsx
<div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f5efe3' }}>
  {/* Header - Fixed */}
  <div className="flex-shrink-0 px-4 pt-4 pb-4 flex items-center gap-3" 
       style={{ borderBottom: '1px solid rgba(78, 57, 32, 0.12)' }}>
    <button>{/* Back button */}</button>
    <div className="flex-1">
      <h3 className="text-[18px] font-bold">Title</h3>
      <p className="text-[13px]" style={{ color: '#9e8f7f' }}>Subtitle</p>
    </div>
  </div>

  {/* Content - Scrollable */}
  <div className="flex-1 overflow-y-auto px-4 py-4" 
       style={{ WebkitOverflowScrolling: 'touch' }}>
    {/* Content */}
  </div>

  {/* Actions - Fixed */}
  <div className="flex-shrink-0 p-4" 
       style={{ 
         borderTop: '1px solid rgba(78, 57, 32, 0.12)',
         paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))'
       }}>
    <Button variant="primary">Primary Action</Button>
  </div>
</div>
```

**Rules:**
- Always full screen (`fixed inset-0`)
- Three-part structure: Header (fixed) + Content (scroll) + Actions (fixed)
- Header has back button (ChevronLeft icon) + title + subtitle
- Content area has `WebkitOverflowScrolling: 'touch'`
- Actions account for TabBar (80px) + safe area
- Slide-in animation: `slideInRight 0.2s cubic-bezier(0.22, 1, 0.36, 1)`

---

#### Touch Targets
**Minimum size**: 44px × 44px

**Specs:**
- Buttons: `py-3.5` (14px) + 16px font = ~46px
- List items: `py-4` minimum
- Icons in buttons: `w-5 h-5`
- Spacing between: `gap-2.5` or `gap-3`

---

#### Form Fields (Mobile)
**Structure:**
```tsx
<div className="mb-5">
  <label className="block text-base font-bold uppercase tracking-wider mb-2" 
         style={{ color: '#6e6256' }}>
    Label
  </label>
  <p className="text-sm mb-3 leading-relaxed" style={{ color: '#6e6256' }}>
    Description text
  </p>
  <input className="w-full px-4 py-3.5 rounded-2xl text-[16px]" />
</div>
```

**Rules:**
- 16px input font size (prevents zoom)
- Labels are bold, uppercase
- Descriptions provide context
- White background on inputs for contrast
- 5 units margin between fields

---

#### Lists (Mobile)
**Interactive list items:**
```tsx
<button className="w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]"
        style={{
          background: 'white',
          border: '1px solid rgba(78, 57, 32, 0.12)'
        }}>
  <div className="flex items-center justify-between">
    <div className="flex-1">
      <h4 className="text-[15px] font-bold mb-1">Title</h4>
      <p className="text-[13px]" style={{ color: '#6e6256' }}>Subtitle</p>
    </div>
    <ChevronRight className="w-5 h-5" style={{ color: '#c4522a' }} />
  </div>
</button>
```

**Rules:**
- White background cards with borders
- Full width buttons for touch
- ChevronRight indicator for navigation
- `active:scale-[0.98]` for feedback
- Spacing between items: `space-y-2.5` or `space-y-3`

---

### Desktop Patterns

#### Multi-Column Layouts
**Common pattern**: Sidebar + Main + Detail

**Example: Two-column**
```tsx
<div className="flex gap-6">
  {/* Sidebar */}
  <div className="w-80 flex-shrink-0">
    <Card>{/* List */}</Card>
  </div>
  
  {/* Main content */}
  <div className="flex-1 min-w-0">
    <Card>{/* Detail */}</Card>
  </div>
</div>
```

**Rules:**
- Fixed sidebar width (usually `w-80` = 320px)
- Main content uses `flex-1 min-w-0` for truncation
- Gap between columns: `gap-6` (24px)
- Each section in Card component

---

#### Centered Modals
**When to use**: Confirmations, quick forms, alerts

**Structure:**
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-6"
     style={{ background: 'rgba(32, 24, 15, 0.5)' }}>
  <Card className="w-full max-w-md">
    <h3 className="text-lg font-bold mb-2">Modal Title</h3>
    <p className="text-sm mb-6" style={{ color: '#6e6256' }}>Description</p>
    
    {/* Content */}
    
    <div className="flex gap-3 justify-end">
      <Button variant="secondary">Cancel</Button>
      <Button variant="primary">Confirm</Button>
    </div>
  </Card>
</div>
```

**Rules:**
- Backdrop: `rgba(32, 24, 15, 0.5)`
- Max width: `max-w-md` or `max-w-lg`
- Padding around modal: `p-6`
- Actions right-aligned with gap-3

---

#### Form Fields (Desktop)
**Use FormComponents:**
```tsx
<Field>
  <Label htmlFor="title">Title</Label>
  <Description>This is a description</Description>
  <Input id="title" type="text" />
</Field>
```

**Rules:**
- Always use Field wrapper
- Smaller text than mobile (14px labels, 12px descriptions)
- Tighter spacing (mb-3.5 on Field)
- Can arrange in grid: `<div className="grid grid-cols-2 gap-4">`

---

#### Tables & Data Lists
**Specs:**
- Header: Small caps, `text-xs`, `uppercase`, `tracking-wider`, Color `#9e8f7f`
- Row height: `py-3`
- Border between rows: `border-b border-[rgba(78, 57, 32, 0.08)]`
- Hover: `hover:bg-[rgba(196, 82, 42, 0.05)]`

---

## Interactions

### Mobile
- **Tap feedback**: `active:scale-[0.98]` on buttons/cards
- **Transitions**: `transition-all` for smooth scaling
- **No hover states**: Mobile doesn't have hover
- **Scrolling**: Always add `WebkitOverflowScrolling: 'touch'`
- **Animation**: Slide-in for modals (`slideInRight`)

### Desktop
- **Hover states**: Subtle background changes
- **Cursor**: `cursor-pointer` on clickable elements
- **Transitions**: `transition-all duration-[180ms]`
- **Focus rings**: 3px ring with `rgba(196, 82, 42, 0.12)`

---

## Component Usage Rules

### Reusability Checklist
Before creating a new component, ask:
1. Does FormComponents have what I need?
2. Can I use Card or MobileSection?
3. Is there an existing pattern in DESIGN_SYSTEM.md?
4. If creating new: Will this be used 3+ times?

### When to Create New Components
✅ **Do create** when:
- Component will be reused 3+ times
- Complex logic needs encapsulation
- Platform-specific implementation needed
- Establishing a new pattern

❌ **Don't create** when:
- One-off usage
- Can compose from existing components
- Only styling differences (use className instead)

### File Organization
```
/src/app/components/
  FormComponents.tsx     ← Form inputs, labels, buttons
  Card.tsx               ← Desktop container
  MobileSection.tsx      ← Mobile container
  CustomSelect.tsx       ← Mobile dropdown
  TabBar.tsx             ← Mobile navigation
  
  [Feature]View.tsx      ← Feature-specific views
```

---

## Accessibility

### Focus Management
- All interactive elements keyboard accessible
- Visible focus rings (not removed)
- Tab order follows visual flow

### Labels
- All inputs have associated labels
- Use `htmlFor` and `id` linking
- Screen reader text for icon-only buttons: `<span className="sr-only">`

### Color Contrast
- Text on cream background: AA compliant
- Primary button text: AAA compliant
- Never rely on color alone

### Touch/Click Targets
- Mobile: Minimum 44×44px
- Desktop: Minimum 32×32px

---

## Anti-Patterns

❌ **Don't do:**
- Mix mobile and desktop components in same render
- Create custom form inputs without using FormComponents
- Use arbitrary spacing values (use system)
- Inline styles for colors (use design tokens)
- Skip Label + Description pattern in forms
- Create component variants with props when separate components clearer
- Use both Card and MobileSection on same breakpoint

✅ **Do instead:**
- Completely separate mobile and desktop implementations
- Extend FormComponents or request additions
- Use spacing system (px-4, py-3, gap-6, etc.)
- Use CSS custom properties or inline with semantic names
- Always provide Label + Description
- Create separate components for distinct use cases
- Use `lg:hidden` and `hidden lg:block` for clean separation

---

## Version History

### v1.0.1 - March 13, 2026
- Updated Card component: Removed gradients, simplified to solid background
- Updated MobileSection: Simplified gradient to solid background  
- Updated Tabs component: Removed desktop gradient, standardized active/inactive states
- Fixed Button sizing: Mobile now `px-6 py-4` with `text-[17px]`, Desktop `px-5 py-2.5` with `text-sm`
- Fixed Toggle dimensions: Mobile `h-7`, Desktop `h-6`
- Added Tabs component documentation

### v1.0.0 - March 13, 2026
- Initial design system documentation
- Established brand foundations
- Documented FormComponents suite
- Defined mobile and desktop patterns
- Created reusability guidelines