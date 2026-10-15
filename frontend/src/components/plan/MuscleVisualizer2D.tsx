import React from 'react';

export type FocusArea = 'back' | 'shoulder' | 'arm' | 'chest' | 'abs' | 'butt' | 'leg' | 'full body';

interface MuscleVisualizer2DProps {
  selectedFocus: FocusArea[];
  onToggleFocus: (area: FocusArea) => void;
}

export function MuscleVisualizer2D({ selectedFocus, onToggleFocus }: MuscleVisualizer2DProps) {
  void React;
  const isSelected = (area: FocusArea) =>
    selectedFocus.includes(area) || selectedFocus.includes('full body');

  // Exact Image 2 aesthetics: Charcoal dark-gray base, crisp white division lines, electric blue active highlight
  const getMuscleStyle = (area: FocusArea) => {
    const active = isSelected(area);
    return {
      fill: active ? '#3b82f6' : '#2c2d31',
      stroke: '#ffffff',
      strokeWidth: active ? 1.3 : 1.1,
      strokeLinejoin: 'round' as const,
      strokeLinecap: 'round' as const,
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
    };
  };

  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-[#0c0c0f] flex flex-col items-center gap-6 shadow-2xl">
      {/* Visualizer Top Bar & Legend */}
      <div className="w-full flex items-center justify-between border-b border-white/8 pb-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold">
            Interactive Anatomy Visualizer
          </span>
          <p className="text-xs text-white/50 font-mono mt-0.5">
            Click any muscle group on the athletic models to target in your plan.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-white/40">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2c2d31] border border-white" />
            Rest
          </span>
          <span className="flex items-center gap-1.5 text-blue-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] border border-white shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            Active Focus
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-8 w-full py-2">
        {/* ===================================================================
            FRONT ANATOMICAL ATHLETIC PHYSIQUE (Anterior View)
        =================================================================== */}
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-mono uppercase tracking-widest text-white/60 mb-3 font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Anterior (Front View)
          </span>

          <svg
            viewBox="0 0 200 350"
            className="w-52 h-84 overflow-visible select-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)]"
          >
            {/* Glow Filter for Active Muscles */}
            <defs>
              <filter id="activeBlueGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#3b82f6" floodOpacity="0.8" />
              </filter>
            </defs>

            {/* ─── HEAD & NECK (Gray Anatomical Mask like Image 2) ─────────── */}
            <g id="front-head-neck">
              {/* Head Profile */}
              <path
                d="M 100 12 C 90 12, 84 21, 84 34 C 84 46, 91 56, 100 57 C 109 56, 116 46, 116 34 C 116 21, 110 12, 100 12 Z"
                fill="#8f9398"
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Neck & Sternocleidomastoid */}
              <path
                d="M 92 56 L 86 70 L 114 70 L 108 56 Z"
                fill="#8f9398"
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* White Neck Separation Lines */}
              <line x1="97" y1="58" x2="94" y2="70" stroke="#ffffff" strokeWidth="1" />
              <line x1="103" y1="58" x2="106" y2="70" stroke="#ffffff" strokeWidth="1" />
            </g>

            {/* ─── DELTOIDS / SHOULDERS (Front) ────────────────────────── */}
            <g onClick={() => onToggleFocus('shoulder')} className="cursor-pointer group">
              {/* Left Deltoid */}
              <path
                d="M 82 68 C 72 70, 58 76, 54 88 C 52 98, 56 108, 64 114 C 70 106, 73 95, 76 84 Z"
                style={getMuscleStyle('shoulder')}
                filter={isSelected('shoulder') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right Deltoid */}
              <path
                d="M 118 68 C 128 70, 142 76, 146 88 C 148 98, 144 108, 136 114 C 130 106, 127 95, 124 84 Z"
                style={getMuscleStyle('shoulder')}
                filter={isSelected('shoulder') ? 'url(#activeBlueGlow)' : undefined}
              />
            </g>

            {/* ─── PECTORALIS MAJOR / CHEST ────────────────────────────── */}
            <g onClick={() => onToggleFocus('chest')} className="cursor-pointer group">
              {/* Left Pec */}
              <path
                d="M 76 80 L 98 80 L 98 116 C 89 117, 78 114, 71 106 C 68 96, 71 86, 76 80 Z"
                style={getMuscleStyle('chest')}
                filter={isSelected('chest') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right Pec */}
              <path
                d="M 124 80 L 102 80 L 102 116 C 111 117, 122 114, 129 106 C 132 96, 129 86, 124 80 Z"
                style={getMuscleStyle('chest')}
                filter={isSelected('chest') ? 'url(#activeBlueGlow)' : undefined}
              />
            </g>

            {/* ─── ARMS / BICEPS & FOREARMS (Front) ────────────────────── */}
            <g onClick={() => onToggleFocus('arm')} className="cursor-pointer group">
              {/* Left Bicep */}
              <path
                d="M 63 114 C 57 118, 53 129, 55 141 C 59 147, 65 147, 69 141 C 71 131, 69 122, 63 114 Z"
                style={getMuscleStyle('arm')}
                filter={isSelected('arm') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right Bicep */}
              <path
                d="M 137 114 C 143 118, 147 129, 145 141 C 141 147, 135 147, 131 141 C 129 131, 131 122, 137 114 Z"
                style={getMuscleStyle('arm')}
                filter={isSelected('arm') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Left Forearm */}
              <path
                d="M 55 143 C 51 151, 46 166, 44 182 C 46 186, 52 186, 56 180 C 60 168, 64 156, 67 143 Z"
                style={getMuscleStyle('arm')}
                filter={isSelected('arm') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right Forearm */}
              <path
                d="M 145 143 C 149 151, 154 166, 156 182 C 154 186, 148 186, 144 180 C 140 168, 136 156, 133 143 Z"
                style={getMuscleStyle('arm')}
                filter={isSelected('arm') ? 'url(#activeBlueGlow)' : undefined}
              />
            </g>

            {/* ─── HANDS (Image 2 style with white fingers) ─────────────── */}
            <g id="front-hands">
              {/* Left Hand */}
              <path
                d="M 44 183 C 41 190, 36 200, 31 206 L 36 211 L 43 203 L 46 208 L 49 201 L 52 205 L 54 198 L 56 182 Z"
                fill="#2c2d31"
                stroke="#ffffff"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Right Hand */}
              <path
                d="M 156 183 C 159 190, 164 200, 169 206 L 164 211 L 157 203 L 154 208 L 151 201 L 148 205 L 146 198 L 144 182 Z"
                fill="#2c2d31"
                stroke="#ffffff"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* ─── ABDOMINALS & OBLIQUES (Core 6-Pack Grid) ─────────────── */}
            <g onClick={() => onToggleFocus('abs')} className="cursor-pointer group">
              {/* Upper Abs (Pair 1) */}
              <rect
                x="84"
                y="119"
                width="14"
                height="11"
                rx="2"
                style={getMuscleStyle('abs')}
                filter={isSelected('abs') ? 'url(#activeBlueGlow)' : undefined}
              />
              <rect
                x="102"
                y="119"
                width="14"
                height="11"
                rx="2"
                style={getMuscleStyle('abs')}
                filter={isSelected('abs') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Mid Abs (Pair 2) */}
              <rect
                x="84"
                y="133"
                width="14"
                height="11"
                rx="2"
                style={getMuscleStyle('abs')}
                filter={isSelected('abs') ? 'url(#activeBlueGlow)' : undefined}
              />
              <rect
                x="102"
                y="133"
                width="14"
                height="11"
                rx="2"
                style={getMuscleStyle('abs')}
                filter={isSelected('abs') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Lower Abs & V-Taper */}
              <path
                d="M 84 147 L 98 147 L 98 163 L 87 159 Z"
                style={getMuscleStyle('abs')}
                filter={isSelected('abs') ? 'url(#activeBlueGlow)' : undefined}
              />
              <path
                d="M 116 147 L 102 147 L 102 163 L 113 159 Z"
                style={getMuscleStyle('abs')}
                filter={isSelected('abs') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Left External Obliques */}
              <path
                d="M 73 121 C 71 133, 72 145, 75 156 C 80 154, 82 144, 82 123 Z"
                style={getMuscleStyle('abs')}
                filter={isSelected('abs') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right External Obliques */}
              <path
                d="M 127 121 C 129 133, 128 145, 125 156 C 120 154, 118 144, 118 123 Z"
                style={getMuscleStyle('abs')}
                filter={isSelected('abs') ? 'url(#activeBlueGlow)' : undefined}
              />
            </g>

            {/* Pelvic Line & Groin */}
            <path
              d="M 86 160 L 100 167 L 114 160 L 108 174 L 92 174 Z"
              fill="#2c2d31"
              stroke="#ffffff"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />

            {/* ─── QUADRICEPS & ANTERIOR LEGS ──────────────────────────── */}
            <g onClick={() => onToggleFocus('leg')} className="cursor-pointer group">
              {/* Left Quad (Vastus Lateralis + Medialis) */}
              <path
                d="M 75 166 C 71 184, 67 214, 71 236 C 77 240, 85 238, 91 232 C 93 214, 93 186, 95 166 Z"
                style={getMuscleStyle('leg')}
                filter={isSelected('leg') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right Quad */}
              <path
                d="M 125 166 C 129 184, 133 214, 129 236 C 123 240, 115 238, 109 232 C 107 214, 107 186, 105 166 Z"
                style={getMuscleStyle('leg')}
                filter={isSelected('leg') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Left Knee Patella */}
              <circle cx="81" cy="241" r="4.5" fill="#2c2d31" stroke="#ffffff" strokeWidth="1.1" />
              {/* Right Knee Patella */}
              <circle cx="119" cy="241" r="4.5" fill="#2c2d31" stroke="#ffffff" strokeWidth="1.1" />
              {/* Left Lower Leg / Calves */}
              <path
                d="M 74 248 C 70 264, 70 288, 74 312 C 78 314, 84 314, 86 308 C 90 290, 90 268, 88 248 Z"
                style={getMuscleStyle('leg')}
                filter={isSelected('leg') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right Lower Leg / Calves */}
              <path
                d="M 126 248 C 130 264, 130 288, 126 312 C 122 314, 116 314, 114 308 C 110 290, 110 268, 112 248 Z"
                style={getMuscleStyle('leg')}
                filter={isSelected('leg') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Feet (Left & Right) */}
              <path
                d="M 73 313 L 70 324 L 84 324 L 86 313 Z"
                fill="#2c2d31"
                stroke="#ffffff"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
              <path
                d="M 127 313 L 130 324 L 116 324 L 114 313 Z"
                fill="#2c2d31"
                stroke="#ffffff"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>

        {/* ===================================================================
            REAR ANATOMICAL ATHLETIC PHYSIQUE (Posterior View)
        =================================================================== */}
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-mono uppercase tracking-widest text-white/60 mb-3 font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Posterior (Rear View)
          </span>

          <svg
            viewBox="0 0 200 350"
            className="w-52 h-84 overflow-visible select-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)]"
          >
            {/* ─── HEAD & NECK POSTERIOR (Gray Mask like Image 2) ─────────── */}
            <g id="rear-head-neck">
              <path
                d="M 100 12 C 90 12, 84 21, 84 34 C 84 46, 91 56, 100 57 C 109 56, 116 46, 116 34 C 116 21, 110 12, 100 12 Z"
                fill="#8f9398"
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Cervical Spine / Neck Lines */}
              <path
                d="M 94 57 L 90 68 L 110 68 L 106 57 Z"
                fill="#8f9398"
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* ─── BACK: TRAPEZIUS & LATISSIMUS DORSI ──────────────────── */}
            <g onClick={() => onToggleFocus('back')} className="cursor-pointer group">
              {/* Upper Trapezius (Diamond Crest) */}
              <path
                d="M 100 58 L 86 68 L 78 86 L 100 110 L 122 86 L 114 68 Z"
                style={getMuscleStyle('back')}
                filter={isSelected('back') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Left Latissimus Dorsi (V-Taper Wing) */}
              <path
                d="M 76 88 L 98 112 L 98 152 L 80 152 C 72 136, 68 114, 74 94 Z"
                style={getMuscleStyle('back')}
                filter={isSelected('back') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right Latissimus Dorsi (V-Taper Wing) */}
              <path
                d="M 124 88 L 102 112 L 102 152 L 120 152 C 128 136, 132 114, 126 94 Z"
                style={getMuscleStyle('back')}
                filter={isSelected('back') ? 'url(#activeBlueGlow)' : undefined}
              />
            </g>

            {/* ─── REAR DELTOIDS (Shoulders Posterior) ─────────────────── */}
            <g onClick={() => onToggleFocus('shoulder')} className="cursor-pointer group">
              <path
                d="M 80 72 C 70 76, 58 84, 56 94 C 54 104, 60 112, 66 116 C 70 106, 73 94, 76 84 Z"
                style={getMuscleStyle('shoulder')}
                filter={isSelected('shoulder') ? 'url(#activeBlueGlow)' : undefined}
              />
              <path
                d="M 120 72 C 130 76, 142 84, 144 94 C 146 104, 140 112, 134 116 C 130 106, 127 94, 124 84 Z"
                style={getMuscleStyle('shoulder')}
                filter={isSelected('shoulder') ? 'url(#activeBlueGlow)' : undefined}
              />
            </g>

            {/* ─── TRICEPS & POSTERIOR ARMS ────────────────────────────── */}
            <g onClick={() => onToggleFocus('arm')} className="cursor-pointer group">
              {/* Left Tricep (Horseshoe Head) */}
              <path
                d="M 64 116 C 58 122, 54 132, 56 142 C 60 148, 66 148, 70 142 C 72 132, 70 124, 64 116 Z"
                style={getMuscleStyle('arm')}
                filter={isSelected('arm') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right Tricep */}
              <path
                d="M 136 116 C 142 122, 146 132, 144 142 C 140 148, 134 148, 130 142 C 128 132, 130 124, 136 116 Z"
                style={getMuscleStyle('arm')}
                filter={isSelected('arm') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Posterior Forearms */}
              <path
                d="M 55 143 C 51 151, 46 166, 44 182 C 46 186, 52 186, 56 180 C 60 168, 64 156, 67 143 Z"
                style={getMuscleStyle('arm')}
                filter={isSelected('arm') ? 'url(#activeBlueGlow)' : undefined}
              />
              <path
                d="M 145 143 C 149 151, 154 166, 156 182 C 154 186, 148 186, 144 180 C 140 168, 136 156, 133 143 Z"
                style={getMuscleStyle('arm')}
                filter={isSelected('arm') ? 'url(#activeBlueGlow)' : undefined}
              />
            </g>

            {/* Posterior Hands */}
            <g id="rear-hands">
              <path
                d="M 44 183 C 41 190, 36 200, 31 206 L 36 211 L 43 203 L 46 208 L 49 201 L 52 205 L 54 198 L 56 182 Z"
                fill="#2c2d31"
                stroke="#ffffff"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 156 183 C 159 190, 164 200, 169 206 L 164 211 L 157 203 L 154 208 L 151 201 L 148 205 L 146 198 L 144 182 Z"
                fill="#2c2d31"
                stroke="#ffffff"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* ─── GLUTES / BUTT (Exact split like Image 2) ─────────────── */}
            <g onClick={() => onToggleFocus('butt')} className="cursor-pointer group">
              {/* Left Glute */}
              <path
                d="M 75 156 C 71 172, 73 192, 85 200 C 93 200, 97 188, 97 158 Z"
                style={getMuscleStyle('butt')}
                filter={isSelected('butt') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right Glute */}
              <path
                d="M 125 156 C 129 172, 127 192, 115 200 C 107 200, 103 188, 103 158 Z"
                style={getMuscleStyle('butt')}
                filter={isSelected('butt') ? 'url(#activeBlueGlow)' : undefined}
              />
            </g>

            {/* ─── HAMSTRINGS & POSTERIOR CALVES ───────────────────────── */}
            <g onClick={() => onToggleFocus('leg')} className="cursor-pointer group">
              {/* Left Hamstrings */}
              <path
                d="M 75 202 C 71 216, 71 232, 75 244 C 81 246, 89 244, 93 236 C 95 222, 95 210, 95 202 Z"
                style={getMuscleStyle('leg')}
                filter={isSelected('leg') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right Hamstrings */}
              <path
                d="M 125 202 C 129 216, 129 232, 125 244 C 119 246, 111 244, 107 236 C 105 222, 105 210, 105 202 Z"
                style={getMuscleStyle('leg')}
                filter={isSelected('leg') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Left Gastrocnemius (Calf) */}
              <path
                d="M 74 248 C 68 266, 70 290, 74 312 C 78 314, 84 314, 86 308 C 90 290, 90 268, 88 248 Z"
                style={getMuscleStyle('leg')}
                filter={isSelected('leg') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Right Gastrocnemius (Calf) */}
              <path
                d="M 126 248 C 132 266, 130 290, 126 312 C 122 314, 116 314, 114 308 C 110 290, 110 268, 112 248 Z"
                style={getMuscleStyle('leg')}
                filter={isSelected('leg') ? 'url(#activeBlueGlow)' : undefined}
              />
              {/* Posterior Heels / Feet */}
              <path
                d="M 73 313 L 71 324 L 83 324 L 85 313 Z"
                fill="#2c2d31"
                stroke="#ffffff"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
              <path
                d="M 127 313 L 129 324 L 117 324 L 115 313 Z"
                fill="#2c2d31"
                stroke="#ffffff"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
