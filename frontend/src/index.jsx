import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/react";
import "@/index.css";
import App from "@/App";
import { CLERK_APPEARANCE, CLERK_PUBLISHABLE_KEY, clerkEnabled } from "@/lib/clerk";
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

const app = (
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    {clerkEnabled ? (
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        appearance={CLERK_APPEARANCE}
        signInUrl="/login"
        signUpUrl="/login?mode=register"
        afterSignOutUrl="/"
      >
        {app}
      </ClerkProvider>
    ) : app}
  </React.StrictMode>,
);
