import { Component } from "react";
import { recordActivity } from "@/lib/activity";

// Catches render/lazy-chunk errors in its subtree and shows a recoverable
// fallback instead of a blank screen. Use variant="app" for the root shell
// and variant="route" around each page so one crashing screen doesn't take
// down the rest of the app. quiet boundaries (non-critical chrome such as
// the activity dock) render nothing on error.
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    recordActivity({
      level: "error",
      source: this.props.label ? `screen:${this.props.label}` : "screen",
      message: error?.message || "The screen crashed",
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.quiet) return null;

    const isRoute = this.props.variant === "route";
    return (
      <div
        className={isRoute ? "p-6 relative z-10" : "min-h-screen grid place-items-center p-6 relative z-10"}
        data-testid={isRoute ? "route-error" : "app-error"}
        role="alert"
      >
        <div className="surface max-w-md space-y-4 p-6">
          <p className="eyebrow">Studio interrupted</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {this.props.label ? `${this.props.label} hit an error` : "This screen hit an error"}
          </h1>
          <p className="text-sm text-slate-300 break-words">{error.message || "Something went wrong while rendering this screen."}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={this.reset} data-testid="error-try-again">
              Try again
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-lg border border-slate-700 text-sm"
              onClick={() => window.location.reload()}
              data-testid="error-reload"
            >
              Reload page
            </button>
            <a href="/dashboard" className="h-9 px-3 rounded-lg border border-slate-700 text-sm inline-flex items-center" data-testid="error-go-dashboard">
              Go to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
