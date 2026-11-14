import { Link } from 'react-router-dom';
import { ArrowRight, Info, Lock, X } from 'lucide-react';
import {
  cleanExerciseName,
  type ExerciseItem,
  type FocusArea,
  type GoalType,
  type WorkoutSplitDay,
} from '@/components/plan/planUtils';

interface ExerciseDetailModalProps {
  exercise: ExerciseItem | null;
  weeklyWorkoutSplit: WorkoutSplitDay[];
  onClose: () => void;
  onAddExerciseToDay: (dayNumber: number, exercise: ExerciseItem) => void;
}

export function ExerciseDetailModal({
  exercise,
  weeklyWorkoutSplit,
  onClose,
  onAddExerciseToDay,
}: ExerciseDetailModalProps) {
  if (!exercise) return null;

  return (
    /* EXERCISE DETAIL MODAL WITH 3D GIF & ENGLISH INSTRUCTIONS */
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#111114] p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-red font-bold">
              {exercise.body_part} • {exercise.equipment}
            </span>
            <h3 className="text-xl font-bold text-white capitalize mt-0.5">
              {cleanExerciseName(exercise.name)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border border-white/10 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3D Animated GIF Showcase */}
        <div className="w-full aspect-video rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center p-3 relative shadow-inner">
          <img
            src={exercise.gif_url}
            alt={exercise.name}
            className="w-full h-full object-contain"
          />
        </div>

        {/* English Step-by-Step Instructions */}
        <div className="space-y-3">
          <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-white/50 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-red" />
            Execution Instructions
          </h4>

          {exercise.instruction_steps && exercise.instruction_steps.length > 0 ? (
            <ol className="space-y-2.5 text-xs text-white/80 leading-relaxed font-sans">
              {exercise.instruction_steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="w-5 h-5 rounded-full bg-red/10 text-red font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-white/70 leading-relaxed">
              {exercise.instructions}
            </p>
          )}
        </div>

        {/* Modal Footer with Add to Routine Selector placed full width, label on top, NO Close Demo button */}
        <div className="pt-4 border-t border-white/10 space-y-2">
          <label className="text-xs font-mono font-bold uppercase tracking-wider text-white/60 block">
            Add to Routine:
          </label>
          <select
            onChange={(e) => {
              const dayNum = parseInt(e.target.value, 10);
              if (!isNaN(dayNum)) {
                onAddExerciseToDay(dayNum, exercise);
                e.target.value = '';
              }
            }}
            defaultValue=""
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none focus:border-red transition-colors cursor-pointer"
          >
            <option value="" disabled className="bg-[#111114]">
              Choose Scheduled Day...
            </option>
            {weeklyWorkoutSplit
              .filter((d) => !d.isRest)
              .map((d) => (
                <option key={d.dayNumber} value={d.dayNumber} className="bg-[#111114] text-white">
                  {d.dayName} ({d.focusTitle})
                </option>
              ))}
          </select>
        </div>
      </div>
    </div>
  );
}

interface MembershipRequiredModalProps {
  open: boolean;
  goal: GoalType;
  frequency: number;
  selectedFocus: FocusArea[];
  onClose: () => void;
  onReviewSetup: () => void;
}

export function MembershipRequiredModal({
  open,
  goal,
  frequency,
  selectedFocus,
  onClose,
  onReviewSetup,
}: MembershipRequiredModalProps) {
  if (!open) return null;

  return (
    /* MEMBERSHIP PLAN REQUIRED MODAL (FOR REGISTERED USERS ON "START NOW") */
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-red/40 bg-[#121216] p-6 sm:p-7 shadow-2xl space-y-5 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Card Corner Close X Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-16 h-16 rounded-2xl bg-red/10 border border-red/30 text-red flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(239,68,68,0.25)]">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-red font-bold">
            Membership Plan Required
          </span>
          <h3 className="text-xl font-black uppercase text-white tracking-tight">
            Unlock Your Plan
          </h3>
          <p className="text-xs text-white/60 font-sans leading-relaxed">
            Kailangan mo munang mag-avail ng membership plan bago makapag-proceed sa Your Plan interactive dashboard, customizable weekly blueprint, at workout execution tracking.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-left font-mono text-xs space-y-1.5">
          <div className="flex items-center justify-between text-white/50 text-[10px] uppercase">
            <span>Personalized Setup:</span>
            <span className="text-emerald-400 font-bold">Generated</span>
          </div>
          <p className="text-white font-bold text-sm">
            {goal} • {frequency} Days / Week
          </p>
          <p className="text-[11px] text-white/40">
            Focus Areas: <span className="text-white capitalize">{selectedFocus.join(', ')}</span>
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <Link
            to="/membership"
            className="w-full py-3.5 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-[0_0_18px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Avail Membership Plan</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={onReviewSetup}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs font-mono transition-colors cursor-pointer"
          >
            Review Calculated Setup
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddExerciseToRoutineModalProps {
  exercise: ExerciseItem | null;
  weeklyWorkoutSplit: WorkoutSplitDay[];
  onClose: () => void;
  onSelectDay: (dayNumber: number, exercise: ExerciseItem) => void;
}

export function AddExerciseToRoutineModal({
  exercise,
  weeklyWorkoutSplit,
  onClose,
  onSelectDay,
}: AddExerciseToRoutineModalProps) {
  if (!exercise) return null;

  return (
    /* ADD EXERCISE TO ROUTINE MODAL (Clean, page-level overlay without clipping) */
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#141418] p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3 border-b border-white/10">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-red font-bold">
              Add to Routine
            </span>
            <h4 className="font-bold text-sm text-white capitalize mt-0.5">
              {cleanExerciseName(exercise.name)}
            </h4>
            <p className="text-[10px] text-white/40 font-mono capitalize">
              {exercise.body_part} • {exercise.equipment}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-mono tracking-wider text-white/50 font-bold block mb-1">
            Select Scheduled Workout Day:
          </span>
          {weeklyWorkoutSplit
            .filter((d) => !d.isRest)
            .map((d) => (
              <button
                key={d.dayNumber}
                type="button"
                onClick={() => {
                  onSelectDay(d.dayNumber, exercise);
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl border border-white/8 bg-white/5 hover:bg-red/15 hover:border-red/40 text-left text-xs font-mono text-white/80 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
              >
                <span className="font-semibold text-white group-hover:text-red">{d.dayName}</span>
                <span className="text-[10px] text-white/40 group-hover:text-white">{d.focusTitle}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
