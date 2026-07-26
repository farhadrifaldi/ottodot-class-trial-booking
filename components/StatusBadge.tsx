import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/lib/types";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  payment_failed: "Payment failed",
  cancelled: "Cancelled",
};

const STATUS_CLASSES: Record<BookingStatus, string> = {
  confirmed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400",
  pending_payment:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  payment_failed:
    "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400",
  cancelled:
    "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_CLASSES[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
