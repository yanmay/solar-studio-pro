---
name: SolarScan AI Premium
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1b1b1d'
  surface-container: '#1f1f21'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#d7c3ae'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#303032'
  outline: '#9f8e7a'
  outline-variant: '#524534'
  surface-tint: '#ffb955'
  primary: '#ffc880'
  on-primary: '#452b00'
  primary-container: '#f5a623'
  on-primary-container: '#644000'
  inverse-primary: '#835500'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#9bd9ff'
  on-tertiary: '#00344a'
  tertiary-container: '#3ac2ff'
  on-tertiary-container: '#004d6a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb4'
  primary-fixed-dim: '#ffb955'
  on-primary-fixed: '#291800'
  on-primary-fixed-variant: '#633f00'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7cd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
  outline-muted: rgba(255, 255, 255, 0.1)
  chart-fill-start: rgba(245, 166, 35, 0.15)
  chart-fill-end: rgba(245, 166, 35, 0)
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
  gutter: 24px
  container-margin-mobile: 20px
  container-margin-desktop: 48px
---

## Brand & Style
The brand personality is **authoritative, analytical, and futuristic**. It functions as a "Professional Investment Memorandum," targeting high-net-worth investors and commercial stakeholders in the renewable energy sector. 

The visual style is **Corporate Modern with Glassmorphic accents**. It balances the clinical precision of a financial report with the high-tech allure of aerospace and solar technology. The UI evokes a sense of "intelligence" through clean information density, subtle animations, and a sophisticated dark-mode palette that makes data visualizations glow.

## Colors
The palette is rooted in a deep "Obsidian" neutral base to provide maximum contrast for data. 

- **Primary (Solar Amber):** Used for key financial highlights, action buttons, and "break-even" indicators. It represents energy and value.
- **Secondary (Eco Green):** Reserved for positive growth metrics, environmental impact, and successful subsidies.
- **Tertiary (Tech Blue):** Used for technical specifications and system intelligence markers.
- **Neutral:** A range of surfaces from `#0e0e10` (deepest containers) to `#39393b` (elevated components), using low-opacity white borders (`white/5` or `white/10`) instead of heavy grays to define structure.

## Typography
The system uses **Inter** exclusively, relying on its utilitarian and systematic qualities. 

Hierarchy is established through extreme weight variance (from 400 for long-form analysis to 700 for key findings) and tracking. **Labels** use `0.05em` letter-spacing and uppercase styling to denote metadata. **Display** type uses negative tracking (`-0.02em`) to feel more compact and modern at large scales.

## Layout & Spacing
The layout follows a **Fixed-Width Professional Document** model. On desktop, the main content is constrained to a 4xl (approx. 896px) canvas to ensure optimal line length for analytical reading.

- **Vertical Rhythm:** Sections are separated by `stack-lg` (48px) and horizontal rules (`hr`) with `white/10` opacity. 
- **Grid:** A standard 12-column grid is used internally for metric rows, often reflowing from 4 columns on desktop to 1 column on mobile.
- **Margins:** A consistent `gutter` of 24px is maintained for horizontal safety.

## Elevation & Depth
Depth is achieved through **Tonal Layering and Glassmorphism** rather than traditional shadows.

1.  **Level 0 (Background):** Solid `#131315`.
2.  **Level 1 (Navigation):** `surface-dim/80` with a `backdrop-blur-md`. This creates a sense of the document sliding beneath the header.
3.  **Level 2 (Containers):** Cards and chart areas use `surface-container-lowest` with a `white/10` border.
4.  **Visual Accents:** Soft "Glow" effects are used for data lines (Primary color) and environmental icons (Secondary color with `30%` opacity stroke).

## Shapes
The shape language is **Structured and Softened**. 
- Standard UI containers (cards, chart areas) use `rounded-lg` (0.5rem).
- Interactive elements like buttons use `rounded-lg` for a more substantial, professional feel.
- Purely decorative or iconic elements (status circles, icon backdrops) use `rounded-full` (pill/circle).

## Components

### Buttons
- **Primary Action:** Solid `primary-container` background with `on-primary-container` text. Large horizontal padding (px-6) and bold labels.
- **Ghost/Nav Links:** No background, `on-surface-variant` text, transitioning to `primary` with a 2px bottom border on active states.

### Data Cards
- Minimalist containers with a 1px border (`white/10`). 
- Vertical stack: Label (uppercase, small) -> Value (large, bold) -> Optional Footer (small, muted).

### Financial Ledger
- A specialized list component with alternating `surface-container-lowest` backgrounds.
- Row items use flex-justify-between with consistent vertical padding (py-4).

### Icons
- Use **Material Symbols Outlined**. 
- Fill is used sparingly for active states or branding in the header. 
- Icon size is standard 24px, but reduced to 18px when used within buttons or inline labels.

### Charts
- **Monotone Area Charts:** Primary color stroke (2px) with a gradient fill transitioning from 15% opacity to 0%. 
- **Markers:** Vertical dashed lines (`primary/50`) for milestone indicators like "Break-even."