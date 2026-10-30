"use client";

import { useState } from "react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href.split("?")[0];
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex min-h-11 items-center rounded-full border border-white/40 px-4 text-sm font-semibold hover:bg-white/10"
    >
      {copied ? "Link copiado!" : "Compartilhar"}
    </button>
  );
}
