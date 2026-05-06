const SCROLL_DURATION_MS = 850

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export function scrollToSection(id: string) {
  const element = document.getElementById(id)
  if (!element) return

  const shouldReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const targetY = element.getBoundingClientRect().top + window.scrollY

  if (shouldReduceMotion) {
    window.scrollTo({ top: targetY })
    return
  }

  const startY = window.scrollY
  const distance = targetY - startY
  const startTime = performance.now()

  const step = (now: number) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / SCROLL_DURATION_MS, 1)
    window.scrollTo(0, startY + distance * easeOutCubic(progress))

    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }

  requestAnimationFrame(step)
}
