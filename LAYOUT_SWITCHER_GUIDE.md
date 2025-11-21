# Layout Switcher Feature Guide

## 🎯 Overview
The Layout Switcher allows users to manually control the application's layout mode, giving them the flexibility to choose between mobile and desktop experiences regardless of their actual screen size.

## 📱 What is the Layout Switcher?

The Layout Switcher is a new icon button located in the top-right header, next to the Dark Mode toggle. It provides three layout options:

### Layout Modes

1. **🔄 Auto (Responsive)** - Default
   - Automatically adapts based on screen width
   - Mobile layout: ≤ 768px
   - Desktop layout: > 768px
   - Icon: Sync/Refresh icon

2. **📱 Mobile Layout**
   - Forces mobile view on any screen size
   - Configuration panel slides in as drawer
   - Hamburger menu always visible
   - Stacked vertical layout
   - Icon: Mobile phone icon

3. **💻 Desktop Layout**
   - Forces desktop view on any screen size
   - Side-by-side panels
   - Collapsible configuration panel
   - Full workspace available
   - Icon: Desktop monitor icon

## 🎨 Visual Indicators

The Layout Switcher button shows different colors based on the active mode:
- **Auto**: Gray icon (default)
- **Mobile**: Primary blue/purple icon
- **Desktop**: Success green icon

## 🚀 How to Use

### Switching Layouts

1. Click the Layout Switcher icon (near the theme toggle)
2. A dropdown menu appears with three options
3. Select your preferred layout mode
4. The layout changes instantly

### When to Use Each Mode

#### Use Mobile Layout When:
- ✅ Testing mobile responsiveness on desktop
- ✅ You prefer a focused, single-panel view
- ✅ Working with touchscreen on desktop
- ✅ Presenting on projector with limited space
- ✅ Simulating mobile user experience

#### Use Desktop Layout When:
- ✅ Working on tablet but want full features
- ✅ Need side-by-side panel viewing
- ✅ Using external monitor with tablet
- ✅ Prefer desktop experience on larger phones (landscape)
- ✅ Testing desktop features on mobile browser

#### Use Auto Layout When:
- ✅ Want automatic responsive behavior (recommended)
- ✅ Switching between devices frequently
- ✅ Screen size changes (rotation, resize)
- ✅ No specific layout preference

## 💡 Features

### Persistent Preference
- Your layout choice is saved to browser storage
- Preference persists across sessions
- Synced across tabs in the same browser
- Independent of dark/light theme preference

### Smooth Transitions
- Instant layout switching
- Animated panel movements
- No data loss during transitions
- Maintains scroll position where possible

### Smart Behavior
- Mobile menu auto-closes when switching to desktop
- Panel states preserved during mode changes
- Responsive to window resize in auto mode
- Works seamlessly with existing features

## 🛠️ Technical Details

### State Management
The layout mode is stored in Zustand preferences store:
```typescript
type LayoutMode = 'auto' | 'mobile' | 'desktop';
```

### CSS Implementation
Layout modes apply via body attribute:
```html
<body data-layout-mode="auto|mobile|desktop">
```

This allows CSS to target specific modes:
```css
body[data-layout-mode="mobile"] .left-panel-wrapper {
  /* Mobile-specific styles */
}
```

### Responsive Behavior
```typescript
// Auto mode respects screen size
const isMobile = 
  layoutMode === 'mobile' || 
  (layoutMode === 'auto' && window.innerWidth <= 768);

// Desktop mode always shows desktop layout
const isDesktop = layoutMode === 'desktop';
```

## 📋 Use Cases

### For Developers
```
Scenario: Testing responsive design
Action: Switch to mobile layout on desktop browser
Benefit: See exact mobile experience without device emulator
```

### For Designers
```
Scenario: Reviewing mobile UI on large screen
Action: Force mobile layout on 27" monitor
Benefit: Better focus on mobile design without context switching
```

### For QA Testers
```
Scenario: Testing both layouts quickly
Action: Toggle between mobile and desktop modes
Benefit: Fast regression testing without device switching
```

### For Power Users
```
Scenario: Prefer desktop UI on iPad
Action: Force desktop layout on tablet
Benefit: Access full features on tablet device
```

### For Presenters
```
Scenario: Demo mobile features on projector
Action: Switch to mobile layout during presentation
Benefit: Clear mobile UI demonstration to audience
```

## 🎓 Tips & Best Practices

### General Tips
- 💡 Start with **Auto mode** for normal usage
- 💡 Use **Mobile mode** for focused work or testing
- 💡 Use **Desktop mode** on tablets for full features
- 💡 Layout preference is device-specific

### Testing Tips
- ✅ Test mobile layout first on desktop before deploying
- ✅ Verify desktop features work in forced desktop mode
- ✅ Check transitions between all three modes
- ✅ Test with different zoom levels (90%-150%)

### Accessibility Tips
- ♿ Layout switcher is keyboard accessible
- ♿ Screen readers announce current mode
- ♿ Dropdown menu fully navigable
- ♿ Works with browser zoom

## 🔧 Keyboard Shortcuts

While there's no dedicated keyboard shortcut for the layout switcher (to avoid conflicts), you can:
- Tab to focus the layout switcher
- Enter/Space to open dropdown
- Arrow keys to navigate options
- Enter to select mode
- Escape to close dropdown

## 🐛 Troubleshooting

### Layout Not Changing
**Problem**: Clicked layout mode but nothing changed
**Solution**: 
- Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
- Clear browser cache
- Check browser console for errors

### Mobile Menu Not Appearing
**Problem**: In mobile mode but no hamburger menu
**Solution**:
- Ensure you're in workspace view (not landing/projects)
- Check if layout mode is actually set to mobile
- Refresh the page

### Desktop Layout Cramped on Small Screen
**Problem**: Desktop layout too crowded on phone
**Solution**:
- Switch to Auto or Mobile mode
- Browser zoom out slightly (pinch gesture)
- Rotate device to landscape

### Preference Not Saving
**Problem**: Layout mode resets after closing browser
**Solution**:
- Check browser allows localStorage
- Disable private/incognito mode
- Check browser storage settings

## 📊 Comparison Matrix

| Feature | Auto | Mobile | Desktop |
|---------|------|--------|---------|
| Responsive | ✅ Yes | ❌ Fixed | ❌ Fixed |
| Mobile drawer | On ≤768px | ✅ Always | ❌ Never |
| Side panels | On >768px | ❌ Never | ✅ Always |
| Hamburger menu | On ≤768px | ✅ Always | ❌ Never |
| Panel collapse | On >768px | ❌ N/A | ✅ Yes |
| Best for | General | Testing | Tablets |

## 🎯 Future Enhancements

Potential improvements being considered:
- 🔮 Keyboard shortcut (e.g., Ctrl+L)
- 🔮 Remember mode per device type
- 🔮 Automatic mode switching based on context
- 🔮 Custom breakpoint configuration
- 🔮 Layout presets (compact, comfortable, spacious)

## 📞 Support

### Need Help?
- 📧 Email: support@adamai.com
- 💬 In-app help: Click help icon
- 📚 Full docs: [docs.adamai.com](https://docs.adamai.com)

### Report Issues
If the layout switcher isn't working as expected:
1. Note your browser and version
2. Current layout mode setting
3. Screen size/device type
4. Screenshots if applicable
5. Submit via GitHub issues or support email

## 🎉 Conclusion

The Layout Switcher gives you **complete control** over your ADAM AI experience:
- 🎯 Choose your preferred layout
- 🧪 Test different views instantly
- 💼 Optimize for your workflow
- 🚀 Increase productivity

**Pro Tip**: Most users should stick with **Auto mode** for the best responsive experience. Use manual modes for specific needs like testing, presenting, or personal preference!

---

*Last updated: November 21, 2025*
*Version: 2.1.0*
*Feature: Layout Switcher*

