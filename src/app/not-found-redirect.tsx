"use client";

import { useEffect } from "react";

// /e/<slug>/ ainda não gerado no build → página do evento ao vivo.
export function NotFoundRedirect() {
  useEffect(() => {
    const m = window.location.pathname.match(/^\/e\/([a-z0-9-]+)\/?$/);
    if (m && m[1] !== "_") window.location.replace(`/evento/?s=${m[1]}${window.location.search.replace(/^\?/, "&")}`);
  }, []);
  return null;
}
