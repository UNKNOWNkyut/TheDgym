import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, X } from 'lucide-react';
import { api } from '@/services/api';
import { extractErrorMessage, formatScheduleDateTime } from '@/utils/formatters';
import type { PTSession, PTSessionStatus } from '@/types/auth';

function formatCoachNoteRecord(params: {
  exercise: string;
  weightKg: string;
  reps: string;
  rpe: string;
  notes: string;
}): string {
  const exerciseTrim = params.exercise.trim();
  const weightTrim = params.weightKg.trim();
  const repsTrim = params.reps.trim();
  const rpeTrim = params.rpe.trim();
  const notesTrim = params.notes.trim();

  const metrics: string[] = [];
  if (weightTrim) metrics.push(`${weightTrim}kg`);
  if (repsTrim) metrics.push(`${repsTrim} reps`);
  if (rpeTrim) metrics.push(`RPE ${rpeTrim}`);

  const lines: string[] = [];
  if (exerciseTrim) {
    lines.push(metrics.length ? `${exerciseTrim} (${metrics.join(' • ')})` : exerciseTrim);
  }
  if (notesTrim) {
    lines.push(notesTrim);
  }

  return lines.join(' — ').slice(0, 1000);
}

interface TrainerSessionNoteModalProps {
  initialSessionId: string;
  loggableSessions: PTSession[];
  getStatusLabel: (status: PTSessionStatus) => string;
  onClose: () => void;
  onSaved: (updated: PTSession) => void;
}

export function TrainerSessionNoteModal({
  initialSessionId,
  loggableSessions,
  getStatusLabel,
  onClose,
  onSaved,
}: TrainerSessionNoteModalProps) {
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId);
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseWeight, setExerciseWeight] = useState('');
  const [exerciseReps, setExerciseReps] = useState('');
  const [exerciseRpe, setExerciseRpe] = useState('');
  const [coachFreeNotes, setCoachFreeNotes] = useState(
    () => loggableSessions.find((s) => String(s.id) === initialSessionId)?.coach_notes || '',
  );
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [loggerError, setLoggerError] = useState<string | null>(null);

  const handleSaveLog = async (e: FormEvent) => {
    e.preventDefault();
    const sessionId = Number(selectedSessionId);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      setLoggerError('Please select a PT session to attach these notes to.');
      return;
    }

    const formattedNote = formatCoachNoteRecord({
      exercise: exerciseName,
      weightKg: exerciseWeight,
      reps: exerciseReps,
      rpe: exerciseRpe,
      notes: coachFreeNotes,
    });

    if (!formattedNote) {
      setLoggerError('Enter an exercise record or coaching notes before saving.');
      return;
    }

    setIsSavingLog(true);
    setLoggerError(null);

    try {
      const updated = await api.updatePTSession(sessionId, { coach_notes: formattedNote });
      onSaved(updated);
    } catch (err) {
      setLoggerError(extractErrorMessage(err, 'Unable to save session notes.'));
    } finally {
      setIsSavingLog(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-red" />
            <h3 className="font-bold text-base uppercase text-white font-mono">
              Coach Session Notes Logger
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loggableSessions.length === 0 ? (
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-center space-y-3">
            <p className="text-xs font-mono text-zinc-300">
              You do not have any assigned PT sessions to attach workout notes to yet.
            </p>
            <Link
              to="/manage/pt-sessions"
              onClick={onClose}
              className="inline-block px-4 py-2 rounded-lg bg-red hover:bg-red-hover text-white text-xs font-mono uppercase tracking-wider"
            >
              Go to PT Schedule
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSaveLog} className="space-y-4">
            {loggerError && (
              <div
                role="alert"
                className="px-3.5 py-2.5 rounded-lg border border-red/30 bg-red/10 text-red-200 text-xs font-mono"
              >
                {loggerError}
              </div>
            )}

            <div>
              <label
                htmlFor="logger-session-select"
                className="block text-xs uppercase font-mono text-zinc-400 mb-1"
              >
                Assigned PT Session
              </label>
              <select
                id="logger-session-select"
                value={selectedSessionId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedSessionId(nextId);
                  const found = loggableSessions.find((s) => String(s.id) === nextId);
                  if (found) setCoachFreeNotes(found.coach_notes || '');
                }}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red"
                required
              >
                <option value="">Select session...</option>
                {loggableSessions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.member_name || s.member_code || `Member #${s.member_id}`} —{' '}
                    {formatScheduleDateTime(s.scheduled_at)} ({getStatusLabel(s.status)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="logger-exercise"
                className="block text-xs uppercase font-mono text-zinc-400 mb-1"
              >
                Key Exercise / Focus (optional)
              </label>
              <input
                id="logger-exercise"
                type="text"
                placeholder="e.g., Barbell Back Squat"
                value={exerciseName}
                onChange={(e) => setExerciseName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="logger-weight"
                  className="block text-xs uppercase font-mono text-zinc-400 mb-1"
                >
                  Weight (kg)
                </label>
                <input
                  id="logger-weight"
                  type="number"
                  step="0.5"
                  min="0"
                  value={exerciseWeight}
                  onChange={(e) => setExerciseWeight(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red"
                />
              </div>
              <div>
                <label
                  htmlFor="logger-reps"
                  className="block text-xs uppercase font-mono text-zinc-400 mb-1"
                >
                  Reps
                </label>
                <input
                  id="logger-reps"
                  type="number"
                  min="1"
                  value={exerciseReps}
                  onChange={(e) => setExerciseReps(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red"
                />
              </div>
              <div>
                <label
                  htmlFor="logger-rpe"
                  className="block text-xs uppercase font-mono text-zinc-400 mb-1"
                >
                  RPE (1–10)
                </label>
                <input
                  id="logger-rpe"
                  type="text"
                  placeholder="8.5"
                  value={exerciseRpe}
                  onChange={(e) => setExerciseRpe(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="logger-notes"
                className="block text-xs uppercase font-mono text-zinc-400 mb-1"
              >
                Coaching Notes (saved to session record)
              </label>
              <textarea
                id="logger-notes"
                rows={3}
                maxLength={850}
                placeholder="Technique cues, progression notes, or athlete feedback..."
                value={coachFreeNotes}
                onChange={(e) => setCoachFreeNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red resize-none"
              />
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingLog}
                className="px-4 py-2 rounded-lg bg-red hover:bg-red-hover text-white text-xs font-bold font-mono uppercase tracking-wider transition-colors shadow-md cursor-pointer disabled:opacity-60"
              >
                {isSavingLog ? 'Saving...' : 'Save Coach Notes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
