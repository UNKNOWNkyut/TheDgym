import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useDotTheme } from '@/components/ui/dot-pattern'
import { StaggeredMenu, type StaggeredMenuItem, type StaggeredMenuSocialItem } from '@/components/ui/StaggeredMenu'
import { GYM_INFO } from '@/constants/gymInfo'
import type { UserRole } from '@/types/auth'

const SOCIAL_ITEMS: StaggeredMenuSocialItem[] = [
  { label: 'Facebook', link: GYM_INFO.facebookUrl },
  { label: 'Email', link: GYM_INFO.emailHref },
  { label: 'Call Us', link: GYM_INFO.phoneHref },
]

const ROLE_PROFILE_TARGETS: Record<UserRole, { link: string; ariaLabel: string }> = {
  admin: { link: '/manage', ariaLabel: 'Go to Management Hub' },
  staff: { link: '/manage/scanner', ariaLabel: 'Go to Staff Scanner' },
  trainer: { link: '/dashboard', ariaLabel: 'Go to Trainer Dashboard' },
  member: { link: '/dashboard', ariaLabel: 'Go to Profile Dashboard' },
  user: { link: '/dashboard', ariaLabel: 'Go to Profile Dashboard' },
}

const PUBLIC_MENU_ITEMS: StaggeredMenuItem[] = [
  { label: 'Home', link: '/', ariaLabel: 'Go to Home' },
  { label: 'About', link: '/about', ariaLabel: 'Go to About' },
  { label: 'Membership', link: '/membership', ariaLabel: 'Go to Membership' },
  { label: 'Classes', link: '/classes', ariaLabel: 'Go to Classes' },
  { label: 'Trainers', link: '/trainers', ariaLabel: 'Go to Trainers' },
  { label: 'Contact', link: '/contact', ariaLabel: 'Go to Contact' },
]

export function Header() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const { theme, toggleTheme } = useDotTheme()

  const isLight = theme === 'light'

  const profileTarget =
    isAuthenticated && user
      ? ROLE_PROFILE_TARGETS[user.role]
      : { link: '/login', ariaLabel: 'Go to Sign In' }

  const menuItems: StaggeredMenuItem[] = [
    { label: 'Profile', link: profileTarget.link, ariaLabel: profileTarget.ariaLabel },
    ...PUBLIC_MENU_ITEMS,
  ]

  return (
    <StaggeredMenu
      position="right"
      colors={isLight ? ['#e4e4e7', '#E5201A'] : ['#141418', '#E5201A']}
      items={menuItems}
      socialItems={SOCIAL_ITEMS}
      displaySocials
      displayItemNumbering
      logoUrl={isLight ? '/assets/logos/thedgym-light.png' : '/assets/logos/thedgym.png'}
      menuButtonColor={isLight ? '#111111' : '#ffffff'}
      openMenuButtonColor={isLight ? '#111111' : '#ffffff'}
      accentColor="#E5201A"
      changeMenuColorOnOpen
      isFixed
      closeOnClickAway
      theme={theme}
      onThemeToggle={toggleTheme}
      onNavigate={(path) => navigate(path)}
    />
  )
}
