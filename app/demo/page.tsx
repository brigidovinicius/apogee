"use client";

import { Component as LunarGravityCard } from "@/components/ui/lunar-gravity-card";

/** Demo original do componente, preservada para referência. */
export default function Demo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-zinc-950 p-4 sm:p-10">
      <div className="relative w-full max-w-[1000px]">
        <LunarGravityCard />
      </div>
    </div>
  );
}
