import { CheckCircle2, LogIn, Printer, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";

import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Dialog";
import { money, shortDate } from "../../lib/format";
import type { Child } from "../../lib/types";

export function ChildQrDialog({
  child,
  open,
  onClose,
}: {
  child: Child | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  if (!child) return null;
  const inside = Boolean(child.active_visit);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Child QR pass"
      description="Print this pass and attach it to the wristband. One scan identifies the child at the counter."
      size="sm"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => window.print()}
            leftIcon={<Printer className="h-4 w-4" />}
          >
            Print pass
          </Button>
          {inside && child.active_visit ? (
            <Button
              onClick={() => {
                onClose();
                navigate(`/checkout/${child.active_visit?.id}`);
              }}
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Open checkout
            </Button>
          ) : (
            <Button
              onClick={() => {
                onClose();
                navigate(`/check-in?childId=${child.id}`);
              }}
              leftIcon={<LogIn className="h-4 w-4" />}
            >
              Check in now
            </Button>
          )}
        </div>
      }
    >
      <div className="mx-auto w-full max-w-[280px]">
        <div className="print-area overflow-hidden rounded-2xl border border-dashed border-ink/20 bg-white p-5 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-white">
              <QrCode className="h-4 w-4" />
            </span>
            <div className="text-left leading-none">
              <p className="text-[13px] font-extrabold tracking-[-0.02em]">Saraban</p>
              <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.22em] text-ink-muted">
                Play Area
              </p>
            </div>
          </div>
          <div className="my-4 border-t border-dashed border-ink/20" />
          <p className="truncate text-lg font-extrabold tracking-[-0.02em] text-ink">
            {child.name}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            Age {child.age} · {child.parent_name}
          </p>
          <div className="mt-4 flex justify-center">
            <QRCodeSVG
              value={child.qr_code}
              size={156}
              level="M"
              marginSize={1}
              fgColor="#1C202B"
              bgColor="#FFFFFF"
            />
          </div>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-700">
            Scan at reception
          </p>
          <p className="tabular mt-1 text-[12px] font-semibold text-ink">+91 {child.phone}</p>
          <div className="my-3 border-t border-dashed border-ink/20" />
          <p className="text-[9px] text-ink-faint">
            {child.active_visit
              ? `Checked in · ${child.active_visit.plan_name}`
              : `Registered ${shortDate(child.created_at)}`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {inside ? (
          <Badge tone="success" dot>
            Currently inside · {child.active_visit?.plan_name}
          </Badge>
        ) : (
          <Badge tone="primary">Plan from {money(150)}</Badge>
        )}
      </div>
    </Modal>
  );
}
