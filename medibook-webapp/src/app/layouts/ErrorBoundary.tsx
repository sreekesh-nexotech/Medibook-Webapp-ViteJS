import { Component, type ErrorInfo, type ReactNode } from 'react';

import { reportError } from '@/core/error/monitoring';

import { isStaleBuildError } from '@/app/staleBuild';

interface ErrorBoundaryProps {
  /** `reference` is the crash report's id once monitoring has it, else `null`. */
  fallback: (error: unknown, reset: () => void, reference: string | null) => ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  err: unknown;
  reference: string | null;
}

/**
 * Per-view error boundary, ported from the design prototype
 * (`Medibook mbAdmin.html` `ErrorBoundary`). This is a class component by
 * necessity — React only exposes error-boundary behaviour through class
 * lifecycles (`getDerivedStateFromError`) — a pre-authorized exception to
 * the function-components-only rule.
 *
 * The prototype's `resetKey` prop is expressed as a React `key={view}` at
 * the call sites instead: a view change remounts the boundary, clearing any
 * caught error exactly like the prototype's `componentDidUpdate` reset.
 *
 * Each crash is reported to monitoring with its component stack (OBS-01),
 * except a code file removed by a redeploy, which reloads instead (RUN-01).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { err: null, reference: null };

  static getDerivedStateFromError(err: unknown): Partial<ErrorBoundaryState> {
    return { err };
  }

  componentDidCatch(err: unknown, info: ErrorInfo): void {
    if (isStaleBuildError(err)) return;
    const reference = reportError(err, { source: 'render', componentStack: info.componentStack });
    if (reference) this.setState({ reference });
  }

  render(): ReactNode {
    if (this.state.err)
      return this.props.fallback(
        this.state.err,
        () => this.setState({ err: null, reference: null }),
        this.state.reference,
      );
    return this.props.children;
  }
}
