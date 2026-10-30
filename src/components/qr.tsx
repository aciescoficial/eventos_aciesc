"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: "M" }).then(setSrc);
  }, [value, size]);
  if (!src) return <div style={{ width: size, height: size }} className="animate-pulse rounded-xl bg-bg" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt={label} className="rounded-xl bg-white" />;
}
