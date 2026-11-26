import { useEffect, useState } from "react";
import { resolveAuthUrl } from "@/lib/api";

/** <img> that loads protected API media with the Clerk Bearer token. */
export function AuthedImg({ src, alt = "", className, ...props }) {
  const [resolved, setResolved] = useState("");

  useEffect(() => {
    let alive = true;
    setResolved("");
    if (!src) return undefined;
    resolveAuthUrl(src)
      .then((url) => {
        if (alive) setResolved(url);
      })
      .catch(() => {
        if (alive) setResolved("");
      });
    return () => {
      alive = false;
    };
  }, [src]);

  if (!resolved) {
    return <div className={className} aria-hidden data-testid={props["data-testid"] ? `${props["data-testid"]}-loading` : undefined} />;
  }
  return <img src={resolved} alt={alt} className={className} {...props} />;
}
