import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "./Button";

export function QrScanner({
  onScan,
  disabled = false,
}: {
  onScan: (text: string) => void;
  disabled?: boolean;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setActive(false);
    if (scanner) {
      try {
        await scanner.stop();
      } catch {
        // already stopped
      }
      try {
        scanner.clear();
      } catch {
        // container already cleared
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (scannerRef.current || disabled) return;
    setError(null);
    setActive(true);

    // Let the container paint before the library measures it.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const scanner = new Html5Qrcode("saraban-qr-reader", false);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        async (decodedText) => {
          await stopScanner();
          onScan(decodedText);
        },
        () => {
          // Frames without a QR code are ignored.
        },
      );
    } catch {
      scannerRef.current = null;
      setActive(false);
      setError("Camera unavailable or permission denied. Use the search option below.");
      try {
        scanner.clear();
      } catch {
        // ignore
      }
    }
  }, [disabled, onScan, stopScanner]);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // ignore
            }
          });
      }
    };
  }, []);

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink/10 bg-ink">
        <div
          id="saraban-qr-reader"
          className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />

        {!active ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/75">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10">
              <Camera className="h-6 w-6" />
            </span>
            <p className="text-[13px] font-medium">Camera preview</p>
            <p className="max-w-[240px] text-center text-[11px] leading-relaxed text-white/45">
              Hold the child&apos;s QR wristband inside the frame
            </p>
          </div>
        ) : null}

        {active ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-[58%] w-[58%]">
              <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-lg border-l-2 border-t-2 border-white" />
              <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-lg border-r-2 border-t-2 border-white" />
              <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-lg border-b-2 border-l-2 border-white" />
              <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-lg border-b-2 border-r-2 border-white" />
              <span className="absolute inset-x-2 top-1/2 h-0.5 animate-pulse-soft bg-primary-200/90" />
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs font-medium leading-snug text-danger">
          <CameraOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        {active ? (
          <Button variant="secondary" onClick={() => void stopScanner()} leftIcon={<CameraOff className="h-4 w-4" />}>
            Stop camera
          </Button>
        ) : (
          <Button
            onClick={() => void startScanner()}
            disabled={disabled}
            leftIcon={<ScanLine className="h-4 w-4" />}
          >
            Start camera
          </Button>
        )}
        <span className="text-[11px] leading-snug text-ink-faint">
          Camera permission is required. Manual search always works.
        </span>
      </div>
    </div>
  );
}
