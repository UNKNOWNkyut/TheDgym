import { Link } from 'react-router-dom'

const FOOTER_LINKS = {
  Gym: [
    { label: 'About', href: '/about' },
    { label: 'Membership', href: '/membership' },
    { label: 'Classes', href: '/classes' },
    { label: 'Personal Training', href: '/trainers' },
  ],
  Info: [
    { label: 'Contact', href: '/contact' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Use', href: '/terms' },
  ],
}

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className="bg-surface border-t border-white/8 mt-auto"
      role="contentinfo"
    >
      <div className="container-dgym py-12 md:py-16">

        {/* Top section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 mb-10 md:mb-12">

          {/* Brand column */}
          <div className="md:col-span-1">
            <Link to="/" aria-label="The DGym — Go to homepage">
              <img
                src="/assets/logos/thedgym.png"
                alt="The DGym Rosario Batangas"
                width={200}
                height={64}
                className="h-12 md:h-14 w-auto object-contain mb-4 opacity-95 hover:opacity-100 transition-opacity duration-200"
                loading="lazy"
              />
            </Link>
            <p className="text-sm text-white/50 leading-relaxed max-w-xs">
              High End Premium Weightlifting, Powerlifting, and Fitness Gym in Rosario, Batangas.
            </p>

            {/* Facebook link */}
            <a
              href="https://www.facebook.com/profile.php?id=61577169056417"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow The DGym Rosario Batangas on Facebook"
              className="inline-flex items-center gap-2 mt-4 text-sm text-white/50 hover:text-white transition-colors duration-150"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook: The DGym Rosario Batangas
            </a>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
                {group}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-white/50 hover:text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-1 rounded-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/8 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/30">
            &copy; {currentYear} The DGym Rosario Batangas. All rights reserved.
          </p>
          <p className="text-xs text-white/20">
            High End Premium Weightlifting & Powerlifting Gym.
          </p>
        </div>
      </div>
    </footer>
  )
}
