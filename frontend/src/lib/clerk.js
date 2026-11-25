export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
export const clerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY);

export const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "#6366f1",
    colorBackground: "#020617",
    colorText: "#e2e8f0",
    colorTextSecondary: "#94a3b8",
    colorInputBackground: "#020617",
    colorInputText: "#f8fafc",
    colorDanger: "#fb7185",
    borderRadius: "0.75rem",
  },
  elements: {
    cardBox: "shadow-2xl border border-slate-800",
    card: "bg-slate-950 border border-slate-800 shadow-none",
    headerTitle: "text-slate-50",
    headerSubtitle: "text-slate-400",
    socialButtonsBlockButton: "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800",
    formButtonPrimary: "bg-indigo-500 hover:bg-indigo-400 text-white",
    footerActionLink: "text-cyan-300 hover:text-cyan-200",
  },
};
