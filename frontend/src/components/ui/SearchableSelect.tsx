import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption {
  id: number
  codeOrId: string
  name: string
  subtitle?: string
}

interface SearchableSelectProps {
  label?: string
  placeholder?: string
  value: number | '' | null
  onChange: (id: number) => void
  options: SelectOption[]
  loading?: boolean
  error?: string
  disabled?: boolean
  required?: boolean
  idColLabel?: string
  nameColLabel?: string
}

interface DropdownCoords {
  top?: number
  bottom?: number
  left: number
  width: number
  openUpward: boolean
}

export function SearchableSelect({
  label,
  placeholder = 'Select an option…',
  value,
  onChange,
  options,
  loading = false,
  error,
  disabled = false,
  required = false,
  idColLabel = 'ID',
  nameColLabel = 'NAME',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [coords, setCoords] = useState<DropdownCoords | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.id === value)

  // Filter options based on search query
  const filteredOptions = options.filter((opt) => {
    if (!search.trim()) return true
    const q = search.toLowerCase().trim()
    return (
      opt.codeOrId.toLowerCase().includes(q) ||
      opt.name.toLowerCase().includes(q) ||
      (opt.subtitle && opt.subtitle.toLowerCase().includes(q))
    )
  })

  // Calculate dynamic position relative to trigger button
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownHeight = 280

    // If space below is limited and space above is larger, flip upward
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight

    if (openUpward) {
      setCoords({
        bottom: window.innerHeight - rect.top + 6,
        left: rect.left,
        width: Math.max(rect.width, 280),
        openUpward: true,
      })
    } else {
      setCoords({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 280),
        openUpward: false,
      })
    }
  }, [])

  // When opening, compute position & attach listeners
  useEffect(() => {
    if (isOpen) {
      updatePosition()

      const handleScrollOrResize = () => {
        updatePosition()
      }

      window.addEventListener('scroll', handleScrollOrResize, true)
      window.addEventListener('resize', handleScrollOrResize)

      // Auto-focus search input
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50)

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true)
        window.removeEventListener('resize', handleScrollOrResize)
        clearTimeout(timer)
      }
    }
  }, [isOpen, updatePosition])

  // Handle outside click to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node
      const isInsideTrigger = triggerRef.current?.contains(target)
      const isInsideDropdown = dropdownRef.current?.contains(target)

      if (!isInsideTrigger && !isInsideDropdown) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (id: number) => {
    onChange(id)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className="w-full">
      {label && (
        <label className="text-xs uppercase tracking-widest text-white/40 block mb-1.5 font-mono">
          {label} {required && <span className="text-red">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between gap-2 transition-all ${
          error
            ? 'border-red/60 focus:border-red'
            : isOpen
            ? 'border-red/50 ring-1 ring-red/30 bg-white/[0.07]'
            : 'border-white/10 hover:border-white/20'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="flex items-center gap-2.5 truncate">
          {loading ? (
            <span className="text-white/40 text-xs">Loading options…</span>
          ) : selectedOption ? (
            <>
              <span className="px-1.5 py-0.5 rounded bg-red/15 border border-red/30 text-red font-mono text-xs font-bold shrink-0">
                {selectedOption.codeOrId}
              </span>
              <span className="text-white font-medium truncate">{selectedOption.name}</span>
            </>
          ) : (
            <span className="text-white/30">{placeholder}</span>
          )}
        </div>

        <svg
          className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

      {/* Portal Dropdown Menu — Mounted to document.body to NEVER get cut off by parent overflow */}
      {isOpen &&
        coords &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: coords.top !== undefined ? `${coords.top}px` : 'auto',
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
            }}
            className="bg-zinc-950/98 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-150"
          >
            {/* Search Bar at Top */}
            <div className="p-2.5 border-b border-white/10 bg-white/[0.03]">
              <div className="relative">
                <svg
                  className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ID, code, or name…"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red/50 transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Table Header: ID, Names */}
            <div className="grid grid-cols-12 px-3 py-2 bg-white/[0.04] border-b border-white/5 text-[10px] font-mono uppercase tracking-wider text-white/40 font-semibold">
              <span className="col-span-4">{idColLabel}</span>
              <span className="col-span-8">{nameColLabel}</span>
            </div>

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-white/[0.04] scrollbar-thin scrollbar-thumb-white/15">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-xs text-white/30 font-mono">
                  No matching records found.
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.id === value
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelect(opt.id)}
                      className={`grid grid-cols-12 items-center px-3 py-2.5 cursor-pointer text-xs transition-colors ${
                        isSelected
                          ? 'bg-red/20 text-white'
                          : 'hover:bg-white/10 text-white/80 hover:text-white'
                      }`}
                    >
                      {/* ID / Code Column */}
                      <div className="col-span-4 flex items-center gap-1.5 font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            isSelected
                              ? 'bg-red text-white'
                              : 'bg-white/5 text-red/90 border border-white/10'
                          }`}
                        >
                          {opt.codeOrId}
                        </span>
                      </div>

                      {/* Name Column */}
                      <div className="col-span-8 truncate">
                        <p className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-white/90'}`}>
                          {opt.name}
                        </p>
                        {opt.subtitle && (
                          <p className="text-[10px] text-white/40 truncate font-mono">
                            {opt.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
