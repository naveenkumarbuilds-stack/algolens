import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function ComingSoon({ playground = false }) {
  return (
    <div className="page">
      <span className="eyebrow">{playground ? 'CODE PLAYGROUND' : 'ALGORITHM LIBRARY'}</span>
      <section className="empty-state">
        <span className="empty-icon">
          <Icon name={playground ? 'code' : 'book'} size={32} />
        </span>
        <h1 className="page-title">
          {playground ? 'A space for your own code.' : 'A closer look at every algorithm.'}
        </h1>
        <p>
          {playground
            ? 'Program upload, selected-variable tracing, and custom-code playback are planned for Phase 6, including JavaScript, Java, and C. Java and C require a separate isolated compiler service.'
            : 'All 17 step generators are ready. Animated visualizers arrive in Phase 4, and the interactive library in Phase 5.'}
        </p>
        <Link to="/" className="button secondary">
          Back to overview
          <Icon name="arrow" size={18} />
        </Link>
      </section>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page empty-state">
      <span className="eyebrow">404 · PAGE NOT FOUND</span>
      <h1 className="page-title">A little off the path.</h1>
      <p>The page you’re looking for doesn’t exist.</p>
      <Link className="button primary" to="/">
        Back to overview
        <Icon name="arrow" size={18} />
      </Link>
    </div>
  );
}
