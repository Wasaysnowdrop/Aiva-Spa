export default function KnowledgeBaseLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
      <div className="animate-pulse space-y-6">
        <div className="h-7 w-48 rounded-md bg-[#1A1B1E]" />
        <div className="h-3.5 w-72 rounded-md bg-[#1A1B1E]" />
        <div className="flex gap-4">
          <div className="w-64 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-[#1A1B1E]" />
            ))}
          </div>
          <div className="flex-1 rounded-2xl border border-[#23252A] bg-[#121316] p-5">
            <div className="space-y-4">
              <div className="h-6 w-1/3 rounded bg-[#1A1B1E]" />
              <div className="h-24 w-full rounded bg-[#1A1B1E]" />
              <div className="h-24 w-full rounded bg-[#1A1B1E]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
