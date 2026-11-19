---
"@primer/behaviors": patch
---

`getAnchoredPosition`: resolve the floating element's real CSS containing block instead of assuming `document.body` or a merely positioned ancestor. This fixes several classes of mispositioned tooltips, popovers, menus and dialogs:

- top-layer elements (modal dialogs and open native popovers) are positioned against the viewport (`position: fixed`) or the initial containing block, never against DOM ancestors, so a `margin` or `border` on `document.body` no longer shifts them ([#242](https://github.com/primer/behaviors/issues/242));
- non-modal dialogs are positioned like other absolutely positioned elements;
- fixed positioned elements are positioned against the viewport unless a transform-like ancestor establishes their containing block — a merely positioned ancestor no longer shifts them;
- ancestors with `transform`, `translate`, `rotate`, `scale`, `perspective`, `filter`, `backdrop-filter`, containment, matching `will-change`, `content-visibility` or `transform-style: preserve-3d` are recognized as containing blocks, and `display: contents` ancestors are skipped;
- `overflow` ancestors below the containing block no longer incorrectly flip or clamp the floating element.

The new browser test suite (`npm run test:browser`) exercises these rules with real layout in Chromium, Firefox and WebKit.
