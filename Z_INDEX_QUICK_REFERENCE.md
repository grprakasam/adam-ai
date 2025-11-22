# Z-Index Quick Reference Card

## 📋 Standard Z-Index Values

Use these standardized z-index values to maintain consistency:

### Global Level (1000+)
```css
/* Top-most UI elements */
.app-header          { z-index: 1000; }
.modal-overlay       { z-index: 1100; }
.toast-notification  { z-index: 1200; }
.dropdown-menu       { z-index: 1050; }
```

### Workspace Level (50-200)
```css
/* Workspace-wide sticky elements */
.workspace-utilities        { z-index: 100; }
.workspace-navigation       { z-index: 90; }
.workspace-progress-bar     { z-index: 80; }
```

### Tab Level (1-10) 
```css
/* Within isolated tab containers */
.tab-header          { z-index: 5; }
.tab-toolbar         { z-index: 4; }
.tab-sticky-element  { z-index: 3; }
```

### Content Level (auto or 1)
```css
/* Regular scrollable content */
.content-area        { z-index: 1; }
.card                { z-index: auto; }
.list-item           { z-index: auto; }
```

## 🎯 Rules to Follow

### ✅ DO:
1. **Use isolation** for tab containers
   ```css
   .tab-container {
     isolation: isolate;
     position: relative;
     z-index: 1;
   }
   ```

2. **Keep z-index values low** within isolated contexts
   ```css
   /* Inside isolated container */
   .header { z-index: 5; }  /* Not 100! */
   ```

3. **Document high z-index usage**
   ```css
   .modal {
     z-index: 1100; /* Must be above all content */
   }
   ```

4. **Test scrolling** after z-index changes

### ❌ DON'T:
1. **Don't use z-index: 9999**
   ```css
   /* ❌ BAD */
   .my-element { z-index: 9999; }
   
   /* ✅ GOOD */
   .my-element { z-index: 100; }
   ```

2. **Don't skip isolation**
   ```css
   /* ❌ BAD */
   .tab {
     /* No isolation */
     .header { z-index: 100; }
   }
   
   /* ✅ GOOD */
   .tab {
     isolation: isolate;
     .header { z-index: 5; }
   }
   ```

3. **Don't create z-index wars**
   - If element A needs to be above B
   - Increase A by 1, not 100

4. **Don't use z-index without position**
   ```css
   /* ❌ BAD - z-index does nothing */
   .element {
     z-index: 10;
   }
   
   /* ✅ GOOD */
   .element {
     position: relative;
     z-index: 10;
   }
   ```

## 🏗️ Component Checklist

When creating a new component with sticky/fixed positioning:

- [ ] Does it need isolation? → Add `isolation: isolate`
- [ ] What's the parent z-index? → Use lower value
- [ ] Is it global? → Use 1000+
- [ ] Is it workspace-level? → Use 50-200
- [ ] Is it tab-level? → Use 1-10
- [ ] Is it content? → Use auto or 1
- [ ] Does it scroll? → Test scrolling behavior
- [ ] Does it overlap? → Adjust z-index hierarchy

## 🔍 Debugging Z-Index Issues

### Browser DevTools Method:
1. Open DevTools (F12)
2. Select problematic element
3. Check Computed styles → z-index
4. Look for parent isolation
5. Verify stacking context

### Common Issues:
```css
/* Issue: Content hidden by sticky header */
/* ❌ WRONG */
.sticky-header { z-index: 100; }
.content { z-index: 50; }

/* ✅ RIGHT */
.container { isolation: isolate; }
.sticky-header { z-index: 5; }
.content { z-index: auto; }
```

## 📐 Stacking Context Triggers

These CSS properties create new stacking contexts:
- `isolation: isolate`
- `opacity` < 1
- `transform` (any)
- `filter` (any)
- `position: fixed` or `position: sticky`
- `will-change: transform`

## 🎨 Visual Hierarchy Map

```
┌─────────────────────────────────────┐
│ Global Modals & Overlays   (1100+) │
│ ├─ App Header              (1000)  │
│ └─ Notifications           (1200)  │
├─────────────────────────────────────┤
│ Workspace Utilities        (100)   │
│ Workspace Navigation       (90)    │
├─────────────────────────────────────┤
│ Tab Containers (isolated)          │
│ ├─ Tab Header              (5)     │
│ ├─ Tab Toolbar             (4)     │
│ └─ Content Area            (1)     │
└─────────────────────────────────────┘
```

## 💾 Save This!

Keep this file for reference when:
- Adding new sticky elements
- Creating new tabs
- Debugging overlap issues
- Onboarding new developers
- Code reviews

## 🚨 Emergency Fix

If content is hidden:
1. Find the hiding element
2. Check its z-index
3. Add isolation to parent
4. Reduce child z-index
5. Test scrolling

```css
/* Quick fix template */
.parent-container {
  isolation: isolate;  /* Create boundary */
  position: relative;  /* Enable stacking */
}

.child-header {
  position: sticky;
  top: 0;
  z-index: 5;  /* Keep low */
}

.child-content {
  z-index: auto;  /* Default stacking */
}
```

## 📚 Further Reading

- MDN: CSS Stacking Context
- MDN: isolation property
- CSS Tricks: Z-Index
- Web.dev: Stacking Context

---

**Last Updated:** After UI/UX scrolling fix
**Maintained By:** Development Team
**File Location:** `/Z_INDEX_QUICK_REFERENCE.md`

