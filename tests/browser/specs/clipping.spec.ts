import {test, expect} from '@playwright/test'
import {place, expectAttached} from './support'

// Overflow clipping: per CSS, an `overflow` ancestor clips positioned descendants, but the
// floating element is positioned against its containing block — so overflow between the
// element and its containing block is escaped, while overflow at or above the containing
// block (and the containing block itself) clips. The anchored position algorithm must only
// flip/clamp to keep the element inside the ancestors that actually clip it.

const SETTINGS = {side: 'outside-bottom', align: 'start', anchorOffset: 4}

test.describe('clipping ancestors', () => {
  test('flips inside an overflow ancestor above the containing block', async ({page}) => {
    const result = await place(page, {
      html: '<div id="panel"><div id="float"></div></div><div id="anchor"></div>',
      style: `
        #panel { position: relative; overflow: hidden; margin: 100px; width: 400px; height: 200px; }
        #anchor { position: absolute; left: 300px; top: 260px; width: 60px; height: 24px; }
        #float { position: absolute; width: 140px; height: 48px; }
      `,
      bodyStyle: 'height: 3000px',
      settings: SETTINGS,
    })

    expect(result.position.anchorSide).toBe('outside-top')
    expectAttached(result, {anchorOffset: 4})
  })

  test('ignores overflow below the containing block', async ({page}) => {
    const result = await place(page, {
      html: '<div id="containing-block"><div id="overflow"><div id="float"></div></div></div><div id="anchor"></div>',
      style: `
        #containing-block { position: relative; margin: 100px; width: 500px; height: 400px; }
        #overflow { overflow: hidden; width: 150px; height: 80px; }
        #anchor { position: absolute; left: 120px; top: 160px; width: 40px; height: 20px; }
        #float { position: absolute; width: 140px; height: 48px; }
      `,
      bodyStyle: 'height: 3000px',
      settings: SETTINGS,
    })

    // The overflow box is inside the containing block and therefore does not clip the
    // element, so no flip is needed even though the element escapes that box.
    expect(result.position.anchorSide).toBe('outside-bottom')
    expectAttached(result, {anchorOffset: 4})
  })

  test('flips inside a scrollable containing block', async ({page}) => {
    const result = await place(page, {
      html: '<div id="panel"><div id="float"></div></div><div id="anchor"></div>',
      style: `
        #panel { position: relative; overflow: auto; margin: 100px; width: 400px; height: 200px; }
        #anchor { position: absolute; left: 300px; top: 260px; width: 60px; height: 24px; }
        #float { position: absolute; width: 140px; height: 48px; }
      `,
      bodyStyle: 'height: 3000px',
      settings: SETTINGS,
    })

    expect(result.position.anchorSide).toBe('outside-top')
    expectAttached(result, {anchorOffset: 4})
  })

  test('does not clip fixed elements with overflow ancestors', async ({page}) => {
    const result = await place(page, {
      html: '<div id="overflow"><div id="float"></div></div><div id="anchor"></div>',
      style: `
        #overflow { overflow: hidden; margin: 100px; width: 300px; height: 200px; }
        #anchor { position: absolute; left: 300px; top: 660px; width: 60px; height: 24px; }
        #float { position: fixed; width: 140px; height: 48px; }
      `,
      bodyStyle: 'height: 3000px',
      settings: SETTINGS,
    })

    // Clipped by the viewport only, so the side flips at the bottom of the viewport.
    expect(result.position.anchorSide).toBe('outside-top')
    expectAttached(result, {anchorOffset: 4})
  })
})
