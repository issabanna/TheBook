# Reusable website design kit

This kit packages the current compact Merciful Father design into a clean standalone stylesheet. It does not depend on the original site's HTML, JavaScript, application form, database, email service, or branding artwork.

## Font

**Cairo** for both English and Arabic, with `Tahoma, Arial, sans-serif` fallbacks.

Google Fonts import is included in `theme.css`. Weights: 400 (body), 500/600 (supporting UI and labels), 700 (card headings), 800 (main headings and buttons), 900 (available for emphasis).

```html
<link rel="stylesheet" href="theme.css">
<body class="mf-theme">
  <main class="mf-container mf-section">
    <div class="mf-eyebrow">YOUR INTRODUCTION</div>
    <h1>Your heading <em>with an accent.</em></h1>
    <p>Readable supporting copy in Cairo.</p>
    <a class="mf-button" href="#">Primary action</a>
    <a class="mf-button mf-button-secondary" href="#">Secondary action</a>
  </main>
</body>
```

For Arabic set `<html lang="ar" dir="rtl">`. For English use `<html lang="en" dir="ltr">`. The same CSS supports both. Translation and language switching are not included in this visual kit.

## Main colors

| Role | Hex |
|---|---|
| Navy headings / main text | `#19164C` |
| Pale-blue background | `#E8F6FF` |
| White surfaces | `#FFFFFF` |
| Cyan decorative accents | `#56B8DD` |
| Darker cyan heading accents | `#2583A3` |
| Red primary button | `#DE3048` |
| Red hover / error text | `#B51E38` |
| Yellow decorative stars | `#F0DC00` |
| Muted copy | `#58657B` |
| Light borders | `#D2E8F3` |
| Secondary button background | `#EDF0F3` |
| Secondary button text | `#465365` |
| Secondary button border | `#CBD2DA` |

Cyan and yellow are mainly decorative. Use navy or the darker cyan for readable text on pale backgrounds.

## Typography — current compact homepage scale

| Element | Desktop | Mobile (680px and below) | Weight | Line height |
|---|---|---|---|---|
| Main heading | `clamp(38px, 4.2vw, 60px)` | `clamp(32px, 8vw, 42px)` | 800 | 1.25 / 1.3 |
| Section heading | `clamp(30px, 3vw, 44px)` | 29px | 800 | 1.35 / 1.4 |
| Card heading | 25px | 24px | 700 | 1.4 / 1.5 |
| Body paragraph | 17px | 17px | 400 | 1.75 / 1.7 |
| Form label | 16px | 16px | 600 | 1.9 |
| Primary button | 16px | 15px | 800 | 1.8 |
| Secondary status button | 13px | 13px | 800 | 1.6 |
| Small enquiry note | 13px | 13px | 400 | 1.6 |
| Inline validation | 12px | 12px | 400 | 1.65 |
| Eyebrow / small introduction | 13px | 11px | 700 | 1.6 |

`clamp()` makes headings scale between the minimum and maximum sizes. The coming-soon screen has separate compact heading rules: desktop `clamp(34px, 4.5vw, 60px)`, mobile `clamp(27px, 7.5vw, 36px)` in English.

## Spacing and shapes

- Main content width: maximum **1240px**, **88%** of the viewport on desktop, **90%** on mobile.
- Section padding: **50px** top/bottom on desktop, **32px** on mobile.
- Grid gap: **24px**, reduced to **20px** on mobile.
- Card padding: **24px**, reduced to **20px** on mobile.
- Cards: white, **1px** light-blue border, **12px** corner radius (some existing site cards use 14px).
- Buttons and inputs: **6px** corner radius.
- Primary buttons: around **46px** high, padding **10px 18px**.
- Small secondary button: **36px** minimum height, padding **7px 14px**.
- Inputs: **46px** minimum height, padding **10px 12px**.
- Keep generous paragraph spacing, with headings closer to their associated text.

## Files

- `theme.css`: reusable colors, typography and component styles.
- `example.html`: English and Arabic examples, buttons, cards and an input error.
- `background.svg`: the pale-blue decorative background from the coming-soon page; optional.

To use the background:

```css
.your-hero {
  background: #e8f6ff url('background.svg') center / cover no-repeat;
}
```

Replace the sample brand name, content, links and any imagery with those of the new website. The `mf-` prefix keeps the component styles separate from other CSS.
