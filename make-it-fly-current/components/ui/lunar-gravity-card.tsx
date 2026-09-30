"use client";

import React from "react";
import { MoonScene } from "@/components/ui/moon-scene";
import { cn } from "@/lib/utils";

export interface LunarGravityCardProps {
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
}

export default function LunarGravityCard({
  className,
  title = (
    <>
      <span className="text-zinc-50 drop-shadow-sm">Lunar</span>
      <br />
      <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-400 to-zinc-800 drop-shadow-md">
        Gravity.
      </span>
    </>
  ),
  description = "Embed highly realistic astrophysics directly into your Next.js project. Zero configuration, fully interactive, and flawlessly smooth.",
}: LunarGravityCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-[1000px] min-h-[700px] md:min-h-[auto] md:h-[540px] bg-black rounded-[2.5rem] flex flex-col md:flex-row relative overflow-hidden border border-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,0.4)]",
        className
      )}
    >
      <div className="absolute top-0 left-0 md:inset-y-0 md:left-0 w-full h-[60%] md:h-full md:w-[60%] bg-gradient-to-b md:bg-gradient-to-r from-black via-black/90 to-transparent z-10 pointer-events-none"></div>

      <div className="w-full md:w-[45%] flex flex-col justify-center px-10 py-12 md:p-0 md:pl-16 relative z-20 pointer-events-none">
        <h2 className="text-[4.5rem] md:text-[5.5rem] font-bold tracking-tighter leading-[0.9] mb-6">
          {title}
        </h2>
        <p className="text-base md:text-lg text-zinc-400 font-medium leading-relaxed max-w-[340px]">
          {description}
        </p>
      </div>

      <div className="relative md:absolute md:right-0 md:top-0 w-full h-[450px] md:h-full md:w-[65%] pointer-events-auto z-0 flex items-center justify-center">
        <div className="absolute inset-0 w-full h-full">
          <MoonScene />
        </div>
      </div>
    </div>
  );
}

export { LunarGravityCard as Component };
