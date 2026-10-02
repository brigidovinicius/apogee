import Link from "next/link";

export function AdminNav() {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-6 py-4 text-sm font-semibold">
        <Link href="/" className="mr-auto text-lg text-slate-950">Radar Acadêmico</Link>
        <Link href="/admin/fontes" className="text-slate-600 hover:text-blue-700">Fontes</Link>
        <Link href="/admin/ingestoes" className="text-slate-600 hover:text-blue-700">Ingestões</Link>
        <Link href="/admin/revisao" className="text-slate-600 hover:text-blue-700">Revisão</Link>
      </div>
    </nav>
  );
}