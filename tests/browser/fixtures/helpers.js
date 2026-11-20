// In-page helpers for the browser regression fixtures. Loaded with `addScriptTag` after
// the harness page has imported the built bundle.
;(() => {
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

  const rectOf = element => {
    const rect = element.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    }
  }

  const isTopLayer = element => {
    try {
      return element.matches(':modal') || element.matches(':popover-open')
    } catch {
      return false
    }
  }

  /**
   * Renders a fixture, activates the floating element if it lives in the top layer,
   * positions it with `getAnchoredPosition`, and returns the measured result.
   */
  window.__place = async ({html, style = '', bodyStyle = '', settings = {}, scroll = [0, 0], activate = null}) => {
    document.getElementById('fixture-style').textContent = style
    document.body.setAttribute('style', bodyStyle)
    document.body.innerHTML = html
    await nextFrame()

    if (activate) {
      const element = document.querySelector(activate.selector || '#float')
      if (activate.type === 'popover') element.showPopover()
      else if (activate.type === 'modal') element.showModal()
      else if (activate.type === 'dialog') element.show()
      await nextFrame()
    }

    if (scroll) window.scrollTo(scroll[0], scroll[1])
    await nextFrame()

    return window.__reposition(settings)
  }

  /** Re-runs the position calculation for the current fixture (e.g. after scrolling). */
  window.__reposition = async settings => {
    const floating = document.querySelector('#float')
    const anchor = document.querySelector('#anchor')
    if (!floating || !anchor) throw new Error('fixture must contain #float and #anchor')

    const position = window.__getAnchoredPosition(floating, anchor, settings)
    floating.style.left = `${position.left}px`
    floating.style.top = `${position.top}px`
    await nextFrame()

    return {
      position,
      floating: rectOf(floating),
      anchor: rectOf(anchor),
      scroll: [window.scrollX, window.scrollY],
      viewport: {
        width: document.documentElement.clientWidth || window.innerWidth,
        height: document.documentElement.clientHeight || window.innerHeight,
      },
      computed: {
        position: getComputedStyle(floating).position,
        topLayer: isTopLayer(floating),
      },
    }
  }
})()
