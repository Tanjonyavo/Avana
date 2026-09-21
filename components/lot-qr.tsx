"use client";

import { QRCodeSVG } from "qrcode.react";
import { absoluteUrl } from "@/lib/site";

export function LotQr({ code }: { code: string }) {
  const url = absoluteUrl(`/tracabilite/${encodeURIComponent(code)}`);
  return (
    <QRCodeSVG
      value={url}
      size={148}
      bgColor="#fffefa"
      fgColor="#271c17"
      level="M"
      marginSize={1}
      title={`QR du lot ${code}`}
    />
  );
}
