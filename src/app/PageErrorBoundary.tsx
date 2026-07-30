import React from 'react';

interface PageErrorBoundaryProps {
  pageKey: string;
  children: React.ReactNode;
}

interface PageErrorBoundaryState {
  error: Error | null;
}

/**
 * Isolates a render failure to the active workspace page so the console shell
 * (sidebar, header, toasts) stays usable. Resets whenever the page changes.
 */
export class PageErrorBoundary extends React.Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  declare props: Readonly<PageErrorBoundaryProps>;
  declare setState: React.Component<PageErrorBoundaryProps, PageErrorBoundaryState>['setState'];
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`Page render failed: ${this.props.pageKey}`, error);
  }

  componentDidUpdate(previousProps: PageErrorBoundaryProps) {
    if (previousProps.pageKey !== this.props.pageKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
          <h2 className="text-sm font-bold">This workspace could not be displayed</h2>
          <p className="mt-1 text-xs">Refresh the page and try again. The error has been logged for diagnosis.</p>
          <p className="mt-2 rounded bg-white/70 px-2 py-1 font-mono text-[10px]">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default PageErrorBoundary;
