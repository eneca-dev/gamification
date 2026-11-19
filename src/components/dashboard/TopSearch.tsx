"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

interface TopSearchProps {
  label: string;
  query: string;
  onQueryChange: (query: string) => void;
}

export function TopSearch({ label, query, onQueryChange }: TopSearchProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        onQueryChange("");
      }
    }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [open, onQueryChange]);

  function close() {
    setOpen(false);
    onQueryChange("");
  }

  return (
    <div ref={rootRef} className={`relative shrink-0 ${open ? "z-30" : ""}`}>
      <button
        type="button"
        onClick={() => open ? close() : setOpen(true)}
        aria-label={open ? `Закрыть поиск: ${label}` : `Поиск: ${label}`}
        aria-expanded={open}
        className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
        style={{ color: "var(--apex-text-secondary)", background: open ? "var(--apex-info-bg)" : "transparent" }}
      >
        {open ? <X size={14} /> : <Search size={14} />}
      </button>
      {open && (
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") close(); }}
          aria-label={`Найти в ${label}`}
          placeholder="Поиск..."
          className="absolute right-full top-1/2 z-30 mr-1.5 w-36 max-w-[70vw] -translate-y-1/2 rounded-lg px-3 py-1.5 text-xs shadow-md outline-none"
          style={{ background: "var(--apex-surface)", border: "1px solid var(--apex-primary)", color: "var(--apex-text)" }}
        />
      )}
    </div>
  );
}
