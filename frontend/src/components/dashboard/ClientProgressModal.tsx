import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  Dumbbell,
  Flame,
  HeartPulse,
  Plus,
  Ruler,
  Scale,
  Utensils,
  X,
} from 'lucide-react';
import { api } from '@/services/api';
import type {
  ClientProgressReport,
  ProgressEntry,
  ProgressEntryCreatePayload,
} from '@/types/auth';

interface ClientProgressModalProps {
  memberId: number | null;
  fallbackName?: string;
  onClose: () => void;
}

type ModalTab = 'overview' | 'log' | 'plan';

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red';

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(ts));
}

function buildSparklinePoints(values: number[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return '4,22 116,22';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((val, idx) => {
      const x = 4 + (idx / (values.length - 1)) * 112;
      const y = 38 - ((val - min) / span) * 30;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

interface PlanScheduleItem {
  day?: string;
  focus?: string;
  exercises?: number;
}

interface MealItemPreview {
  badge?: string;
  title?: string;
  calories?: string;
}

function parseJsonSafe<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function ClientProgressModal({
  memberId,
  fallbackName,
  onClose,
}: ClientProgressModalProps) {
  if (memberId === null) return null;
  return (
    <ClientProgressModalContent
      key={memberId}
      memberId={memberId}
      fallbackName={fallbackName}
      onClose={onClose}
    />
  );
}

function ClientProgressModalContent({
  memberId,
  fallbackName,
  onClose,
}: {
  memberId: number;
  fallbackName?: string;
  onClose: () => void;
}) {
  const [report, setReport] = useState<ClientProgressReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('overview');

  // Log metric state
  const [exerciseName, setExerciseName] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');
  const [rir, setRir] = useState('');
  const [restSeconds, setRestSeconds] = useState('');
  const [bodyWeightKg, setBodyWeightKg] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [chestCm, setChestCm] = useState('');
  const [hipsCm, setHipsCm] = useState('');
  const [armsCm, setArmsCm] = useState('');
  const [thighsCm, setThighsCm] = useState('');
  const [rhr, setRhr] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);

  // Plan editor state
  const [goalFocus, setGoalFocus] = useState('');
  const [workoutSummary, setWorkoutSummary] = useState('');
  const [mealSummary, setMealSummary] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  const loadReport = useCallback(async (targetMemberId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMemberProgressReport(targetMemberId);
      setReport(data);
      setGoalFocus(data.assigned_plan?.goal_focus || '');
      setWorkoutSummary(data.assigned_plan?.workout_plan_summary || '');
      setMealSummary(data.assigned_plan?.meal_plan_summary || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load client progress report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport(memberId);
  }, [memberId, loadReport]);

  const entries = report?.entries || [];
  const chronological = [...entries].reverse();

  const weightTrend = chronological
    .map((e) => e.body_weight_kg)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const volumeTrend = chronological
    .map((e) => e.training_volume)
    .filter((v): v is number => v !== null && Number.isFinite(v));

  const latestStrength: ProgressEntry | undefined = entries.find(
    (e) => e.exercise_name || e.weight_kg !== null || e.training_volume !== null,
  );
  const latestBody: ProgressEntry | undefined = entries.find(
    (e) =>
      e.body_weight_kg !== null ||
      e.waist_cm !== null ||
      e.chest_cm !== null ||
      e.hips_cm !== null ||
      e.arms_cm !== null ||
      e.thighs_cm !== null,
  );

  const workoutSplit = parseJsonSafe<PlanScheduleItem[]>(report?.assigned_plan?.workout_split_json);
  const mealItems = parseJsonSafe<MealItemPreview[]>(report?.assigned_plan?.meal_plan_json);

  const handleLogSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingEntry(true);
    setError(null);
    const payload: ProgressEntryCreatePayload = {
      exercise_name: exerciseName.trim() || undefined,
      weight_kg: parseOptionalNumber(weightKg),
      sets: parseOptionalNumber(sets),
      reps: parseOptionalNumber(reps),
      rpe: parseOptionalNumber(rpe),
      rir: parseOptionalNumber(rir),
      rest_seconds: parseOptionalNumber(restSeconds),
      body_weight_kg: parseOptionalNumber(bodyWeightKg),
      waist_cm: parseOptionalNumber(waistCm),
      chest_cm: parseOptionalNumber(chestCm),
      hips_cm: parseOptionalNumber(hipsCm),
      arms_cm: parseOptionalNumber(armsCm),
      thighs_cm: parseOptionalNumber(thighsCm),
      resting_heart_rate: parseOptionalNumber(rhr),
      notes: entryNotes.trim() || undefined,
    };
    try {
      await api.createMemberProgressEntry(memberId, payload);
      setExerciseName('');
      setWeightKg('');
      setSets('');
      setReps('');
      setRpe('');
      setRir('');
      setRestSeconds('');
      setBodyWeightKg('');
      setWaistCm('');
      setChestCm('');
      setHipsCm('');
      setArmsCm('');
      setThighsCm('');
      setRhr('');
      setEntryNotes('');
      await loadReport(memberId);
      setActiveTab('overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save progress snapshot.');
    } finally {
      setSavingEntry(false);
    }
  };

  const handleSavePlan = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);
    setError(null);
    try {
      await api.updateMemberTrainingPlan(memberId, {
        goal_focus: goalFocus.trim() || null,
        workout_plan_summary: workoutSummary.trim() || null,
        meal_plan_summary: mealSummary.trim() || null,
      });
      await loadReport(memberId);
      setActiveTab('overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workout/meal plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  const computedPreviewVolume = (() => {
    const w = parseOptionalNumber(weightKg);
    const s = parseOptionalNumber(sets);
    const r = parseOptionalNumber(reps);
    if (w !== undefined && s !== undefined && r !== undefined) {
      return (w * s * r).toLocaleString();
    }
    return null;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-[#0a0a0e] p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-widest bg-red/15 text-red border border-red/30">
                Athlete Progress Report
              </span>
              {report?.member_code && (
                <span className="text-xs font-mono text-zinc-400">{report.member_code}</span>
              )}
              {report?.active_plan_name && (
                <span className="text-xs font-mono text-zinc-500">
                  • {report.active_plan_name}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-white mt-1">
              {report?.member_name || fallbackName || `Member #${memberId}`}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/70 p-0.5 text-xs font-mono">
              {(['overview', 'log', 'plan'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    activeTab === tab
                      ? 'bg-red text-white font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab === 'overview' ? 'Report' : tab === 'log' ? '+ Log Metric' : 'Edit Plan'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              aria-label="Close progress report"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-red/30 bg-red/10 text-xs font-mono text-red-200">
            {error}
          </div>
        )}

        {loading && !report ? (
          <div className="py-16 text-center text-sm font-mono text-zinc-400">
            Loading client workouts, nutrition blueprint, and biometric progress...
          </div>
        ) : activeTab === 'log' ? (
          <form onSubmit={handleLogSubmit} className="space-y-5">
            {/* Strength & Overload */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Dumbbell className="w-3.5 h-3.5 text-red" />
                  Strength &amp; Progressive Overload
                </span>
                {computedPreviewVolume && (
                  <span className="text-xs font-mono text-red">
                    Volume: {computedPreviewVolume} kg
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-mono text-zinc-400">Exercise Name</label>
                  <input
                    value={exerciseName}
                    onChange={(e) => setExerciseName(e.target.value)}
                    placeholder="e.g. Barbell Back Squat"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">Load (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="100"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">Sets × Reps</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      value={sets}
                      onChange={(e) => setSets(e.target.value)}
                      placeholder="4"
                      className={INPUT_CLASS}
                    />
                    <input
                      type="number"
                      value={reps}
                      onChange={(e) => setReps(e.target.value)}
                      placeholder="8"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">RPE (1–10)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={rpe}
                    onChange={(e) => setRpe(e.target.value)}
                    placeholder="8.5"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">RIR</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={rir}
                    onChange={(e) => setRir(e.target.value)}
                    placeholder="2"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">Rest (sec)</label>
                  <input
                    type="number"
                    value={restSeconds}
                    onChange={(e) => setRestSeconds(e.target.value)}
                    placeholder="90"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">Resting HR (bpm)</label>
                  <input
                    type="number"
                    value={rhr}
                    onChange={(e) => setRhr(e.target.value)}
                    placeholder="62"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>

            {/* Body Composition & Tape */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-red" />
                Body Composition &amp; Tape Measurements (cm / kg)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bodyWeightKg}
                    onChange={(e) => setBodyWeightKg(e.target.value)}
                    placeholder="72.4"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">Waist</label>
                  <input
                    type="number"
                    step="0.1"
                    value={waistCm}
                    onChange={(e) => setWaistCm(e.target.value)}
                    placeholder="79"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">Chest</label>
                  <input
                    type="number"
                    step="0.1"
                    value={chestCm}
                    onChange={(e) => setChestCm(e.target.value)}
                    placeholder="98"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">Hips</label>
                  <input
                    type="number"
                    step="0.1"
                    value={hipsCm}
                    onChange={(e) => setHipsCm(e.target.value)}
                    placeholder="94"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">Arms</label>
                  <input
                    type="number"
                    step="0.1"
                    value={armsCm}
                    onChange={(e) => setArmsCm(e.target.value)}
                    placeholder="35.5"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400">Thighs</label>
                  <input
                    type="number"
                    step="0.1"
                    value={thighsCm}
                    onChange={(e) => setThighsCm(e.target.value)}
                    placeholder="56"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-mono text-zinc-400">Coach Notes / Recovery Feedback</label>
                <textarea
                  rows={2}
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  placeholder="Form cues, overload progression, sleep/recovery note..."
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="px-4 py-2 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEntry}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-semibold cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                {savingEntry ? 'Saving...' : 'Save Progress Snapshot'}
              </button>
            </div>
          </form>
        ) : activeTab === 'plan' ? (
          <form onSubmit={handleSavePlan} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-zinc-400">Primary Training Goal</label>
              <input
                value={goalFocus}
                onChange={(e) => setGoalFocus(e.target.value)}
                placeholder="e.g. Hypertrophy Upper/Lower • 2,400 kcal high-protein"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="text-xs font-mono text-zinc-400">Assigned Workout Plan Summary</label>
              <textarea
                rows={3}
                value={workoutSummary}
                onChange={(e) => setWorkoutSummary(e.target.value)}
                placeholder="Mon/Thu Push & Squat, Tue/Fri Pull & Hinge, progressive overload @ RPE 8"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="text-xs font-mono text-zinc-400">Assigned Meal Plan Summary</label>
              <textarea
                rows={3}
                value={mealSummary}
                onChange={(e) => setMealSummary(e.target.value)}
                placeholder="4 high-protein meals/day: 160g protein, complex carbs pre/post workout"
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="px-4 py-2 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPlan}
                className="px-4 py-2 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-semibold cursor-pointer disabled:opacity-50"
              >
                {savingPlan ? 'Saving...' : 'Save Assigned Plan'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            {/* Assigned Plans */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5 text-red" />
                    Active Workout Plan
                  </span>
                  {report?.assigned_plan?.goal_focus && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {report.assigned_plan.goal_focus}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed">
                  {report?.assigned_plan?.workout_plan_summary ||
                    'No workout split synced yet. Client can save a routine in Your Plan, or click "Edit Plan" to assign one.'}
                </p>
                {workoutSplit && workoutSplit.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {workoutSplit.slice(0, 7).map((d, i) => (
                      <span
                        key={`${d.day || i}`}
                        className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-950 text-[10px] font-mono text-zinc-300"
                      >
                        {d.day || `Day ${i + 1}`}: {d.focus || 'Workout'}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-red" />
                  Active Meal Plan
                </span>
                <p className="text-xs text-zinc-200 leading-relaxed">
                  {report?.assigned_plan?.meal_plan_summary ||
                    'No nutrition blueprint synced yet. Click "Edit Plan" to specify daily calorie & macro targets.'}
                </p>
                {mealItems && mealItems.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {mealItems.slice(0, 4).map((m, i) => (
                      <div
                        key={`${m.badge || i}`}
                        className="px-2 py-1 rounded border border-zinc-800 bg-zinc-950 text-[10px] font-mono text-zinc-300 truncate"
                      >
                        <span className="text-red">{m.badge || `M${i + 1}`}:</span> {m.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3 Pillars Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Strength & Overload */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5 text-red" /> Strength &amp; Overload
                  </span>
                  {volumeTrend.length > 1 && (
                    <svg viewBox="0 0 120 42" className="w-20 h-7">
                      <polyline
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2"
                        points={buildSparklinePoints(volumeTrend)}
                      />
                    </svg>
                  )}
                </div>
                <p className="text-lg font-bold text-white">
                  {latestStrength?.training_volume != null
                    ? `${latestStrength.training_volume.toLocaleString()} kg vol`
                    : latestStrength?.weight_kg != null
                      ? `${latestStrength.weight_kg} kg load`
                      : 'No strength log yet'}
                </p>
                <p className="text-[11px] font-mono text-zinc-400">
                  {latestStrength?.exercise_name
                    ? `${latestStrength.exercise_name}: ${latestStrength.sets ?? '-'}×${latestStrength.reps ?? '-'} @ ${latestStrength.weight_kg ?? '-'}kg`
                    : 'Log load, sets, reps & RPE'}
                </p>
                <div className="flex gap-3 text-[11px] font-mono text-zinc-300 pt-1 border-t border-zinc-800/80">
                  <span>RPE: {latestStrength?.rpe ?? '—'}</span>
                  <span>RIR: {latestStrength?.rir ?? '—'}</span>
                  <span>Rest: {latestStrength?.rest_seconds ? `${latestStrength.rest_seconds}s` : '—'}</span>
                </div>
              </div>

              {/* Body Composition */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-red" /> Body Composition
                  </span>
                  {weightTrend.length > 1 && (
                    <svg viewBox="0 0 120 42" className="w-20 h-7">
                      <polyline
                        fill="none"
                        stroke="#e4e4e7"
                        strokeWidth="2"
                        points={buildSparklinePoints(weightTrend)}
                      />
                    </svg>
                  )}
                </div>
                <p className="text-lg font-bold text-white">
                  {latestBody?.body_weight_kg != null
                    ? `${latestBody.body_weight_kg} kg`
                    : 'No weigh-in yet'}
                </p>
                <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-[11px] font-mono text-zinc-400">
                  <span>Waist: {latestBody?.waist_cm ?? '—'}</span>
                  <span>Hips: {latestBody?.hips_cm ?? '—'}</span>
                  <span>Chest: {latestBody?.chest_cm ?? '—'}</span>
                  <span>Arms: {latestBody?.arms_cm ?? '—'}</span>
                  <span>Thighs: {latestBody?.thighs_cm ?? '—'}</span>
                </div>
              </div>

              {/* Cardio, Recovery & Consistency */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                <span className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-red" /> Cardio &amp; Consistency
                </span>
                <p className="text-lg font-bold text-white flex items-center gap-2">
                  <span>
                    {report?.attendance.latest_resting_heart_rate != null
                      ? `${report.attendance.latest_resting_heart_rate} bpm RHR`
                      : `${report?.attendance.active_week_streak ?? 0}-Wk Streak`}
                  </span>
                  <Flame className="w-4 h-4 text-red" />
                </p>
                <p className="text-[11px] font-mono text-zinc-400">
                  {report?.attendance.visits_last_30_days ?? 0} visits (30d) •{' '}
                  {report?.attendance.completed_pt_sessions ?? 0} PT completed
                </p>
                <p className="text-[11px] font-mono text-zinc-300 pt-1 border-t border-zinc-800/80">
                  Last Visit: {formatShortDate(report?.attendance.last_visit_at)} • Streak:{' '}
                  {report?.attendance.active_week_streak ?? 0} wks
                </p>
              </div>
            </div>

            {/* Historical Trend Entries */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-red" />
                  Historical Progress Log ({entries.length})
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('log')}
                  className="text-xs font-mono text-red hover:underline cursor-pointer"
                >
                  + Record New Check-in
                </button>
              </div>

              {entries.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-zinc-500">
                  No structured progress entries recorded yet.
                  {report?.recent_coach_notes && report.recent_coach_notes.length > 0 && (
                    <div className="mt-3 text-left max-w-xl mx-auto space-y-1 text-zinc-300">
                      <p className="text-[10px] uppercase text-zinc-500">Recent Session Notes:</p>
                      {report.recent_coach_notes.map((n, idx) => (
                        <p key={idx} className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5">
                          {n}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-[10px] font-mono uppercase text-zinc-500">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Lift &amp; Overload</th>
                        <th className="py-2.5 px-3">Volume / RPE / Rest</th>
                        <th className="py-2.5 px-3">Body &amp; Tape (cm)</th>
                        <th className="py-2.5 px-3">RHR / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {entries.slice(0, 12).map((entry) => (
                        <tr key={entry.id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-mono text-zinc-400 whitespace-nowrap">
                            {formatShortDate(entry.recorded_at)}
                          </td>
                          <td className="py-2.5 px-3 text-white font-medium">
                            {entry.exercise_name
                              ? `${entry.exercise_name} (${entry.weight_kg ?? '-'}kg • ${entry.sets ?? '-'}×${entry.reps ?? '-'})`
                              : 'Body / Cardio Check'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-300">
                            {entry.training_volume != null ? `${entry.training_volume} kg` : '—'}
                            {entry.rpe != null ? ` • RPE ${entry.rpe}` : ''}
                            {entry.rir != null ? ` • RIR ${entry.rir}` : ''}
                            {entry.rest_seconds != null ? ` • ${entry.rest_seconds}s` : ''}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-400">
                            {entry.body_weight_kg != null ? `${entry.body_weight_kg}kg` : '—'}
                            {entry.waist_cm != null ? ` • W:${entry.waist_cm}` : ''}
                            {entry.chest_cm != null ? ` C:${entry.chest_cm}` : ''}
                            {entry.arms_cm != null ? ` A:${entry.arms_cm}` : ''}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-300">
                            {entry.resting_heart_rate != null && (
                              <span className="font-mono text-red mr-2">
                                {entry.resting_heart_rate} bpm
                              </span>
                            )}
                            {entry.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
