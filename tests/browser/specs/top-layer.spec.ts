import {test, expect} from '@playwright/test'
import {place, expectAttached} from './support'

// Top-layer elements (modal dialogs, open native popovers) are not positioned by their
// DOM ancestors. Per CSS Position 4 they are positioned against the viewport when their
// computed `position` is fixed, and against the initial containing block otherwise.

const SETTINGS = {side: 'outside-bottom', align: 'start', anchorOffset: 4}

const ANCHOR_CSS = `
  #anchor { position: absolute; left: 400px; top: 600px; width: 60px; height: 24px; background: #d0d7de; }
  #float { width: 140px; height: 48px; background: rgb(207 34 46 / 40%); }
`

test.describe('top-layer elements', () => {
  test('positions an absolutely positioned popover against the document origin', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float" popover="manual"></div>',
      style: `${ANCHOR_CSS} #float { position: absolute; }`,
      bodyStyle: 'height: 3000px',
      activate: {type: 'popover'},
      scroll: [0, 400],
      settings: SETTINGS,
    })

    expect(result.computed.topLayer).toBe(true)
    expect(result.computed.position).toBe('absolute')
    expectAttached(result, {anchorOffset: 4})
  })

  test('positions a fixed positioned popover against the viewport', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float" popover="manual"></div>',
      style: `${ANCHOR_CSS} #float { position: fixed; }`,
      bodyStyle: 'height: 3000px',
      activate: {type: 'popover'},
      scroll: [0, 400],
      settings: SETTINGS,
    })

    expect(result.computed.topLayer).toBe(true)
    expect(result.computed.position).toBe('fixed')
    expectAttached(result, {anchorOffset: 4})
  })

  test('positions a modal dialog (fixed) against the viewport', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><dialog id="float"></dialog>',
      style: ANCHOR_CSS,
      bodyStyle: 'height: 3000px',
      activate: {type: 'modal'},
      scroll: [0, 400],
      settings: SETTINGS,
    })

    expect(result.computed.topLayer).toBe(true)
    expect(result.computed.position).toBe('fixed')
    expectAttached(result, {anchorOffset: 4})
  })

  test('positions a modal dialog with author position: absolute against the document origin', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><dialog id="float"></dialog>',
      style: `${ANCHOR_CSS} #float { position: absolute; }`,
      bodyStyle: 'height: 3000px',
      activate: {type: 'modal'},
      scroll: [0, 400],
      settings: SETTINGS,
    })

    expect(result.computed.topLayer).toBe(true)
    expect(result.computed.position).toBe('absolute')
    expectAttached(result, {anchorOffset: 4})
  })

  test('ignores DOM ancestors, including transformed ones', async ({page}) => {
    const result = await place(page, {
      html: '<div id="ancestor"><dialog id="float"></dialog></div><div id="anchor"></div>',
      style: `
        #ancestor { margin: 200px; transform: translateX(40px); }
        ${ANCHOR_CSS}
      `,
      bodyStyle: 'height: 3000px',
      activate: {type: 'modal'},
      scroll: [0, 400],
      settings: SETTINGS,
    })

    expectAttached(result, {anchorOffset: 4})
  })

  test('treats a non-modal dialog as a DOM-positioned element', async ({page}) => {
    const result = await place(page, {
      html: `
        <div id="panel"><dialog id="float"></dialog></div>
        <div id="anchor"></div>
      `,
      style: `
        #panel { position: relative; margin-left: 120px; margin-top: 400px; width: 500px; height: 200px; }
        ${ANCHOR_CSS}
        #float { position: absolute; }
      `,
      bodyStyle: 'height: 3000px',
      activate: {type: 'dialog'},
      settings: SETTINGS,
    })

    expect(result.computed.topLayer).toBe(false)
    expect(result.computed.position).toBe('absolute')
    expectAttached(result, {anchorOffset: 4})
  })
})
