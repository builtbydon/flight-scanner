import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
  /** Fixed column width (e.g. "6rem"). Setting any column's width switches the
   *  table to fixed layout so wide unbreakable content can't overflow. */
  width?: string;
  /** Truncate overflowing cell content with an ellipsis (needs a sized table —
   *  i.e. some column has a width, or this column shares the remaining space). */
  truncate?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  className?: string;
}

/** Generic dark-theme data table with right-alignable numeric columns. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  empty = "Nothing to show.",
  className = "",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-text-dim py-4">{empty}</p>;
  }
  const fixed = columns.some((c) => c.width);
  return (
    <table className={`w-full border-collapse text-[13px] ${fixed ? "table-fixed" : ""} ${className}`}>
      <thead>
        <tr className="text-left">
          {columns.map((c) => (
            <th
              key={c.key}
              style={c.width ? { width: c.width } : undefined}
              className={`pb-2 px-2 text-[11px] font-medium uppercase tracking-wide text-text-muted border-b border-surface-700/40 ${
                c.align === "right" ? "text-right" : ""
              }`}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={getRowKey(row, i)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`border-b border-surface-700/15 ${
              onRowClick ? "cursor-pointer hover:bg-surface-800/50 transition-colors" : ""
            }`}
          >
            {columns.map((c) => (
              <td
                key={c.key}
                className={`py-2 px-2 ${c.align === "right" ? "text-right tabular-nums" : ""} ${
                  c.truncate ? "max-w-0 truncate whitespace-nowrap" : ""
                } ${c.className ?? ""}`}
              >
                {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
