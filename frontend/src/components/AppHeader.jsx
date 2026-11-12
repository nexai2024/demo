import { Link, NavLink } from "react-router-dom";
import { Clapperboard, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navCls = ({ isActive }) =>
  `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`;

export const AppHeader = ({ children }) => {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-6 min-w-0">
        <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold shrink-0" data-testid="header-logo-link">
          <Clapperboard className="h-5 w-5 text-cyan-400" /> Flowcast
        </Link>
        {children || (
          <nav className="hidden sm:flex items-center gap-1">
            <NavLink to="/dashboard" className={navCls} data-testid="nav-projects-link">Projects</NavLink>
            <NavLink to="/settings" className={navCls} data-testid="nav-settings-link">Settings</NavLink>
          </nav>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {user?.picture ? (
          <img src={user.picture} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 grid place-items-center text-xs font-semibold" data-testid="header-user-avatar">
            {(user?.name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <button onClick={logout} className="text-slate-400 hover:text-white transition-colors" aria-label="Log out" data-testid="logout-button">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
