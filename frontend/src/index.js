import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";
import { recordActivity } from "@/lib/activity";

// Error boundaries only catch render errors. Surface the rest (async
// throws, unhandled rejections) in the Activity dock instead of leaving
// them as console-only mysteries.
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  recordActivity({
    level: "error",
    source: "promise",
    message: reason?.message || (typeof reason === "string" ? reason : "Unhandled promise rejection"),
  });
});
window.addEventListener("error", (event) => {
  if (event.message) {
    recordActivity({ level: "error", source: "window", message: event.message });
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
