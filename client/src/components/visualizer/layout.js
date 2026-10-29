export function graphPositions(view) {
  if (view.kind === 'tree') {
    const positions = new Map();
    const children = new Set(view.edges.map((e) => e.to));
    const root = view.nodes.find((n) => !children.has(n.id));
    let order = 0;
    function visit(id, depth) {
      const left = view.edges.find((e) => e.from === id && e.id.endsWith(':left'));
      const right = view.edges.find((e) => e.from === id && e.id.endsWith(':right'));
      if (left) visit(left.to, depth + 1);
      positions.set(id, { x: 55 + order++ * 75, y: 45 + depth * 85 });
      if (right) visit(right.to, depth + 1);
    }
    if (root) visit(root.id, 0);
    return positions;
  }
  return new Map(
    view.nodes.map((n, i) => [
      n.id,
      {
        x: 260 + 180 * Math.cos((i / view.nodes.length) * 2 * Math.PI - Math.PI / 2),
        y: 230 + 180 * Math.sin((i / view.nodes.length) * 2 * Math.PI - Math.PI / 2),
      },
    ]),
  );
}
