import React, { useState } from "react";
import { PricingTable, useClerk } from "@clerk/react";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { CLERK_APPEARANCE } from "@/lib/clerk";

export function ClerkAccountTools() {
  const clerk = useClerk();
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <button
        type="button"
        onClick={() => clerk.openUserProfile()}
        className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm flex items-center gap-2"
        data-testid="clerk-manage-account"
      >
        <UserRound className="h-4 w-4" /> Manage account & security
      </button>
      <button
        type="button"
        onClick={() => clerk.openOrganizationProfile()}
        className="h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm flex items-center gap-2"
        data-testid="clerk-manage-organization"
      >
        <Building2 className="h-4 w-4" /> Manage organization
      </button>
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5" /> Password reset, MFA, devices and sessions are handled by Clerk.
      </span>
    </div>
  );
}

function BillingFallback() {
  return (
    <p className="text-xs text-slate-500 mt-4" data-testid="billing-disabled">
      Clerk Billing is not enabled for this instance yet. Turn it on in the Clerk dashboard to offer upgrades here.
    </p>
  );
}

class BillingBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* Clerk throws when Billing is disabled in the dashboard. */
  }
  render() {
    if (this.state.failed) return <BillingFallback />;
    return this.props.children;
  }
}

export function ClerkBilling() {
  const [scope, setScope] = useState("user");
  return (
    <div className="mt-5" data-testid="clerk-billing">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="font-medium">Subscription plans</h4>
          <p className="text-xs text-slate-500 mt-1">
            Checkout, trials, invoices, upgrades and cancellation are handled by Clerk Billing.
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-700 overflow-hidden" role="tablist" aria-label="Billing scope">
          {[
            ["user", "Individual"],
            ["organization", "Organization"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              onClick={() => setScope(value)}
              className={`px-3 h-9 text-sm ${scope === value ? "bg-indigo-500 text-white" : "bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
              data-testid={`billing-scope-${value}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <BillingBoundary key={scope}>
        <PricingTable
          for={scope}
          appearance={CLERK_APPEARANCE}
          newSubscriptionRedirectUrl="/settings"
        />
      </BillingBoundary>
      {scope === "organization" && (
        <p className="text-xs text-slate-500 mt-3">
          Select or create an organization from the account menu before subscribing it. Seat limits and member roles are enforced by Clerk.
        </p>
      )}
    </div>
  );
}
