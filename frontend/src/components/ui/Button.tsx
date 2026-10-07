import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ButtonVariant, ButtonSize } from '@/types'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
  fullWidth?: boolean
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-red text-white',
    'hover:bg-red-hover hover:shadow-[0_0_24px_rgba(229,32,26,0.4)]',
    'active:scale-[0.97]',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none',
  ].join(' '),

  secondary: [
    'border border-white/15 text-white bg-transparent',
    'hover:bg-white/5 hover:border-white/25',
    'active:scale-[0.97]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),

  ghost: [
    'text-white/70 bg-transparent',
    'hover:text-white hover:bg-white/5',
    'active:scale-[0.97]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),

  danger: [
    'bg-danger text-white',
    'hover:brightness-110',
    'active:scale-[0.97]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm px-4 py-2 min-h-[36px]',
  md: 'text-sm px-6 py-3 min-h-[44px]',
  lg: 'text-base px-8 py-4 min-h-[52px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth = false,
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2',
        'font-semibold rounded-lg',
        'transition-all duration-150 cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}
