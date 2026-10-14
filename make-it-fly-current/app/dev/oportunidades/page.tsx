import { connection } from "next/server";
import { notFound } from "next/navigation";
import { CountdownDemo } from "./countdown-demo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teste local dos contadores", robots: { index: false, follow: false } };

export default async function LocalOpportunitiesPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  await connection();
  // This Server Component samples request time after connection(); the client receives a stable value.
  // eslint-disable-next-line react-hooks/purity
  return <CountdownDemo initialNow={Date.now()} />;
}
