"use client";

/**
 * Opens the browser's print dialog, which is also where "Save as PDF" lives.
 * Printing through the browser is what lets a worksheet keep the SVG figures
 * and question tables the screen renders, instead of re-drawing them in a
 * second PDF engine.
 */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="kx-btn-primary" onClick={() => window.print()}>
      {label}
    </button>
  );
}
