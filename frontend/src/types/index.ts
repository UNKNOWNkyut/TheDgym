// Shared TypeScript types for Phase 1 UI components

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'red'

export type RiskTier = 'high' | 'medium' | 'low'

export interface NavItem {
  label: string
  href: string
}
