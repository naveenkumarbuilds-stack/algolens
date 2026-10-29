import { useState } from 'react';
import { algorithms } from '../algorithms/registry';

export function AlgorithmCatalog({ selectedId, onSelect }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const visible = algorithms.filter(
    (item) =>
      (category === 'All' || item.category === category) &&
      `${item.name} ${item.category} ${item.complexity.note}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <section className="algorithm-catalog" aria-label="Browse algorithms">
      <div className="catalog-header">
        <h2>Find your next “aha”.</h2>
        <label>
          <span className="sr-only">Search algorithms</span>
          <input
            type="search"
            placeholder="Search algorithms…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="category-tabs" aria-label="Filter by category">
        {['All', ...new Set(algorithms.map((item) => item.category))].map((name) => (
          <button key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>
            {name}
          </button>
        ))}
      </div>
      <p className="catalog-count" role="status">
        {visible.length} {visible.length === 1 ? 'algorithm' : 'algorithms'}
        {category !== 'All' ? ` · ${category}` : ''}
      </p>
      <div className="catalog-grid">
        {visible.map((item) => (
          <button
            className={`catalog-card ${item.id === selectedId ? 'selected' : ''}`}
            key={item.id}
            aria-pressed={item.id === selectedId}
            onClick={() => onSelect(item.id)}
          >
            <span>{item.category}</span>
            <strong>
              {item.name}
              <span aria-hidden="true">↗</span>
            </strong>
            <small>{item.complexity.time}</small>
            {item.id === selectedId && <span className="catalog-selected">Selected ✓</span>}
          </button>
        ))}
      </div>
      {!visible.length && (
        <div className="library-empty">
          <h3>No algorithms found</h3>
          <p>Try another search or choose a different category.</p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery('');
              setCategory('All');
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}
