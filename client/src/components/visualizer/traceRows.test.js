import { describe, it, expect } from 'vitest';
import { filterSteps, pageSteps, variableChanges } from './traceRows';
const steps = [
  { index: 0, type: 'initial', line: null, variables: {}, explanation: 'Start' },
  {
    index: 1,
    type: 'compare',
    line: 3,
    variables: { i: 0, value: 5 },
    explanation: 'Compare the first value',
  },
  {
    index: 2,
    type: 'write',
    line: 4,
    variables: { i: 1, value: 5 },
    explanation: 'Advance the index',
  },
];
describe('dry-run exploration', () => {
  it('combines action and case-insensitive search without changing original indices', () => {
    expect(filterSteps(steps, { action: 'compare', query: ' FIRST ' })).toEqual([steps[1]]);
    expect(filterSteps(steps, { action: 'write', query: 'compare' })).toEqual([]);
    expect(filterSteps(steps, { query: '3' })).toEqual([steps[1]]);
  });
  it('searches selected-variable snapshots and distinguishes missing from zero', () => {
    expect(filterSteps(steps, { watched: 'i', query: '0' })).toEqual([steps[1]]);
    expect(variableChanges(steps[1], steps[0])).toEqual(['i', 'value']);
    expect(variableChanges(steps[2], steps[1])).toEqual(['i']);
  });
  it('bounds pages after filters shrink results and preserves every row across pages', () => {
    const rows = Array.from({ length: 85 }, (_, index) => ({ index }));
    expect(pageSteps(rows, 2).rows).toHaveLength(5);
    expect(pageSteps(rows, 99).page).toBe(2);
    expect(pageSteps([], 99)).toEqual({ rows: [], page: 0, pages: 1 });
    expect([0, 1, 2].flatMap((page) => pageSteps(rows, page).rows)).toEqual(rows);
  });
  it('detects nested changes and newly reintroduced variables', () => {
    expect(variableChanges({ variables: { arr: [1, 3] } }, { variables: { arr: [1, 2] } })).toEqual(
      ['arr'],
    );
    expect(variableChanges({ variables: { i: null } }, { variables: {} })).toEqual(['i']);
  });
});
