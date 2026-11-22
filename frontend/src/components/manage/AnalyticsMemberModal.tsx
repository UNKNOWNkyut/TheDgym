import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { QuarterRing } from '@/components/ui/quarter-ring'
import type { MemberChurnDetail, RetentionStrategy } from '@/types/auth'

interface AnalyticsMemberModalProps {
  selectedMember: MemberChurnDetail
  strategy: RetentionStrategy | null
  isGeneratingStrategy: boolean
  isDispatchingOffer: boolean
  activeModalTab: 'DIAGNOSIS' | 'RETENTION'
  strategyError: string | null
  dispatchSuccess: string | null
  onClose: () => void
  onChangeTab: (tab: 'DIAGNOSIS' | 'RETENTION') => void
  onGenerateStrategy: () => void
  onDispatchOffer: () => void
}

export function AnalyticsMemberModal({
  selectedMember,
  strategy,
  isGeneratingStrategy,
  isDispatchingOffer,
  activeModalTab,
  strategyError,
  dispatchSuccess,
  onClose,
  onChangeTab,
  onGenerateStrategy,
  onDispatchOffer,
}: AnalyticsMemberModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/15 bg-[#121215] p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-white/10 pb-4">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-red-500 font-semibold">
              Member Retention &amp; Intelligence Hub
            </span>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mt-0.5">
              {selectedMember.full_name}
            </h3>
            <span className="text-xs text-white/40 font-mono">
              {selectedMember.member_code} &bull; Status: {selectedMember.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/8 pb-3 text-xs font-mono">
          <button
            type="button"
            onClick={() => onChangeTab('RETENTION')}
            className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
              activeModalTab === 'RETENTION'
                ? 'border-red/40 bg-red/15 text-red font-semibold shadow-[0_0_15px_rgba(229,32,26,0.2)]'
                : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            <span>AI Retention Strategy &amp; Offer</span>
            {strategy && <span className="w-2 h-2 rounded-full bg-red animate-pulse" />}
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('DIAGNOSIS')}
            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
              activeModalTab === 'DIAGNOSIS'
                ? 'border-white/30 bg-white/10 text-white font-semibold'
                : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            Risk Signals &amp; Feature Vector
          </button>
        </div>

        {/* Notifications / Alerts */}
        {dispatchSuccess && (
          <div className="p-3 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-mono flex items-center gap-2 animate-fade-in">
            <span>✓</span>
            <span>{dispatchSuccess}</span>
          </div>
        )}

        {strategyError && (
          <div className="p-3 rounded-xl border border-red/30 bg-red/10 text-red text-xs font-mono flex items-center gap-2 animate-fade-in">
            <span>✕</span>
            <span>{strategyError}</span>
          </div>
        )}

        {/* TAB 1: AI RETENTION STRATEGY & OFFER */}
        {activeModalTab === 'RETENTION' && (
          <div className="space-y-4">
            {isGeneratingStrategy ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <QuarterRing className="size-8 text-red" />
                <p className="text-xs uppercase tracking-widest text-white/70 font-mono">
                  Generating AI Retention Playbook...
                </p>
                <p className="text-[11px] text-white/40 font-mono">
                  Synthesizing attendance velocity and churn signals
                </p>
              </div>
            ) : !strategy ? (
              <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02] text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-red/10 border border-red/20 mx-auto flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-red" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white uppercase tracking-tight">
                    AI Retention Playbook Ready
                  </h4>
                  <p className="text-xs text-white/50 max-w-md mx-auto mt-1 leading-relaxed">
                    Generate a tailored re-engagement strategy and customized promo offer for {selectedMember.full_name} based on their {selectedMember.risk_tier} churn risk signals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onGenerateStrategy}
                  className="px-4 py-2 rounded-lg bg-red hover:bg-red-hover text-white text-xs font-semibold uppercase tracking-wider font-mono transition-all shadow-[0_0_20px_rgba(229,32,26,0.3)] cursor-pointer"
                >
                  Generate AI Retention Strategy &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {/* Strategy Header */}
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-white/40">
                      AI Retention Playbook
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          strategy.urgency === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : strategy.urgency === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {strategy.urgency} URGENCY
                      </span>
                      {strategy.status === 'dispatched' && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                          DISPATCHED
                        </span>
                      )}
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-white">
                    {strategy.strategy_title}
                  </h4>

                  <p className="text-xs text-white/70 leading-relaxed">
                    {strategy.diagnosis_summary}
                  </p>
                </div>

                {/* Tactical Action Steps */}
                <div className="p-4 rounded-xl border border-white/8 bg-white/[0.02] space-y-2">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 block">
                    Recommended Tactical Actions (Staff &amp; Coaches)
                  </span>
                  <ul className="space-y-1.5 text-xs text-white/80 font-mono">
                    {strategy.tactical_action_steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-red font-bold mt-0.5">&bull;</span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Personalized Offer Preview & Dispatch */}
                <div className="p-4 rounded-xl border border-red/30 bg-red/[0.04] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-red font-semibold">
                      Targeted Retention Offer
                    </span>
                    <span className="text-[10px] font-mono text-white/40">
                      Destination: {strategy.offer_action_url}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-white">
                      {strategy.offer_title}
                    </p>
                    <p className="text-xs text-white/70 mt-1 leading-relaxed">
                      "{strategy.offer_message}"
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-red/20">
                    <span className="text-[11px] text-white/40 font-mono">
                      CTA Button: <strong className="text-white">{strategy.offer_action_text}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onGenerateStrategy}
                        disabled={isGeneratingStrategy}
                        className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-mono transition-all cursor-pointer"
                      >
                        Re-generate
                      </button>

                      <button
                        type="button"
                        onClick={onDispatchOffer}
                        disabled={isDispatchingOffer}
                        className="px-4 py-1.5 rounded-lg bg-red hover:bg-red-hover text-white text-xs font-semibold font-mono uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(229,32,26,0.3)] disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                      >
                        {isDispatchingOffer ? (
                          <span>Sending...</span>
                        ) : strategy.status === 'dispatched' ? (
                          <span>Re-send Offer</span>
                        ) : (
                          <span>Dispatch Offer to Member</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DIAGNOSTIC SIGNALS & ML VECTOR */}
        {activeModalTab === 'DIAGNOSIS' && (
          <div className="space-y-4">
            {/* Risk Tier & Score */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 block">
                  XGBoost Churn Risk Tier
                </span>
                <span
                  className={`text-lg font-black font-mono ${
                    selectedMember.risk_tier === 'HIGH'
                      ? 'text-red-400'
                      : selectedMember.risk_tier === 'MEDIUM'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {selectedMember.risk_tier} RISK
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 block">
                  Probability
                </span>
                <span className="text-2xl font-black text-white font-mono">
                  {Math.round(selectedMember.churn_probability * 100)}%
                </span>
              </div>
            </div>

            {/* Contributing Risk Signals */}
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 block mb-2">
                Primary Contributing Signals
              </span>
              <ul className="space-y-1.5">
                {selectedMember.top_risk_factors.map((f, i) => (
                  <li key={i} className="text-xs text-red-300/90 font-mono flex items-center gap-2">
                    <span className="text-red-500">&bull;</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Feature Vector Table */}
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 block mb-2">
                Feature Vector (ML Ingestion Metrics)
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                  <span className="text-white/40 block text-[10px]">Weekly Check-ins</span>
                  <span className="text-white font-semibold">
                    {selectedMember.features.visit_frequency_weekly}x/week
                  </span>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                  <span className="text-white/40 block text-[10px]">Days Inactive</span>
                  <span className="text-white font-semibold">
                    {selectedMember.features.days_since_last_checkin} days
                  </span>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                  <span className="text-white/40 block text-[10px]">Visits (30 Days)</span>
                  <span className="text-white font-semibold">
                    {selectedMember.features.total_visits_30d} entries
                  </span>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                  <span className="text-white/40 block text-[10px]">Tenure</span>
                  <span className="text-white font-semibold">
                    {selectedMember.features.membership_tenure_days} days
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onChangeTab('RETENTION')
                  if (!strategy) {
                    onGenerateStrategy()
                  }
                }}
                className="w-full py-2.5 rounded-xl border border-red/30 bg-red/10 hover:bg-red/20 text-red text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>View / Generate AI Retention Strategy</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Action */}
        <div className="pt-3 border-t border-white/10 flex justify-between items-center">
          <Link
            to={`/manage/members/${selectedMember.member_id}`}
            state={{ from: 'analytics' }}
            className="text-xs text-red-400 hover:text-red-300 font-mono underline"
          >
            View Full Member Profile &rarr;
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-mono transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
