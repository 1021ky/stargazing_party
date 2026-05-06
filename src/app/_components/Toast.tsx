"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

type ToastProps = {
  message: string;
  duration?: number;
  onClose: () => void;
};

export function Toast({ message, duration = 5000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-gray-800 px-5 py-3 text-sm text-white shadow-lg">
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="flex-shrink-0 rounded p-0.5 hover:bg-white/20"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
