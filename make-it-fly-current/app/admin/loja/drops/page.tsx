import type { Metadata } from "next";
import { listDropSignups } from "@/lib/admin/drop-signups";
import { DropSignupsView } from "./drop-signups-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cadastros dos drops" };

export default async function DropSignupsPage({ searchParams }: {
  searchParams: Promise<{ busca?: string | string[]; pagina?: string | string[] }>;
}) {
  const params = await searchParams;
  const result = await listDropSignups(params.busca, params.pagina);
  return <DropSignupsView result={result} />;
}
