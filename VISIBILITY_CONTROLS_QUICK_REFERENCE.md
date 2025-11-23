# Visibility Controls - Quick Reference Guide

## 📍 Location
The visibility controls are located between the "Customize Columns" toolbar and the main table.

## 🎛️ Available Controls

### 1. View Density (Left Side)
```
┌──────────────────────────────────────────┐
│ View Density: [Compact] [Comfortable] [Spacious] │
└──────────────────────────────────────────┘
```

**Compact** 🔍
- Smallest spacing and fonts
- See more rows at once
- Code blocks: 250px max height
- Cell padding: 12px
- Font size: 12px

**Comfortable** ✨ (Default)
- Balanced view
- Good for everyday use
- Code blocks: 320px max height
- Cell padding: 20px
- Font size: 13px

**Spacious** 📖
- Largest spacing and fonts
- Maximum readability
- Code blocks: 400px max height
- Cell padding: 28px
- Font size: 14px

---

### 2. Column Width (Middle)
```
┌──────────────────────────────────────────┐
│ Column Width: [Narrow] [Standard] [Wide]     │
└──────────────────────────────────────────┘
```

**Narrow** 📱
- Compact columns
- Less horizontal scrolling
- Code column: 320px
- Best for smaller screens

**Standard** 💻 (Default)
- Balanced widths
- Optimal for most cases
- Code column: 400px
- Best for regular monitors

**Wide** 🖥️
- Maximum column widths
- More content visible
- Code column: 550px
- Best for large monitors

---

### 3. Scroll Hint (Right Side)
```
┌──────────────────────────────────────────────────┐
│ ⓘ Use horizontal scrollbar below to view all columns │
└──────────────────────────────────────────────────┘
```

- Pulsing yellow indicator
- Reminds about horizontal scrolling
- Always visible for guidance

---

## 🎨 Scrollbar Features

### Horizontal Scrollbar
```
════════════════════════════════════════
    ████████████████░░░░░░░░░░░░░
════════════════════════════════════════
```

**Features:**
- ✅ **Always visible** - No more hidden scrollbar
- ✅ **Bold red gradient** - Easy to spot (crimson to bright red)
- ✅ **18px height** - Large enough to grab easily
- ✅ **Animated pulse** - Subtle animation draws attention
- ✅ **Hover effects** - Brightens and scales on hover
- ✅ **Smooth scrolling** - Professional feel

### Visual Indicators
```
[Red Gradient]                    [Red Gradient]
     ↓                                 ↓
     ▼                                 ▼
┌─────────┬──────────┬──────────┬─────────┐
│ LEFT    │  Table   │  Content │  RIGHT  │
│ EDGE    │  Rows    │  Here    │  EDGE   │
│ (shown  │          │          │ (always │
│  when   │          │          │  shown) │
│ scrolled)│         │          │         │
└─────────┴──────────┴──────────┴─────────┘
```

**Left Edge Indicator:**
- Appears when scrolled > 20px
- Shows you can scroll back left
- Red gradient fading right

**Right Edge Indicator:**
- Always visible
- Shows more content to the right
- Red gradient fading left

---

## 💡 Usage Tips

### For Small Screens (< 1400px)
1. Use **Narrow** column width
2. Use **Compact** density
3. Scroll horizontally to view all columns
4. Watch for edge indicators

### For Regular Monitors (1400px - 1900px)
1. Use **Standard** column width (default)
2. Use **Comfortable** density (default)
3. Minimal scrolling needed
4. Optimal balance

### For Large Monitors (> 1900px)
1. Use **Wide** column width
2. Use **Spacious** density
3. See almost all columns at once
4. Maximum readability

### For Data Review/Validation
1. Use **Spacious** density
2. Use **Wide** column width
3. Larger fonts and spacing
4. Easier to read code snippets

### For Quick Scanning
1. Use **Compact** density
2. Use **Narrow** column width
3. See many rows at once
4. Perfect for getting overview

---

## 🎯 Best Practices

### ✅ DO:
- Adjust density based on your task
- Use wider columns for code review
- Pay attention to edge indicators
- Use horizontal scrollbar for navigation

### ❌ DON'T:
- Don't hide columns you need frequently
- Don't use compact view for detailed review
- Don't ignore the scroll hint
- Don't forget to scroll right to see all columns

---

## 🔧 Troubleshooting

**Problem: Can't see scrollbar**
- ✅ Solution: Scrollbar is now always visible with red color
- ✅ It's at the bottom of the table container
- ✅ Look for the bold red bar

**Problem: Table feels cramped**
- ✅ Switch to "Spacious" density
- ✅ Switch to "Wide" column width
- ✅ Or both for maximum space

**Problem: Can't see all columns**
- ✅ Use the horizontal scrollbar at bottom
- ✅ Look for red gradient on right edge
- ✅ Drag scrollbar or use mouse wheel (Shift + scroll)

**Problem: Text is too small**
- ✅ Switch to "Spacious" density
- ✅ Font sizes increase automatically
- ✅ More padding for easier reading

**Problem: Too much scrolling**
- ✅ Switch to "Narrow" column width
- ✅ Switch to "Compact" density
- ✅ Hide unnecessary columns via "Customize Columns"

---

## 📊 Column Width Reference

| Column         | Narrow | Standard | Wide  |
|----------------|--------|----------|-------|
| Variable       | 150px  | 200px    | 250px |
| Label          | 200px  | 300px    | 400px |
| Type           | 90px   | 110px    | 130px |
| Length/Format  | 90px   | 110px    | 130px |
| Origin         | 120px  | 150px    | 200px |
| Derivation     | 200px  | 250px    | 350px |
| Rationale      | 220px  | 300px    | 400px |
| Code Snippet   | 320px  | 400px    | 550px |
| Acceptance     | 130px  | 150px    | 180px |
| Notes          | 180px  | 220px    | 280px |

---

## 🚀 Keyboard Shortcuts (Future Enhancement)

| Shortcut       | Action                    |
|----------------|---------------------------|
| Ctrl + 1       | Compact density           |
| Ctrl + 2       | Comfortable density       |
| Ctrl + 3       | Spacious density          |
| Ctrl + -       | Narrow columns            |
| Ctrl + 0       | Standard columns          |
| Ctrl + +       | Wide columns              |
| Shift + Scroll | Horizontal scroll         |

*Note: Keyboard shortcuts planned for future release*

---

## 📱 Responsive Behavior

**On screens < 1400px:**
- Controls wrap to multiple rows
- Scroll hint moves to its own row
- All functionality remains available

**On all screen sizes:**
- Horizontal scrollbar always visible
- Sticky headers work perfectly
- Smooth transitions maintained

---

## 🎨 Color Legend

| Element              | Color                | Purpose                    |
|----------------------|----------------------|----------------------------|
| Scrollbar thumb      | Crimson Red gradient | High visibility            |
| Edge indicators      | Red gradient         | Show scroll availability   |
| Active control       | Green gradient       | Current selection          |
| Scroll hint          | Yellow gradient      | Draw attention             |
| Selected row         | Green tint           | Hover feedback             |

---

## Support

For issues or questions about the visibility controls:
1. Check this quick reference guide
2. Review the full documentation (PAIR_PROGRAMMING_TABLE_ENHANCEMENTS.md)
3. Experiment with different combinations
4. Use the scroll hint for guidance

**Remember:** The controls are designed to adapt to YOUR workflow. Try different combinations to find what works best for your task! 🎯







