export default function CalendarLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
      <div className="animate-pulse space-y-6">
        <div className="h-7 w-40 rounded-md bg-[#1A1B1E]" />
        <div className="h-3.5 w-56 rounded-md bg-[#1A1B1E]" />
        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="aspect-square rounded bg-[#1A1B1E]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
