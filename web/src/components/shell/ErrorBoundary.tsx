import { Component, type ReactNode } from "react";

/** Keeps one broken page (or a WebGL failure) from blanking the whole console. */
export default class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return this.props.fallback ?? (
      <div className="card p-8">
        <p className="text-[18px] font-bold text-bad">This view hit an error.</p>
        <p className="data mt-2 text-[14px] text-ink-3">{this.state.error.message}</p>
        <button className="btn-ghost mt-4" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}
