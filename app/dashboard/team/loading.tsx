export default function TeamLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
      <div className="animate-pulse space-y-6">
        <div className="h-7 w-28 rounded-md bg-[#1A1B1E]" />
        <div className="h-3.5 w-64 rounded-md bg-[#1A1B1E]" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-[#23252A] bg-[#121316] p-4">
              <div className="size-12 rounded-full bg-[#1A1B1E]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/4 rounded bg-[#1A1B1E]" />
                <div className="h-2.5 w-1/3 rounded bg-[#1A1B1E]" />
              </div>
              <div className="h-6 w-20 rounded bg-[#1A1B1E]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
