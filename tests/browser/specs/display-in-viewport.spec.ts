import {test, expect} from '@playwright/test'
import {place, expectAttached, expectWithinViewport} from './support'

// `displayInViewport: true` constrains the floating element to the visible viewport even
// when the document (or its containing block) can scroll. This is used by consumer
// components whose overlays must stay visible without scrolling.

test.use({viewport: {width: 1024, height: 600}})

const SETTINGS = {side: 'outside-bottom', align: 'start', anchorOffset: 4}
const SCROLLED_SETTINGS = {...SETTINGS, displayInViewport: true}

const ANCHOR_CSS = `
  #anchor { position: absolute; left: 400px; top: 1360px; width: 60px; height: 24px; background: #d0d7de; }
  #float { width: 140px; height: 48px; background: rgb(207 34 46 / 40%); }
`

test.describe('displayInViewport', () => {
  test('keeps a top-layer popover inside the visible viewport', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float" popover="manual"></div>',
      style: `${ANCHOR_CSS} #float { position: absolute; }`,
      bodyStyle: 'height: 3000px',
      activate: {type: 'popover'},
      scroll: [0, 800],
      settings: SCROLLED_SETTINGS,
    })

    expect(result.position.anchorSide).toBe('outside-top')
    expectAttached(result, {anchorOffset: 4})
    expectWithinViewport(result)
  })

  test('allows document space when displayInViewport is not set', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float" popover="manual"></div>',
      style: `${ANCHOR_CSS} #float { position: absolute; }`,
      bodyStyle: 'height: 3000px',
      activate: {type: 'popover'},
      scroll: [0, 800],
      settings: SETTINGS,
    })

    // There is scrollable document space below the viewport, so no flip is needed.
    expect(result.position.anchorSide).toBe('outside-bottom')
    expectAttached(result, {anchorOffset: 4})
  })

  test('keeps a fixed element inside the visible viewport', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float"></div>',
      style: `${ANCHOR_CSS} #float { position: fixed; }`,
      bodyStyle: 'height: 3000px',
      scroll: [0, 800],
      settings: SCROLLED_SETTINGS,
    })

    expect(result.position.anchorSide).toBe('outside-top')
    expectAttached(result, {anchorOffset: 4})
    expectWithinViewport(result)
  })
})
