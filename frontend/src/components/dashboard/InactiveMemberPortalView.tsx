import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Lock, ShieldAlert } from 'lucide-react';
import { OFFICIAL_GROUP_CLASSES } from '@/constants/coaches';
import { GYM_INFO } from '@/constants/gymInfo';
import { PUBLIC_PLANS } from '@/constants/plans';

interface InactiveMemberPortalViewProps {
  activationStepsCompleted: number;
  isPendingPayment: boolean;
  email: string;
  onSelectPlan: (slug: string) => void;
}

export function InactiveMemberPortalView({
  activationStepsCompleted,
  isPendingPayment,
  email,
  onSelectPlan,
}: InactiveMemberPortalViewProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Membership Activation Steps & Status Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold uppercase tracking-tight text-white font-mono">
                Membership Activation Progress
              </h2>
              <p className="text-xs text-white/50">
                Follow these 3 steps to activate your pass and unlock bookings
              </p>
            </div>
            <span className="text-xs font-mono text-amber-400 font-bold">
              {activationStepsCompleted} of 3 Done
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all"
              style={{ width: `${(activationStepsCompleted / 3) * 100}%` }}
            />
          </div>

          <div className="space-y-3 pt-2">
            {/* Step 1: Account Created */}
            <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.03] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-mono text-white">DGym athlete account active</p>
                  <p className="text-[11px] font-mono text-white/50 truncate">{email}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 shrink-0">
                Completed
              </span>
            </div>

            {/* Step 2: Select & Pay Membership Pass */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isPendingPayment
                  ? 'border-amber-500/35 bg-amber-500/[0.05]'
                  : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-mono text-white">
                  {isPendingPayment
                    ? 'Verify pending checkout payment'
                    : 'Choose a training pass (Day Pass, Monthly, or Long-Term)'}
                </p>
                <p className="text-[11px] font-mono text-white/50 mt-0.5">
                  {isPendingPayment
                    ? 'Your invoice is awaiting payment verification.'
                    : 'Pick a plan below to proceed to secure Xendit checkout.'}
                </p>
              </div>
              <Link
                to={isPendingPayment ? '/payment' : '/payment?plan=monthly'}
                className="text-xs font-mono font-bold text-amber-400 hover:underline shrink-0"
              >
                {isPendingPayment ? 'Resume Payment →' : 'Go to Checkout →'}
              </Link>
            </div>

            {/* Step 3: Keycard Pairing & Floor Access */}
            <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-mono text-white/80">
                  Collect NFC smart keycard at reception &amp; book floor classes
                </p>
                <p className="text-[11px] font-mono text-white/45 mt-0.5">
                  Available immediately once your pass status turns Active.
                </p>
              </div>
              <Link
                to="/trainers"
                className="text-xs font-mono text-white/60 hover:text-white transition-colors shrink-0"
              >
                Meet Coaches →
              </Link>
            </div>
          </div>
        </div>

        {/* Status Notice Card */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
              <ShieldAlert className="w-4 h-4" />
              <span>{isPendingPayment ? 'PAYMENT PENDING' : 'NO ACTIVE PASS'}</span>
            </div>
            <h3 className="text-base font-bold text-white">
              {isPendingPayment ? 'Checkout Awaiting Verification' : 'Ready to Start Training?'}
            </h3>
            <p className="text-xs text-white/65 mt-1 leading-relaxed">
              {isPendingPayment
                ? 'Your checkout invoice is pending confirmation. Resume payment verification to activate your NFC smart keycard and gym access.'
                : 'Your athlete profile is registered at our Rosario facility. Choose a pass below to unlock NFC smart keycard access, lockers, and coaching sessions.'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/8 text-[11px] font-mono space-y-1">
            <p className="text-white/50 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-white/40" />
              Facility Hours:
            </p>
            <p className="text-white">{GYM_INFO.operatingHoursSummary}</p>
          </div>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight text-white font-mono">
            Select a Training Pass
          </h2>
          <p className="text-xs text-white/50">
            Automatic membership activation upon payment
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PUBLIC_PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={`rounded-2xl border p-6 flex flex-col justify-between space-y-5 transition-all ${
                plan.highlight
                  ? 'border-red/40 bg-gradient-to-b from-red/10 to-[#0d0d11] shadow-[0_0_20px_rgba(229,32,26,0.15)]'
                  : 'border-white/10 bg-[#0d0d11] hover:border-white/20'
              }`}
            >
              <div>
                {plan.badge && (
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest bg-red/20 text-red border border-red/30 mb-3">
                    {plan.badge}
                  </span>
                )}
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-mono text-white">
                    {plan.priceFormatted}
                  </span>
                  <span className="text-xs font-mono text-white/50">{plan.period}</span>
                </div>
                <p className="text-xs text-white/65 mt-2 leading-relaxed">
                  {plan.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onSelectPlan(plan.slug)}
                className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  plan.highlight
                    ? 'bg-red hover:bg-red-hover text-white shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                Avail This Plan
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Locked Group Conditioning Preview (Official Schedule) */}
      <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-white/50" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/75 font-mono">
              Complimentary Evening Classes (Pass Required)
            </h3>
          </div>
          <span className="text-xs font-mono text-amber-400">Included with Membership</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
          {OFFICIAL_GROUP_CLASSES.map((cls) => (
            <div
              key={cls.classType}
              className="p-4 rounded-xl border border-white/8 bg-white/[0.02] space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm text-white">{cls.name}</p>
                <span className="text-[11px] font-mono text-emerald-400">{cls.rateLabel}</span>
              </div>
              <p className="text-xs text-white/55 font-mono">
                {cls.coachName} • {cls.scheduleTime}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
