import {test} from '@playwright/test'
import {place, reposition, expectAttached} from './support'

// Consumers recompute the anchored position on scroll. The returned coordinates must keep
// the floating element attached to the anchor for both document scroll and scrollable
// containing blocks.

const SETTINGS = {side: 'outside-bottom', align: 'start', anchorOffset: 4}

const ANCHOR_CSS = `
  #anchor { position: absolute; left: 400px; top: 600px; width: 60px; height: 24px; background: #d0d7de; }
  #float { width: 140px; height: 48px; background: rgb(207 34 46 / 40%); }
`

test.describe('scroll tracking', () => {
  test('keeps a top-layer popover attached after the document scrolls', async ({page}) => {
    let result = await place(page, {
      html: '<div id="anchor"></div><div id="float" popover="manual"></div>',
      style: `${ANCHOR_CSS} #float { position: absolute; }`,
      bodyStyle: 'height: 3000px',
      activate: {type: 'popover'},
      settings: SETTINGS,
    })
    expectAttached(result, {anchorOffset: 4})

    await page.evaluate(() => window.scrollTo(0, 400))
    result = await reposition(page, SETTINGS)
    expectAttached(result, {anchorOffset: 4})
  })

  test('keeps a fixed element attached after the document scrolls', async ({page}) => {
    let result = await place(page, {
      html: '<div id="anchor"></div><div id="float"></div>',
      style: `${ANCHOR_CSS} #float { position: fixed; }`,
      bodyStyle: 'height: 3000px',
      settings: SETTINGS,
    })
    expectAttached(result, {anchorOffset: 4})

    await page.evaluate(() => window.scrollTo(0, 400))
    result = await reposition(page, SETTINGS)
    expectAttached(result, {anchorOffset: 4})
  })

  test('keeps an overlay attached inside a scrollable containing block', async ({page}) => {
    let result = await place(page, {
      html: `
        <div id="panel">
          <div id="spacer"></div>
          <div id="anchor"></div>
          <div id="float"></div>
        </div>
      `,
      style: `
        #panel { position: relative; overflow: auto; margin: 100px; width: 500px; height: 300px; }
        #spacer { height: 180px; }
        #anchor { position: absolute; left: 200px; top: 260px; width: 60px; height: 24px; }
        #float { position: absolute; width: 140px; height: 48px; }
      `,
      bodyStyle: 'height: 3000px',
      settings: SETTINGS,
    })
    expectAttached(result, {anchorOffset: 4})

    await page.evaluate(() => {
      document.getElementById('panel')!.scrollTop = 100
    })
    result = await reposition(page, SETTINGS)
    expectAttached(result, {anchorOffset: 4})
  })
})
