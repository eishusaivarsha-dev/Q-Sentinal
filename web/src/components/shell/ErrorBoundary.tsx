import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="panel mx-auto max-w-xl p-8 text-center">
        <div className="eyebrow mb-2 !text-reject">Machine fault</div>
        <h2 className="font-display text-[28px] text-paper">This drawer jammed.</h2>
        <p className="data mt-3 break-all text-[12px] text-paper-faint">{this.state.error.message}</p>
        <button className="btn-ghost mt-5" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}
