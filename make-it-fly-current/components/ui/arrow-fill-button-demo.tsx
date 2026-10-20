"use client";

import ArrowFillButton from "@/components/ui/arrow-fill-button";

export default function ArrowFillButtonDemo() {
  return (
    <div className="flex min-h-64 w-full items-center justify-center p-12">
      <ArrowFillButton btnText="Hover me" onClick={(event) => event.preventDefault()} />
    </div>
  );
}
