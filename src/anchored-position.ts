export type AnchorAlignment = 'start' | 'center' | 'end'

// When prettier supports template literal types...
// export type AnchorSide = `${'inside' | 'outside'}-${'top' | 'bottom' | 'right' | 'left'}` | 'inside-center'
export type AnchorSide =
  | 'inside-top'
  | 'inside-bottom'
  | 'inside-left'
  | 'inside-right'
  | 'inside-center'
  | 'outside-top'
  | 'outside-bottom'
  | 'outside-left'
  | 'outside-right'

/**
 * Settings that customize how a floating element is positioned
 * with respect to an anchor element.
 */
export interface PositionSettings {
  /**
   * Sets the side of the anchor element that the floating element should be
   * pinned to. This side is given by a string starting with either "inside" or
   * "outside", followed by a hyphen, followed by either "top", "right", "bottom",
   * or "left". Additionally, "inside-center" is an allowed value.
   *
   * The first part of this string, "inside" or "outside", determines whether the
   * floating element should be attempted to be placed "inside" the anchor element
   * or "outside" of it. Using "inside" is useful for making it appear that the
   * anchor _contains_ the floating element, and it can be used for implementing a
   * dialog that is centered on the screen. The "outside" value is more common and
   * can be used for tooltips, popovers, menus, etc.
   *
   * The second part of this string determines the _edge_ on the anchor element that
   * the floating element will be anchored to. If side is "inside-center", then
   * the floating element will be centered in the X-direction (while align is used
   * to position it in the Y-direction).
   * Note: "outside-center" is _not_ a valid value for this property.
   */
  side: AnchorSide

  /**
   * Determines how the floating element should align with the anchor element. If
   * set to "start", the floating element's first edge (top or left) will align
   * with the anchor element's first edge. If set to "center", the floating
   * element will be centered along the axis of the anchor edge. If set to "end",
   * the floating element's last edge will align with the anchor element's last edge.
   */
  align: AnchorAlignment

  /**
   * The number of pixels between the anchor edge and the floating element.
   *
   * Positive values move the floating element farther from the anchor element
   * (for outside positioning) or further inside the anchor element (for inside
   * positioning). Negative values have the opposite effect.
   */
  anchorOffset: number

  /**
   * An additional offset, in pixels, to move the floating element from
   * the aligning edge.
   *
   * Positive values move the floating element in the direction of center-
   * alignment. Negative values move the floating element away from center-
   * alignment. When align is "center", positive offsets move the floating
   * element right (top or bottom anchor side) or down (left or right
   * anchor side).
   */
  alignmentOffset: number

  /**
   * If false, when the above settings result in rendering the floating element
   * wholly or partially outside of the bounds of the containing element, attempt
   * to adjust the settings to prevent this. Only applies to "outside" positioning.
   *
   * First, attempt to flip to the opposite edge of the anchor if the floating
   * element is getting clipped in that direction. If flipping results in a
   * similar clipping, try moving to the adjacent sides.
   *
   * Once we find a side that does not clip the overlay in its own dimension,
   * check the rest of the sides to see if we need to adjust the alignment offset
   * to fit in other dimensions.
   *
   * If we try all four sides and get clipped each time, settle for overflowing
   * and use the "bottom" side, since the ability to scroll is most likely in
   * this direction.
   */
  allowOutOfBounds: boolean

  /**
   * If true, attempt to position the floating element entirely within the visible
   * viewport (window.innerWidth/innerHeight) without requiring scrolling.
   * This is useful when the anchor is inside a dialog or other container that
   * prevents scrolling of the main document.
   */
  displayInViewport?: boolean
}

// For each outside anchor position, list the order of alternate positions to try in
// the event that the original position overflows. See comment on `allowOutOfBounds`
// for a more detailed description.
const alternateOrders: Partial<Record<AnchorSide, [AnchorSide, AnchorSide, AnchorSide, AnchorSide]>> = {
  'outside-top': ['outside-bottom', 'outside-right', 'outside-left', 'outside-bottom'],
  'outside-bottom': ['outside-top', 'outside-right', 'outside-left', 'outside-bottom'],
  'outside-left': ['outside-right', 'outside-bottom', 'outside-top', 'outside-bottom'],
  'outside-right': ['outside-left', 'outside-bottom', 'outside-top', 'outside-bottom'],
}

// For each alignment, list the order of alternate alignments to try in
// the event that the original position overflows.
// Prefer start or end over center.
const alternateAlignments: Partial<Record<AnchorAlignment, [AnchorAlignment, AnchorAlignment]>> = {
  start: ['end', 'center'],
  end: ['start', 'center'],
  center: ['end', 'start'],
}

interface Size {
  width: number
  height: number
}

interface Position {
  top: number
  left: number
}

export interface AnchorPosition {
  top: number
  left: number
  anchorSide: AnchorSide
  anchorAlign: AnchorAlignment
}

interface BoxPosition extends Size, Position {}

/**
 * Given a floating element and an anchor element, return coordinates for the top-left
 * of the floating element in order to absolutely position it such that it appears
 * near the anchor element.
 *
 * The returned coordinates are relative to the floating element's CSS containing
 * block: the padding box of its closest positioned ancestor, or, when there is no
 * positioned ancestor, the viewport (fixed positioning) or the initial containing
 * block (everything else, including elements in the top layer). Note that
 * `document.body` is not used as the containing block; its margins and borders are
 * therefore not subtracted from the result.
 *
 * @param floatingElement Element intended to be positioned near or within an anchor
 * @param anchorElement The element to serve as the position anchor
 * @param settings Settings to determine the rules for positioning the floating element
 * @returns {top: number, left: number} coordinates for the floating element
 */
export function getAnchoredPosition(
  floatingElement: Element,
  anchorElement: Element | DOMRect,
  settings: Partial<PositionSettings> = {},
): AnchorPosition {
  const {containingBlock, containingBlockStyle, clippingNode, clippingNodeStyle, isFixed} =
    getContainingBlockInfo(floatingElement)

  // The returned offsets are relative to the floating element's containing block. In
  // client coordinates that origin is the block's padding box, the viewport's top-left
  // corner (fixed positioning / top layer), or the initial containing block's top-left
  // corner, which is the document origin at (-scrollX, -scrollY).
  let relativePosition: Position
  let clippingRect: BoxPosition

  if (containingBlock) {
    const containingBlockRect = containingBlock.getBoundingClientRect()
    const [borderTop, borderLeft] = [
      containingBlockStyle?.borderTopWidth ?? '',
      containingBlockStyle?.borderLeftWidth ?? '',
    ].map(v => parseInt(v, 10) || 0)
    relativePosition = {
      top: containingBlockRect.top + borderTop,
      left: containingBlockRect.left + borderLeft,
    }
    clippingRect = clippingNode ? getClippingRect(clippingNode, clippingNodeStyle) : getDocumentRect()
  } else if (isFixed) {
    // Fixed-positioned elements (including fixed-positioned top-layer elements such as
    // modal dialogs) are positioned against the viewport and cannot be scrolled into view.
    relativePosition = {top: 0, left: 0}
    clippingRect = getViewportRect()
  } else {
    // Everything else (including top-layer elements with `position: absolute`) is
    // positioned against the initial containing block. The element scrolls with the
    // document, so the whole scrollable document is available as visible space.
    relativePosition = {top: -(window.scrollY || 0), left: -(window.scrollX || 0)}
    clippingRect = getDocumentRect()
  }

  return pureCalculateAnchoredPosition(
    clippingRect,
    relativePosition,
    floatingElement.getBoundingClientRect(),
    anchorElement instanceof Element ? anchorElement.getBoundingClientRect() : anchorElement,
    getDefaultSettings(settings),
    {width: window.innerWidth, height: window.innerHeight},
  )
}

interface ContainingBlockInfo {
  /** The nearest ancestor that establishes the floating element's containing block. */
  containingBlock: HTMLElement | null
  containingBlockStyle: CSSStyleDeclaration | null
  /**
   * The nearest `overflow` ancestor that clips the floating element. Only ancestors at
   * or above the containing block clip the element; overflow below the containing block
   * is escaped because the element is positioned against the containing block.
   */
  clippingNode: HTMLElement | null
  clippingNodeStyle: CSSStyleDeclaration | null
  /** Whether the floating element is `position: fixed`. */
  isFixed: boolean
}

// Properties that establish a containing block for absolutely and fixed positioned
// descendants, in addition to `position` (which only applies to absolute descendants).
// https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block
const WILL_CHANGE_CONTAINING_BLOCK = /transform|translate|scale|rotate|perspective|filter/
const CONTAIN_CONTAINING_BLOCK = /layout|paint|strict|content/

function isNone(value: string | null | undefined): boolean {
  return !value || value === 'none'
}

function establishesContainingBlock(style: CSSStyleDeclaration): boolean {
  return (
    !isNone(style.transform) ||
    !isNone(style.translate) ||
    !isNone(style.scale) ||
    !isNone(style.rotate) ||
    !isNone(style.perspective) ||
    !isNone(style.filter) ||
    !isNone(style.backdropFilter) ||
    WILL_CHANGE_CONTAINING_BLOCK.test(style.willChange || '') ||
    CONTAIN_CONTAINING_BLOCK.test(style.contain || '') ||
    (style.transformStyle || 'flat') === 'preserve-3d' ||
    (style.contentVisibility || 'visible') !== 'visible'
  )
}

function isOverflowClipping(style: CSSStyleDeclaration): boolean {
  return /auto|scroll|overlay|hidden|clip/.test(
    `${style.overflow || ''} ${style.overflowX || ''} ${style.overflowY || ''}`,
  )
}

/**
 * Returns the containing block and clipping ancestor for a floating element.
 *
 * The containing block is the nearest ancestor that establishes one: a positioned
 * ancestor for `position: absolute`, or an ancestor with a transform-like property for
 * either `position`. When there is none the containing block is the initial containing
 * block (or the viewport for fixed positioning), and DOM ancestors cannot clip it.
 * Top-layer elements are not positioned or clipped by their DOM ancestors at all.
 */
function getContainingBlockInfo(element: Element): ContainingBlockInfo {
  const {position} = getComputedStyle(element)
  const isFixed = (position || 'static') === 'fixed'
  const isTopLayer = isOnTopLayer(element)

  if (isTopLayer) {
    return {
      containingBlock: null,
      containingBlockStyle: null,
      clippingNode: null,
      clippingNodeStyle: null,
      isFixed,
    }
  }

  let containingBlock: HTMLElement | null = null
  let containingBlockStyle: CSSStyleDeclaration | null = null
  let clippingNode: HTMLElement | null = null
  let clippingNodeStyle: CSSStyleDeclaration | null = null

  let node: Node | null = element.parentNode
  while (node !== null) {
    if (node instanceof HTMLElement) {
      const style = getComputedStyle(node)
      // Elements without a box (display: contents) cannot establish a containing block
      // nor clip anything, even if their computed `position` is not static.
      if ((style.display || 'block') !== 'contents') {
        if (containingBlock === null) {
          const establishes =
            establishesContainingBlock(style) || (!isFixed && (style.position || 'static') !== 'static')
          if (establishes) {
            containingBlock = node
            containingBlockStyle = style
            if (isOverflowClipping(style)) {
              clippingNode = node
              clippingNodeStyle = style
            }
          }
        } else if (clippingNode === null && isOverflowClipping(style)) {
          clippingNode = node
          clippingNodeStyle = style
        }
      }

      // Once the containing block and its nearest clipping ancestor are known there is
      // nothing left to resolve (overflow below the containing block does not clip).
      if (containingBlock !== null && (clippingNode !== null || node === document.documentElement)) {
        break
      }
    }
    if (node === document.documentElement) break
    node = node.parentNode
  }

  return {containingBlock, containingBlockStyle, clippingNode, clippingNodeStyle, isFixed}
}

/** Returns true if the element is currently rendered in the top layer. */
function isOnTopLayer(element: Element): boolean {
  if (typeof element.matches !== 'function') {
    return false
  }
  // Modal dialogs and open native popovers are rendered in the top layer, where they are
  // not positioned by their DOM ancestors. The selectors throw in browsers (and DOM
  // implementations) that do not support that part of the platform.
  for (const selector of [':modal', ':popover-open']) {
    try {
      if (element.matches(selector)) {
        return true
      }
    } catch {
      // Selector not supported; try the next one.
    }
  }
  return false
}

/** The visible viewport, in client coordinates. */
function getViewportRect(): BoxPosition {
  const documentElement = document.documentElement
  return {
    top: 0,
    left: 0,
    width: documentElement.clientWidth || window.innerWidth,
    height: documentElement.clientHeight || window.innerHeight,
  }
}

/**
 * The scrollable document area, in client coordinates: the initial containing block is
 * anchored to the document origin, so this covers everything that can be scrolled into
 * view. `window` dimensions are used as a fallback in environments without layout.
 */
function getDocumentRect(): BoxPosition {
  const scrollX = window.scrollX || 0
  const scrollY = window.scrollY || 0
  const documentElement = document.documentElement
  return {
    top: -scrollY,
    left: -scrollX,
    width: documentElement.clientWidth || window.innerWidth,
    height: Math.max(documentElement.scrollHeight, documentElement.clientHeight, window.innerHeight),
  }
}

/**
 * Returns the rectangle (relative to the window) that will clip the given element
 * if it is rendered outside of its bounds.
 * @param clippingNode The element to use as the clipping boundary
 * @param cachedStyle Optional cached computed style to avoid redundant getComputedStyle call
 * @returns
 */
function getClippingRect(clippingNode: HTMLElement, cachedStyle: CSSStyleDeclaration | null = null): BoxPosition {
  // Batch all reads from the clipping node together
  const elemRect = clippingNode.getBoundingClientRect()
  const elemStyle = cachedStyle || getComputedStyle(clippingNode)

  // Parse all border values in one batch
  const borderTop = parseInt(elemStyle.borderTopWidth, 10) || 0
  const borderLeft = parseInt(elemStyle.borderLeftWidth, 10) || 0
  const borderRight = parseInt(elemStyle.borderRightWidth, 10) || 0
  const borderBottom = parseInt(elemStyle.borderBottomWidth, 10) || 0

  return {
    top: elemRect.top + borderTop,
    left: elemRect.left + borderLeft,
    width: elemRect.width - borderRight - borderLeft,
    // If the clipping node is document.body, it can expand to the full height of the window
    height: Math.max(
      elemRect.height - borderTop - borderBottom,
      clippingNode === document.body ? window.innerHeight : -Infinity,
    ),
  }
}

// Default settings to position a floating element
const positionDefaults: PositionSettings = {
  side: 'outside-bottom',
  align: 'start',

  // note: the following default is not applied if side === "inside-center"
  anchorOffset: 4,

  // note: the following default is only applied if side starts with "inside"
  // and align is not center
  alignmentOffset: 4,

  allowOutOfBounds: false,
  displayInViewport: false,
}

/**
 * Compute a full PositionSettings object from the given partial PositionSettings object
 * by filling in with defaults where applicable.
 * @param settings Partial settings - any omissions will be defaulted
 */
function getDefaultSettings(settings: Partial<PositionSettings> = {}): PositionSettings {
  const side = settings.side ?? positionDefaults.side
  const align = settings.align ?? positionDefaults.align
  return {
    side,
    align,
    // offsets always default to 0 if their respective side/alignment is centered
    anchorOffset: settings.anchorOffset ?? (side === 'inside-center' ? 0 : positionDefaults.anchorOffset),
    alignmentOffset:
      settings.alignmentOffset ??
      (align !== 'center' && side.startsWith('inside') ? positionDefaults.alignmentOffset : 0),
    allowOutOfBounds: settings.allowOutOfBounds ?? positionDefaults.allowOutOfBounds,
    displayInViewport: settings.displayInViewport ?? positionDefaults.displayInViewport,
  }
}

/**
 * Note: This is a pure function with no dependency on DOM APIs.
 * @see getAnchoredPosition
 * @see getDefaultSettings
 * @param viewportRect BoxPosition for the rectangle that will clip the floating element if it is
 *   rendered outside of the boundsof the rectangle.
 * @param relativePosition Position for the closest positioned proper parent of the floating element
 * @param floatingRect WidthAndHeight for the floating element
 * @param anchorRect BoxPosition for the anchor element
 * @param PositionSettings to customize the calculated position for the floating element.
 * @param visibleViewportSize Size of the visible viewport (window dimensions), used when displayInVisibleViewport is true
 */
function pureCalculateAnchoredPosition(
  viewportRect: BoxPosition,
  relativePosition: Position,
  floatingRect: Size,
  anchorRect: BoxPosition,
  {side, align, allowOutOfBounds, anchorOffset, alignmentOffset, displayInViewport}: PositionSettings,
  visibleViewportSize: Size,
): AnchorPosition {
  // Compute the relative viewport rect, to bring it into the same coordinate space as `pos`
  let effectiveViewportRect = viewportRect

  // If displayInViewport is true, constrain to the actual visible viewport
  if (displayInViewport) {
    effectiveViewportRect = {
      top: 0,
      left: 0,
      width: visibleViewportSize.width,
      height: visibleViewportSize.height,
    }
  }

  const relativeViewportRect: BoxPosition = {
    top: effectiveViewportRect.top - relativePosition.top,
    left: effectiveViewportRect.left - relativePosition.left,
    width: effectiveViewportRect.width,
    height: effectiveViewportRect.height,
  }

  let pos = calculatePosition(floatingRect, anchorRect, side, align, anchorOffset, alignmentOffset)
  let anchorSide = side
  let anchorAlign = align
  pos.top -= relativePosition.top
  pos.left -= relativePosition.left

  // Handle screen overflow
  if (!allowOutOfBounds) {
    const alternateOrder = alternateOrders[side]

    let positionAttempt = 0
    if (alternateOrder) {
      let prevSide = side

      // Try all the alternate sides until one does not overflow
      while (
        positionAttempt < alternateOrder.length &&
        shouldRecalculatePosition(prevSide, pos, relativeViewportRect, floatingRect)
      ) {
        const nextSide = alternateOrder[positionAttempt++]
        prevSide = nextSide

        // If we have cut off in the same dimension as the "side" option, try flipping to the opposite side.
        pos = calculatePosition(floatingRect, anchorRect, nextSide, align, anchorOffset, alignmentOffset)
        pos.top -= relativePosition.top
        pos.left -= relativePosition.left
        anchorSide = nextSide
      }
    }

    // If using alternate anchor side does not stop overflow,
    // try using an alternate alignment
    const alternateAlignment = alternateAlignments[align]

    let alignmentAttempt = 0
    if (alternateAlignment) {
      let prevAlign = align

      // Try all the alternate alignments until one does not overflow
      while (
        alignmentAttempt < alternateAlignment.length &&
        shouldRecalculateAlignment(prevAlign, pos, relativeViewportRect, floatingRect)
      ) {
        const nextAlign = alternateAlignment[alignmentAttempt++]
        prevAlign = nextAlign

        pos = calculatePosition(floatingRect, anchorRect, anchorSide, nextAlign, anchorOffset, alignmentOffset)
        pos.top -= relativePosition.top
        pos.left -= relativePosition.left
        anchorAlign = nextAlign
      }
    }

    // At this point we've flipped the position if applicable. Now just nudge until it's on-screen.
    if (pos.top < relativeViewportRect.top) {
      pos.top = relativeViewportRect.top
    }
    if (pos.left < relativeViewportRect.left) {
      pos.left = relativeViewportRect.left
    }
    if (pos.left + floatingRect.width > effectiveViewportRect.width + relativeViewportRect.left) {
      pos.left = effectiveViewportRect.width + relativeViewportRect.left - floatingRect.width
    }
    // Always apply bottom constraint when displayInViewport is true
    if (displayInViewport || (alternateOrder && positionAttempt < alternateOrder.length)) {
      if (pos.top + floatingRect.height > effectiveViewportRect.height + relativeViewportRect.top) {
        // This prevents top from being a negative value
        pos.top = Math.max(effectiveViewportRect.height + relativeViewportRect.top - floatingRect.height, 0)
      }
    }
  }

  return {...pos, anchorSide, anchorAlign}
}

/**
 * Given a floating element and an anchor element, return coordinates for the
 * top-left of the floating element in order to absolutely position it such
 * that it appears near the anchor element.
 *
 * @param elementDimensions Dimensions of the floating element
 * @param anchorPosition Position of the anchor element
 * @param side Side of the anchor to position the floating element
 * @param align How to align the floating element with the anchor element
 * @param anchorOffset Absolute pixel offset for anchor positioning
 * @param alignmentOffset Absolute pixel offset for alignment
 * @returns {top: number, left: number} coordinates for the floating element
 */
function calculatePosition(
  elementDimensions: Size,
  anchorPosition: BoxPosition,
  side: AnchorSide,
  align: AnchorAlignment,
  anchorOffset: number,
  alignmentOffset: number,
) {
  const anchorRight = anchorPosition.left + anchorPosition.width
  const anchorBottom = anchorPosition.top + anchorPosition.height
  let top = -1
  let left = -1
  if (side === 'outside-top') {
    top = anchorPosition.top - anchorOffset - elementDimensions.height
  } else if (side === 'outside-bottom') {
    top = anchorBottom + anchorOffset
  } else if (side === 'outside-left') {
    left = anchorPosition.left - anchorOffset - elementDimensions.width
  } else if (side === 'outside-right') {
    left = anchorRight + anchorOffset
  }

  if (side === 'outside-top' || side === 'outside-bottom') {
    if (align === 'start') {
      left = anchorPosition.left + alignmentOffset
    } else if (align === 'center') {
      left = anchorPosition.left - (elementDimensions.width - anchorPosition.width) / 2 + alignmentOffset
    } else {
      // end
      left = anchorRight - elementDimensions.width - alignmentOffset
    }
  }

  if (side === 'outside-left' || side === 'outside-right') {
    if (align === 'start') {
      top = anchorPosition.top + alignmentOffset
    } else if (align === 'center') {
      top = anchorPosition.top - (elementDimensions.height - anchorPosition.height) / 2 + alignmentOffset
    } else {
      // end
      top = anchorBottom - elementDimensions.height - alignmentOffset
    }
  }

  if (side === 'inside-top') {
    top = anchorPosition.top + anchorOffset
  } else if (side === 'inside-bottom') {
    top = anchorBottom - anchorOffset - elementDimensions.height
  } else if (side === 'inside-left') {
    left = anchorPosition.left + anchorOffset
  } else if (side === 'inside-right') {
    left = anchorRight - anchorOffset - elementDimensions.width
  } else if (side === 'inside-center') {
    left = (anchorRight + anchorPosition.left) / 2 - elementDimensions.width / 2 + anchorOffset
  }

  if (side === 'inside-top' || side === 'inside-bottom') {
    if (align === 'start') {
      left = anchorPosition.left + alignmentOffset
    } else if (align === 'center') {
      left = anchorPosition.left - (elementDimensions.width - anchorPosition.width) / 2 + alignmentOffset
    } else {
      // end
      left = anchorRight - elementDimensions.width - alignmentOffset
    }
  } else if (side === 'inside-left' || side === 'inside-right' || side === 'inside-center') {
    if (align === 'start') {
      top = anchorPosition.top + alignmentOffset
    } else if (align === 'center') {
      top = anchorPosition.top - (elementDimensions.height - anchorPosition.height) / 2 + alignmentOffset
    } else {
      // end
      top = anchorBottom - elementDimensions.height - alignmentOffset
    }
  }

  return {top, left}
}

/**
 * Determines if there is an overflow
 * @param side
 * @param currentPos
 * @param containerDimensions
 * @param elementDimensions
 */
function shouldRecalculatePosition(
  side: AnchorSide,
  currentPos: Position,
  containerDimensions: BoxPosition,
  elementDimensions: Size,
) {
  if (side === 'outside-top' || side === 'outside-bottom') {
    return (
      currentPos.top < containerDimensions.top ||
      currentPos.top + elementDimensions.height > containerDimensions.height + containerDimensions.top
    )
  } else {
    return (
      currentPos.left < containerDimensions.left ||
      currentPos.left + elementDimensions.width > containerDimensions.width + containerDimensions.left
    )
  }
}

/**
 * Determines if there is an overflow
 * @param align,
 * @param currentPos
 * @param containerDimensions
 * @param elementDimensions
 */
function shouldRecalculateAlignment(
  align: AnchorAlignment,
  currentPos: Position,
  containerDimensions: BoxPosition,
  elementDimensions: Size,
) {
  if (align === 'end') {
    return currentPos.left < containerDimensions.left
  } else if (align === 'start' || align === 'center') {
    return (
      // right edge
      currentPos.left + elementDimensions.width > containerDimensions.left + containerDimensions.width ||
      // left edge
      currentPos.left < containerDimensions.left
    )
  }
}
