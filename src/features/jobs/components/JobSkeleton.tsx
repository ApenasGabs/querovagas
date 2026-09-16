export const JobSkeleton = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="card bg-base-100 border border-base-300 p-5 space-y-4 animate-pulse rounded-2xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-base-300" />
              <div className="space-y-1.5">
                <div className="w-24 h-3 rounded bg-base-300" />
                <div className="w-16 h-2 rounded bg-base-300" />
              </div>
            </div>
            <div className="w-14 h-4 rounded bg-base-300" />
          </div>

          <div className="space-y-2">
            <div className="w-4/5 h-4 rounded bg-base-300" />
            <div className="w-3/5 h-4 rounded bg-base-300" />
          </div>

          <div className="flex gap-2">
            <div className="w-16 h-5 rounded-full bg-base-300" />
            <div className="w-16 h-5 rounded-full bg-base-300" />
          </div>

          <div className="pt-3 border-t border-base-200 flex justify-between items-center">
            <div className="w-20 h-3 rounded bg-base-300" />
            <div className="w-20 h-7 rounded-lg bg-base-300" />
          </div>
        </div>
      ))}
    </div>
  );
};
