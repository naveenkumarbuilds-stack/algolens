import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="recovery-screen">
          <span className="eyebrow">LET’S GET YOU BACK</span>
          <h1>Something interrupted this page.</h1>
          <p>
            Your saved problems are kept on the server. Reload to reopen the app; unsaved editor
            changes may be lost.
          </p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Reload AlgoLens
          </button>
          <a className="button secondary" href="/">
            Back to overview
          </a>
        </main>
      );
    return this.props.children;
  }
}
