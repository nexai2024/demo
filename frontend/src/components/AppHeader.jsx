import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Clapperboard, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { UserMenu } from "@/components/UserMenu";

const navCls = ({ isActive }) => `nav-pill ${isActive ? "is-active" : "hover:text-white"}`;

const Links = ({ onNavigate, test = false }) => {
  const { user } = useAuth();
  return (
    <>
      <NavLink to="/dashboard" className={navCls} data-testid={test ? "nav-projects-link" : undefined} onClick={onNavigate}>Projects</NavLink>
      {user?.role === "admin" && (
        <NavLink to="/admin" className={navCls} data-testid={test ? "nav-admin-link" : undefined} onClick={onNavigate}>Admin</NavLink>
      )}
      <NavLink to="/help" className={navCls} data-testid={test ? "nav-help-link" : undefined} onClick={onNavigate}>Help</NavLink>
    </>
  );
};

export const AppHeader = ({ children }) => {
  const [menu, setMenu] = useState(false);
  return (
    <header className="app-header" data-testid="app-header">
      <div className="flex items-center gap-4 min-w-0">
        <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold shrink-0" data-testid="header-logo-link">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500/20 text-cyan-300"><Clapperboard className="h-4 w-4" /></span>
          AppShowcase
        </Link>
        {children || (
          <nav className="hidden sm:flex items-center gap-1" data-testid="app-nav">
            <Links test />
          </nav>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <UserMenu />
        {!children && (
          <button type="button" className="sm:hidden h-8 w-8 grid place-items-center rounded-full hover:bg-slate-800" aria-label="Open menu" onClick={() => setMenu((v) => !v)} data-testid="nav-menu-button">
            {menu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        )}
      </div>
      {menu && !children && (
        <nav className="absolute left-3 right-3 top-[4.2rem] surface flex flex-col p-2 sm:hidden" data-testid="nav-mobile">
          <Links onNavigate={() => setMenu(false)} />
          <NavLink to="/settings" className={navCls} onClick={() => setMenu(false)} data-testid="nav-settings-link">Account settings</NavLink>
        </nav>
      )}
    </header>
  );
};
