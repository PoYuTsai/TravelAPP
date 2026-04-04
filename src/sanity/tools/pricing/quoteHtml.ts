export function sanitizeQuoteHtml(html: string): string {
  const container = document.createElement('div')
  container.innerHTML = html

  container.querySelectorAll([
    'script',
    'iframe',
    'object',
    'embed',
    'svg',
    'math',
    'form',
    'input',
    'textarea',
    'button',
    'select',
    'option',
    'audio',
    'video',
    'source',
    'track',
    'base',
    'link',
  ].join(',')).forEach((element) => element.remove())

  const styleTags = Array.from(container.querySelectorAll('style'))
  styleTags.slice(1).forEach((element) => element.remove())

  container.querySelectorAll('*').forEach((element) => {
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()

      if (name.startsWith('on')) {
        element.removeAttribute(attr.name)
        continue
      }

      if (
        ['href', 'src', 'xlink:href', 'formaction'].includes(name) &&
        (value.startsWith('javascript:') || value.startsWith('data:'))
      ) {
        element.removeAttribute(attr.name)
      }
    }
  })

  return container.innerHTML
}
