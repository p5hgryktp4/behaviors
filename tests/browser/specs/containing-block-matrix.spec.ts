import {test} from '@playwright/test'
import {place, expectAttached} from './support'

// Cross-engine matrix: for every CSS property that may or may not establish a containing
// block for positioned descendants, place a floating element inside an offset ancestor and
// assert that it still appears attached to its anchor. The assertion is engine-agnostic:
// it fails whenever the containing block used by `getAnchoredPosition` disagrees with the
// one the browser actually uses.

const CANDIDATES = [
  // establishes a containing block for absolute (and, for the transform-like ones, fixed)
  'position: relative',
  'position: absolute',
  'position: sticky',
  'transform: translateX(0.001px)',
  'transform: translateZ(0)',
  'translate: 1px',
  'rotate: 0.001deg',
  'scale: 1.0001',
  'filter: blur(0.001px)',
  'perspective: 1px',
  'backdrop-filter: blur(0.001px)',
  'contain: layout',
  'contain: paint',
  'contain: strict',
  'contain: content',
  'will-change: transform',
  'will-change: filter',
  'will-change: perspective',
  'content-visibility: auto',
  'transform-style: preserve-3d',
  // must not establish a containing block
  'isolation: isolate',
  'opacity: 0.99',
  'container-type: inline-size',
  'container-type: size',
  'mask-image: linear-gradient(black, black)',
  'clip-path: inset(0)',
]

const STRATEGIES = ['absolute', 'fixed'] as const

for (const candidate of CANDIDATES) {
  for (const strategy of STRATEGIES) {
    test(`${strategy} element inside an ancestor with "${candidate}"`, async ({page}) => {
      const result = await place(page, {
        html: '<div id="ancestor"><div id="float"></div></div><div id="anchor"></div>',
        style: `
          #ancestor {
            margin: 100px;
            width: 300px;
            height: 300px;
            background: rgb(0 0 255 / 10%);
            ${candidate};
          }
          #anchor { position: absolute; left: 420px; top: 320px; width: 60px; height: 24px; }
          #float { position: ${strategy}; width: 140px; height: 48px; background: rgb(207 34 46 / 40%); }
        `,
        bodyStyle: 'height: 3000px',
        scroll: strategy === 'fixed' ? [0, 250] : [0, 0],
        settings: {side: 'outside-bottom', align: 'start', anchorOffset: 4},
      })

      expectAttached(result, {anchorOffset: 4})
    })
  }
}
