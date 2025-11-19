# Accessibility Compliance Enhancements

This document summarizes the accessibility improvements implemented in the ADAM AI workspace to align with WCAG 2.1 AA expectations.

## WCAG 2.1 Alignment

| Requirement | Implementation |
|-------------|----------------|
| Documented conformance approach | This document plus inline comments track the controls and shortcuts that were added. |
| 2.1.1 Keyboard / 2.1.2 No Keyboard Trap | All panels, tabs, and workspace controls are reachable with the keyboard; custom handlers support quick navigation (Alt+\\ to toggle the configuration panel, Alt+1 to focus the workspace, Shift+/ to open contextual help). |
| 2.4.1 Bypass Blocks | A global skip link (`Skip to main content`) is available before the application container. |
| 2.4.3 Focus Order / 2.4.7 Focus Visible | Global `:focus-visible` styles ensure consistent outlines. Tab navigation, panel toggles, and modals now expose roles and ARIA attributes so assistive technologies can track focus. |
| 1.4.3 Contrast | Base typography uses the tokenized neutral palette and the default text color is now `var(--gray-900)` on `var(--surface-base)` to guarantee ≥4.5:1 contrast; gradients were left for purely decorative surfaces. |
| 4.1.2 Name, Role, Value | Left panel tabs, the progress bar, locked state notices, and toggle controls expose `role`, `aria-label`, `aria-expanded`, and `aria-live` values so that screen readers can announce state changes. |

## Keyboard Navigation Reference

- `Tab / Shift+Tab`: Traverse all actionable controls (tabs, toggle button, editor commands, etc.).
- `Alt + \`` (backslash) or `Alt + [`: Collapse/expand the configuration panel from anywhere.
- `Alt + 1`: Move focus directly to the main workspace region (`main#main-content`).
- `Shift + /`: Reserved shortcut that opens the interactive help overlay (see guidance section once tutorials are enabled).

## Screen Reader Enhancements

- Left panel tabs now use semantic `role="tablist"` / `role="tab"` / `role="tabpanel"` pairings with IDs.
- The configuration toggle announces whether the panel is expanded or collapsed.
- Progress indicators (`ApprovalProgressBar`, locked workspace progress) expose `role="status"` and include hidden descriptions via the shared `VisuallyHidden` helper.
- Live regions broadcast completion status when the user unlocks pair programming or crosses the 80% approval threshold.

## Focus and Motion Preferences

- Global `:focus-visible` outlines follow the design tokens so keyboard users always see where they are.
- `.sr-only` and `.skip-link` utilities centralize visually hidden text and bypass links.
- `@media (prefers-reduced-motion: reduce)` now disables non-essential transitions for users that opt out of animations.

## Testing

1. Run `npm run dev` inside `frontend/` and exercise the skip link, keyboard shortcuts, and tab order using only the keyboard.
2. Use NVDA/JAWS/VoiceOver to confirm that the configuration panel, workspace tabs, progress bar, and error messages are announced with the right context.
3. Use the Axe or Lighthouse accessibility audits to verify there are no remaining violations for keyboard, focus, or color contrast.

Document last updated: <!-- TODO: update as new accessibility work is delivered -->.
