import { useEffect } from 'react'
import { GYM_INFO } from '@/constants/gymInfo'

interface SEOProps {
  title?: string
  description?: string
  canonical?: string
  ogImage?: string
  noIndex?: boolean
}

const DEFAULT_SITE_URL = 'https://thedgym.com'
const RAW_SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || '').trim().replace(/\/+$/, '')
export const SITE_URL = /^https?:\/\/[^/\s]+/i.test(RAW_SITE_URL) ? RAW_SITE_URL : DEFAULT_SITE_URL

const SITE_NAME = GYM_INFO.name
const DEFAULT_DESCRIPTION = GYM_INFO.seoDescription
const DEFAULT_OG_IMAGE = '/assets/images/dgym_bg.jpg'
const PRIVATE_PATH_PREFIXES = ['/manage', '/dashboard', '/settings', '/payment', '/login', '/register']

function resolveSiteUrl(value: string): string {
  if (value.startsWith(DEFAULT_SITE_URL)) {
    return `${SITE_URL}${value.slice(DEFAULT_SITE_URL.length)}`
  }
  if (/^https?:\/\//i.test(value)) return value
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

/**
 * SEO component — updates document head tags per route cleanly.
 */
export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  noIndex,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — High End Premium Fitness Gym`

  useEffect(() => {
    document.title = fullTitle

    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
    const isPrivatePath = PRIVATE_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
    const shouldNoIndex = noIndex ?? isPrivatePath
    const resolvedOgImage = resolveSiteUrl(ogImage)
    const resolvedUrl = canonical ? resolveSiteUrl(canonical) : `${SITE_URL}${pathname}`

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
    setMeta('robots', shouldNoIndex ? 'noindex, nofollow' : 'index, follow')
    setMeta('og:title', fullTitle, true)
    setMeta('og:description', description, true)
    setMeta('og:site_name', SITE_NAME, true)
    setMeta('og:type', 'website', true)
    setMeta('og:url', resolvedUrl, true)
    setMeta('og:image', resolvedOgImage, true)
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', fullTitle)
    setMeta('twitter:description', description)
    setMeta('twitter:image', resolvedOgImage)

    const canonicalLink = document.querySelector('link[rel="canonical"]')
    if (canonical && !shouldNoIndex) {
      const link = canonicalLink ?? document.createElement('link')
      if (!canonicalLink) {
        link.setAttribute('rel', 'canonical')
        document.head.appendChild(link)
      }
      link.setAttribute('href', resolvedUrl)
    } else if (shouldNoIndex && canonicalLink) {
      canonicalLink.remove()
    }
  }, [fullTitle, description, canonical, ogImage, noIndex])

  return null
}
