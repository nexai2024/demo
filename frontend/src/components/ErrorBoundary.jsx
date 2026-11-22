import { Component } from "react";
import { recordActivity } from "@/lib/activity";

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    recordActivity({ level: "error", source: "screen", message: error?.message || "The screen crashed" });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen grid place-items-center p-6 relative z-10" data-testid="app-error">
        <div className="surface max-w-md space-y-4 p-6">
          <p className="eyebrow">Studio interrupted</p>
          <h1 className="text-2xl font-bold tracking-tight">This screen hit an error</h1>
          <p className="text-sm text-slate-300">{this.state.error.message}</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()} data-testid="app-error-reload">Reload the studio</button>
        </div>
      </div>
    );
  }
}
