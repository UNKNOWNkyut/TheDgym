import React from 'react';

export type FocusArea = 'back' | 'shoulder' | 'arm' | 'chest' | 'abs' | 'butt' | 'leg' | 'full body';

interface MuscleVisualizer2DProps {
  selectedFocus: FocusArea[];
  onToggleFocus: (area: FocusArea) => void;
}

export function MuscleVisualizer2D({ selectedFocus, onToggleFocus }: MuscleVisualizer2DProps) {
  void React;

  const isSelected = (group: string): boolean => {
    if (selectedFocus.includes('full body')) return true;
    if (group === 'chest' && selectedFocus.includes('chest')) return true;
    if ((group === 'shoulders' || group === 'shoulder') && selectedFocus.includes('shoulder')) return true;
    if ((group === 'arms' || group === 'arm') && selectedFocus.includes('arm')) return true;
    if (group === 'back' && selectedFocus.includes('back')) return true;
    if (group === 'abs' && selectedFocus.includes('abs')) return true;
    if ((group === 'glutes' || group === 'butt') && selectedFocus.includes('butt')) return true;
    if ((group === 'legs' || group === 'leg') && selectedFocus.includes('leg')) return true;
    return false;
  };

  const handleGroupClick = (group: string) => {
    let mappedArea: FocusArea = 'chest';
    if (group === 'shoulders' || group === 'shoulder') mappedArea = 'shoulder';
    else if (group === 'arms' || group === 'arm') mappedArea = 'arm';
    else if (group === 'back') mappedArea = 'back';
    else if (group === 'abs') mappedArea = 'abs';
    else if (group === 'glutes' || group === 'butt') mappedArea = 'butt';
    else if (group === 'legs' || group === 'leg') mappedArea = 'leg';
    else if (group === 'chest') mappedArea = 'chest';
    onToggleFocus(mappedArea);
  };

  // Human-readable labels for selected muscles
  const selectedLabels = selectedFocus.map((f) => {
    switch (f) {
      case 'chest': return 'Chest';
      case 'shoulder': return 'Shoulders';
      case 'arm': return 'Arms';
      case 'back': return 'Back';
      case 'abs': return 'Abs & Core';
      case 'butt': return 'Glutes / Butt';
      case 'leg': return 'Legs';
      case 'full body': return 'Full Body';
      default: return f;
    }
  });

  return (
    <div className="w-full flex flex-col items-center rounded-2xl bg-white border border-neutral-200 p-4 sm:p-6 shadow-2xl space-y-4 text-neutral-800 select-none">
      <style>{`
        .silhouette-base {
          fill: #b5b5b5;
          stroke: #b5b5b5;
          stroke-width: 2;
          stroke-linejoin: round;
          stroke-linecap: round;
        }
        .hair-shape {
          fill: #6b6b6b;
        }
        .muscle-static {
          fill: #3d3d3d;
          stroke: #b5b5b5;
          stroke-width: 2.1;
          stroke-linejoin: round;
          stroke-linecap: round;
        }
        .muscle-part {
          fill: #3d3d3d;
          stroke: #b5b5b5;
          stroke-width: 2.3;
          stroke-linejoin: round;
          stroke-linecap: round;
          cursor: pointer;
          transition: fill 0.18s cubic-bezier(0.4, 0, 0.2, 1), filter 0.18s ease;
        }
        .muscle-part:hover {
          fill: #525252;
        }
        .muscle-part.selected {
          fill: #5186fb;
        }
        .muscle-part.selected:hover {
          fill: #3b71e8;
        }
      `}</style>

      {/* Header & Legend */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
            Gym Muscle Visualizer
          </h3>
          <p className="text-xs text-neutral-500">
            Click directly on any muscle group in the anatomical diagram to highlight.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-neutral-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3d3d3d] border border-[#b5b5b5]" />
            Rest
          </span>
          <span className="flex items-center gap-1.5 text-blue-600 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#5186fb] shadow-[0_0_6px_rgba(81,134,251,0.6)]" />
            Active Focus
          </span>
        </div>
      </div>

      {/* Anatomical SVG Canvas matching anatomical_muscle_visualizer.html */}
      <div className="w-full flex items-center justify-center py-2">
        <svg
          id="anatomy-svg"
          viewBox="0 0 600 580"
          className="w-full h-auto max-h-[520px] max-w-[560px] overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* ==================== FRONT VIEW (LEFT) ==================== */}
          <g id="front-figure">
            {/* 1. BASE SILHOUETTE (Light Grey #b5b5b5 for head, joints, fascia) */}
            <g id="front-silhouette">
              {/* Neck & Trapezius Base */}
              <path className="silhouette-base" d="M 134,82 L 132,102 L 102,115 L 152,125 L 202,115 L 172,102 L 170,82 Z" />
              {/* Torso, Pelvis & Hip Fascia Base */}
              <path className="silhouette-base" d="M 102,115 C 80,118 72,135 76,162 L 62,218 L 46,274 L 56,280 L 78,225 L 95,180 L 106,208 L 108,262 L 99,296 L 104,352 L 108,395 L 106,455 L 114,515 L 102,535 L 128,539 L 131,512 L 137,455 L 135,395 L 148,315 L 152,306 L 156,315 L 169,395 L 167,455 L 173,512 L 176,539 L 202,535 L 190,515 L 198,455 L 196,395 L 200,352 L 205,296 L 196,262 L 198,208 L 209,180 L 226,225 L 248,280 L 258,274 L 242,218 L 228,162 C 232,135 224,118 202,115 Z" />
              {/* Head & Ears Base */}
              <path className="silhouette-base" d="M 129,57 C 125,57 124,66 129,70 C 131,82 140,94 152,94 C 164,94 173,82 175,70 C 180,66 179,57 175,57 C 176,40 167,30 152,30 C 137,30 128,40 129,57 Z" />
              {/* Hair (Dark Grey #6b6b6b) */}
              <path className="hair-shape" d="M 129,58 C 127,42 135,29 152,29 C 169,29 177,42 175,58 C 174,52 172,46 168,43 C 162,45 142,45 136,43 C 132,46 130,52 129,58 Z" />
            </g>

            {/* 2. NECK & HANDS & FEET (Static Dark Grey #3d3d3d) */}
            <g id="front-static-parts">
              {/* Sternocleidomastoid (Neck) Left & Right */}
              <path className="muscle-static" d="M 136,88 L 149,115 L 137,114 L 133,94 Z" />
              <path className="muscle-static" d="M 168,88 L 155,115 L 167,114 L 171,94 Z" />
              <path className="muscle-static" d="M 146,93 L 152,113 L 158,93 Z" />

              {/* Left Hand & Fingers */}
              <path className="muscle-static" d="M 45,274 L 57,279 L 51,297 L 35,291 Z" />
              <path className="muscle-static" d="M 36,284 L 22,296 C 20,298 22,301 25,299 L 39,289 Z" />
              <path className="muscle-static" d="M 36,292 L 24,313 C 23,316 26,318 28,315 L 40,295 Z" />
              <path className="muscle-static" d="M 41,295 L 32,320 C 31,323 35,324 36,321 L 45,297 Z" />
              <path className="muscle-static" d="M 46,297 L 41,321 C 41,324 44,324 45,321 L 50,298 Z" />
              <path className="muscle-static" d="M 51,297 L 50,317 C 50,320 53,320 54,317 L 55,296 Z" />

              {/* Right Hand & Fingers */}
              <path className="muscle-static" d="M 259,274 L 247,279 L 253,297 L 269,291 Z" />
              <path className="muscle-static" d="M 268,284 L 282,296 C 284,298 282,301 279,299 L 265,289 Z" />
              <path className="muscle-static" d="M 268,292 L 280,313 C 281,316 278,318 276,315 L 264,295 Z" />
              <path className="muscle-static" d="M 263,295 L 272,320 C 273,323 269,324 268,321 L 259,297 Z" />
              <path className="muscle-static" d="M 258,297 L 263,321 C 263,324 260,324 259,321 L 254,298 Z" />
              <path className="muscle-static" d="M 253,297 L 254,317 C 254,320 251,320 250,317 L 249,296 Z" />

              {/* Knees / Patella */}
              <path className="muscle-static" d="M 114,380 C 118,376 126,376 130,380 C 131,389 128,399 122,402 C 116,399 113,389 114,380 Z" />
              <path className="muscle-static" d="M 190,380 C 186,376 178,376 174,380 C 173,389 176,399 182,402 C 188,399 191,389 190,380 Z" />

              {/* Left & Right Ankles/Feet */}
              <path className="muscle-static" d="M 115,498 L 128,506 L 129,522 L 114,515 Z" />
              <path className="muscle-static" d="M 113,519 L 129,525 L 128,539 L 101,536 Z" />
              <path className="muscle-static" d="M 189,498 L 176,506 L 175,522 L 190,515 Z" />
              <path className="muscle-static" d="M 191,519 L 175,525 L 176,539 L 203,536 Z" />
            </g>

            {/* 3. INTERACTIVE MUSCLE GROUPS - FRONT VIEW */}
            {/* TRAPEZIUS (Back / Upper) */}
            <g onClick={() => handleGroupClick('back')} className="cursor-pointer">
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 131,100 L 105,114 L 135,116 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 173,100 L 199,114 L 169,116 Z" />
            </g>

            {/* CHEST (Pectoralis Major) */}
            <g onClick={() => handleGroupClick('chest')} className="cursor-pointer">
              <path className={`muscle-part ${isSelected('chest') ? 'selected' : ''}`} d="M 105,121 C 118,117 138,118 150,124 L 150,164 C 138,175 112,175 101,161 C 96,147 98,130 105,121 Z" />
              <path className={`muscle-part ${isSelected('chest') ? 'selected' : ''}`} d="M 199,121 C 186,117 166,118 154,124 L 154,164 C 166,175 192,175 203,161 C 208,147 206,130 199,121 Z" />
            </g>

            {/* SHOULDERS (Anterior & Lateral Deltoids) */}
            <g onClick={() => handleGroupClick('shoulders')} className="cursor-pointer">
              <path className={`muscle-part ${isSelected('shoulders') ? 'selected' : ''}`} d="M 114,116 C 92,115 76,129 77,154 C 79,163 87,168 96,161 C 97,144 102,126 114,116 Z" />
              <path className={`muscle-part ${isSelected('shoulders') ? 'selected' : ''}`} d="M 190,116 C 212,115 228,129 227,154 C 225,163 217,168 208,161 C 207,144 202,126 190,116 Z" />
            </g>

            {/* ARMS (Biceps, Brachialis, Forearms) */}
            <g onClick={() => handleGroupClick('arms')} className="cursor-pointer">
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 88,163 C 95,159 100,166 97,179 L 85,212 C 79,213 76,206 79,193 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 77,161 C 83,163 85,174 81,189 L 72,208 C 67,203 68,182 77,161 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 216,163 C 209,159 204,166 207,179 L 219,212 C 225,213 228,206 225,193 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 227,161 C 221,163 219,174 223,189 L 232,208 C 237,203 236,182 227,161 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 68,207 C 75,208 78,215 74,230 L 55,275 L 47,271 L 61,222 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 84,214 C 78,225 68,252 57,276 L 52,274 L 74,214 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 236,207 C 229,208 226,215 230,230 L 249,275 L 257,271 L 243,222 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 220,214 C 226,225 236,252 247,276 L 252,274 L 230,214 Z" />
            </g>

            {/* ABS & CORE (Rectus Abdominis 6-Pack, Lower Abs & Obliques) */}
            <g onClick={() => handleGroupClick('abs')} className="cursor-pointer">
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 150,168 L 150,188 L 125,187 C 124,177 132,169 150,168 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 154,168 L 154,188 L 179,187 C 180,177 172,169 154,168 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 150,190 L 150,208 L 125,207 L 125,189 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 154,190 L 154,208 L 179,207 L 179,189 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 150,210 L 150,227 L 127,226 L 125,209 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 154,210 L 154,227 L 177,226 L 179,209 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 150,230 L 150,250 L 127,249 L 127,229 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 154,230 L 154,250 L 177,249 L 177,229 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 150,252 L 150,301 C 138,298 130,275 127,251 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 154,252 L 154,301 C 166,298 174,275 177,251 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 103,167 L 122,175 L 122,193 L 106,184 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 106,186 L 122,195 L 123,215 L 108,205 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 108,207 L 124,217 L 125,246 L 109,235 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 109,237 L 125,249 L 132,292 C 121,284 112,265 109,237 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 201,167 L 182,175 L 182,193 L 198,184 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 198,186 L 182,195 L 181,215 L 196,205 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 196,207 L 180,217 L 179,246 L 195,235 Z" />
              <path className={`muscle-part ${isSelected('abs') ? 'selected' : ''}`} d="M 195,237 L 179,249 L 172,292 C 183,284 192,265 195,237 Z" />
            </g>

            {/* LEGS - FRONT (Quadriceps, Adductors, Calves/Tibialis) */}
            <g onClick={() => handleGroupClick('legs')} className="cursor-pointer">
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 108,266 C 100,285 98,312 102,332 L 114,296 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 116,282 C 106,312 102,348 109,378 L 121,346 L 124,292 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 125,294 L 119,369 L 129,369 L 138,312 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 139,316 L 128,374 C 136,377 142,368 143,350 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 129,296 L 147,313 L 142,344 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 196,266 C 204,285 206,312 202,332 L 190,296 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 188,282 C 198,312 202,348 195,378 L 183,346 L 180,292 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 179,294 L 185,369 L 175,369 L 166,312 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 165,316 L 176,374 C 168,377 162,368 161,350 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 175,296 L 157,313 L 162,344 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 112,402 C 104,424 106,462 115,496 L 121,496 L 120,408 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 122,410 L 123,496 L 130,502 C 137,468 139,432 131,406 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 192,402 C 200,424 198,462 189,496 L 183,496 L 184,408 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 182,410 L 181,496 L 174,502 C 167,468 165,432 173,406 Z" />
            </g>
          </g>

          {/* ==================== BACK VIEW (RIGHT) ==================== */}
          <g id="back-figure">
            {/* 1. BASE SILHOUETTE (Light Grey #b5b5b5) */}
            <g id="back-silhouette">
              {/* Neck & Trapezius Base */}
              <path className="silhouette-base" d="M 430,82 L 428,102 L 398,115 L 448,125 L 498,115 L 468,102 L 466,82 Z" />
              {/* Torso, Pelvis & Legs Base */}
              <path className="silhouette-base" d="M 398,115 C 376,118 368,135 372,162 L 358,218 L 342,274 L 352,280 L 374,225 L 391,180 L 402,208 L 404,262 L 395,296 L 400,352 L 404,395 L 402,455 L 410,515 L 398,535 L 424,539 L 427,512 L 433,455 L 431,395 L 444,315 L 448,306 L 452,315 L 465,395 L 463,455 L 469,512 L 472,539 L 498,535 L 486,515 L 494,455 L 492,395 L 496,352 L 501,296 L 492,262 L 494,208 L 505,180 L 522,225 L 544,280 L 554,274 L 538,218 L 524,162 C 528,135 520,118 498,115 Z" />
              {/* Head & Ears Base */}
              <path className="silhouette-base" d="M 425,57 C 421,57 420,66 425,70 C 427,82 436,94 448,94 C 460,94 469,82 471,70 C 476,66 475,57 471,57 C 472,40 463,30 448,30 C 433,30 424,40 425,57 Z" />
              {/* Back of Hair */}
              <path className="hair-shape" d="M 425,59 C 423,41 432,29 448,29 C 464,29 473,41 471,59 C 468,69 462,74 448,74 C 434,74 428,69 425,59 Z" />
            </g>

            {/* 2. NECK & HANDS & FEET (Static Dark Grey #3d3d3d) */}
            <g id="back-static-parts">
              <path className="muscle-static" d="M 435,82 L 446,82 L 446,105 L 431,105 Z" />
              <path className="muscle-static" d="M 461,82 L 450,82 L 450,105 L 465,105 Z" />
              {/* Left Hand & Fingers */}
              <path className="muscle-static" d="M 341,274 L 353,279 L 347,297 L 331,291 Z" />
              <path className="muscle-static" d="M 332,284 L 318,296 C 316,298 318,301 321,299 L 335,289 Z" />
              <path className="muscle-static" d="M 332,292 L 320,313 C 319,316 322,318 324,315 L 336,295 Z" />
              <path className="muscle-static" d="M 337,295 L 328,320 C 327,323 331,324 332,321 L 341,297 Z" />
              <path className="muscle-static" d="M 342,297 L 337,321 C 337,324 340,324 341,321 L 346,298 Z" />
              <path className="muscle-static" d="M 347,297 L 346,317 C 346,320 349,320 350,317 L 351,296 Z" />
              {/* Right Hand & Fingers */}
              <path className="muscle-static" d="M 555,274 L 543,279 L 549,297 L 565,291 Z" />
              <path className="muscle-static" d="M 564,284 L 578,296 C 580,298 578,301 575,299 L 561,289 Z" />
              <path className="muscle-static" d="M 564,292 L 576,313 C 577,316 574,318 572,315 L 560,295 Z" />
              <path className="muscle-static" d="M 559,295 L 568,320 C 569,323 565,324 564,321 L 555,297 Z" />
              <path className="muscle-static" d="M 554,297 L 559,321 C 559,324 556,324 555,321 L 550,298 Z" />
              <path className="muscle-static" d="M 549,297 L 550,317 C 550,320 547,320 546,317 L 545,296 Z" />
              {/* Left & Right Heels / Feet */}
              <path className="muscle-static" d="M 412,515 L 424,515 L 425,539 L 397,536 Z" />
              <path className="muscle-static" d="M 484,515 L 472,515 L 471,539 L 499,536 Z" />
            </g>

            {/* 3. INTERACTIVE MUSCLE GROUPS - BACK VIEW */}
            {/* BACK (Trapezius, Infraspinatus, Teres Major, Latissimus Dorsi, Erector Spinae) */}
            <g onClick={() => handleGroupClick('back')} className="cursor-pointer">
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 430,104 L 446,104 L 446,120 L 399,116 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 466,104 L 450,104 L 450,120 L 497,116 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 402,118 L 446,122 L 446,198 L 424,148 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 494,118 L 450,122 L 450,198 L 472,148 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 401,126 L 422,148 L 399,158 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 398,158 L 423,150 L 428,167 L 396,174 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 495,126 L 474,148 L 497,158 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 498,158 L 473,150 L 468,167 L 500,174 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 398,175 L 428,169 L 444,205 L 434,248 L 405,232 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 498,175 L 468,169 L 452,205 L 462,248 L 491,232 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 446,208 L 446,265 L 435,250 Z" />
              <path className={`muscle-part ${isSelected('back') ? 'selected' : ''}`} d="M 450,208 L 450,265 L 461,250 Z" />
            </g>

            {/* SHOULDERS - BACK (Posterior Deltoids) */}
            <g onClick={() => handleGroupClick('shoulders')} className="cursor-pointer">
              <path className={`muscle-part ${isSelected('shoulders') ? 'selected' : ''}`} d="M 399,117 C 378,120 370,136 374,158 L 399,152 L 403,125 Z" />
              <path className={`muscle-part ${isSelected('shoulders') ? 'selected' : ''}`} d="M 497,117 C 518,120 526,136 522,158 L 497,152 L 493,125 Z" />
            </g>

            {/* ARMS - BACK (Triceps Brachii & Posterior Forearms) */}
            <g onClick={() => handleGroupClick('arms')} className="cursor-pointer">
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 374,159 L 393,154 L 383,198 L 366,196 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 394,156 L 397,178 L 384,212 L 378,198 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 522,159 L 503,154 L 513,198 L 530,196 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 502,156 L 499,178 L 512,212 L 518,198 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 365,202 L 378,208 L 352,276 L 343,271 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 380,210 L 386,216 L 356,278 L 350,275 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 531,202 L 518,208 L 544,276 L 553,271 Z" />
              <path className={`muscle-part ${isSelected('arms') ? 'selected' : ''}`} d="M 516,210 L 510,216 L 540,278 L 546,275 Z" />
            </g>

            {/* GLUTES / BUTT (Gluteus Medius & Gluteus Maximus) */}
            <g onClick={() => handleGroupClick('glutes')} className="cursor-pointer">
              <path className={`muscle-part ${isSelected('glutes') ? 'selected' : ''}`} d="M 405,244 C 416,242 428,246 436,255 L 400,268 C 400,257 402,249 405,244 Z" />
              <path className={`muscle-part ${isSelected('glutes') ? 'selected' : ''}`} d="M 400,270 C 414,254 436,255 446,268 L 446,310 C 425,317 402,308 398,285 Z" />
              <path className={`muscle-part ${isSelected('glutes') ? 'selected' : ''}`} d="M 491,244 C 480,242 468,246 460,255 L 496,268 C 496,257 494,249 491,244 Z" />
              <path className={`muscle-part ${isSelected('glutes') ? 'selected' : ''}`} d="M 496,270 C 482,254 460,255 450,268 L 450,310 C 471,317 494,308 498,285 Z" />
            </g>

            {/* LEGS - BACK (Hamstrings, Adductors/Vastus Lateralis Edge, Calves) */}
            <g onClick={() => handleGroupClick('legs')} className="cursor-pointer">
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 405,308 C 414,312 421,314 424,314 L 417,392 L 404,402 C 405,368 405,335 405,308 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 425,314 L 434,314 L 431,394 L 424,402 L 418,392 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 491,308 C 482,312 475,314 472,314 L 479,392 L 492,402 C 491,368 491,335 491,308 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 471,314 L 462,314 L 465,394 L 472,402 L 478,392 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 398,298 L 404,308 L 403,365 C 397,345 396,320 398,298 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 435,314 L 444,314 L 436,356 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 498,298 L 492,308 L 493,365 C 499,345 500,320 498,298 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 461,314 L 452,314 L 460,356 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 414,398 L 418,465 L 404,458 C 401,432 405,408 414,398 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 419,398 C 429,408 434,432 429,458 L 419,465 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 406,462 L 415,468 L 415,508 L 410,508 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 428,462 L 420,468 L 420,508 L 425,508 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 482,398 L 478,465 L 492,458 C 495,432 491,408 482,398 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 477,398 C 467,408 462,432 467,458 L 477,465 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 490,462 L 481,468 L 481,508 L 486,508 Z" />
              <path className={`muscle-part ${isSelected('legs') ? 'selected' : ''}`} d="M 468,462 L 476,468 L 476,508 L 471,508 Z" />
            </g>
          </g>
        </svg>
      </div>

      {/* Footer Status Pill */}
      <div className="w-full flex items-center justify-center pt-2 border-t border-neutral-100">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-100 text-neutral-700 text-xs font-mono font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-[#5186fb] inline-block shadow-[0_0_6px_rgba(81,134,251,0.6)]" />
          <span>
            {selectedLabels.length > 0
              ? `Selected Focus: ${selectedLabels.join(', ')}`
              : 'Click any muscle group to focus in your routine'}
          </span>
        </div>
      </div>
    </div>
  );
}
export default MuscleVisualizer2D;
