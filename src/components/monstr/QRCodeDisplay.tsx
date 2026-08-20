"use client";

import { useRef } from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";

interface Props {
  url: string;
}

export default function QRCodeDisplay({ url }: Props) {
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (canvas) {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "contest-qr-code.png";
      link.click();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-center p-4 bg-white dark:bg-black rounded">
        <div ref={qrRef}>
          <QRCode value={url} size={200} level="H" />
        </div>
      </div>
      <button
        onClick={downloadQR}
        className="mecha-btn w-full text-sm"
      >
        Download QR code
      </button>
    </div>
  );
}
