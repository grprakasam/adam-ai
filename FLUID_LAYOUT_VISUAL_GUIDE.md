# Fluid Layout Visual Structure

## Desktop Layout (1440px+)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔗 Code2 Icon   Pair Programming Area     5 variables • 3 generated     │  (Sticky Header)
│ Background: Green gradient (10b981 → 059669)                            │
├─────────────────────────────────────────────────────────────────────────┤
│ Scrollable Content Area (Padding: 32px)                                 │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ Card 1           │  │ Card 2           │  │ Card 3           │       │
│  │                  │  │                  │  │                  │       │
│  │ AGE              │  │ AGEGR            │  │ ALB              │       │
│  │ Age (years)      │  │ Age Group        │  │ Albumin Level    │       │
│  │                  │  │                  │  │                  │       │
│  │ [Required] [✓]   │  │ [Modify] [⏳]    │  │ [✓]              │       │
│  │                  │  │                  │  │                  │       │
│  │ Type:  NUMERIC   │  │ Type:  CHARACTER │  │ Type:  NUMERIC   │       │
│  │ Orig:  SDTM      │  │ Orig:  DERIVED   │  │ Orig:  LAB       │       │
│  │                  │  │                  │  │                  │       │
│  │ [Show More] [Gen]│  │ [Show More] [Gen]│  │ [Show More] [Gen]│       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ Card 4           │  │ Card 5           │                             │
│  │                  │  │                  │                             │
│  │ AGEM             │  │ ALEQ             │                             │
│  │ Age Group Middle │  │ Age = Level      │                             │
│  │                  │  │                  │                             │
│  │ [⏳] [⏳]        │  │ [✗] [⏳]         │                             │
│  │                  │  │                  │                             │
│  │ Type:  CHARACTER │  │ Type:  NUMERIC   │                             │
│  │ Orig:  DERIVED   │  │ Orig:  DERIVED   │                             │
│  │                  │  │                  │                             │
│  │ [Show More] [Gen]│  │ [Show More] [Gen]│                             │
│  └──────────────────┘  └──────────────────┘                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Card Structure (Expanded View)

```
┌────────────────────────────────────┐
│ AGE                      [✓] [Req]  │ ← Card Header
│ Age (years)                        │
├────────────────────────────────────┤
│ Type:     NUMERIC                  │ ← Info Rows
│ Length:   8                        │
│ Format:   F8.0                     │
│ Origin:   SDTM                     │
├────────────────────────────────────┤
│ DERIVATION LOGIC                   │ ← Expanded Details
│ ┌──────────────────────────────────┐
│ │ Extract from DEMOGRAPHY table    │
│ └──────────────────────────────────┘
│
│ CODING RATIONALE
│ ┌──────────────────────────────────┐
│ │ Age is derived from birth date   │
│ │ and reference date. Calculated   │
│ │ as: (ref_date - birth_date) / 365│
│ └──────────────────────────────────┘
│
│ CODE SNIPPET (R)
│ ┌──────────────────────────────────┐
│ │ adam_data$AGE <-                 │
│ │  as.numeric(floor(                │
│ │   (adam_data$RFXDTC -             │
│ │    adam_data$BRTHDTC) / 365.25)) │
│ └──────────────────────────────────┘
│
│ USER NOTES
│ ┌──────────────────────────────────┐
│ │ Confirmed with clinical team     │
│ └──────────────────────────────────┘
│
├────────────────────────────────────┤
│ [Show Less v]  [Regenerate]        │ ← Footer Actions
└────────────────────────────────────┘
```

## Mobile Layout (≤ 768px)

```
┌─────────────────────────────────────┐
│ 🔗 Pair Programming Area            │ (Sticky Header)
│ 5 variables • 3 generated           │
├─────────────────────────────────────┤
│ Scrollable Content Area (Pad: 16px) │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ AGE                  [✓] [Req]  │ │
│ │ Age (years)                     │ │
│ │                                 │ │
│ │ Type:   NUMERIC                 │ │
│ │ Orig:   SDTM                    │ │
│ │                                 │ │
│ │ [Show More] [Generate]          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ AGEGR              [Modify] [⏳] │ │
│ │ Age Group                       │ │
│ │                                 │ │
│ │ Type:   CHARACTER               │ │
│ │ Orig:   DERIVED                 │ │
│ │                                 │ │
│ │ [Show More] [Generate]          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ... (scrollable vertical)           │
│                                     │
└─────────────────────────────────────┘
```

## Tablet Layout (768px - 1024px)

```
┌───────────────────────────────────────────────────┐
│ 🔗 Pair Programming Area  5 var • 3 gen          │
├───────────────────────────────────────────────────┤
│ Content Area (Padding: 24px, Gap: 20px)          │
│                                                  │
│ ┌─────────────────────┐  ┌─────────────────────┐ │
│ │ AGE                 │  │ AGEGR               │ │
│ │ Age (years)         │  │ Age Group           │ │
│ │ [✓] [Required]      │  │ [Modify]            │ │
│ │ Type: NUMERIC       │  │ Type: CHARACTER     │ │
│ │ [Show More] [Gen]   │  │ [Show More] [Gen]   │ │
│ └─────────────────────┘  └─────────────────────┘ │
│                                                  │
│ ┌─────────────────────┐  ┌─────────────────────┐ │
│ │ ALB                 │  │ AGEM                │ │
│ │ Albumin Level       │  │ Age Group Middle    │ │
│ │ [✓]                 │  │ [⏳]                │ │
│ │ Type: NUMERIC       │  │ Type: CHARACTER     │ │
│ │ [Show More] [Gen]   │  │ [Show More] [Gen]   │ │
│ └─────────────────────┘  └─────────────────────┘ │
│                                                  │
│ ┌─────────────────────┐                         │
│ │ ALEQ                │                         │
│ │ Age = Level         │                         │
│ │ [✗]                 │                         │
│ │ Type: NUMERIC       │                         │
│ │ [Show More] [Gen]   │                         │
│ └─────────────────────┘                         │
│                                                  │
└───────────────────────────────────────────────────┘
```

## Color Palette

### Status Badges

| Status | Color | Background | Border |
|--------|-------|-----------|--------|
| **Required** | #991b1b (Red) | #fef2f2 | #fecaca |
| **Accepted** ✓ | #166534 (Green) | #f0fdf4 | #bbf7d0 |
| **Rejected** ✗ | #991b1b (Red) | #fef2f2 | #fecaca |
| **Modify** ⏳ | #b45309 (Yellow) | #fffbeb | #fcd34d |
| **Pending** ⏳ | #0369a1 (Blue) | #f0f9ff | #bae6fd |

### Card States

| State | Border | Shadow | Background |
|-------|--------|--------|-----------|
| **Default** | #e5e7eb | 0 1px 3px rgba(0,0,0,0.08) | white |
| **Hover** | #10b981 | 0 4px 12px rgba(16,185,129,0.12) | white |
| **Selected** | #10b981 | 0 4px 12px rgba(16,185,129,0.2) | gradient #f0fdf4→#f5fdf9 |

### Typography

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| **Card Title** | 15px | 700 | #1f2937 |
| **Card Label** | 13px | 400 | #6b7280 |
| **Info Label** | 11px | 600 | #6b7280 |
| **Info Value** | 12px | 400 | #1f2937 |
| **Detail Title** | 11px | 700 | #6b7280 |
| **Detail Content** | 12px | 400 | #374151 |
| **Badge Text** | 11px | 600 | varies |

## Responsive Breakpoints

```javascript
// CSS Grid columns
Mobile (default):    minmax(320px, 1fr)      [1 column]
Tablet (768px+):     minmax(320px, 1fr)      [1-2 columns]
Desktop (1024px+):   minmax(380px, 1fr)      [2-3 columns]
Large (1440px+):     minmax(420px, 1fr)      [3-4 columns]

// Padding
Mobile:   16px
Tablet:   24px
Desktop:  24px
Large:    32px

// Gap between cards
Mobile:   16px
Tablet:   20px
Desktop:  20px
Large:    24px
```

## Interactions

### Card Hover
- Border color: #e5e7eb → #10b981
- Shadow: subtle → prominent
- Transform: translateY(0) → translateY(-2px)
- Duration: 0.2s ease

### Card Click/Expand
1. Arrow icon rotates
2. Details section slides down (smooth transition)
3. Card expands naturally with flex-direction: column
4. Layout reflows without breaking adjacent cards

### Button Hover
- Primary button: #10b981 → #059669
- Secondary button: #f3f4f6 → #e5e7eb
- Duration: 0.2s ease

### Scroll Behavior
- Smooth scrolling in content area
- Header remains sticky (position: sticky, top: 0, z-index: 50)
- No horizontal scrolling needed
- Content area overflow-y: auto for vertical scrolling

## Accessibility

✅ **Semantic HTML**
- Use `<div>` with proper ARIA roles for cards
- Use `<button>` elements for interactive components
- Proper heading hierarchy

✅ **Keyboard Navigation**
- Tab through cards
- Enter to expand/collapse
- Space to activate buttons
- Arrow keys to navigate between cards (optional)

✅ **Screen Reader Support**
- Card labels and values announced
- Badge status announced
- Button purposes clear
- ARIA labels on interactive elements

✅ **Color Contrast**
- All text meets WCAG AA standard
- Status indicators use shape + color
- No information conveyed by color alone

✅ **Focus States**
- Visible focus indicators on all interactive elements
- Focus outline: 2px solid #10b981

---

## Comparison: Old vs New Layout

| Aspect | Old (Table) | New (Cards) |
|--------|-----------|-----------|
| **Horizontal Scroll** | Required | None |
| **Responsive** | Poor | Excellent |
| **Mobile UX** | Cramped | Natural |
| **Information Density** | High but cluttered | Balanced |
| **Visual Hierarchy** | Flat | Progressive |
| **Expand/Collapse** | No | Yes |
| **Status Visibility** | Column | Badge |
| **Accessibility** | Table semantics | Better UX |
| **Code Complexity** | Table structure | Component structure |

