"use client";

import Image from "next/image";
import { useState } from "react";

type ProductMarkProps = {
  name: string;
  brand?: { image: string; background: string };
  fallbackSrc?: string;
};

export function ProductMark({ name, brand, fallbackSrc }: ProductMarkProps) {
  return <MarkImage key={JSON.stringify([brand?.image, fallbackSrc])} name={name} brand={brand} fallbackSrc={fallbackSrc} />;
}

function MarkImage({ name, brand, fallbackSrc }: ProductMarkProps) {
  const [attempt, setAttempt] = useState(0);
  const sources = [brand?.image, fallbackSrc].filter((src): src is string => Boolean(src));
  const src = sources[attempt];
  const surface = src === brand?.image && brand ? brand.background : src ? "light" : "monogram";
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("");
  return <span data-ap-item-mark={surface} aria-hidden="true">
    {src
      ? <Image key={src} src={src} width={48} height={48} alt="" unoptimized onError={() => setAttempt(attempt + 1)} />
      : initials.toLocaleUpperCase("pt-BR")}
  </span>;
}
