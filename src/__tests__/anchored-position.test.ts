import {PositionSettings, getAnchoredPosition} from '../anchored-position.js'

/*

Note: In each test below, we check the calculation from getAnchoredPosition against exact
values. For each `expect` call, there is an accompanying comment that distills the effective
calculation from the inputs, which may help debugging in the event of a test failure.

*/

// The DOMRect constructor isn't available in JSDOM, so we improvise here.
function makeDOMRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON() {
      return this
    },
  }
}

// Since Jest/JSDOM doesn't support layout, we can stub out getBoundingClientRect if we know the
// correct dimensions. JSDOM will handle the rest of the DOM API used by getAnchoredPosition.
function createVirtualDOM(
  parentRect: DOMRect,
  anchorRect: DOMRect,
  floatingRect: DOMRect,
  parentBorders: {top: number; right: number; bottom: number; left: number} = {top: 0, right: 0, bottom: 0, left: 0},
) {
  const parent = document.createElement('div')
  parent.style.overflow = 'hidden'
  parent.style.position = 'relative'
  parent.style.borderTopWidth = `${parentBorders.top}px`
  parent.style.borderRightWidth = `${parentBorders.right}px`
  parent.style.borderBottomWidth = `${parentBorders.bottom}px`
  parent.style.borderLeftWidth = `${parentBorders.left}px`
  parent.id = 'parent'
  parent.innerHTML = '<div id="float"></div><div id="anchor"></div>'
  const float = parent.querySelector('#float')!

  const anchor = parent.querySelector('#anchor')!
  anchor.getBoundingClientRect = () => anchorRect
  parent.getBoundingClientRect = () => parentRect
  float.getBoundingClientRect = () => floatingRect
  return {float, parent, anchor}
}

// jsdom has no top layer, so simulate it by making `matches()` report the selector a
// browser would match for a top-layer element (`:modal` or `:popover-open`).
function markAsTopLayer(element: Element, selector: ':modal' | ':popover-open') {
  const originalMatches = element.matches.bind(element)
  Object.defineProperty(element, 'matches', {
    configurable: true,
    value: (value: string) => value === selector || originalMatches(value),
  })
}

describe('getAnchoredPosition', () => {
  it('returns the correct position in the default case with no overflow', () => {
    const anchorRect = makeDOMRect(300, 200, 50, 50)
    const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
    document.body.innerHTML = '<div id="float"></div><div id="anchor"></div>'
    const float = document.querySelector('#float')!
    const anchor = document.querySelector('#anchor')!
    float.getBoundingClientRect = () => floatingRect
    anchor.getBoundingClientRect = () => anchorRect
    document.body.getBoundingClientRect = () => makeDOMRect(0, 0, 1920, 0)
    Object.defineProperty(window, 'innerHeight', {get: () => 1080})
    const settings: Partial<PositionSettings> = {anchorOffset: 4}
    const {top, left} = getAnchoredPosition(float, anchor, settings)
    expect(top).toEqual(254)
    expect(left).toEqual(300)
  })

  it('returns the correct position in the case of top-layer elements', () => {
    const anchorRect = makeDOMRect(300, 200, 50, 50)
    const parentRect = makeDOMRect(800, 600, 50, 50)
    const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
    document.body.innerHTML = '<div><dialog id="float"></dialog><div id="anchor"></div></div>'
    const parent = document.querySelector('div')!
    parent.style.overflow = 'hidden'
    parent.style.position = 'relative'
    const float = document.querySelector('#float')!
    const anchor = document.querySelector('#anchor')!
    parent.getBoundingClientRect = () => parentRect
    float.getBoundingClientRect = () => floatingRect
    anchor.getBoundingClientRect = () => anchorRect
    document.body.getBoundingClientRect = () => makeDOMRect(0, 0, 1920, 0)
    Object.defineProperty(window, 'innerHeight', {get: () => 1080})
    markAsTopLayer(float, ':modal')
    const settings: Partial<PositionSettings> = {anchorOffset: 4}
    const {top, left} = getAnchoredPosition(float, anchor, settings)
    expect(top).toEqual(254)
    expect(left).toEqual(300)
  })

  it('returns the correct position in the default case with no overflow, inside a clipping parent', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(300, 200, 50, 50)
    const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {anchorOffset: 4}

    const {top, left} = getAnchoredPosition(float, anchor, settings)

    expect(top).toEqual(234)
    expect(left).toEqual(280)
  })

  it('returns the correct position for different outside side settings with no overflow', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(300, 200, 50, 50)
    const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {}
    let top = 0
    let left = 0

    // should be the same calculation as the default settings test above
    settings.side = 'outside-bottom'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))
    expect(top).toEqual(234) // anchorRect.top + anchorRect.height + (settings.anchorOffset ?? 4) - parentRect.top
    expect(left).toEqual(280) // anchorRect.left - parentRect.left

    settings.side = 'outside-left'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))
    expect(top).toEqual(180) // anchorRect.top - parentRect.top
    expect(left).toEqual(176) // anchorRect.left - floatingRect.width - (settings.anchorOffset ?? 4) - parentRect.left

    settings.side = 'outside-right'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))
    expect(top).toEqual(180) // anchorRect.top - parentRect.top
    expect(left).toEqual(334) // anchorRect.left + anchorRect.width + (settings.anchorOffset ?? 4) - parentRect.left

    settings.side = 'outside-top'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))
    expect(top).toEqual(76) // anchorRect.top - floatingRect.height - (settings.anchorOffset ?? 4) - parentRect.top
    expect(left).toEqual(280) // anchorRect.left - parentRect.left
  })

  it('returns the correct position for different inside side settings', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(300, 200, 50, 50)
    const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {}
    let top = 0
    let left = 0

    settings.side = 'inside-bottom'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))

    // anchorRect.top + anchorRect.height - (settings.anchorOffset ?? 4) - floatingRect.height - parentRect.top
    expect(top).toEqual(126)
    // anchorRect.left + (settings.alignmentOffset ?? 4) - parentRect.left
    expect(left).toEqual(284)

    settings.side = 'inside-left'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))
    expect(top).toEqual(184) // anchorRect.top + (settings.alignmentOffset ?? 4) - parentRect.top
    expect(left).toEqual(284) // anchorRect.left + (settings.anchorOffset ?? 4) - parentRect.left

    settings.side = 'inside-right'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))

    // anchorRect.top + (settings.alignmentOffset ?? 4) - parentRect.top
    expect(top).toEqual(184)
    // anchorRect.left + anchorRect.width - (settings.anchorOffset ?? 4) - floatingRect.width - parentRect.left
    expect(left).toEqual(226)

    // almost the same as inside-left, with the exception of offsets
    settings.side = 'inside-top'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))
    expect(top).toEqual(184) // anchorRect.top + (settings.anchorOffset ?? 4) - parentRect.top
    expect(left).toEqual(284) // anchorRect.left + (settings.alignmentOffset ?? 4) - parentRect.left

    settings.side = 'inside-center'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))
    expect(top).toEqual(184) // anchorRect.top + (settings.alignmentOffset ?? 4) - parentRect.top
    expect(left).toEqual(255) // anchorRect.left + anchorRect.width / 2 - floatingRect.width / 2 - parentRect.left
  })

  it('returns the correct position inside centering along both axes', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(300, 200, 50, 50)
    const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {side: 'inside-center', align: 'center'}

    const {top, left} = getAnchoredPosition(float, anchor, settings)

    expect(top).toEqual(155) // anchorRect.top + anchorRect.height / 2 - floatingRect.height / 2 - parentRect.top
    expect(left).toEqual(255) // anchorRect.left + anchorRect.width / 2 - floatingRect.width / 2 - parentRect.left
  })

  it('returns the correct position for different alignment settings with no overflow', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(300, 200, 50, 50)
    const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {}
    let top = 0
    let left = 0

    settings.align = 'start'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))
    expect(top).toEqual(234) // anchorRect.top + anchorRect.height + (settings.anchorOffset ?? 4) - parentRect.top
    expect(left).toEqual(280) // anchorRect.left + (settings.alignmentOffset ?? 0) - parentRect.left

    settings.align = 'center'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))

    // anchorRect.top + anchorRect.height + (settings.anchorOffset ?? 4) - parentRect.top
    expect(top).toEqual(234)
    // anchorRect.left + anchorRect.width / 2 - floatingRect.width / 2 + (settings.anchorOffset ?? 0) - parentRect.left
    expect(left).toEqual(255)

    settings.align = 'end'
    ;({top, left} = getAnchoredPosition(float, anchor, settings))

    // anchorRect.top + anchorRect.height + (settings.anchorOffset ?? 4) - parentRect.top
    expect(top).toEqual(234)
    // anchorRect.left + anchorRect.width - floatingRect.width - (settings.alignmentOffset ?? 0) - parentRect.left
    expect(left).toEqual(230)
  })

  it('properly flips to the opposite side if the calculated position overflows along the same axis', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(300, 400, 50, 50)
    const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {}

    const {top, left} = getAnchoredPosition(float, anchor, settings)

    expect(top).toEqual(276) // anchorRect.top - floatingRect.height - (settings.anchorOffset ?? 4) - parentRect.top
    expect(left).toEqual(280) // anchorRect.left - parentRect.left
  })

  it('properly moves to an adjacent side if overflow happens along side edge and flipped edge', () => {
    const parentRect = makeDOMRect(20, 20, 500, 200)
    const anchorRect = makeDOMRect(300, 100, 50, 50)
    const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {}

    const {top, left} = getAnchoredPosition(float, anchor, settings)

    expect(top).toEqual(80) // anchorRect.top - parentRect.top
    expect(left).toEqual(334) // anchorRect.left + anchorRect.width + (settings.anchorOffset ?? 4) - parentRect.left
  })

  it('properly adjusts the position using an alignment offset if overflow happens along the alignment edge', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(300, 200, 50, 50)
    const floatingRect = makeDOMRect(NaN, NaN, 400, 100)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {}

    const {top, left} = getAnchoredPosition(float, anchor, settings)

    expect(top).toEqual(234) // anchorRect.top + anchorRect.height + (settings.anchorOffset ?? 4) - parentRect.top
    expect(left).toEqual(100) // parentRect.width - floatingRect.width
  })

  it('properly calculates the position that needs to be flipped and offset-adjusted', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(300, 400, 50, 50)
    const floatingRect = makeDOMRect(NaN, NaN, 400, 100)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {}

    const {top, left} = getAnchoredPosition(float, anchor, settings)

    expect(top).toEqual(276) // anchorRect.top - floatingRect.height - (settings.anchorOffset ?? 4) - parentRect.top
    expect(left).toEqual(100) // parentRect.width - floatingRect.width
  })

  it('properly calculates the outside position with many simultaneous settings interactions (stress test)', () => {
    const parentRect = makeDOMRect(20, 20, 200, 500)
    const anchorRect = makeDOMRect(95, 295, 100, 200)
    const floatingRect = makeDOMRect(NaN, NaN, 175, 200)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {
      side: 'outside-right',
      align: 'center',
      alignmentOffset: 10,
      anchorOffset: -10,
    }

    const {top, left} = getAnchoredPosition(float, anchor, settings)

    // expect to try right, left, and bottom before ending on top
    expect(top).toEqual(85) // anchorRect.top - floatingRect.height - (settings.anchorOffset ?? 4) - parentRect.top

    // expect center alignment to run against edge, so ignored. Also causes alignment offset to be ignored.
    expect(left).toEqual(25) // parentRect.width - floatingRect.width
  })

  it('properly calculates the inside position with many simultaneous settings interactions (stress test)', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(100, 100, 300, 300)
    const floatingRect = makeDOMRect(NaN, NaN, 100, 200)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {
      side: 'inside-right',
      align: 'center',
      alignmentOffset: 10,
      anchorOffset: -10,
    }

    const {top, left} = getAnchoredPosition(float, anchor, settings)

    // anchorRect.top + anchorRect.height / 2 - floatingRect.height / 2 + (settings.alignmentOffset ?? 4) - parentRect.top
    expect(top).toEqual(140)

    // anchorRect.left + anchorRect.width - floatingRect.width - (settings.anchorOffset ?? 4) - parentRect.left
    expect(left).toEqual(290)
  })

  it('properly calculates the position when alignment needs to be flipped', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(450, 20, 50, 50) // right aligned square, at the edge
    const floatingRect = makeDOMRect(NaN, NaN, 100, 50)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {side: 'outside-bottom', align: 'start'} // but there's not enough room for that

    const {top, left, anchorAlign} = getAnchoredPosition(float, anchor, settings)
    expect(top).toEqual(54) // anchorRect.top - parentRect.top + anchorRect.height + (settings.anchorOffset ?? 4)

    /**
     * with align:start, left = anchorRect.left - parentTop.left = 430
     * and right = left + floatingRect.width = 530
     * which would overflow parentRect.left + parentRect.width = 520
     * so it should flip to align:end
     */
    expect(anchorAlign).toEqual('end')
    // based on align:end, anchorRect.left + anchorRect.width - parentRect.left - floatingRect.width
    expect(left).toEqual(380)
  })

  it('properly calculates the position when only side needs to be flipped', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(450, 20, 50, 50) // right aligned square, at the edge
    const floatingRect = makeDOMRect(NaN, NaN, 100, 50)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)

    // not enough space for specified side or alignment
    const settings: Partial<PositionSettings> = {side: 'outside-right', align: 'start'}

    const {top, left, anchorSide, anchorAlign} = getAnchoredPosition(float, anchor, settings)
    expect(top).toEqual(0) // anchorRect.top - parentRect.top

    expect(anchorSide).toEqual('outside-left') // flipped
    expect(anchorAlign).toEqual('start') // no need to flip
    expect(left).toEqual(326) // anchorRect.left - floatingRect.width - (settings.anchorOffset ?? 4) - parentRect.left
  })

  it('properly calculates the position when both side and alignment need to be flipped', () => {
    const parentRect = makeDOMRect(20, 20, 500, 500)
    const anchorRect = makeDOMRect(450, 20, 50, 50) // right aligned square, at the edge
    const floatingRect = makeDOMRect(NaN, NaN, 100, 50)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)

    // not enough space for specified side or alignment
    const settings: Partial<PositionSettings> = {side: 'outside-top', align: 'start'}

    const {top, left, anchorSide, anchorAlign} = getAnchoredPosition(float, anchor, settings)
    expect(anchorSide).toEqual('outside-bottom')
    expect(anchorAlign).toEqual('end')
    expect(top).toEqual(54) // anchorRect.top + anchorRect.height + (settings.anchorOffset ?? 4) - parentRect.top
    expect(left).toEqual(380) // anchorRect.left + anchorRect.width - parentRect.left - floatingRect.width
  })

  // This test runs for values derived from a real use case https://github.com/github/accessibility-audits/issues/4515 as seen on a local storybook.
  it('should overflow to bottom if the element is too tall to fit on the screen when zoomed', () => {
    const parentRect = makeDOMRect(0, 0, 400, 400)
    const anchorRect = makeDOMRect(16, 16, 32, 32) // left aligned button
    const floatingRect = makeDOMRect(0, 0, 256, 428)
    const {float, anchor} = createVirtualDOM(parentRect, anchorRect, floatingRect)
    const settings: Partial<PositionSettings> = {side: 'outside-bottom', align: 'start'}
    const {top, left, anchorSide, anchorAlign} = getAnchoredPosition(float, anchor, settings)
    expect(anchorSide).toEqual('outside-right')
    expect(anchorAlign).toEqual('start')
    expect(top).toEqual(0)
    expect(left).toEqual(52)
  })

  describe('getComputedStyle optimization', () => {
    it('should make fewer getComputedStyle calls with deeply nested DOM', () => {
      const parentRect = makeDOMRect(20, 20, 500, 500)
      const anchorRect = makeDOMRect(300, 200, 50, 50)
      const floatingRect = makeDOMRect(NaN, NaN, 100, 100)

      // Create a deeply nested DOM structure
      const root = document.createElement('div')
      root.style.overflow = 'hidden'
      root.style.position = 'relative'
      root.style.borderTopWidth = '0px'
      root.style.borderRightWidth = '0px'
      root.style.borderBottomWidth = '0px'
      root.style.borderLeftWidth = '0px'
      root.getBoundingClientRect = () => parentRect

      // Create 5 intermediate divs (none positioned, none clipping)
      let currentParent = root
      for (let i = 0; i < 5; i++) {
        const div = document.createElement('div')
        div.id = `intermediate-${i}`
        div.style.position = 'static'
        div.style.overflow = 'visible'
        currentParent.appendChild(div)
        currentParent = div
      }

      const float = document.createElement('div')
      float.id = 'float'
      float.getBoundingClientRect = () => floatingRect
      currentParent.appendChild(float)

      const anchor = document.createElement('div')
      anchor.id = 'anchor'
      anchor.getBoundingClientRect = () => anchorRect
      currentParent.appendChild(anchor)

      // Mock getComputedStyle to track calls
      const originalGetComputedStyle = window.getComputedStyle
      let callCount = 0
      const getComputedStyleSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => {
        callCount++
        return originalGetComputedStyle(element)
      })

      const settings: Partial<PositionSettings> = {anchorOffset: 4}
      const result = getAnchoredPosition(float, anchor, settings)

      // Verify the result is correct
      expect(result.top).toBeDefined()
      expect(result.left).toBeDefined()

      // With cached styles, the implementation makes:
      // - 1 call for the floating element's own computed style
      // - 5 calls during traversal (one for each intermediate div)
      // - 1 call for root during traversal (finds both the containing block and the
      //   clipping node, and caches its style)
      // - 0 additional calls (clipping rect and containing block borders reuse the
      //   cached style from traversal)
      // Total: 1 + 5 + 1 = 7 calls
      //
      // Without caching it would be:
      // - 6 calls for the containing block traversal (5 intermediate + 1 root)
      // - 6 calls for getClippingRect traversal (5 intermediate + 1 root)
      // - 1 call for the containing block borders
      // - 1 call for the clipping rect borders (same element but separate call)
      // Total: 6 + 6 + 1 + 1 = 14 calls, plus the floating element's style
      //
      // Caching roughly halves the getComputedStyle calls (14+1 -> 7)
      expect(callCount).toBe(7)
      expect(callCount).toBeGreaterThan(0)

      getComputedStyleSpy.mockRestore()
    })

    it('should keep getComputedStyle calls minimal when there is no positioned ancestor', () => {
      const anchorRect = makeDOMRect(300, 200, 50, 50)
      const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
      document.body.innerHTML = '<div id="float"></div><div id="anchor"></div>'
      const float = document.querySelector('#float')!
      const anchor = document.querySelector('#anchor')!
      float.getBoundingClientRect = () => floatingRect
      anchor.getBoundingClientRect = () => anchorRect

      const originalGetComputedStyle = window.getComputedStyle
      let callCount = 0
      const getComputedStyleSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => {
        callCount++
        return originalGetComputedStyle(element)
      })

      getAnchoredPosition(float, anchor, {anchorOffset: 4})

      // 1 call for the floating element + 1 for <body> + 1 for <html>
      expect(callCount).toBe(3)

      getComputedStyleSpy.mockRestore()
    })

    it('should handle case where positioned parent is same as clipping node', () => {
      const parentRect = makeDOMRect(20, 20, 500, 500)
      const anchorRect = makeDOMRect(300, 200, 50, 50)
      const floatingRect = makeDOMRect(NaN, NaN, 100, 100)

      // Create a single parent that is both positioned and clipping
      const parent = document.createElement('div')
      parent.style.overflow = 'hidden'
      parent.style.position = 'relative'
      parent.style.borderTopWidth = '0px'
      parent.style.borderRightWidth = '0px'
      parent.style.borderBottomWidth = '0px'
      parent.style.borderLeftWidth = '0px'
      parent.getBoundingClientRect = () => parentRect

      const float = document.createElement('div')
      float.getBoundingClientRect = () => floatingRect
      parent.appendChild(float)

      const anchor = document.createElement('div')
      anchor.getBoundingClientRect = () => anchorRect
      parent.appendChild(anchor)

      const settings: Partial<PositionSettings> = {anchorOffset: 4}
      const result = getAnchoredPosition(float, anchor, settings)

      // Should work correctly when both are the same element
      // With default side='outside-bottom', align='start':
      expect(result.top).toEqual(234) // anchorRect.top + anchorRect.height + anchorOffset - parentRect.top
      expect(result.left).toEqual(280) // anchorRect.left - parentRect.left
    })

    it('should handle case where positioned parent is found before clipping node', () => {
      const parentRect = makeDOMRect(20, 20, 500, 500)
      const clippingRect = makeDOMRect(10, 10, 600, 600)
      const anchorRect = makeDOMRect(300, 200, 50, 50)
      const floatingRect = makeDOMRect(NaN, NaN, 100, 100)

      // Create outer clipping node
      const clippingNode = document.createElement('div')
      clippingNode.style.overflow = 'hidden'
      clippingNode.style.position = 'static'
      clippingNode.style.borderTopWidth = '0px'
      clippingNode.style.borderRightWidth = '0px'
      clippingNode.style.borderBottomWidth = '0px'
      clippingNode.style.borderLeftWidth = '0px'
      clippingNode.getBoundingClientRect = () => clippingRect

      // Create inner positioned parent
      const parent = document.createElement('div')
      parent.style.overflow = 'visible'
      parent.style.position = 'relative'
      parent.style.borderTopWidth = '0px'
      parent.style.borderRightWidth = '0px'
      parent.style.borderBottomWidth = '0px'
      parent.style.borderLeftWidth = '0px'
      parent.getBoundingClientRect = () => parentRect
      clippingNode.appendChild(parent)

      const float = document.createElement('div')
      float.getBoundingClientRect = () => floatingRect
      parent.appendChild(float)

      const anchor = document.createElement('div')
      anchor.getBoundingClientRect = () => anchorRect
      parent.appendChild(anchor)

      const settings: Partial<PositionSettings> = {anchorOffset: 4}
      const result = getAnchoredPosition(float, anchor, settings)

      // Should work correctly when positioned parent is closer than clipping node
      // Position is calculated relative to the positioned parent (inner element)
      expect(result.top).toEqual(234) // anchorRect.top + anchorRect.height + anchorOffset - parentRect.top
      expect(result.left).toEqual(280) // anchorRect.left - parentRect.left
    })

    it('should handle case where clipping node is found before positioned parent', () => {
      const clippingRect = makeDOMRect(20, 20, 500, 500)
      const parentRect = makeDOMRect(10, 10, 600, 600)
      const anchorRect = makeDOMRect(300, 200, 50, 50)
      const floatingRect = makeDOMRect(NaN, NaN, 100, 100)

      // Create outer positioned parent
      const positionedParent = document.createElement('div')
      positionedParent.style.overflow = 'visible'
      positionedParent.style.position = 'relative'
      positionedParent.style.borderTopWidth = '0px'
      positionedParent.style.borderRightWidth = '0px'
      positionedParent.style.borderBottomWidth = '0px'
      positionedParent.style.borderLeftWidth = '0px'
      positionedParent.getBoundingClientRect = () => parentRect

      // Create inner clipping node
      const clippingNode = document.createElement('div')
      clippingNode.style.overflow = 'hidden'
      clippingNode.style.position = 'static'
      clippingNode.style.borderTopWidth = '0px'
      clippingNode.style.borderRightWidth = '0px'
      clippingNode.style.borderBottomWidth = '0px'
      clippingNode.style.borderLeftWidth = '0px'
      clippingNode.getBoundingClientRect = () => clippingRect
      positionedParent.appendChild(clippingNode)

      const float = document.createElement('div')
      float.getBoundingClientRect = () => floatingRect
      clippingNode.appendChild(float)

      const anchor = document.createElement('div')
      anchor.getBoundingClientRect = () => anchorRect
      clippingNode.appendChild(anchor)

      const settings: Partial<PositionSettings> = {anchorOffset: 4}
      const result = getAnchoredPosition(float, anchor, settings)

      // Should work correctly when clipping node is closer than positioned parent
      // Position is calculated relative to the positioned parent (outer element)
      expect(result.top).toEqual(244) // anchorRect.top + anchorRect.height + anchorOffset - parentRect.top
      expect(result.left).toEqual(290) // anchorRect.left - parentRect.left
    })
  })

  describe('displayInViewport option', () => {
    beforeEach(() => {
      // Mock window dimensions for consistent testing
      Object.defineProperty(window, 'innerWidth', {value: 1024, writable: true})
      Object.defineProperty(window, 'innerHeight', {value: 768, writable: true})
    })

    it('defaults to false when not specified', () => {
      const anchorRect = makeDOMRect(300, 200, 50, 50)
      const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
      const {float, anchor} = createVirtualDOM(makeDOMRect(20, 20, 1920, 1080), anchorRect, floatingRect)

      const {top, left} = getAnchoredPosition(float, anchor, {side: 'outside-bottom'})

      // Should use normal clipping behavior (relative to clipping parent)
      expect(top).toEqual(234) // anchorRect.top + anchorRect.height + 4 - parentRect.top
      expect(left).toEqual(280) // anchorRect.left - parentRect.left
    })

    it('constrains to visible viewport when set to true', () => {
      const anchorRect = makeDOMRect(950, 700, 50, 50) // Near bottom-right of viewport
      const floatingRect = makeDOMRect(NaN, NaN, 200, 200) // Large floating element
      const {float, anchor} = createVirtualDOM(
        makeDOMRect(0, 0, 2000, 2000), // Large container
        anchorRect,
        floatingRect,
      )

      const {top, left} = getAnchoredPosition(float, anchor, {
        side: 'outside-bottom',
        displayInViewport: true,
      })

      // Should be constrained to fit within viewport (1024x768)
      expect(left).toBeLessThanOrEqual(1024 - 200) // left + width <= viewport width
      expect(top + 200).toBeLessThanOrEqual(768) // top + height <= viewport height
    })

    it('flips to top when bottom would exceed viewport height', () => {
      const anchorRect = makeDOMRect(400, 700, 50, 50) // Near bottom of viewport
      const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
      const {float, anchor} = createVirtualDOM(makeDOMRect(0, 0, 1920, 1080), anchorRect, floatingRect)

      const {top, anchorSide} = getAnchoredPosition(float, anchor, {
        side: 'outside-bottom',
        displayInViewport: true,
      })

      // Should flip to top side to fit in viewport
      expect(anchorSide).toEqual('outside-top')
      expect(top).toBeGreaterThanOrEqual(0)
      expect(top + 100).toBeLessThanOrEqual(768)
    })

    it('adjusts left position when right edge would exceed viewport width', () => {
      const anchorRect = makeDOMRect(950, 300, 50, 50) // Near right edge of viewport
      const floatingRect = makeDOMRect(NaN, NaN, 150, 100)
      const {float, anchor} = createVirtualDOM(makeDOMRect(0, 0, 1920, 1080), anchorRect, floatingRect)

      const {left} = getAnchoredPosition(float, anchor, {
        side: 'outside-bottom',
        align: 'start',
        displayInViewport: true,
      })

      // Should be pushed left to fit in viewport
      expect(left + 150).toBeLessThanOrEqual(1024) // left + width <= viewport width
    })

    it('works with inside positioning', () => {
      const anchorRect = makeDOMRect(100, 100, 800, 600) // Large anchor covering most viewport
      const floatingRect = makeDOMRect(NaN, NaN, 200, 100)
      const {float, anchor} = createVirtualDOM(makeDOMRect(0, 0, 1920, 1080), anchorRect, floatingRect)

      const {top, left} = getAnchoredPosition(float, anchor, {
        side: 'inside-center',
        align: 'center',
        displayInViewport: true,
      })

      // Should position inside the anchor and within viewport
      expect(left).toBeGreaterThanOrEqual(0)
      expect(top).toBeGreaterThanOrEqual(0)
      expect(left + 200).toBeLessThanOrEqual(1024)
      expect(top + 100).toBeLessThanOrEqual(768)
    })

    it('still respects allowOutOfBounds when both options are set', () => {
      const anchorRect = makeDOMRect(950, 700, 50, 50)
      const floatingRect = makeDOMRect(NaN, NaN, 200, 200)
      const {float, anchor} = createVirtualDOM(makeDOMRect(0, 0, 1920, 1080), anchorRect, floatingRect)

      const {top, left} = getAnchoredPosition(float, anchor, {
        side: 'outside-bottom',
        displayInViewport: true,
        allowOutOfBounds: true,
      })

      // When allowOutOfBounds is true, should allow overflow even with displayInViewport
      // The exact behavior depends on implementation, but it should not throw an error
      expect(typeof top).toBe('number')
      expect(typeof left).toBe('number')
    })

    it('handles edge case when anchor is outside viewport', () => {
      const anchorRect = makeDOMRect(1200, 900, 50, 50) // Outside 1024x768 viewport
      const floatingRect = makeDOMRect(NaN, NaN, 100, 100)
      const {float, anchor} = createVirtualDOM(makeDOMRect(0, 0, 2000, 2000), anchorRect, floatingRect)

      const {top, left} = getAnchoredPosition(float, anchor, {
        side: 'outside-bottom',
        displayInViewport: true,
      })

      // When anchor is outside viewport, the position calculation should still work
      // but the final nudging should ensure no part of the floating element exceeds viewport
      // Since the anchor is at (1200, 900) with 'outside-bottom', the floating element
      // would initially be positioned around (1200, 954), which exceeds viewport bounds
      // The displayInViewport option should constrain this
      expect(left + 100).toBeLessThanOrEqual(1024) // right edge within viewport
      expect(top + 100).toBeLessThanOrEqual(768) // bottom edge within viewport
    })
  })

  // Regression tests for https://github.com/primer/behaviors/issues/242: the offsets
  // returned by `getAnchoredPosition` must be relative to the floating element's real CSS
  // containing block. `document.body` is not that block unless it is itself positioned,
  // which used to make a body margin or border shift top-layer overlays (tooltips,
  // popovers, dialogs) and other elements without a positioned ancestor.
  //
  // jsdom has no layout engine, so rectangles and viewport/document metrics are stubbed
  // per test. Real-browser coverage lives in `tests/browser` (Playwright).
  describe('containing block resolution (#242)', () => {
    const originalBodyRect = document.body.getBoundingClientRect
    const originalDocumentElementRect = document.documentElement.getBoundingClientRect
    const defaultViewport = {width: window.innerWidth, height: window.innerHeight}
    const defaultScroll = {x: window.scrollX, y: window.scrollY}

    afterEach(() => {
      document.documentElement.removeAttribute('style')
      document.body.removeAttribute('style')
      document.body.innerHTML = ''
      document.body.getBoundingClientRect = originalBodyRect
      document.documentElement.getBoundingClientRect = originalDocumentElementRect
      delete (document.documentElement as Partial<HTMLElement>).scrollHeight
      stubViewport({...defaultViewport, scrollX: defaultScroll.x, scrollY: defaultScroll.y})
    })

    function stubViewport({
      width = 1024,
      height = 1080,
      scrollX = 0,
      scrollY = 0,
    }: {width?: number; height?: number; scrollX?: number; scrollY?: number} = {}) {
      Object.defineProperty(window, 'innerWidth', {configurable: true, value: width, writable: true})
      Object.defineProperty(window, 'innerHeight', {configurable: true, value: height, writable: true})
      Object.defineProperty(window, 'scrollX', {configurable: true, value: scrollX, writable: true})
      Object.defineProperty(window, 'scrollY', {configurable: true, value: scrollY, writable: true})
    }

    function stubDocumentHeight(height: number) {
      Object.defineProperty(document.documentElement, 'scrollHeight', {configurable: true, value: height})
    }

    function stubRect(element: Element, rect: DOMRect) {
      element.getBoundingClientRect = () => rect
    }

    function stubBodyRect({left = 0, top = 0, width = 1024, height = 2400} = {}) {
      document.body.getBoundingClientRect = () => makeDOMRect(left, top, width, height)
    }

    interface FixtureOptions {
      /** Styles for wrapper elements between <body> and the floating element, outermost first. */
      ancestors?: string[]
      floatingStyle?: string
      anchorRect?: DOMRect
      floatingRect?: DOMRect
      topLayerSelector?: ':modal' | ':popover-open'
    }

    function render({
      ancestors = [],
      floatingStyle = 'position: absolute',
      anchorRect = makeDOMRect(300, 200, 50, 50),
      floatingRect = makeDOMRect(NaN, NaN, 100, 100),
      topLayerSelector,
    }: FixtureOptions = {}) {
      const float = document.createElement('div')
      float.id = 'float'
      float.setAttribute('style', floatingStyle)
      float.getBoundingClientRect = () => floatingRect

      let parent: HTMLElement = document.body
      for (const [index, style] of ancestors.entries()) {
        const wrapper = document.createElement('div')
        wrapper.id = `ancestor-${index}`
        wrapper.setAttribute('style', style)
        // Give each ancestor a distinct, known rect so origins are easy to verify.
        wrapper.getBoundingClientRect = () => makeDOMRect(100 + index * 10, 100 + index * 10, 500, 500)
        parent.appendChild(wrapper)
        parent = wrapper
      }
      parent.appendChild(float)

      const anchor = document.createElement('div')
      anchor.id = 'anchor'
      anchor.getBoundingClientRect = () => anchorRect
      document.body.appendChild(anchor)

      if (topLayerSelector) markAsTopLayer(float, topLayerSelector)
      return {float, anchor, floatingRect}
    }

    describe('top-layer elements (modal dialogs and native popovers)', () => {
      it('ignores body margins and borders for absolutely positioned top-layer elements', () => {
        stubViewport()
        stubBodyRect({left: 200, top: 50})
        document.body.style.borderTopWidth = '10px'
        document.body.style.borderLeftWidth = '20px'
        // github.com's <tool-tip> is a popover with author `position: absolute`.
        const {float, anchor} = render({topLayerSelector: ':popover-open'})

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(254) // anchorRect.top + anchorRect.height + anchorOffset
        expect(left).toEqual(300) // anchorRect.left
      })

      it('ignores a positioned DOM wrapper and scroll offsets', () => {
        stubViewport({scrollX: 100, scrollY: 400})
        stubBodyRect({left: 200, top: 30})
        document.body.style.position = 'relative'
        const {float, anchor} = render({
          ancestors: ['position: relative; overflow: hidden'],
          topLayerSelector: ':modal',
        })

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        // Page coordinates: the initial containing block origin is (-scrollX, -scrollY)
        expect(top).toEqual(654) // 254 + scrollY
        expect(left).toEqual(400) // 300 + scrollX
      })

      it('uses viewport coordinates for fixed positioned top-layer elements (modal dialogs)', () => {
        stubViewport({scrollX: 100, scrollY: 400})
        stubBodyRect({left: 20, top: 30})
        const {float, anchor} = render({floatingStyle: 'position: fixed', topLayerSelector: ':modal'})

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(254) // anchorRect.top + anchorRect.height + anchorOffset
        expect(left).toEqual(300) // anchorRect.left
      })

      it('flips sides in page coordinates near the top of the document', () => {
        stubViewport()
        stubBodyRect({left: 200, top: 50})
        const {float, anchor} = render({
          anchorRect: makeDOMRect(300, 10, 50, 50),
          topLayerSelector: ':popover-open',
        })

        const {top, left, anchorSide} = getAnchoredPosition(float, anchor, {
          side: 'outside-top',
          align: 'start',
          anchorOffset: 4,
        })

        expect(anchorSide).toEqual('outside-bottom')
        expect(top).toEqual(64)
        expect(left).toEqual(300)
      })

      it('flips sides in page coordinates near the right edge of the viewport', () => {
        stubViewport()
        stubBodyRect({left: 200, top: 50})
        const {float, anchor} = render({
          anchorRect: makeDOMRect(950, 200, 50, 50),
          topLayerSelector: ':popover-open',
        })

        const {top, left, anchorSide} = getAnchoredPosition(float, anchor, {
          side: 'outside-right',
          align: 'start',
          anchorOffset: 4,
        })

        expect(anchorSide).toEqual('outside-left')
        expect(top).toEqual(200)
        expect(left).toEqual(846)
      })

      it('honors displayInViewport on a scrolled document', () => {
        stubViewport({scrollY: 400, height: 768})
        stubDocumentHeight(2400)
        const {float, anchor} = render({
          anchorRect: makeDOMRect(300, 700, 50, 50),
          topLayerSelector: ':popover-open',
        })

        const {top, left, anchorSide} = getAnchoredPosition(float, anchor, {
          side: 'outside-bottom',
          align: 'start',
          anchorOffset: 4,
          displayInViewport: true,
        })

        expect(anchorSide).toEqual('outside-top')
        expect(top).toEqual(996) // anchorRect.top + scrollY - anchorOffset - floatingRect.height
        expect(left).toEqual(300)
      })

      it('uses document space for overflow when displayInViewport is not set', () => {
        stubViewport({scrollY: 400, height: 768})
        stubDocumentHeight(2400)
        const {float, anchor} = render({
          anchorRect: makeDOMRect(300, 700, 50, 50),
          topLayerSelector: ':popover-open',
        })

        const {top, left, anchorSide} = getAnchoredPosition(float, anchor, {
          side: 'outside-bottom',
          align: 'start',
          anchorOffset: 4,
        })

        expect(anchorSide).toEqual('outside-bottom')
        expect(top).toEqual(1154)
        expect(left).toEqual(300)
      })

      it('clamps the alignment within the viewport horizontally', () => {
        stubViewport()
        stubBodyRect({left: 200, top: 50})
        const {float, anchor} = render({
          anchorRect: makeDOMRect(950, 200, 50, 50),
          topLayerSelector: ':popover-open',
        })

        const {top, left, anchorAlign} = getAnchoredPosition(float, anchor, {
          side: 'outside-bottom',
          align: 'start',
          anchorOffset: 4,
        })

        expect(anchorAlign).toEqual('end')
        expect(top).toEqual(254)
        expect(left).toEqual(900)
      })

      it('treats a non-modal dialog as a DOM-positioned element', () => {
        stubViewport()
        const {float, anchor} = render({
          ancestors: ['position: relative'],
          floatingStyle: 'position: absolute',
        })

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        // Not in the top layer: the positioned ancestor is the containing block
        expect(top).toEqual(154) // 254 - ancestorRect.top
        expect(left).toEqual(200) // 300 - ancestorRect.left
      })
    })

    describe('containing block chain', () => {
      it('ignores body margins for absolutely positioned elements without a positioned ancestor', () => {
        stubViewport()
        stubBodyRect({left: 200, top: 50})
        const {float, anchor} = render()

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(254)
        expect(left).toEqual(300)
      })

      it('positions against the document origin when the document is scrolled', () => {
        stubViewport({scrollY: 400})
        stubBodyRect({left: 200, top: 50 - 400})
        const {float, anchor} = render()

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(654) // anchorRect.top + anchorRect.height + anchorOffset + scrollY
        expect(left).toEqual(300) // anchorRect.left + scrollX
      })

      it('includes horizontal scroll', () => {
        stubViewport({scrollX: 100})
        stubBodyRect({left: 200 - 100, top: 50})
        const {float, anchor} = render()

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(254)
        expect(left).toEqual(400) // anchorRect.left + scrollX
      })

      it('uses a transformed ancestor as the containing block for absolute elements', () => {
        stubViewport()
        const {float, anchor} = render({ancestors: ['transform: translateX(0.001px)']})

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(154) // 254 - ancestorRect.top
        expect(left).toEqual(200) // 300 - ancestorRect.left
      })

      it('uses a transformed ancestor as the containing block for fixed elements', () => {
        stubViewport({scrollY: 400})
        const {float, anchor} = render({
          ancestors: ['transform: translateZ(0)'],
          floatingStyle: 'position: fixed',
        })

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(154) // 254 - ancestorRect.top
        expect(left).toEqual(200) // 300 - ancestorRect.left
      })

      it('does not let a merely positioned ancestor capture fixed elements', () => {
        stubViewport({scrollY: 400})
        const {float, anchor} = render({
          ancestors: ['position: relative; overflow: hidden'],
          floatingStyle: 'position: fixed',
        })

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(254) // viewport coordinates
        expect(left).toEqual(300)
      })

      it('uses ancestors with will-change: transform as the containing block', () => {
        stubViewport()
        const {float} = render({floatingStyle: 'position: fixed', ancestors: ['will-change: transform']})
        const {top, left} = getAnchoredPosition(float, document.querySelector('#anchor')!, {anchorOffset: 4})
        expect(top).toEqual(154)
        expect(left).toEqual(200)
      })

      it('uses ancestors with contain: paint as the containing block', () => {
        stubViewport()
        const {float, anchor} = render({ancestors: ['contain: paint']})
        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})
        expect(top).toEqual(154)
        expect(left).toEqual(200)
      })

      it('uses ancestors with content-visibility: auto as the containing block', () => {
        stubViewport()
        const {float, anchor} = render({
          ancestors: ['content-visibility: auto'],
          floatingStyle: 'position: fixed',
        })
        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})
        expect(top).toEqual(154)
        expect(left).toEqual(200)
      })

      it('does not use ancestors that only create a stacking context', () => {
        stubViewport()
        const {float, anchor} = render({ancestors: ['isolation: isolate; opacity: 0.99']})
        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})
        expect(top).toEqual(254)
        expect(left).toEqual(300)
      })

      it('skips display: contents ancestors, which generate no box', () => {
        stubViewport()
        const {float, anchor} = render({ancestors: ['position: relative; display: contents']})
        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})
        expect(top).toEqual(254)
        expect(left).toEqual(300)
      })

      it('uses a positioned body as the containing block', () => {
        stubViewport()
        document.body.style.position = 'relative'
        stubBodyRect({left: 20, top: 30, width: 880, height: 2400})
        const {float, anchor} = render()

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(224) // 254 - bodyRect.top
        expect(left).toEqual(280) // 300 - bodyRect.left
      })

      it('adds the positioned body borders to the containing block', () => {
        stubViewport()
        document.body.style.position = 'relative'
        document.body.style.borderTopWidth = '10px'
        document.body.style.borderLeftWidth = '20px'
        stubBodyRect({left: 20, top: 30, width: 880, height: 2400})
        const {float, anchor} = render()

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(214) // 254 - bodyRect.top - borderTopWidth
        expect(left).toEqual(260) // 300 - bodyRect.left - borderLeftWidth
      })

      it('uses a transformed body as the containing block for fixed elements', () => {
        stubViewport()
        document.body.style.transform = 'translateX(0.001px)'
        stubBodyRect({left: 20, top: 30, width: 1000, height: 2400})
        const {float, anchor} = render({floatingStyle: 'position: fixed'})

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(224) // 254 - bodyRect.top
        expect(left).toEqual(280) // 300 - bodyRect.left
      })

      it('uses a positioned root element as the containing block', () => {
        stubViewport()
        document.documentElement.style.position = 'relative'
        stubRect(document.documentElement, makeDOMRect(10, 20, 1000, 500))
        const {float, anchor} = render()

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(234) // 254 - rootRect.top
        expect(left).toEqual(290) // 300 - rootRect.left
      })

      it('clamps the alignment within the viewport horizontally', () => {
        stubViewport()
        stubBodyRect({left: 200, top: 50})
        const {float, anchor} = render({anchorRect: makeDOMRect(950, 200, 50, 50)})

        const {top, left, anchorAlign} = getAnchoredPosition(float, anchor, {
          side: 'outside-bottom',
          align: 'start',
          anchorOffset: 4,
        })

        expect(anchorAlign).toEqual('end')
        expect(top).toEqual(254)
        expect(left).toEqual(900)
      })
    })

    describe('clipping ancestors', () => {
      it('ignores overflow below the containing block', () => {
        stubViewport()
        const {float, anchor} = render({
          // The positioned ancestor is the containing block; the overflow box below it
          // cannot clip the element, so the document's scrollable space is available.
          ancestors: ['position: relative', 'overflow: hidden'],
          anchorRect: makeDOMRect(220, 270, 20, 20),
        })

        const {top, left, anchorSide} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(anchorSide).toEqual('outside-bottom')
        expect(top).toEqual(194) // 270 + 20 + 4 - ancestorRect.top
        expect(left).toEqual(120) // 220 - ancestorRect.left
      })

      it('flips inside an overflow ancestor at or above the containing block', () => {
        stubViewport()
        const {float, anchor} = render({
          ancestors: ['overflow: hidden', 'position: relative'],
          anchorRect: makeDOMRect(120, 570, 20, 20),
        })

        const {top, left, anchorSide} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(anchorSide).toEqual('outside-top')
        expect(top).toEqual(356) // 570 - 4 - 100 - containingBlockRect.top
        expect(left).toEqual(10) // 120 - containingBlockRect.left
      })

      it('flips inside a scrollable containing block', () => {
        stubViewport()
        const {float, anchor} = render({
          ancestors: ['position: relative; overflow: auto'],
          anchorRect: makeDOMRect(120, 570, 20, 20),
        })

        const {top, left, anchorSide} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(anchorSide).toEqual('outside-top')
        expect(top).toEqual(366) // 570 - 4 - 100 - ancestorRect.top
        expect(left).toEqual(20) // 120 - ancestorRect.left
      })

      it('does not clip fixed elements with overflow ancestors', () => {
        stubViewport({height: 1080})
        const {float, anchor} = render({
          ancestors: ['overflow: hidden'],
          floatingStyle: 'position: fixed',
          anchorRect: makeDOMRect(300, 960, 50, 50),
        })

        const {top, anchorSide} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        // Clipped by the viewport only, so the side flips at the bottom of the viewport
        expect(anchorSide).toEqual('outside-top')
        expect(top).toEqual(856) // 960 - 4 - 100
      })
    })

    describe('fixed-positioned elements', () => {
      it('positions against the viewport, ignoring body margins and scroll', () => {
        stubViewport({scrollY: 400})
        stubBodyRect({left: 200, top: 50 - 400})
        const {float, anchor} = render({floatingStyle: 'position: fixed'})

        const {top, left} = getAnchoredPosition(float, anchor, {anchorOffset: 4})

        expect(top).toEqual(254)
        expect(left).toEqual(300)
      })

      it('honors displayInViewport near the bottom of the viewport', () => {
        stubViewport({height: 768})
        stubBodyRect({left: 200, top: 50})
        const {float, anchor} = render({
          floatingStyle: 'position: fixed',
          anchorRect: makeDOMRect(300, 700, 50, 50),
        })

        const {top, left, anchorSide} = getAnchoredPosition(float, anchor, {
          side: 'outside-bottom',
          align: 'start',
          anchorOffset: 4,
          displayInViewport: true,
        })

        expect(anchorSide).toEqual('outside-top')
        expect(top).toEqual(596) // anchorRect.top - anchorOffset - floatingRect.height
        expect(left).toEqual(300)
      })
    })
  })
})
