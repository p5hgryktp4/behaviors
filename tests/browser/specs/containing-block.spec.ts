import {test, expect} from '@playwright/test'
import {place, expectAttached} from './support'

// Scenarios where the containing block is established by something other than the closest
// positioned ancestor: transforms, containment, positioned body/root elements. These are
// the cases where a `document.body` heuristic or a "position only" ancestor walk fails.

const SETTINGS = {side: 'outside-bottom', align: 'start', anchorOffset: 4}

const ANCHOR_CSS = `
  #anchor { position: absolute; left: 500px; top: 700px; width: 60px; height: 24px; background: #d0d7de; }
  #float { width: 140px; height: 48px; background: rgb(207 34 46 / 40%); }
`

test.describe('containing block resolution', () => {
  test('uses a transformed ancestor for absolutely positioned elements', async ({page}) => {
    const result = await place(page, {
      html: '<div id="ancestor"><div id="float"></div></div><div id="anchor"></div>',
      style: `
        #ancestor { margin: 150px; width: 300px; height: 300px; transform: translateX(30px); }
        ${ANCHOR_CSS}
        #float { position: absolute; }
      `,
      bodyStyle: 'height: 3000px',
      settings: SETTINGS,
    })

    expectAttached(result, {anchorOffset: 4})
  })

  test('uses a transformed ancestor for fixed positioned elements', async ({page}) => {
    const result = await place(page, {
      html: '<div id="ancestor"><div id="float"></div></div><div id="anchor"></div>',
      style: `
        #ancestor { margin: 150px; width: 300px; height: 300px; transform: translateZ(0); }
        ${ANCHOR_CSS}
        #float { position: fixed; }
      `,
      bodyStyle: 'height: 3000px',
      scroll: [0, 400],
      settings: SETTINGS,
    })

    expectAttached(result, {anchorOffset: 4})
  })

  test('does not let a merely positioned ancestor capture fixed elements', async ({page}) => {
    const result = await place(page, {
      html: '<div id="ancestor"><div id="float"></div></div><div id="anchor"></div>',
      style: `
        #ancestor { position: relative; margin: 150px; width: 300px; height: 300px; }
        ${ANCHOR_CSS}
        #float { position: fixed; }
      `,
      bodyStyle: 'height: 3000px',
      scroll: [0, 400],
      settings: SETTINGS,
    })

    expectAttached(result, {anchorOffset: 4})
  })

  test('uses a positioned body as the containing block', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float"></div>',
      style: `
        ${ANCHOR_CSS}
        #float { position: absolute; }
      `,
      bodyStyle: 'position: relative; margin: 120px 80px; height: 3000px',
      settings: SETTINGS,
    })

    expectAttached(result, {anchorOffset: 4})
  })

  test('uses a transformed body as the containing block for fixed elements', async ({page}) => {
    const result = await place(page, {
      html: '<div id="anchor"></div><div id="float"></div>',
      style: `
        ${ANCHOR_CSS}
        #float { position: fixed; }
      `,
      bodyStyle: 'margin: 0; height: 3000px; transform: translateX(40px)',
      scroll: [0, 400],
      settings: SETTINGS,
    })

    expectAttached(result, {anchorOffset: 4})
  })

  test('skips display: contents ancestors, which generate no box', async ({page}) => {
    const result = await place(page, {
      html: '<div id="ancestor"><div id="float"></div></div><div id="anchor"></div>',
      style: `
        #ancestor { display: contents; position: relative; }
        ${ANCHOR_CSS}
        #float { position: absolute; }
      `,
      bodyStyle: 'height: 3000px',
      settings: SETTINGS,
    })

    expectAttached(result, {anchorOffset: 4})
  })

  test('positions absolutely positioned elements inside a scrollable container', async ({page}) => {
    const result = await place(page, {
      html: `
        <div id="panel">
          <div id="spacer"></div>
          <div id="anchor"></div>
          <div id="float"></div>
        </div>
      `,
      style: `
        #panel { position: relative; overflow: auto; margin: 100px; width: 500px; height: 300px; }
        #spacer { height: 200px; }
        #anchor { position: absolute; left: 200px; top: 260px; width: 60px; height: 24px; }
        #float { position: absolute; width: 140px; height: 48px; }
      `,
      bodyStyle: 'height: 3000px',
      settings: SETTINGS,
    })

    expect(result.computed.position).toBe('absolute')
    expectAttached(result, {anchorOffset: 4})
  })
})
