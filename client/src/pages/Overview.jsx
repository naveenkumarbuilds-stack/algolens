import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { Icon } from '../components/Icon';

const tracks = [
  {
    number: '01',
    title: 'See algorithms in motion',
    text: 'Follow comparisons, swaps, and decisions as they happen.',
    type: 'ARRAYS & SORTING',
    bars: [30, 60, 42, 82, 52, 100, 70],
  },
  {
    number: '02',
    title: 'Connect the dots',
    text: 'Explore how graph and tree algorithms find their way.',
    type: 'GRAPHS & TREES',
    graph: true,
  },
  {
    number: '03',
    title: 'Make every step count',
    text: 'Break bigger problems into smaller, understandable pieces.',
    type: 'DYNAMIC PROGRAMMING',
    grid: true,
  },
];
export function Overview() {
  const { user } = useAuth();
  return (
    <div className="page overview">
      <div className="page-eyebrow">
        <span className="status-dot" /> YOUR ALGORITHM WORKSPACE
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="pill">A LITTLE CLARITY GOES A LONG WAY</span>
          <h1>
            Don’t just run it.
            <br />
            <span>Understand it.</span>
          </h1>
          <p>
            Your space to explore algorithms, follow the logic, and turn “why does this work?” into
            “now I get it.”
          </p>
          <Link className="button primary" to={user ? '/dashboard' : '/register'}>
            {user ? 'Open my workspace' : 'Create your workspace'}
            <Icon name="arrow" size={18} />
          </Link>
          <span className="hero-caption">
            {user
              ? `Welcome back, ${user.name}.`
              : 'Free to learn. Built for your next breakthrough.'}
          </span>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-top">
            <span className="visual-dots">● ● ●</span>
            <span>bubble-sort.js</span>
            <span>JS</span>
          </div>
          <div className="code-line">
            <span>04</span>
            <code>
              <em>if</em> (arr[j] &gt; arr[j + 1]) {'{'}
            </code>
          </div>
          <div className="visual-bars">
            {[42, 68, 95, 55, 78, 115].map((height, i) => (
              <div key={i} className={i === 2 || i === 3 ? 'bar active' : 'bar'} style={{ height }}>
                <span>{[3, 5, 8, 4, 6, 9][i]}</span>
                <small>{i}</small>
              </div>
            ))}
          </div>
          <div className="compare-note">
            <span>↔</span>
            <div>
              <strong>Look closer. The logic is here.</strong>
              <p>Every comparison tells part of the story.</p>
            </div>
          </div>
          <div className="visual-footer">
            <span>
              <i />
              Your next algorithm, step by step
            </span>
            <span>STEP BY STEP ↗</span>
          </div>
        </div>
      </section>
      <section className="learning-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FROM CONFUSION TO CLARITY</span>
            <h2>A different way to learn algorithms</h2>
          </div>
          <span className="quiet-label">Visual learning, at your pace</span>
        </div>
        <div className="track-grid">
          {tracks.map((track) => (
            <article className="track-card" key={track.number}>
              <div className="track-top">
                <span>{track.type}</span>
                <span>{track.number}</span>
              </div>
              <div className="track-art" aria-hidden="true">
                {track.bars && (
                  <div className="mini-bars">
                    {track.bars.map((height, i) => (
                      <span key={i} style={{ height: height * 0.65 }} />
                    ))}
                  </div>
                )}
                {track.graph && (
                  <svg viewBox="0 0 250 90">
                    <path
                      d="M42 52 102 23 165 54 218 25M102 23l6 58m57-27-57 27"
                      fill="none"
                      stroke="currentColor"
                      opacity=".3"
                      strokeWidth="2"
                    />
                    {[
                      [42, 52],
                      [102, 23],
                      [165, 54],
                      [218, 25],
                      [108, 81],
                    ].map(([x, y], i) => (
                      <g key={i}>
                        <circle
                          cx={x}
                          cy={y}
                          r="12"
                          fill={i === 1 ? '#c1e9a5' : 'var(--surface)'}
                          stroke="currentColor"
                        />
                        <text x={x} y={y + 4} textAnchor="middle" fill="var(--text)" fontSize="10">
                          {String.fromCharCode(65 + i)}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
                {track.grid && (
                  <div className="mini-grid">
                    {[0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 2, 2, 0, 1, 2, 3].map((n, i) => (
                      <span key={i} className={i === 15 ? 'selected' : ''}>
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <h3>{track.title}</h3>
              <p>{track.text}</p>
              <Link className="coming-label" to="/library">
                EXPLORE ALGORITHMS <span>↗</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="workspace-banner">
        <div className="banner-icon">
          <Icon name="book" size={24} />
        </div>
        <div>
          <h3>Your progress deserves a place.</h3>
          <p>
            {user
              ? 'Save problems, add notes, and keep your practice streak growing.'
              : 'Create an account today. Save problems and track practice as features arrive.'}
          </p>
        </div>
        <Link to={user ? '/dashboard' : '/register'}>
          {user ? 'My workspace' : 'Get started'}
          <Icon name="arrow" size={18} />
        </Link>
      </section>
    </div>
  );
}
