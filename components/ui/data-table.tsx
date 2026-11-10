import type { ReactNode } from "react";
import { cx } from "./cx";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Hide below the md breakpoint. Use for secondary columns on phones. */
  hideOnMobile?: boolean;
  align?: "left" | "right";
}

/**
 * Data table with a caption, sticky header row and thin rules. Wraps itself in a scroll area so a wide table
 * scrolls inside its own box and never widens the page. Empty rows show `empty` instead of an empty grid.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  empty,
  className,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  empty?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("overflow-x-auto border border-line bg-surface-raised", className)}>
      <table className="w-full min-w-[32rem] border-collapse text-left text-[14px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-raised">
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cx(
                  "px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft",
                  c.align === "right" && "text-right",
                  c.hideOnMobile && "hidden md:table-cell",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-soft">
                {empty ?? "Nothing to show yet."}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="border-b border-line last:border-b-0 hover:bg-accent-soft/40">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx("px-4 py-3.5 align-middle text-ink", c.align === "right" && "text-right tabular-nums", c.hideOnMobile && "hidden md:table-cell")}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
