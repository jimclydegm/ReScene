"use client";
import { useState, type ReactNode } from "react";
import { X } from "lucide-react";

export function DismissibleNotice({
  children,
  className = "",
  role = "status",
  label = "Dismiss notification",
}: {
  children: ReactNode;
  className?: string;
  role?: "status" | "alert";
  label?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className={`dismissible-notice ${className}`} role={role}>
      <div className="notice-content">{children}</div>
      <button
        type="button"
        className="icon-button notice-dismiss"
        aria-label={label}
        title={label}
        onClick={() => setDismissed(true)}
      >
        <X size={15} />
      </button>
    </div>
  );
}
