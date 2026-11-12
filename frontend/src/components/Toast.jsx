import React from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div className="fixed bottom-5 right-5 z-50 animate-fade-in">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
          isErr
            ? "bg-rose-50 text-rose-900 border-rose-200"
            : "bg-[#14532D] text-white border-[#228B22]"
        }`}
      >
        {isErr ? (
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-[#A3E635] shrink-0" />
        )}
        <span>{toast.message}</span>
        <button onClick={onClose} className="opacity-70 hover:opacity-100 ml-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
