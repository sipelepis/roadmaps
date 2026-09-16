import gsap from 'gsap'

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
gsap.defaults({ ease: 'power3.out', duration: 0.6 })

/** Route enter: content rises in, then the roadmap draws itself top to bottom. */
export function enter(main: HTMLElement) {
  if (still()) return
  const blocks = main.querySelectorAll(':scope > .hero > *, :scope > :not(.hero)')
  const tl = gsap.timeline()
  tl.from(blocks, { y: 14, autoAlpha: 0, stagger: 0.06, clearProps: 'transform,opacity,visibility' })
  const edges = main.querySelectorAll('.map .edge'), boxes = main.querySelectorAll('.map .node')
  if (boxes.length) {
    tl.from(boxes, { y: 10, autoAlpha: 0, stagger: { amount: 0.8 } }, 0.2)
    tl.fromTo(edges, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, stagger: { amount: 0.8 } }, 0.4)
  }
}

/** Test result rows: slide in one after another. */
export function reveal(items: HTMLCollection) {
  if (still() || !items.length) return
  gsap.from(items, { y: 6, autoAlpha: 0, duration: 0.35, stagger: 0.05, clearProps: 'transform,opacity,visibility' })
}

/** Status badge pop when it changes. */
export function pop(el: Element) {
  if (still()) return
  gsap.from(el, { scale: 0.6, duration: 0.45, ease: 'back.out(2.5)', transformOrigin: 'left center', clearProps: 'transform' })
}

/** Count a number up or down instead of snapping. */
export function count(el: Element, to: number) {
  const o = { v: +(el.textContent ?? 0) }
  if (still() || o.v === to) { el.textContent = String(to); return }
  gsap.to(o, { v: to, duration: 0.5, snap: 'v', onUpdate: () => (el.textContent = String(o.v)) })
}
