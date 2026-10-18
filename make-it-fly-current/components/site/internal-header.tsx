import { SiteHeader } from "./site-header";

type InternalHeaderProps = { current: "galeria" | "loja" | "membros" };

export function InternalHeader({ current }: InternalHeaderProps) {
  const section = { galeria: "gallery", loja: "store", membros: "members" } as const;
  return <SiteHeader current={section[current]} eventLink />;
}
