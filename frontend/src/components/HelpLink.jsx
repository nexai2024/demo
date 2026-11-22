import { Link } from "react-router-dom";
import { CircleHelp } from "lucide-react";

export function HelpLink({ topic, label }) {
  return (
    <Link
      to={`/help#${topic}`}
      data-help={topic}
      data-testid={`help-link-${topic}`}
      aria-label={`Open help for ${label}`}
      title={`Help: ${label}`}
      className="inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:text-cyan-300 hover:bg-slate-800"
    >
      <CircleHelp className="h-4 w-4" />
    </Link>
  );
}
