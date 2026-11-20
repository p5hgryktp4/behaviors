import {test, expect} from '@playwright/test'
import {place, expectAttached, expectWithinViewport} from './support'

// https://github.com/primer/behaviors/issues/242
// A margin (or border) on document.body used to be subtracted from the returned offsets
// because `document.body` was mistaken for the containing block. This shifted tooltips,
// popovers and any other overlay that has no positioned ancestor, by exactly the size of
// the margin. These tests use real layout in every engine.

const BODY_STYLE = 'margin: 200px 50px; height: 3000px'

const FIXTURE_CSS = `
  #anchor { position: absolute; left: 400px; top: 600px; width: 60px; height: 24px; background: #d0d7de; }
  #float { position: absolute; width: 140px; height: 48px; background: rgb(207 34 46 / 40%); }
`

const SETTINGS = {side: 'outside-bottom', align: 'start', anchorOffset: 4}

test.describe('body margins (#242)', () => {
  test('keeps a native popover tooltip attached, ignoring the body margin', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float" popover="manual"></div>',
      style: FIXTURE_CSS,
      bodyStyle: BODY_STYLE,
      activate: {type: 'popover'},
      settings: SETTINGS,
    })

    expect(result.computed.topLayer).toBe(true)
    expectAttached(result, {anchorOffset: 4})
  })

  test('keeps a native popover tooltip attached when the document is scrolled', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float" popover="manual"></div>',
      style: FIXTURE_CSS,
      bodyStyle: BODY_STYLE,
      activate: {type: 'popover'},
      scroll: [0, 400],
      settings: SETTINGS,
    })

    expectAttached(result, {anchorOffset: 4})
  })

  test('keeps an absolutely positioned element without a positioned ancestor attached', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float"></div>',
      style: FIXTURE_CSS,
      bodyStyle: BODY_STYLE,
      settings: SETTINGS,
    })

    expect(result.computed.topLayer).toBe(false)
    expectAttached(result, {anchorOffset: 4})
  })

  test('positions fixed elements against the viewport', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float"></div>',
      style: `${FIXTURE_CSS} #float { position: fixed; }`,
      bodyStyle: BODY_STYLE,
      scroll: [0, 400],
      settings: SETTINGS,
    })

    expectAttached(result, {anchorOffset: 4})
  })

  test('keeps an element inside a positioned portal wrapper attached', async ({page}) => {
    const result = await place(page, {
      html: '<div id="portal"><div id="float"></div></div><div id="anchor"></div>',
      style: `
        #portal { position: relative; top: 40px; left: 30px; width: 100%; height: 100%; }
        ${FIXTURE_CSS}
      `,
      bodyStyle: BODY_STYLE,
      settings: SETTINGS,
    })

    expectAttached(result, {anchorOffset: 4})
  })

  test('clamps the alignment inside the viewport at the right edge', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float"></div>',
      style: `
        #anchor { position: absolute; right: 10px; top: 300px; width: 60px; height: 24px; }
        #float { position: absolute; width: 140px; height: 48px; }
      `,
      bodyStyle: BODY_STYLE,
      settings: SETTINGS,
    })

    // align:start would put the floating element past the right edge of the viewport
    expect(result.position.anchorAlign).toBe('end')
    expectAttached(result, {anchorOffset: 4})
    expectWithinViewport(result)
  })

  test('ignores a body border as well as the body margin', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float"></div>',
      style: FIXTURE_CSS,
      bodyStyle: 'margin: 120px 80px; border: 10px solid black; height: 3000px',
      settings: SETTINGS,
    })

    expectAttached(result, {anchorOffset: 4})
  })
})
