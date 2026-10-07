import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  id,
  className = '',
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-white/70"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-white/40 pointer-events-none" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        <input
          id={inputId}
          className={[
            'w-full bg-surface-2 text-white',
            'border rounded-lg px-4 py-3',
            'text-sm placeholder:text-white/30',
            'transition-all duration-150',
            error
              ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger/30'
              : 'border-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/10',
            'focus:outline-none',
            leftIcon ? 'pl-10' : '',
            rightIcon ? 'pr-10' : '',
            className,
          ].join(' ')}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          aria-invalid={error ? true : undefined}
          {...props}
        />

        {rightIcon && (
          <span className="absolute right-3 text-white/40" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-white/40">
          {hint}
        </p>
      )}
    </div>
  )
}
