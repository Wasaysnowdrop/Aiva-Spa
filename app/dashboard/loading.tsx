export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-5 lg:px-8 lg:pt-8">
      <div className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-md bg-[#1A1B1E]" />
          <div className="h-3.5 w-72 rounded-md bg-[#1A1B1E]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#23252A] bg-[#121316] p-5"
            >
              <div className="h-3 w-24 rounded bg-[#1A1B1E]" />
              <div className="mt-4 h-7 w-20 rounded bg-[#1A1B1E]" />
              <div className="mt-2 h-2.5 w-16 rounded bg-[#1A1B1E]" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="h-4 w-32 rounded bg-[#1A1B1E]" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-[#1A1B1E]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/2 rounded bg-[#1A1B1E]" />
                  <div className="h-2.5 w-1/3 rounded bg-[#1A1B1E]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
