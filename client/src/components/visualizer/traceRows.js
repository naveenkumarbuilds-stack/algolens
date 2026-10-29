export function filterSteps(steps, { action = '', query = '', watched = '' } = {}) {
  const search = query.trim().toLowerCase();
  return steps.filter(
    (step) =>
      (!action || step.type === action) &&
      (!search ||
        [
          step.explanation,
          step.line ?? '',
          step.type,
          JSON.stringify(watched ? { [watched]: step.variables[watched] } : step.variables),
        ]
          .join(' ')
          .toLowerCase()
          .includes(search)),
  );
}
export function variableChanges(step, previous) {
  return Object.keys(step.variables).filter(
    (name) =>
      !previous ||
      !Object.hasOwn(previous.variables, name) ||
      JSON.stringify(previous.variables[name]) !== JSON.stringify(step.variables[name]),
  );
}
export function pageSteps(steps, page, size = 40) {
  const pages = Math.max(1, Math.ceil(steps.length / size));
  const current = Math.max(0, Math.min(pages - 1, page));
  return { rows: steps.slice(current * size, (current + 1) * size), page: current, pages };
}
