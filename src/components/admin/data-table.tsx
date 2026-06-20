"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type DataTableColumn<T> = {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  width?: string
  className?: string
}

export type DataTableProps<T> = {
  rows: T[]
  columns: DataTableColumn<T>[]
  search?: (row: T, term: string) => boolean
  empty?: React.ReactNode
  pageSize?: number
  title?: string
  onRefresh?: () => void
  isRefreshing?: boolean
  rightSlot?: React.ReactNode
}

export function DataTable<T>({
  rows,
  columns,
  search,
  empty,
  pageSize = 25,
  title,
  onRefresh,
  isRefreshing = false,
  rightSlot,
}: DataTableProps<T>) {
  const [term, setTerm] = React.useState("")
  const [page, setPage] = React.useState(0)

  const filtered = React.useMemo(() => {
    if (!term) return rows
    if (!search) return rows
    return rows.filter((r) => search(r, term))
  }, [rows, term, search])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const pageRows = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  return (
    <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#23252A] p-3">
        {title ? (
          <h3 className="text-sm font-semibold text-[#F7F8F8]">{title}</h3>
        ) : null}
        {search ? (
          <div className="relative ml-auto">
            <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-[#62666D]" />
            <Input
              value={term}
              onChange={(e) => {
                setTerm(e.target.value)
                setPage(0)
              }}
              placeholder="Search…"
              className="h-8 w-48 border-[#23252A] bg-[#121316] pl-7 text-xs text-[#F7F8F8] placeholder:text-[#62666D]"
            />
          </div>
        ) : null}
        {rightSlot}
        {onRefresh ? (
          <Button
            size="icon-sm"
            variant="outline"
            onClick={onRefresh}
            className="size-7 border-[#23252A] bg-[#121316] text-[#8A8F98] hover:text-[#F7F8F8]"
            title="Refresh"
          >
            <RefreshCw className={cn("size-3", isRefreshing && "animate-spin")} />
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1A1B1E] text-left text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn("px-3 py-2 font-semibold", c.className)}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1B1E]">
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-[#62666D]"
                >
                  {empty ?? "No rows."}
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr
                  key={(row as unknown as { id?: string }).id ?? i}
                  className="text-[#F7F8F8] transition hover:bg-[#101115]"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "whitespace-nowrap px-3 py-2 align-middle text-xs",
                        c.className,
                      )}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="flex items-center justify-between border-t border-[#1A1B1E] px-3 py-2 text-[10px] text-[#62666D]">
          <span>
            {filtered.length} rows · page {currentPage + 1} of {pages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="size-7 border-[#23252A] bg-[#121316] text-[#8A8F98] hover:text-[#F7F8F8] disabled:opacity-30"
            >
              <ChevronLeft className="size-3" />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              disabled={currentPage >= pages - 1}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              className="size-7 border-[#23252A] bg-[#121316] text-[#8A8F98] hover:text-[#F7F8F8] disabled:opacity-30"
            >
              <ChevronRight className="size-3" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
