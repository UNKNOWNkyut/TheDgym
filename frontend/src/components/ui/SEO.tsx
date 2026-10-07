import { useEffect } from 'react'

interface SEOProps {
  title?: string
  description?: string
  canonical?: string
  ogImage?: string
}

const SITE_NAME = 'The DGym Rosario Batangas'
const DEFAULT_DESCRIPTION = 'High End Premium Weightlifting, Powerlifting, and Fitness Gym in Rosario, Batangas.'
const DEFAULT_OG_IMAGE = '/assets/images/dgym_bg.jpg'

/**
 * SEO component — updates document head for each page.
 * Phase 2: Basic meta tags. Phase 10 will add structured data / sitemap.
 */
export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — High End Premium Fitness Gym`

  useEffect(() => {
    document.title = fullTitle

    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name'
      let el = document.querySelector(`meta[${attr}="${name}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    setMeta('description', description)
    setMeta('og:title', fullTitle, true)
    setMeta('og:description', description, true)
    setMeta('og:site_name', SITE_NAME, true)
    setMeta('og:type', 'website', true)
    setMeta('og:image', ogImage, true)
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', fullTitle)
    setMeta('twitter:description', description)

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]')
      if (!link) {
        link = document.createElement('link')
        link.setAttribute('rel', 'canonical')
        document.head.appendChild(link)
      }
      link.setAttribute('href', canonical)
    }
  }, [fullTitle, description, canonical, ogImage])

  return null
}
