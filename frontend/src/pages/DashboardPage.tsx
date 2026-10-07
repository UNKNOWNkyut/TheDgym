import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

export function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  // Admin and Staff are routed directly to the Management Hub
  if (user.role === 'admin' || user.role === 'staff') {
    return <Navigate to="/manage" replace />
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'trainer':
        return 'warning' as const
      default:
        return 'success' as const
    }
  }

  return (
    <>
      <SEO
        title="Dashboard"
        description="The DGym member & trainer portal."
      />

      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Header bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs uppercase tracking-widest text-white/40 font-mono">
                Account ID #{user.id}
              </span>
              <Badge variant={getRoleBadgeVariant(user.role)} dot>
                {user.role.toUpperCase()}
              </Badge>
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-black uppercase tracking-tight text-white">
              Welcome, {user.full_name}
            </h1>
            <p className="text-sm text-white/50 mt-1 max-w-xl">
              {user.role === 'trainer'
                ? 'Assigned personal training roster, coaching schedules, and athlete sessions.'
                : 'Your active membership pass, class access, and coaching details.'}
            </p>
          </div>
        </div>

        {/* User profile & privileges summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
              Account Credentials
            </p>
            <p className="font-display text-lg font-bold text-white truncate">
              {user.email}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {user.phone ? `Phone: ${user.phone}` : 'No phone linked'}
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
              Membership Status
            </p>
            <p className="font-display text-lg font-bold text-green-400 uppercase">
              Active & Verified
            </p>
            <p className="text-xs text-white/40 mt-1">
              The DGym Rosario Batangas
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
              Member Since
            </p>
            <p className="font-display text-lg font-bold text-white">
              {new Date(user.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <p className="text-xs text-white/40 mt-1">
              Official Athlete Profile
            </p>
          </Card>
        </div>

        {/* Trainer Specific View */}
        {user.role === 'trainer' && (
          <div className="p-8 rounded-2xl border border-white/8 bg-surface">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white mb-2">
              Trainer Roster & Sessions
            </h2>
            <p className="text-sm text-white/50 mb-6">
              Assigned personal training clients, athlete programming, and class schedules.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-white/8 bg-surface-2">
                <p className="text-xs uppercase tracking-wider text-white/40 mb-1">Active Trainees</p>
                <p className="text-2xl font-bold font-display text-white">8 Clients</p>
              </div>
              <div className="p-4 rounded-xl border border-white/8 bg-surface-2">
                <p className="text-xs uppercase tracking-wider text-white/40 mb-1">Weekly PT Hours</p>
                <p className="text-2xl font-bold font-display text-white">24 Hours</p>
              </div>
              <div className="p-4 rounded-xl border border-white/8 bg-surface-2">
                <p className="text-xs uppercase tracking-wider text-white/40 mb-1">Assigned Classes</p>
                <p className="text-2xl font-bold font-display text-white">Barbell Club</p>
              </div>
            </div>
          </div>
        )}

        {/* Member Specific View */}
        {user.role === 'member' && (
          <div className="space-y-6">
            <div className="p-8 rounded-2xl border border-white/8 bg-surface">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
                    Membership Pass
                  </h2>
                  <p className="text-sm text-white/50 mt-1">
                    Present this pass at front desk for seamless check-in.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs uppercase tracking-widest text-green-400 font-semibold font-mono">
                    Access Granted
                  </span>
                </div>
              </div>

              <div className="p-6 rounded-xl border border-white/10 bg-surface-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/40 font-mono mb-1">
                    Pass Type
                  </p>
                  <p className="text-xl font-bold text-white font-display uppercase">
                    Monthly Unlimited Pass
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    Includes open gym equipment access and standard barbell turf.
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-xs uppercase tracking-widest text-white/40 font-mono mb-1">
                    Location
                  </p>
                  <p className="text-sm font-semibold text-white">
                    Rosario, Batangas
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 rounded-xl border border-white/8 bg-surface">
                <h3 className="font-display text-lg font-bold uppercase text-white mb-2">
                  Group Conditioning
                </h3>
                <p className="text-sm text-white/50">
                  Strength, conditioning, and barbell turf sessions available daily. Inquire with staff at front desk.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-white/8 bg-surface">
                <h3 className="font-display text-lg font-bold uppercase text-white mb-2">
                  Personal Coaching
                </h3>
                <p className="text-sm text-white/50">
                  Work directly with DGym certified coaches for tailored programming and technique refinement.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
