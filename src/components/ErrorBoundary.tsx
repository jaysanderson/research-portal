import { Component, type ReactNode } from 'react';
import { ErrorState } from './States';

interface Props { children: ReactNode; resetKey?: string }
interface State { error: Error | null }

// Catches render errors in a subtree so one broken page can't blank the whole app.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error) { console.error('[ErrorBoundary]', error); }

  componentDidUpdate(prev: Props) {
    // Reset when navigating to a different route.
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl px-5 py-16">
          <ErrorState
            message={`This page hit an unexpected error: ${this.state.error.message}`}
            onRetry={() => { this.setState({ error: null }); }}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
