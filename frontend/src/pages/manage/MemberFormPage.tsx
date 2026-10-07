import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/services/api'
import type { MemberCreate, Gender } from '@/types/auth'

gsap.registerPlugin()

const GENDER_OPTIONS: { value: Gender | ''; label: string }[] = [
  { value: '', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

export function MemberFormPage() {
  const navigate = useNavigate()
  const formRef = useRef<HTMLDivElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState<{
    first_name: string
    last_name: string
    email: string
    phone: string
    date_of_birth: string
    gender: Gender | ''
    address: string
    emergency_contact_name: string
    emergency_contact_phone: string
    notes: string
  }>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: '',
  })

  useGSAP(() => {
    gsap.from(formRef.current, { opacity: 0, y: 20, duration: 0.4, ease: 'power2.out' })
  }, { scope: formRef })

  const handleChange = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First name and last name are required.')
      return
    }

    setSubmitting(true)
    setError(null)

    const payload: MemberCreate = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      date_of_birth: form.date_of_birth || undefined,
      gender: form.gender || undefined,
      address: form.address.trim() || undefined,
      emergency_contact_name: form.emergency_contact_name.trim() || undefined,
      emergency_contact_phone: form.emergency_contact_phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }

    try {
      const member = await api.createMember(payload)
      navigate(`/manage/members/${member.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register member.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SEO title="Register Member" description="Add a new gym member to The DGym." />

      <div ref={formRef} className="p-6 md:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/manage/members" className="text-white/40 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">Members</p>
            <h1 className="font-display text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
              Register New Member
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Info */}
          <div className="p-6 rounded-xl border border-white/8 bg-surface">
            <h2 className="text-xs uppercase tracking-widest text-white/40 mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name *"
                name="first_name"
                type="text"
                placeholder="e.g. Juan"
                value={form.first_name}
                onChange={handleChange('first_name')}
              />
              <Input
                label="Last Name *"
                name="last_name"
                type="text"
                placeholder="e.g. Dela Cruz"
                value={form.last_name}
                onChange={handleChange('last_name')}
              />
              <Input
                label="Email Address"
                name="email"
                type="email"
                placeholder="member@email.com"
                value={form.email}
                onChange={handleChange('email')}
              />
              <Input
                label="Phone Number"
                name="phone"
                type="tel"
                placeholder="09XX XXX XXXX"
                value={form.phone}
                onChange={handleChange('phone')}
              />
              <Input
                label="Date of Birth"
                name="date_of_birth"
                type="date"
                placeholder=""
                value={form.date_of_birth}
                onChange={handleChange('date_of_birth')}
              />
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
                  Gender
                </label>
                <select
                  value={form.gender}
                  onChange={handleChange('gender')}
                  className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
                >
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-surface-2">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
                Address
              </label>
              <input
                type="text"
                placeholder="Street, Barangay, City, Province"
                value={form.address}
                onChange={handleChange('address')}
                className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/40 transition-colors"
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="p-6 rounded-xl border border-white/8 bg-surface">
            <h2 className="text-xs uppercase tracking-widest text-white/40 mb-4">Emergency Contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Contact Name"
                name="emergency_contact_name"
                type="text"
                placeholder="Full name"
                value={form.emergency_contact_name}
                onChange={handleChange('emergency_contact_name')}
              />
              <Input
                label="Contact Phone"
                name="emergency_contact_phone"
                type="tel"
                placeholder="09XX XXX XXXX"
                value={form.emergency_contact_phone}
                onChange={handleChange('emergency_contact_phone')}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="p-6 rounded-xl border border-white/8 bg-surface">
            <h2 className="text-xs uppercase tracking-widest text-white/40 mb-4">Admin Notes</h2>
            <textarea
              rows={3}
              placeholder="Internal notes about this member (injuries, special access, etc.)..."
              value={form.notes}
              onChange={handleChange('notes')}
              className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/40 transition-colors resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl border border-red/30 bg-red/10 text-red text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link to="/manage/members">
              <Button variant="ghost" type="button">Cancel</Button>
            </Link>
            <Button variant="primary" type="submit" loading={submitting}>
              Register Member
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
