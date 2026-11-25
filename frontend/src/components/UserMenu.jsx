import { Link, useNavigate } from "react-router-dom";
import { LogOut, Settings2, Shield, UserRound } from "lucide-react";
import { OrganizationSwitcher, useClerk } from "@clerk/react";
import { useAuth } from "@/context/AuthContext";
import { CLERK_APPEARANCE, clerkEnabled } from "@/lib/clerk";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function Avatar({ user }) {
  if (user?.picture) {
    return <img src={user.picture} alt="" className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <div
      className="h-8 w-8 rounded-full bg-indigo-600/30 border border-indigo-400/40 grid place-items-center text-xs font-semibold"
      data-testid="header-user-avatar"
    >
      {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function ClerkSecurityItem() {
  const clerk = useClerk();
  return (
    <DropdownMenuItem
      className="cursor-pointer focus:bg-slate-800"
      onSelect={() => clerk.openUserProfile()}
      data-testid="user-menu-clerk-profile"
    >
      <UserRound className="h-4 w-4" /> Password & security
    </DropdownMenuItem>
  );
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Link to="/login" className="nav-pill" data-testid="header-sign-in">
        Sign in
      </Link>
    );
  }

  const onLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex items-center gap-2" data-testid="user-menu">
      {clerkEnabled && (
        <div className="hidden xl:block max-w-56 overflow-hidden" data-testid="org-switcher">
          <OrganizationSwitcher
            appearance={CLERK_APPEARANCE}
            hidePersonal={false}
            afterCreateOrganizationUrl="/dashboard"
            afterSelectOrganizationUrl="/dashboard"
            afterSelectPersonalUrl="/dashboard"
          />
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-8 w-8 rounded-full outline-none ring-offset-slate-950 focus-visible:ring-2 focus-visible:ring-indigo-400"
            aria-label="Open account menu"
            data-testid="user-menu-trigger"
          >
            <Avatar user={user} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 bg-slate-950 border-slate-800 text-slate-100">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium truncate" data-testid="user-menu-name">{user.name || "Account"}</p>
            <p className="text-xs text-slate-400 truncate" data-testid="user-menu-email">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-800">
            <Link to="/settings" data-testid="user-menu-settings">
              <Settings2 className="h-4 w-4" /> Account settings
            </Link>
          </DropdownMenuItem>
          {clerkEnabled ? <ClerkSecurityItem /> : null}
          {user.role === "admin" && (
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-800">
              <Link to="/admin" data-testid="user-menu-admin">
                <Shield className="h-4 w-4" /> Admin console
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem
            className="cursor-pointer text-rose-300 focus:bg-slate-800 focus:text-rose-200"
            onSelect={onLogout}
            data-testid="logout-button"
          >
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
