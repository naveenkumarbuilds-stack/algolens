import { graphPositions } from './layout';
function roleFor(step, target, id) {
  return step.highlights.find((h) => h.target === target && h.ids.includes(String(id)))?.role || '';
}

export function ArrayView({ step, initial }) {
  const { values, kind } = step.view;
  const scale = Math.max(1, ...initial.view.values.map(Math.abs), ...values.map(Math.abs));
  if (!values.length) return <div className="visual-empty">The {kind} is empty.</div>;
  return (
    <div className={`array-visual ${kind}`} role="img" aria-label={`${kind}: ${values.join(', ')}`}>
      {values.map((value, i) => (
        <div className={`array-item ${roleFor(step, 'array', i)}`} key={i}>
          <span className="array-value">{value}</span>
          <div
            className={`array-column ${value < 0 ? 'negative' : ''}`}
            style={{ height: kind === 'array' ? 12 + (Math.abs(value) / scale) * 135 : 48 }}
          >
            <span>{kind !== 'array' ? value : ''}</span>
          </div>
          <span className="array-index">
            {i}
            {kind === 'stack' && i === values.length - 1
              ? ' · top'
              : kind === 'queue' && i === 0
                ? ' · front'
                : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

export function GraphView({ step, initial, visited }) {
  const view = step.view;
  const positions = graphPositions(initial.view.kind === 'tree' ? initial.view : view);
  const points = [...positions.values()];
  const width = Math.max(520, ...points.map((p) => p.x + 55)),
    height = Math.max(300, ...points.map((p) => p.y + 55));
  if (!view.nodes.length)
    return <div className="visual-empty">The tree is empty. Step forward to insert its root.</div>;
  return (
    <div className="graph-scroll">
      <svg
        className="graph-visual"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: Math.min(width, 1000) }}
        role="img"
        aria-label={`${view.kind} with ${view.nodes.length} nodes and ${view.edges.length} edges`}
      >
        {view.edges.map((edge) => {
          const from = positions.get(edge.from),
            to = positions.get(edge.to);
          if (!from || !to) return null;
          const dx = to.x - from.x,
            dy = to.y - from.y,
            d = Math.hypot(dx, dy) || 1;
          const x1 = from.x + (dx / d) * 23,
            y1 = from.y + (dy / d) * 23,
            x2 = to.x - (dx / d) * 25,
            y2 = to.y - (dy / d) * 25;
          return (
            <g key={edge.id} className={`graph-edge ${roleFor(step, 'edge', edge.id)}`}>
              <title>
                {edge.from} {edge.directed ? 'to' : '↔'} {edge.to}
                {edge.weight !== undefined ? `, weight ${edge.weight}` : ''}
              </title>
              {edge.from === edge.to ? (
                <path
                  d={`M${from.x - 15},${from.y - 18} C${from.x - 60},${from.y - 80} ${from.x + 60},${from.y - 80} ${from.x + 15},${from.y - 18}`}
                  fill="none"
                />
              ) : (
                <line x1={x1} y1={y1} x2={x2} y2={y2} />
              )}{' '}
              {edge.directed && edge.from !== edge.to && (
                <path
                  d={`M${x2 - (dx / d) * 10 + (dy / d) * 5},${y2 - (dy / d) * 10 - (dx / d) * 5} L${x2},${y2} L${x2 - (dx / d) * 10 - (dy / d) * 5},${y2 - (dy / d) * 10 + (dx / d) * 5}`}
                  fill="none"
                />
              )}
              {edge.weight !== undefined && (
                <text x={(from.x + to.x) / 2 + 8} y={(from.y + to.y) / 2 - 8}>
                  {edge.weight}
                </text>
              )}
            </g>
          );
        })}
        {view.nodes.map((node) => {
          const p = positions.get(node.id);
          return (
            p && (
              <g
                key={node.id}
                className={`graph-node ${visited.has(node.id) ? 'visited' : ''} ${roleFor(step, 'node', node.id)}`}
                transform={`translate(${p.x} ${p.y})`}
              >
                <title>
                  {node.label}
                  {visited.has(node.id) ? ' · visited' : ''}
                </title>
                <circle r="23" />
                <text textAnchor="middle" dy="4">
                  {node.label}
                </text>
              </g>
            )
          );
        })}
      </svg>
    </div>
  );
}
export function DPView({ step }) {
  const { cells, rowLabels, columnLabels } = step.view;
  return (
    <div className="dp-scroll" tabIndex={0} aria-label="Scrollable dynamic programming grid">
      <table className="dp-grid">
        <caption>Dynamic programming table</caption>
        <thead>
          <tr>
            <th scope="col">State</th>
            {columnLabels.map((label, i) => (
              <th key={i} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, r) => (
            <tr key={r}>
              <th scope="row">{rowLabels[r]}</th>
              {row.map((value, c) => (
                <td key={c} className={roleFor(step, 'cell', `${r}:${c}`)}>
                  {value ?? '·'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
