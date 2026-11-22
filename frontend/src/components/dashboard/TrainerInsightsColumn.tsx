import { Link } from 'react-router-dom';
import { CheckCircle2, Dumbbell, TrendingUp } from 'lucide-react';
import { formatScheduleDateTime, getInitials } from '@/utils/formatters';
import type { AtRiskMemberItem, PTSession, PTSessionStatus } from '@/types/auth';

interface TrainerInsightsColumnProps {
  upNextSession: PTSession | null;
  getStatusLabel: (status: PTSessionStatus) => string;
  onOpenLogger: (session: PTSession) => void;
  insightsTab: 'flags' | 'history';
  onTabChange: (tab: 'flags' | 'history') => void;
  atRiskMembers: AtRiskMemberItem[];
  churnError: string | null;
  completedSessions: PTSession[];
  onViewProgress: (target: { memberId: number; memberName?: string }) => void;
}

export function TrainerInsightsColumn({
  upNextSession,
  getStatusLabel,
  onOpenLogger,
  insightsTab,
  onTabChange,
  atRiskMembers,
  churnError,
  completedSessions,
  onViewProgress,
}: TrainerInsightsColumnProps) {
  return (
    <div className="lg:col-span-5 space-y-6">
      {/* Top Card: Up-Next Client Snapshot */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-mono tracking-widest text-zinc-300 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red animate-pulse" aria-hidden="true" />
            NEXT SCHEDULED PT CLIENT
          </span>
          <span className="text-xs font-mono text-zinc-400">
            {upNextSession
              ? formatScheduleDateTime(upNextSession.scheduled_at)
              : 'No upcoming session'}
          </span>
        </div>

        {upNextSession ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white font-bold font-mono text-sm">
                {getInitials(upNextSession.member_name || 'Athlete')}
              </div>
              <div className="min-w-0">
                <Link
                  to={`/manage/members/${upNextSession.member_id}`}
                  className="text-base font-bold text-white hover:text-red transition-colors block truncate"
                >
                  {upNextSession.member_name || upNextSession.member_code || 'Assigned Athlete'}
                </Link>
                <p className="text-xs text-zinc-400 font-mono">
                  {upNextSession.duration_minutes} mins •{' '}
                  {getStatusLabel(upNextSession.status)}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs space-y-2">
              <p className="text-zinc-400 font-mono uppercase text-[10px]">
                Client Notes &amp; Focus:
              </p>
              <p className="text-zinc-200 font-medium">
                {upNextSession.notes || 'No specific athlete notes attached to this booking.'}
              </p>
              {upNextSession.coach_notes && (
                <p className="text-zinc-300 font-mono pt-2 border-t border-zinc-800/80">
                  Coach Log: {upNextSession.coach_notes}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onOpenLogger(upNextSession)}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Dumbbell className="w-3.5 h-3.5 text-red" />
              <span>Log Coaching / Set Notes</span>
            </button>
          </div>
        ) : (
          <div className="py-4 text-center space-y-2">
            <p className="text-xs text-zinc-400 font-mono">
              No upcoming confirmed 1-on-1 PT sessions right now.
            </p>
            <Link
              to="/manage/pt-sessions"
              className="inline-block text-xs font-mono text-red hover:underline"
            >
              Manage PT Schedule →
            </Link>
          </div>
        )}
      </div>

      {/* Bottom Card: Retention Flags & Completed PT History */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="inline-flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 w-full">
            <button
              type="button"
              onClick={() => onTabChange('flags')}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                insightsTab === 'flags'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Retention Flags ({atRiskMembers.length})
            </button>
            <button
              type="button"
              onClick={() => onTabChange('history')}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                insightsTab === 'history'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Completed PT ({completedSessions.length})
            </button>
          </div>
        </div>

        {insightsTab === 'flags' ? (
          churnError ? (
            <p className="text-xs text-zinc-400 py-4 text-center font-mono">{churnError}</p>
          ) : atRiskMembers.length === 0 ? (
            <p className="text-xs text-zinc-400 py-6 text-center font-mono">
              No high or medium churn risk members flagged right now.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {atRiskMembers.slice(0, 8).map((member) => (
                <div
                  key={member.member_id}
                  className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm text-white truncate">
                        {member.full_name}
                      </span>
                      <span
                        className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border font-semibold ${
                          member.risk_tier === 'HIGH'
                            ? 'bg-red/10 text-red border-red/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {member.risk_tier} RISK ({Math.round(member.churn_probability * 100)}%)
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {member.top_risk_factors[0] ||
                        `${member.days_since_last_checkin} days since last gym check-in`}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono mt-1">
                      Code: {member.member_code} • Last check-in:{' '}
                      {member.days_since_last_checkin}d ago
                    </p>
                  </div>

                  <Link
                    to={`/manage/members/${member.member_id}`}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[11px] font-mono border border-zinc-800 transition-colors shrink-0"
                  >
                    Profile →
                  </Link>
                </div>
              ))}
            </div>
          )
        ) : completedSessions.length === 0 ? (
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 text-center space-y-1.5">
            <p className="text-xs text-zinc-400 font-mono">
              No completed PT sessions recorded yet.
            </p>
            <Link
              to="/manage/members"
              className="inline-block text-xs text-red hover:underline font-mono"
            >
              View Gym Members →
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {completedSessions.slice(0, 8).map((sess) => (
              <div
                key={sess.id}
                className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/manage/members/${sess.member_id}`}
                      className="font-semibold text-sm text-white hover:text-red transition-colors truncate"
                    >
                      {sess.member_name || sess.member_code || `Member #${sess.member_id}`}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onViewProgress({
                            memberId: sess.member_id,
                            memberName: sess.member_name || sess.member_code || undefined,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red/30 bg-red/10 text-[10px] font-mono text-red hover:bg-red hover:text-white transition-colors cursor-pointer"
                      >
                        <TrendingUp className="w-3 h-3" />
                        <span>View Progress</span>
                      </button>
                      <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                        {formatScheduleDateTime(sess.scheduled_at)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    {sess.coach_notes || `${sess.duration_minutes} min session completed`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
