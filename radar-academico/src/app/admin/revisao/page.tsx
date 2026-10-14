import { AdminNav } from "../_components/nav";
import { requireAdmin } from "@/lib/auth/admin";
import { listLiveCatalogue } from "@/lib/db/live-catalogue";
export const dynamic = "force-dynamic";
export default async function CataloguePage() {
  await requireAdmin();
  const items = await listLiveCatalogue();
  return <><AdminNav /><main className="mx-auto max-w-5xl p-8"><h1 className="text-3xl font-bold">Catálogo ao vivo</h1>
    <p>Crie, edite e exclua oportunidades no painel da Apogee. As fichas válidas coletadas entram automaticamente.</p>
    <ul>{items.map((item) => <li key={String(item.id)} className="my-4"><a href={String(item.officialUrl)}>{String(item.title)}</a></li>)}</ul>
  </main></>;
}
