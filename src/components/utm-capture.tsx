"use client";

import { useEffect } from "react";
import { captureUtm } from "@/lib/utm";

export function UtmCapture() {
  useEffect(() => captureUtm(), []);
  return null;
}
