"use client";

import { Download } from "lucide-react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { useRef } from "react";
import { absoluteUrl } from "@/lib/site";

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

export function LotQrDownload({ code }: { code: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = absoluteUrl(`/tracabilite/${encodeURIComponent(code)}`);
  const filename = `avana-qr-${code.toLowerCase()}`;

  const downloadSvg = () => {
    if (!svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    const objectUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    triggerDownload(objectUrl, `${filename}.svg`);
    URL.revokeObjectURL(objectUrl);
  };

  const downloadPng = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl, `${filename}.png`);
      URL.revokeObjectURL(objectUrl);
    }, "image/png");
  };

  return (
    <div className="admin-qr-download">
      <QRCodeSVG
        ref={svgRef}
        value={url}
        size={148}
        bgColor="#fffefa"
        fgColor="#271c17"
        level="M"
        marginSize={1}
        title={`QR du lot ${code}`}
      />
      <QRCodeCanvas
        ref={canvasRef}
        value={url}
        size={1024}
        bgColor="#fffefa"
        fgColor="#271c17"
        level="M"
        marginSize={1}
        className="sr-only"
      />
      <div className="button-row">
        <button className="button button-outline button-sm" type="button" onClick={downloadSvg}>
          <Download size={14} /> SVG
        </button>
        <button className="button button-outline button-sm" type="button" onClick={downloadPng}>
          <Download size={14} /> PNG
        </button>
      </div>
    </div>
  );
}
