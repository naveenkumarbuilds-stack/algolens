# Phase 5 — Algorithm library, dry runs and complexity

The library now provides searchable cards for all 17 algorithms, category filters, selected-card state and an empty-search recovery action. Picking a card loads that algorithm's example and clears the previous trace. The existing selector remains available beside the JSON editor.

The new complexity panel shows the core algorithm's time and space bounds, when to use it, symbol definitions and a beginner explanation of Big-O. It explicitly distinguishes core costs from input copying, snapshot recording and displayed step counts. The recorded line is pseudocode, matching the registry source; it is not claimed to be the internal JavaScript implementation.

The dry-run table is now visible under playback. Each row displays its step number, operation, recorded line and corresponding pseudocode, plain-English explanation and variable values. Variables changed from the immediately preceding recorded snapshot have a text label and tinted background. A missing variable is marked “Not recorded,” never silently carried forward. Selecting a variable in Variable watch filters the displayed variables in the table.

Search matches explanations, action names, line numbers and recorded variable JSON. Action filters combine with search. Filters preserve original step indices; clicking a step pauses playback at that exact snapshot. “Show current step” clears table filters and opens the page containing the active frame. Pages contain at most 40 rows so large traces do not mount thousands of table rows per animation frame. Paging and filtering the table do not change playback until a step is selected. The table has captions, column headers, focusable scrolling and a page announcement; controls work with a keyboard.

## Run

In separate terminals from `C:\coding\dsa project`:

```powershell
npm run dev:server
```

```powershell
npm run dev:client
```

Open http://localhost:5173/library.

## Verify

1. Search for `binary`, select Binary search and inspect its input requirements and complexity notes.
2. Choose a different category; verify only matching cards appear. Search for nonsense and clear filters from the empty state.
3. Select Bubble sort, run its example and step forward. The dry-run row shows the corresponding pseudocode and changed variables.
4. Choose `j` in Variable watch; rows without `j` say “Not recorded.”
5. Search the dry-run table for `swap`, then choose the `compare` action: the empty-state reset should appear because the filters combine.
6. Clear filters; click a row number and verify the animation seeks and pauses there. Use “Show current step” after navigating through the table.
7. For pagination, use Bubble sort input `{"values":[9,8,7,6,5,4,3,2,1]}` and advance to another table page. All original step numbers remain intact.

```powershell
npm test
npm run lint
npm run format:check
npm run build
```

New focused tests cover combined filters, original-index preservation, selected-variable searches, zero/missing values, nested variable changes, and complete/clamped pagination. Existing algorithm, playback and API tests remain part of the root test command.

## Files

- `client/src/components/AlgorithmCatalog.jsx`: searchable category/card browser.
- `client/src/components/ComplexityPanel.jsx`: reusable complexity and use-case explanation.
- `client/src/components/visualizer/DryRunTable.jsx`: searchable, paginated, seekable trace table.
- `client/src/components/visualizer/traceRows.js`: pure filtering, variable-difference and pagination helpers.
- `client/src/components/visualizer/traceRows.test.js`: behavior tests for table data operations.
- `client/src/pages/Library.jsx`: catalog and complexity integration.
- `client/src/components/visualizer/TracePlayer.jsx`: shared playback/table selection integration.
- `client/src/styles.css`: responsive catalog and table styles.

No new dependencies or backend changes are required. Java/C upload and execution remain Phase 6 scope.

## Interview summary

The registry supplies the catalog, complexity panel and displayed pseudocode from one source of truth.
Filtering preserves original snapshot indices so selecting a row always seeks the correct animation frame.
Pagination limits mounted table rows while immutable snapshots make variable comparisons reliable.

Suggested commit: `feat(library): add searchable catalog and detailed paginated dry runs`.
