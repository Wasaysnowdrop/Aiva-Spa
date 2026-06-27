export default function AnalyticsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
      <div className="animate-pulse space-y-6">
        <div className="h-7 w-40 rounded-md bg-[#1A1B1E]" />
        <div className="h-3.5 w-72 rounded-md bg-[#1A1B1E]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
              <div className="h-3 w-24 rounded bg-[#1A1B1E]" />
              <div className="mt-4 h-6 w-16 rounded bg-[#1A1B1E]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
