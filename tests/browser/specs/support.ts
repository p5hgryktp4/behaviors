import {expect, type Page} from '@playwright/test'

export interface PlaceOptions {
  html: string
  style?: string
  bodyStyle?: string
  settings?: Record<string, unknown>
  scroll?: [number, number]
  activate?: {type: 'popover' | 'modal' | 'dialog'; selector?: string}
}

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
  centerX: number
  centerY: number
}

export interface PlacementResult {
  position: {
    top: number
    left: number
    anchorSide: string
    anchorAlign: string
  }
  floating: Rect
  anchor: Rect
  scroll: [number, number]
  viewport: {width: number; height: number}
  computed: {position: string; topLayer: boolean}
}

export const HARNESS_URL = '/tests/browser/fixtures/harness.html'
export const TOLERANCE = 1

export async function loadHarness(page: Page) {
  await page.goto(HARNESS_URL)
  await page.waitForFunction(() => (window as unknown as {__ready?: boolean}).__ready === true)
  await page.addScriptTag({url: '/tests/browser/fixtures/helpers.js'})
}

export async function place(page: Page, options: PlaceOptions): Promise<PlacementResult> {
  await loadHarness(page)
  return page.evaluate(
    opts => (window as unknown as {__place: (o: PlaceOptions) => Promise<PlacementResult>}).__place(opts),
    options,
  )
}

export async function reposition(page: Page, settings: Record<string, unknown> = {}): Promise<PlacementResult> {
  return page.evaluate(
    opts =>
      (window as unknown as {__reposition: (o: Record<string, unknown>) => Promise<PlacementResult>}).__reposition(
        opts,
      ),
    settings,
  )
}

const near = (actual: number, expected: number, message: string) => {
  expect(Math.abs(actual - expected), `${message} (actual ${actual}, expected ${expected})`).toBeLessThanOrEqual(
    TOLERANCE,
  )
}

function expectHorizontalAlignment(result: PlacementResult) {
  const {floating, anchor, position} = result
  if (position.anchorAlign === 'start') near(floating.left, anchor.left, 'floating left edge should align with anchor')
  else if (position.anchorAlign === 'end')
    near(floating.right, anchor.right, 'floating right edge should align with anchor')
  else near(floating.centerX, anchor.centerX, 'floating should be centered on the anchor')
}

function expectVerticalAlignment(result: PlacementResult) {
  const {floating, anchor, position} = result
  if (position.anchorAlign === 'start') near(floating.top, anchor.top, 'floating top edge should align with anchor')
  else if (position.anchorAlign === 'end')
    near(floating.bottom, anchor.bottom, 'floating bottom edge should align with anchor')
  else near(floating.centerY, anchor.centerY, 'floating should be centered on the anchor')
}

/**
 * Asserts that the floating element is visually attached to its anchor according to the
 * side/alignment the algorithm reported. This is engine-agnostic: it validates the
 * placement contract (`getAnchoredPosition` coordinates + the consumer applying them)
 * rather than hard-coding numbers, so the same expectation works in every browser.
 */
export function expectAttached(result: PlacementResult, {anchorOffset = 0} = {}) {
  const {floating, anchor, position} = result
  switch (position.anchorSide) {
    case 'outside-bottom':
      near(floating.top, anchor.bottom + anchorOffset, 'floating should be below the anchor')
      expectHorizontalAlignment(result)
      break
    case 'outside-top':
      near(floating.bottom, anchor.top - anchorOffset, 'floating should be above the anchor')
      expectHorizontalAlignment(result)
      break
    case 'outside-right':
      near(floating.left, anchor.right + anchorOffset, 'floating should be right of the anchor')
      expectVerticalAlignment(result)
      break
    case 'outside-left':
      near(floating.right, anchor.left - anchorOffset, 'floating should be left of the anchor')
      expectVerticalAlignment(result)
      break
    case 'inside-top':
      near(floating.top, anchor.top + anchorOffset, 'floating should be inside the anchor (top)')
      expectHorizontalAlignment(result)
      break
    case 'inside-bottom':
      near(floating.bottom, anchor.bottom - anchorOffset, 'floating should be inside the anchor (bottom)')
      expectHorizontalAlignment(result)
      break
    case 'inside-left':
      near(floating.left, anchor.left + anchorOffset, 'floating should be inside the anchor (left)')
      expectVerticalAlignment(result)
      break
    case 'inside-right':
      near(floating.right, anchor.right - anchorOffset, 'floating should be inside the anchor (right)')
      expectVerticalAlignment(result)
      break
    case 'inside-center': {
      near(
        floating.left,
        anchor.left + (anchor.width - floating.width) / 2,
        'floating should be centered in the anchor',
      )
      expectVerticalAlignment(result)
      break
    }
    default:
      throw new Error(`unexpected anchor side: ${position.anchorSide}`)
  }
}

export function expectWithinViewport(result: PlacementResult) {
  const {floating, viewport} = result
  expect(floating.top, 'floating top should be within the viewport').toBeGreaterThanOrEqual(-TOLERANCE)
  expect(floating.left, 'floating left should be within the viewport').toBeGreaterThanOrEqual(-TOLERANCE)
  expect(floating.bottom, 'floating bottom should be within the viewport').toBeLessThanOrEqual(
    viewport.height + TOLERANCE,
  )
  expect(floating.right, 'floating right should be within the viewport').toBeLessThanOrEqual(viewport.width + TOLERANCE)
}
