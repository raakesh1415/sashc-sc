/**
 * AppTable — shared table wrapper around MaterialReactTable.
 *
 * Centralises all visual/structural defaults so changes to table appearance
 * (paper radius, shadow, action-column config, cell gap) only need to be made here.
 *
 * Usage (basic):
 *   <AppTable columns={columns} data={data} loading={loading}
 *             renderRowActions={({ row }) => <EditButton ... />} />
 *
 * Usage (inline row editing — needs external ref to call setCreatingRow):
 *   const tableRef = useRef(null);
 *   <AppTable ref={tableRef} columns={columns} data={data}
 *             createDisplayMode="row" editDisplayMode="row" enableEditing ... />
 *   <PrimaryButton onClick={() => tableRef.current?.setCreatingRow(true)} />
 *
 * Props:
 *   columns             – column definitions
 *   data                – table rows
 *   loading             – maps to state.isLoading (boolean, default false)
 *   renderRowActions    – render prop for row action buttons
 *   actionsColumnSize   – width of the actions column (default 180)
 *   state               – extra state to merge (isSaving, creatingRow, rowSelection…)
 *   displayColumnDefOptions – override the default action-column config
 *   muiTableBodyCellProps   – override default cell props
 *   ...rest             – all other useMaterialReactTable props pass through unchanged
 *
 * All other visual defaults live here — see App.jsx for color tokens.
 */

import React, { forwardRef, useImperativeHandle } from "react";
import { MaterialReactTable, useMaterialReactTable } from "material-react-table";

const AppTable = forwardRef(function AppTable(
  {
    columns,
    data,
    loading = false,
    renderRowActions,
    actionsColumnSize = 180,
    state,
    displayColumnDefOptions: callerDCD,
    muiTableBodyCellProps: callerCellProps,
    ...rest
  },
  ref
) {
  const hasRowActions =
    !!renderRowActions || rest.enableRowActions === true;

  const table = useMaterialReactTable({
    columns,
    data,

    // ── Visual defaults (edit here to restyle all tables) ──────────────────
    muiTablePaperProps: { sx: { borderRadius: 2, boxShadow: 1 } },
    muiTableBodyCellProps: callerCellProps ?? {
      sx: { "& .MuiBox-root": { gap: "8px" } },
    },

    // ── Row actions defaults (auto-applied when renderRowActions is given) ──
    ...(hasRowActions && {
      enableRowActions: true,
      positionActionsColumn: "last",
      displayColumnDefOptions: callerDCD ?? {
        "mrt-row-actions": {
          header: "Tindakan",
          size: actionsColumnSize,
          enableSorting: false,
          enableHiding: true,
          enableColumnActions: true,
        },
      },
      renderRowActions,
    }),

    // ── State (caller state is merged, not overridden) ─────────────────────
    state: { isLoading: loading, ...state },

    // ── Everything else passes through unchanged ───────────────────────────
    ...rest,
  });

  // Expose the table instance via ref so parent can call setCreatingRow etc.
  useImperativeHandle(ref, () => table, [table]);

  return <MaterialReactTable table={table} />;
});

export default AppTable;
