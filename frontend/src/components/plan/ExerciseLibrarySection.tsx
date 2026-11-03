import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Dumbbell, Plus, Search, X } from 'lucide-react';
import {
  cleanExerciseName,
  filterLibraryExercises,
  ITEMS_PER_PAGE,
  LIBRARY_CATEGORIES,
  type ExerciseItem,
} from '@/components/plan/planUtils';

interface ExerciseLibrarySectionProps {
  exercises: ExerciseItem[];
  loadingExercises: boolean;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onPreviewExercise: (exercise: ExerciseItem) => void;
  onPromptAddExercise: (exercise: ExerciseItem) => void;
}

export function ExerciseLibrarySection({
  exercises,
  loadingExercises,
  selectedCategory,
  onSelectCategory,
  onPreviewExercise,
  onPromptAddExercise,
}: ExerciseLibrarySectionProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  // 10x4 Grid (40 items/page) Pagination & Card Add Routine Dialog
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filteredExercises = useMemo(
    () => filterLibraryExercises(exercises, searchQuery, selectedCategory),
    [exercises, searchQuery, selectedCategory]
  );

  // Total pages & paginated items for 10x4 grid (40 items/page)
  const totalPages = Math.max(1, Math.ceil(filteredExercises.length / ITEMS_PER_PAGE));
  // Reset/clamp page whenever search query or category filter narrows totalPages
  const activePage = Math.min(currentPage, totalPages);

  const paginatedExercises = useMemo(() => {
    const start = (activePage - 1) * ITEMS_PER_PAGE;
    return filteredExercises.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExercises, activePage]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleCategoryClick = (categoryId: string) => {
    onSelectCategory(categoryId);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by exercise name, body part, equipment..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-surface text-sm text-white placeholder-white/30 outline-none focus:border-red transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {LIBRARY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryClick(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-red text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of 3D Exercise Cards (10 Horizontal x 4 Vertical = 40 Per Page) */}
      {loadingExercises ? (
        <div className="py-20 text-center font-mono text-white/40 space-y-3">
          <div className="w-8 h-8 border-2 border-red border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading 3D animated exercises...</p>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-white/10 p-8 space-y-2">
          <Dumbbell className="w-8 h-8 text-white/20 mx-auto" />
          <p className="text-sm text-white/60 font-mono">No matching exercises found.</p>
          <button
            type="button"
            onClick={() => {
              handleSearchChange('');
              onSelectCategory('all');
            }}
            className="text-xs text-red hover:underline font-mono"
          >
            Clear search filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 10 horizontal x 4 vertical layout */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-2.5">
            {paginatedExercises.map((ex) => (
              <div
                key={ex.id}
                className="group rounded-xl border border-white/10 bg-surface overflow-hidden hover:border-red/40 hover:bg-surface-2 transition-all flex flex-col justify-between shadow-md relative"
              >
                {/* GIF Container (Click to Preview Modal) */}
                <div
                  onClick={() => onPreviewExercise(ex)}
                  className="aspect-square w-full bg-black/70 relative overflow-hidden flex items-center justify-center p-1.5 cursor-pointer"
                >
                  <img
                    src={ex.gif_url}
                    alt={ex.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase font-bold bg-black/85 text-white/80 border border-white/10">
                    {ex.body_part}
                  </span>
                </div>

                {/* Info & Add Action */}
                <div className="p-2 space-y-1.5 flex flex-col justify-between flex-1">
                  <div
                    onClick={() => onPreviewExercise(ex)}
                    className="cursor-pointer"
                  >
                    <h4
                      className="font-bold text-[11px] text-white capitalize truncate group-hover:text-red transition-colors leading-tight"
                      title={ex.name}
                    >
                      {cleanExerciseName(ex.name)}
                    </h4>
                    <p className="text-[9px] text-white/40 font-mono capitalize truncate mt-0.5">
                      {ex.equipment}
                    </p>
                  </div>

                  {/* Quick Add to Routine Day */}
                  <div className="pt-1 border-t border-white/5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPromptAddExercise(ex);
                      }}
                      className="w-full py-1 px-1.5 rounded-lg bg-red/10 hover:bg-red/20 text-red border border-red/20 hover:border-red/40 text-[10px] font-mono font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Add to a scheduled workout day"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10 font-mono text-xs">
            <span className="text-white/40">
              Showing{' '}
              <strong className="text-white">
                {(activePage - 1) * ITEMS_PER_PAGE + 1}
              </strong>{' '}
              –{' '}
              <strong className="text-white">
                {Math.min(activePage * ITEMS_PER_PAGE, filteredExercises.length)}
              </strong>{' '}
              of{' '}
              <strong className="text-white">
                {filteredExercises.length.toLocaleString()}
              </strong>{' '}
              Exercises (Page {activePage} of {totalPages})
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={activePage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(1, activePage - 1))}
                disabled={activePage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              {/* Visible Page Indicator */}
              <span className="px-3 py-1.5 rounded-lg bg-red/15 border border-red/30 text-red font-bold">
                {activePage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
                disabled={activePage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={activePage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
