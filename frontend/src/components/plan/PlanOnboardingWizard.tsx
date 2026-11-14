import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { MuscleVisualizer2D } from '@/components/plan/MuscleVisualizer2D';
import {
  FOCUS_OPTIONS,
  FREQUENCY_OPTIONS,
  getBmiMarkerPercent,
  MONTH_NAMES,
  type CalculatedPlanMetrics,
  type ExperienceType,
  type FocusArea,
  type GoalType,
  type PlanDraft,
} from '@/components/plan/planUtils';

const DAY_ITEMS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTH_ITEMS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEAR_ITEMS = Array.from({ length: 65 }, (_, i) => 2012 - i);
const BMI_GRADIENT = 'linear-gradient(to right, #3b82f6 0%, #10b981 35%, #f59e0b 70%, #ef4444 100%)';

const GOAL_CARDS: { id: GoalType; title: string; desc: string; icon: typeof Dumbbell }[] = [
  { id: 'Build Muscle', title: 'Build Muscle', desc: 'Hypertrophy rep ranges (8-12 reps), moderate surplus, muscle fullness.', icon: Dumbbell },
  { id: 'Gain Strength', title: 'Gain Strength', desc: 'Heavy compound lifts (3-6 reps), neuromuscular power, 1RM focus.', icon: Trophy },
  { id: 'Fat Loss', title: 'Fat Loss', desc: 'Caloric deficit, high-density circuits, metabolic conditioning.', icon: Flame },
];

const EXPERIENCE_LEVELS: { id: ExperienceType; title: string; sub: string }[] = [
  { id: 'Beginner', title: 'Beginner', sub: '0-1 year' },
  { id: 'Intermediate', title: 'Intermediate', sub: '1-3 years' },
  { id: 'Advanced', title: 'Advanced', sub: '3+ years' },
];

// DrumRollColumn: Scrollbar-free drag-and-drop roller for date picker
function DrumRollColumn<T extends number | string>({
  items,
  selectedItem,
  onSelect,
  label,
  formatItem,
}: {
  items: T[];
  selectedItem: T;
  onSelect: (item: T) => void;
  label: string;
  formatItem?: (item: T) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  const hasMovedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const idx = items.indexOf(selectedItem);
    if (idx >= 0) containerRef.current.scrollTop = Math.max(0, idx * 36 - 64);
  }, [selectedItem, items]);

  const handleMouseDown = (e: ReactMouseEvent) => {
    if (!containerRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startYRef.current = e.clientY;
    startScrollTopRef.current = containerRef.current.scrollTop;
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const deltaY = e.clientY - startYRef.current;
    if (Math.abs(deltaY) > 4) hasMovedRef.current = true;
    containerRef.current.scrollTop = startScrollTopRef.current - deltaY;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="space-y-1.5 text-center flex-1">
      <label className="text-[10px] font-mono uppercase text-white/40 font-bold block">{label}</label>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-1 space-y-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing touch-pan-y"
      >
        {items.map((item) => (
          <div
            key={String(item)}
            onClick={() => { if (!hasMovedRef.current) onSelect(item); }}
            className={`py-2 text-sm font-mono rounded-lg cursor-pointer transition-all ${
              item === selectedItem ? 'bg-red text-white font-bold shadow-md' : 'text-white/50 hover:bg-white/5 hover:text-white'
            }`}
          >
            {formatItem ? formatItem(item) : item}
          </div>
        ))}
      </div>
    </div>
  );
}

function WizardStepFooter({
  onBack,
  onNext,
  nextLabel = 'Next',
  compact = false,
  sparkle = false,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  compact?: boolean;
  sparkle?: boolean;
}) {
  return (
    <div className={`flex justify-between ${compact ? 'pt-1' : 'pt-2'}`}>
      <button
        type="button"
        onClick={onBack}
        className={`inline-flex items-center gap-1.5 px-4 ${compact ? 'py-2.5' : 'py-3'} rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-mono font-bold uppercase transition-colors`}
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back</span>
      </button>
      <button
        type="button"
        onClick={onNext}
        className={`inline-flex items-center gap-2 ${compact ? 'px-5 py-2.5' : 'px-6 py-3'} rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg`}
      >
        <span>{nextLabel}</span>
        {sparkle ? <Sparkles className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </div>
  );
}

// Tailoring Animation Sub-step (1 to 4)
function TailoringAnimationStep({ onComplete }: { onComplete: () => void }) {
  const [tailorProgress, setTailorProgress] = useState<number>(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Handle Tailoring Experience Animation
  useEffect(() => {
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      setTailorProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          finishTimer = setTimeout(() => onCompleteRef.current(), 400);
          return 100;
        }
        return prev + 2;
      });
    }, 45);

    return () => {
      clearInterval(interval);
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, []);

  let tailorStepIndex = 0;
  if (tailorProgress > 75) tailorStepIndex = 3;
  else if (tailorProgress > 50) tailorStepIndex = 2;
  else if (tailorProgress > 25) tailorStepIndex = 1;

  const tasks = [
    { label: 'Analyzing Body Data', done: tailorStepIndex >= 0 },
    { label: 'Calculating Strength level', done: tailorStepIndex >= 1 },
    { label: 'Selecting exercises', done: tailorStepIndex >= 2 },
    { label: 'Getting everything ready', done: tailorStepIndex >= 3 },
  ];

  return (
    <div className="py-10 px-4 text-center space-y-8 animate-fade-in">
      {/* Radial / Progress Visual */}
      <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" stroke="#27272a" strokeWidth="6" fill="none" />
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="#ef4444"
            strokeWidth="6"
            strokeDasharray="264"
            strokeDashoffset={264 - (264 * tailorProgress) / 100}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-100 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
          <span className="text-2xl font-black text-white">{tailorProgress}%</span>
          <span className="text-[9px] uppercase tracking-widest text-red font-bold">ANALYZING</span>
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-black uppercase text-white tracking-tight">Tailoring Experience...</h2>
        <p className="text-xs text-white/50 font-mono">Synthesizing biometric parameters and building your exercise catalog.</p>
      </div>

      {/* 4 Process Checklist items */}
      <div className="max-w-md mx-auto space-y-3 text-left font-mono">
        {tasks.map((task) => (
          <div
            key={task.label}
            className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
              task.done ? 'border-emerald-500/30 bg-emerald-500/5 text-white' : 'border-white/5 bg-white/[0.01] text-white/30'
            }`}
          >
            <span className="text-xs">{task.label}</span>
            {task.done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface PlanOnboardingWizardProps {
  open: boolean;
  wizardStep: number;
  onChangeStep: (step: number) => void;
  onClose: () => void;
  draft: PlanDraft;
  onPatchDraft: (patch: Partial<PlanDraft>) => void;
  onToggleFocus: (area: FocusArea) => void;
  displayWeight: number;
  onChangeWeightDisplay: (val: number) => void;
  calculatedMetrics: CalculatedPlanMetrics;
  onGeneratePlan: () => void;
  onStartNow: () => void;
}

export function PlanOnboardingWizard({
  open,
  wizardStep,
  onChangeStep,
  onClose,
  draft,
  onPatchDraft,
  onToggleFocus,
  displayWeight,
  onChangeWeightDisplay,
  calculatedMetrics,
  onGeneratePlan,
  onStartNow,
}: PlanOnboardingWizardProps) {
  if (!open) return null;

  const { birthDay, birthMonth, birthYear, weightUnit, weightKg, heightUnit, heightCm, goal, experience, selectedFocus, frequency } = draft;
  // Convert height
  const feetTotal = heightCm / 30.48;
  const feet = Math.floor(feetTotal);
  const inches = Math.round((feetTotal - feet) * 12);
  const bmiMarkerPct = getBmiMarkerPercent(calculatedMetrics.bmi);

  return (
    /* PLAN ONBOARDING WIZARD MODAL (8 STEPS + BENTO SETUP SCREEN) */
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#0f0f13] p-5 sm:p-6 shadow-2xl space-y-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar with Step Indicator & Close X Button */}
        {wizardStep <= 7 && (
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-red uppercase">Step {wizardStep} of 7</span>
              <span className="text-white/20">|</span>
              <span className="text-xs font-mono text-white/40">Personalization</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close prompt"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 1: BIRTHDAY PICKER (Scroll / Roller Style) */}
        {wizardStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black uppercase text-white tracking-tight">What is your birthday?</h2>
              <p className="text-xs text-white/50 font-mono mt-1">
                Used to calculate basal metabolic rate (BMR) and recommended recovery windows.
              </p>
            </div>

            {/* Roller / Scroll Style Date Selector */}
            <div className="p-6 rounded-2xl border border-white/10 bg-surface space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <DrumRollColumn label="Day" items={DAY_ITEMS} selectedItem={birthDay} onSelect={(d) => onPatchDraft({ birthDay: d })} />
                <DrumRollColumn
                  label="Month"
                  items={MONTH_ITEMS}
                  selectedItem={birthMonth}
                  onSelect={(m) => onPatchDraft({ birthMonth: m })}
                  formatItem={(m) => MONTH_NAMES[m - 1].slice(0, 3)}
                />
                <DrumRollColumn label="Year" items={YEAR_ITEMS} selectedItem={birthYear} onSelect={(y) => onPatchDraft({ birthYear: y })} />
              </div>

              {/* Selected Preview Line */}
              <div className="text-center font-mono text-xs text-white/60 pt-2 border-t border-white/5">
                Selected: <strong className="text-white">{MONTH_NAMES[birthMonth - 1]} {birthDay}, {birthYear}</strong>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => onChangeStep(2)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: WEIGHT PICKER (Toggle KG/LBS + Horizontal Scroll Slider) */}
        {wizardStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black uppercase text-white tracking-tight">What is your weight?</h2>
              <p className="text-xs text-white/50 font-mono mt-1">
                Select your current bodyweight to customize strength standards and macros.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-surface space-y-6 text-center">
              {/* KG vs LBS Toggle (Selected is RED) */}
              <div className="inline-flex p-1 rounded-xl bg-black/40 border border-white/10">
                {(['kg', 'lbs'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => onPatchDraft({ weightUnit: unit })}
                    className={`px-5 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                      weightUnit === unit ? 'bg-red text-white shadow-md' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {unit === 'kg' ? 'Kilograms (kg)' : 'Pounds (lbs)'}
                  </button>
                ))}
              </div>

              {/* Huge Number Display */}
              <div className="py-2">
                <span className="text-5xl font-black font-mono text-white tracking-tight">{displayWeight}</span>
                <span className="text-lg font-mono text-red font-bold ml-2">{weightUnit}</span>
              </div>

              {/* Horizontal Scroll Slider */}
              <div className="space-y-2 px-4">
                <input
                  type="range"
                  min={weightUnit === 'kg' ? 40 : 88}
                  max={weightUnit === 'kg' ? 160 : 350}
                  step={1}
                  value={displayWeight}
                  onChange={(e) => onChangeWeightDisplay(Number(e.target.value))}
                  className="w-full h-2 rounded-lg bg-white/10 accent-red cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-white/30">
                  <span>{weightUnit === 'kg' ? '40 kg' : '88 lbs'}</span>
                  <span className="text-white/50">Slide Left or Right</span>
                  <span>{weightUnit === 'kg' ? '160 kg' : '350 lbs'}</span>
                </div>
              </div>
            </div>

            <WizardStepFooter onBack={() => onChangeStep(1)} onNext={() => onChangeStep(3)} />
          </div>
        )}

        {/* STEP 3: HEIGHT PICKER (Toggle CM/FT-IN + Horizontal Scroll Slider) */}
        {wizardStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black uppercase text-white tracking-tight">What is your height?</h2>
              <p className="text-xs text-white/50 font-mono mt-1">
                Used to establish your baseline BMI and leverage biomechanics.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-surface space-y-6 text-center">
              {/* CM vs FT Toggle (Selected is RED) */}
              <div className="inline-flex p-1 rounded-xl bg-black/40 border border-white/10">
                {(['cm', 'ft'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => onPatchDraft({ heightUnit: unit })}
                    className={`px-5 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                      heightUnit === unit ? 'bg-red text-white shadow-md' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {unit === 'cm' ? 'Centimeters (cm)' : 'Feet & Inches (ft/in)'}
                  </button>
                ))}
              </div>

              {/* Huge Number Display */}
              <div className="py-2">
                {heightUnit === 'cm' ? (
                  <>
                    <span className="text-5xl font-black font-mono text-white tracking-tight">{heightCm}</span>
                    <span className="text-lg font-mono text-red font-bold ml-2">cm</span>
                  </>
                ) : (
                  <>
                    <span className="text-5xl font-black font-mono text-white tracking-tight">{feet}' {inches}"</span>
                    <span className="text-xs font-mono text-white/40 block mt-1">({heightCm} cm)</span>
                  </>
                )}
              </div>

              {/* Horizontal Scroll Slider */}
              <div className="space-y-2 px-4">
                <input
                  type="range"
                  min={130}
                  max={220}
                  step={1}
                  value={heightCm}
                  onChange={(e) => onPatchDraft({ heightCm: Number(e.target.value) })}
                  className="w-full h-2 rounded-lg bg-white/10 accent-red cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-white/30">
                  <span>130 cm (4'3")</span>
                  <span className="text-white/50">Slide Left or Right</span>
                  <span>220 cm (7'3")</span>
                </div>
              </div>
            </div>

            <WizardStepFooter onBack={() => onChangeStep(2)} onNext={() => onChangeStep(4)} />
          </div>
        )}

        {/* STEP 4: TOP GOAL (Build Muscle, Gain Strength, Fat Loss) */}
        {wizardStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black uppercase text-white tracking-tight">What is your top goal?</h2>
              <p className="text-xs text-white/50 font-mono mt-1">
                Your workout rep ranges and caloric surplus/deficit will be tuned around this.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {GOAL_CARDS.map((item) => {
                const Icon = item.icon;
                const isSelected = goal === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => onPatchDraft({ goal: item.id })}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      isSelected ? 'border-red bg-red/10 shadow-[0_0_15px_rgba(239,68,68,0.25)]' : 'border-white/10 bg-surface hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl border ${isSelected ? 'bg-red text-white border-red' : 'bg-white/5 text-white/50 border-white/10'}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white">{item.title}</h3>
                        <p className="text-xs text-white/50 font-mono mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-red bg-red text-white' : 'border-white/20'}`}>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <WizardStepFooter onBack={() => onChangeStep(3)} onNext={() => onChangeStep(5)} />
          </div>
        )}

        {/* STEP 5: TRAINING EXPERIENCE (Beginner, Intermediate, Advanced) */}
        {wizardStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                How much training experience do you have?
              </h2>
              <p className="text-xs text-white/50 font-mono mt-1">
                Dictates workout volume, exercise complexity, and recovery speed.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {EXPERIENCE_LEVELS.map((lvl) => {
                const isSelected = experience === lvl.id;
                return (
                  <div
                    key={lvl.id}
                    onClick={() => onPatchDraft({ experience: lvl.id })}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected ? 'border-red bg-red/10 shadow-[0_0_15px_rgba(239,68,68,0.25)]' : 'border-white/10 bg-surface hover:border-white/20'
                    }`}
                  >
                    <div>
                      <h3 className="font-bold text-base text-white">{lvl.title}</h3>
                      <p className="text-xs text-red font-mono font-semibold mt-0.5">{lvl.sub}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-red bg-red text-white' : 'border-white/20'}`}>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <WizardStepFooter onBack={() => onChangeStep(4)} onNext={() => onChangeStep(6)} />
          </div>
        )}

        {/* STEP 6: FOCUS AREAS WITH REALISTIC 2D ANATOMICAL MUSCLE VISUALIZER */}
        {wizardStep === 6 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight">
                Select the areas you want to focus on
              </h2>
              <p className="text-[11px] sm:text-xs text-white/50 font-mono mt-0.5">
                Click the muscle bellies on the anatomical athletic models or toggle the buttons below.
              </p>
            </div>

            {/* High-Fidelity 2D Muscle Visualizer (Anterior & Posterior) */}
            <MuscleVisualizer2D selectedFocus={selectedFocus} onToggleFocus={onToggleFocus} />

            {/* Focus Option Buttons */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {FOCUS_OPTIONS.map((opt) => {
                const isSelected = selectedFocus.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onToggleFocus(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                      isSelected ? 'bg-red text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <WizardStepFooter onBack={() => onChangeStep(5)} onNext={() => onChangeStep(7)} compact />
          </div>
        )}

        {/* STEP 7: WORKOUT FREQUENCY (1-7 Days / Week) */}
        {wizardStep === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black uppercase text-white tracking-tight">How often do you workout?</h2>
              <p className="text-xs text-red font-mono font-semibold mt-1">
                We recommend training at least 3 days a week for better results.
              </p>
            </div>

            <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
              {FREQUENCY_OPTIONS.map((opt) => {
                const isSelected = frequency === opt.days;
                return (
                  <div
                    key={opt.days}
                    onClick={() => onPatchDraft({ frequency: opt.days })}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected ? 'border-red bg-red/10 shadow-[0_0_15px_rgba(239,68,68,0.25)]' : 'border-white/10 bg-surface hover:border-white/20'
                    }`}
                  >
                    <div>
                      <h3 className="font-bold text-sm text-white">{opt.label}</h3>
                      <p className="text-[11px] text-white/40 font-mono mt-0.5">{opt.sub}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-red bg-red text-white' : 'border-white/20'}`}>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <WizardStepFooter onBack={() => onChangeStep(6)} onNext={onGeneratePlan} nextLabel="Generate My Plan" sparkle />
          </div>
        )}

        {/* STEP 8: TAILORING EXPERIENCE ANIMATION SCREEN */}
        {wizardStep === 8 && <TailoringAnimationStep onComplete={() => onChangeStep(9)} />}

        {/* STEP 9: YOUR CUSTOM SETUP IS READY (BENTO STYLE + START NOW) */}
        {wizardStep === 9 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-end -mb-4">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close prompt"
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center space-y-1">
              <div className="inline-flex p-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-black uppercase text-white tracking-tight">Your Custom Setup is Ready!</h2>
              <p className="text-xs text-white/50 font-mono">
                Here is your calibrated biometric assessment based on your answers.
              </p>
            </div>

            {/* Bento Layout Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bento Box 1: Your Weight (Downward Sloping Gradient Line) */}
              <div className="rounded-2xl border border-white/10 bg-surface p-5 space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/40">Your Weight</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{goal}</span>
                </div>

                <div>
                  <p className="text-3xl font-mono font-black text-white">
                    {displayWeight} <span className="text-sm font-normal text-white/50">{weightUnit}</span>
                  </p>
                  <p className="text-[11px] font-mono text-white/40 mt-0.5">
                    Projected Week 4: <strong className="text-emerald-400">{calculatedMetrics.projectedW4Weight} {weightUnit}</strong>
                  </p>
                </div>

                {/* Gradient Downward Line Chart */}
                <div className="pt-2">
                  <svg viewBox="0 0 240 50" preserveAspectRatio="none" className="w-full h-12 overflow-visible">
                    <defs>
                      <linearGradient id="modalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                    <path d="M 5 10 Q 120 25 235 42" fill="none" stroke="url(#modalGrad)" strokeWidth="3.5" strokeLinecap="round" />
                    <circle cx="5" cy="10" r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="235" cy="42" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                  </svg>
                  <div className="flex justify-between text-[10px] font-mono text-white/40 border-t border-white/10 pt-1 mt-1">
                    <span className="text-red font-bold">Today ({displayWeight} {weightUnit})</span>
                    <span className="text-emerald-400 font-bold">Week 4 ({calculatedMetrics.projectedW4Weight} {weightUnit})</span>
                  </div>
                </div>
              </div>

              {/* Bento Box 2: About You (Height, Weight, 1RM, BMI Gauge) */}
              <div className="rounded-2xl border border-white/10 bg-surface p-5 space-y-3 flex flex-col justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/40">About You</span>

                <div className="grid grid-cols-3 gap-2 font-mono text-center py-1 border-y border-white/8">
                  <div>
                    <p className="text-[9px] text-white/40 uppercase">Height</p>
                    <p className="text-xs font-bold text-white">{heightCm} cm</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/40 uppercase">Weight</p>
                    <p className="text-xs font-bold text-white">{weightKg} kg</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/40 uppercase">1RM</p>
                    <p className="text-xs font-bold text-emerald-400">{calculatedMetrics.estimatedBench1RM} kg</p>
                  </div>
                </div>

                {/* BMI Gradient Line with White Circle Marker */}
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1.5">
                    <span className="text-white/40">Total BMI</span>
                    <span className="font-bold text-white">{calculatedMetrics.bmi}</span>
                  </div>

                  <div className="relative w-full h-3 rounded-full overflow-hidden">
                    <div className="absolute inset-0 rounded-full" style={{ background: BMI_GRADIENT }} />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-black shadow-[0_0_6px_rgba(255,255,255,0.9)]"
                      style={{ left: `calc(${bmiMarkerPct}% - 7px)` }}
                    />
                  </div>

                  <div className="flex justify-between text-[9px] font-mono text-white/40 mt-1">
                    <span>Underweight</span>
                    <span className="text-emerald-400 font-semibold">Normal</span>
                    <span>Overweight</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Start Now Button (Guarded for Active Members) */}
            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={onStartNow}
                className="w-full py-3.5 rounded-2xl bg-red hover:bg-red-hover text-white text-sm font-mono font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Start Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onChangeStep(1)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs font-mono transition-colors cursor-pointer"
              >
                Re-calibrate Personalization
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
