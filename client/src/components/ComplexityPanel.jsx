const symbols = {
  Sorting: 'n = number of array elements.',
  Searching: 'n = number of array elements.',
  Graphs: 'V = vertices (nodes); E = edges.',
  'Dynamic programming':
    'Fibonacci: n is the requested index. Knapsack: n is item count and W is capacity. LCS: m and n are the two string lengths.',
  'Data structures':
    'n = stored elements; k = operations; h = tree height. An unbalanced BST can have h = n.',
};
export function ComplexityPanel({ algorithm }) {
  return (
    <section className="library-details" aria-label="Algorithm details">
      <span className="pill">{algorithm.category}</span>
      <h2>{algorithm.name}</h2>
      <dl>
        <dt>Time complexity · core algorithm</dt>
        <dd>{algorithm.complexity.time}</dd>
        <dt>Space complexity · core algorithm</dt>
        <dd>{algorithm.complexity.space}</dd>
      </dl>
      <h3>When to use it</h3>
      <p>{algorithm.complexity.note}</p>
      <div className="complexity-note">
        <strong>Read the notation</strong>
        <p>{symbols[algorithm.category]}</p>
        <p>
          O(1): constant work. O(log n): repeatedly shrink the search space. O(n): one pass. O(n²):
          work grows roughly with the square of input size.
        </p>
      </div>
      <details className="complexity-details">
        <summary>What these numbers mean</summary>
        <p>
          Big-O describes growth as input gets larger, rather than an exact duration. Best, average
          and worst cases depend on the input. Space describes the algorithm’s storage; sorting
          metadata describes auxiliary working space.
        </p>
        <p>
          Copying input and recording full snapshots add time and memory beyond these bounds. The
          displayed step count measures recorded operations, not CPU instructions or a benchmark.
        </p>
      </details>
      <h3>
        How it works <span>· pseudocode</span>
      </h3>
      <ol className="source-lines">
        {algorithm.source.split('\n').map((line, index) => (
          <li key={index}>
            <code>{line}</code>
          </li>
        ))}
      </ol>
    </section>
  );
}
