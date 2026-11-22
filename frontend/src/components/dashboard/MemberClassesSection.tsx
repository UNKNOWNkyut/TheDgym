import { RefreshCw } from 'lucide-react';
import { CLASS_TYPE_LABELS, OFFICIAL_GROUP_CLASSES } from '@/constants/coaches';
import { formatScheduleDateTime } from '@/utils/formatters';
import type { ClassSession } from '@/types/auth';

interface MemberClassesSectionProps {
  groupClasses: ClassSession[];
  reservedCount: number;
  classFeedback: { type: 'success' | 'error'; message: string } | null;
  isLoadingClasses: boolean;
  classesError: string | null;
  togglingClassId: number | null;
  onRetry: () => void;
  onToggleReservation: (cls: ClassSession) => void;
}

export function MemberClassesSection({
  groupClasses,
  reservedCount,
  classFeedback,
  isLoadingClasses,
  classesError,
  togglingClassId,
  onRetry,
  onToggleReservation,
}: MemberClassesSectionProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
            Group Conditioning &amp; Class Reservations
          </h2>
          <p className="text-xs text-white/50">
            Reserve complimentary athlete slots for upcoming floor sessions
          </p>
        </div>
        <span className="text-xs font-mono text-emerald-400">
          {reservedCount} Active {reservedCount === 1 ? 'Booking' : 'Bookings'}
        </span>
      </div>

      {classFeedback && (
        <div
          role={classFeedback.type === 'error' ? 'alert' : 'status'}
          className={`px-4 py-2.5 rounded-xl border text-xs font-mono ${
            classFeedback.type === 'error'
              ? 'border-red/30 bg-red/10 text-red-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {classFeedback.message}
        </div>
      )}

      {isLoadingClasses ? (
        <div className="space-y-3">
          {[1, 2].map((skeleton) => (
            <div
              key={skeleton}
              className="h-20 rounded-xl border border-white/8 bg-white/[0.02] animate-pulse"
            />
          ))}
        </div>
      ) : classesError ? (
        <div className="p-5 rounded-xl border border-red/25 bg-red/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs font-mono text-red-200">{classesError}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 text-xs font-mono text-white cursor-pointer self-start sm:self-center"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : groupClasses.length === 0 ? (
        <div className="p-6 rounded-xl border border-white/8 bg-white/[0.02] space-y-3">
          <p className="text-xs font-mono text-white/75">
            No upcoming class sessions are open for advance reservation right now.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {OFFICIAL_GROUP_CLASSES.map((cls) => (
              <div
                key={cls.classType}
                className="p-3.5 rounded-lg border border-white/8 bg-black/30 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{cls.name}</span>
                  <span className="text-[11px] font-mono text-emerald-400">
                    {cls.rateLabel}
                  </span>
                </div>
                <p className="text-xs font-mono text-white/55">
                  {cls.coachName} • {cls.scheduleTime}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groupClasses.map((cls) => {
            const isReserved = cls.enrollments.length > 0;
            const spotsRemaining = Math.max(0, cls.max_capacity - cls.enrolled_count);
            const isFull = !isReserved && spotsRemaining === 0;
            const isUpdating = togglingClassId === cls.id;
            const typeLabel = CLASS_TYPE_LABELS[cls.class_type] || cls.class_type;

            return (
              <div
                key={cls.id}
                className="p-4 rounded-xl border border-white/8 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-white">{cls.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/8 text-white/75">
                      {cls.coach_name || typeLabel}
                    </span>
                    {cls.coach_name && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 text-white/55">
                        {typeLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/60 font-mono mt-1">
                    {formatScheduleDateTime(cls.scheduled_at)} • {cls.duration_minutes} mins
                    {cls.location ? ` • ${cls.location}` : ''}
                  </p>
                  <p className="text-[11px] text-white/45 font-mono mt-0.5">
                    Capacity: {cls.enrolled_count} / {cls.max_capacity} ({spotsRemaining}{' '}
                    {spotsRemaining === 1 ? 'spot' : 'spots'} left)
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isUpdating || isFull}
                  onClick={() => onToggleReservation(cls)}
                  className={`px-3 py-2 rounded-xl text-xs font-mono transition-all shrink-0 ${
                    isFull
                      ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
                      : isReserved
                        ? 'bg-red/20 text-red border border-red/40 hover:bg-red/30 cursor-pointer disabled:opacity-60'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer disabled:opacity-60'
                  }`}
                >
                  {isUpdating
                    ? 'Updating...'
                    : isFull
                      ? 'Class Full'
                      : isReserved
                        ? 'Cancel Reservation'
                        : 'Reserve Spot'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
