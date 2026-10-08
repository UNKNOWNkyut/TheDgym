import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { api } from '@/services/api'
import type { TrainerProfile, PTSession } from '@/types/auth'

const TIME_SLOTS = [
  '07:00 AM',
  '08:30 AM',
  '10:00 AM',
  '01:00 PM',
  '02:30 PM',
  '04:00 PM',
  '05:30 PM',
  '07:00 PM',
]

const STATUS_BADGES: Record<string, { label: string; style: string }> = {
  pending: {
    label: 'Pending Approval',
    style: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  },
  confirmed: {
    label: 'Confirmed',
    style: 'text-green-400 bg-green-400/10 border-green-400/20',
  },
  scheduled: {
    label: 'Scheduled',
    style: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  rejected: {
    label: 'Declined',
    style: 'text-red-400 bg-red-400/10 border-red-400/20',
  },
  completed: {
    label: 'Completed',
    style: 'text-white/40 bg-white/5 border-white/10',
  },
  cancelled: {
    label: 'Cancelled',
    style: 'text-white/40 bg-white/5 border-white/10',
  },
  no_show: {
    label: 'No Show',
    style: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  },
}

export function BookTrainerPage() {
  const [trainers, setTrainers] = useState<TrainerProfile[]>([])
  const [myBookings, setMyBookings] = useState<PTSession[]>([])
  const [selectedTrainer, setSelectedTrainer] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<string>(TIME_SLOTS[0])
  const [duration, setDuration] = useState<number>(60)
  const [notes, setNotes] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'book' | 'history'>('book')

  const containerRef = useRef<HTMLDivElement>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [trainersData, bookingsData] = await Promise.all([
        api.getAvailableTrainers(),
        api.getMyBookings(),
      ])
      setTrainers(trainersData)
      setMyBookings(bookingsData)
      if (trainersData.length > 0 && !selectedTrainer) {
        setSelectedTrainer(trainersData[0].id)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load booking details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Default date to tomorrow
    const tmrw = new Date()
    tmrw.setDate(tmrw.getDate() + 1)
    setSelectedDate(tmrw.toISOString().split('T')[0])
  }, [])

  useGSAP(() => {
    if (!loading) {
      gsap.from(containerRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
      })
    }
  }, { dependencies: [loading] })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTrainer) {
      setError('Please choose an instructor.')
      return
    }
    if (!selectedDate) {
      setError('Please choose a preferred date.')
      return
    }

    // Convert slot string (e.g., "02:30 PM") and date to ISO datetime
    const [time, period] = selectedSlot.split(' ')
    const [rawH, rawM] = time.split(':').map(Number)
    let hours = rawH
    if (period === 'PM' && hours < 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0

    const bookingDate = new Date(selectedDate)
    bookingDate.setHours(hours, rawM, 0, 0)

    setSubmitting(true)
    setError(null)
    setSuccessMsg(null)

    try {
      await api.bookPTSession({
        trainer_id: selectedTrainer,
        scheduled_at: bookingDate.toISOString(),
        duration_minutes: duration,
        notes: notes || undefined,
      })
      setSuccessMsg('Your booking request has been submitted! Waiting for instructor approval.')
      setNotes('')
      // Refresh bookings and switch to status view
      const updatedBookings = await api.getMyBookings()
      setMyBookings(updatedBookings)
      setActiveTab('history')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit booking.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelBooking = async (sessionId: number) => {
    try {
      await api.cancelPTSession(sessionId)
      const updated = await api.getMyBookings()
      setMyBookings(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel session.')
    }
  }

  return (
    <div ref={containerRef} className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/8 pb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40 font-mono mb-1">
            Coaching & Personal Training
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Book a Fitness Instructor
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Choose your certified coach, select a slot, and submit your 1-on-1 session request.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
          <button
            onClick={() => setActiveTab('book')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'book'
                ? 'bg-red text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            New Booking
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-red text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            My Bookings
            {myBookings.some((b) => b.status === 'pending') && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red/10 border border-red/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-green-400/10 border border-green-400/20 text-green-400 text-sm font-medium">
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-white/40 text-sm">
          Loading coaches and schedules…
        </div>
      ) : activeTab === 'book' ? (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* STEP 1: View & Choose Instructor */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red/20 text-red font-mono text-xs font-bold flex items-center justify-center border border-red/30">
                1
              </span>
              <h2 className="text-base font-semibold text-white">Choose Your Instructor</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trainers.map((t) => {
                const isSelected = selectedTrainer === t.id
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTrainer(t.id)}
                    className={`cursor-pointer rounded-2xl p-5 border transition-all text-left ${
                      isSelected
                        ? 'bg-red/10 border-red/40 ring-1 ring-red/40'
                        : 'bg-surface border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold text-sm uppercase">
                          {t.full_name.slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">{t.full_name}</h3>
                          <p className="text-xs text-white/40 font-mono">{t.email}</p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border uppercase tracking-wider font-semibold ${
                          isSelected
                            ? 'bg-red text-white border-red'
                            : 'bg-white/5 text-white/40 border-white/10'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </span>
                    </div>

                    <p className="text-xs text-white/60 line-clamp-2 mt-2 leading-relaxed">
                      {t.bio || 'Certified fitness coach specializing in strength and body recomposition.'}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {t.specialties.map((spec) => (
                        <span
                          key={spec}
                          className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* STEP 2: Select Date & Time */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red/20 text-red font-mono text-xs font-bold flex items-center justify-center border border-red/30">
                2
              </span>
              <h2 className="text-base font-semibold text-white">Select Date & Time Slot</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface p-6 rounded-2xl border border-white/10">
              <div>
                <label className="text-xs uppercase tracking-widest text-white/40 block mb-2 font-mono">
                  Preferred Date
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red/50 transition-colors"
                />
                <p className="text-xs text-white/30 mt-2">
                  Sessions must be booked at least 24 hours in advance.
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-white/40 block mb-2 font-mono">
                  Duration
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[60, 90].map((d) => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`py-3 rounded-xl border text-sm font-semibold transition-all ${
                        duration === d
                          ? 'bg-red/10 border-red/40 text-red font-bold'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      {d} Minutes
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-widest text-white/40 block mb-2 font-mono">
                  Available Time Slots
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {TIME_SLOTS.map((slot) => {
                    const isSlotSelected = selectedSlot === slot
                    return (
                      <button
                        type="button"
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-mono transition-all text-center ${
                          isSlotSelected
                            ? 'bg-red text-white border-red font-bold shadow-sm'
                            : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:border-white/20'
                        }`}
                      >
                        {slot}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3: Goals & Notes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red/20 text-red font-mono text-xs font-bold flex items-center justify-center border border-red/30">
                3
              </span>
              <h2 className="text-base font-semibold text-white">Focus & Training Goals</h2>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-white/10">
              <label className="text-xs uppercase tracking-widest text-white/40 block mb-2 font-mono">
                Session Goals / Remarks (Optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Form check for Barbell Squat, pre-competition tune-up, or powerlifting peaking advice..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/50 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full md:w-auto bg-red hover:bg-red/80 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all shadow-lg hover:shadow-red/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting Booking Request…' : 'Submit Booking Request'}
            </button>
          </div>
        </form>
      ) : (
        /* MY BOOKINGS & STATUS LIST */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Your Bookings & Status</h2>
            <button
              onClick={() => setActiveTab('book')}
              className="text-xs text-red hover:underline font-mono uppercase tracking-wider"
            >
              + Book Another Session
            </button>
          </div>

          {myBookings.length === 0 ? (
            <div className="bg-surface border border-white/10 rounded-2xl p-12 text-center text-white/40">
              <p className="text-4xl mb-3">🏋️</p>
              <p className="text-sm font-medium text-white mb-1">No bookings recorded yet.</p>
              <p className="text-xs text-white/40 mb-4">
                Select your fitness instructor and submit your first booking request.
              </p>
              <button
                onClick={() => setActiveTab('book')}
                className="bg-red text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-red/80 transition-colors"
              >
                Book Now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myBookings.map((b) => {
                const badge = STATUS_BADGES[b.status] || {
                  label: b.status,
                  style: 'text-white/40 bg-white/5 border-white/10',
                }

                const canCancel = b.status === 'pending' || b.status === 'confirmed' || b.status === 'scheduled'

                return (
                  <div
                    key={b.id}
                    className="bg-surface border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold uppercase tracking-wider font-mono ${badge.style}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-xs text-white/40 font-mono">
                          Booking #{b.id}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white">
                        {b.trainer_name ? `Coach: ${b.trainer_name}` : 'Instructor Assigned'}
                      </h3>

                      <p className="text-xs text-white/60 font-mono">
                        {new Date(b.scheduled_at).toLocaleDateString('en-PH', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(b.scheduled_at).toLocaleTimeString('en-PH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        ({b.duration_minutes} mins)
                      </p>

                      {b.notes && (
                        <p className="text-xs text-white/50 italic mt-1">
                          " {b.notes} "
                        </p>
                      )}

                      {b.rejection_reason && (
                        <div className="p-2.5 rounded-lg bg-red/10 border border-red/20 text-xs text-red-400 mt-2">
                          <span className="font-bold">Declined reason: </span>
                          {b.rejection_reason}
                        </div>
                      )}

                      {b.coach_notes && (
                        <div className="p-2.5 rounded-lg bg-green-400/10 border border-green-400/20 text-xs text-green-400 mt-2">
                          <span className="font-bold">Coach remarks: </span>
                          {b.coach_notes}
                        </div>
                      )}
                    </div>

                    {canCancel && (
                      <div className="shrink-0 pt-2 md:pt-0">
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          className="text-xs border border-white/10 text-white/50 hover:text-red hover:border-red/40 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Cancel Booking
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
