import Link from "next/link";
export function AnnualAccessNotice({ title, next }: { title: string; next: string }) {
  return <section aria-labelledby="annual-access-title"><h2 id="annual-access-title">{title} para assinantes anuais</h2>
    <p>Este recurso exige assinatura anual vigente. O acesso antigo ao Radar continua preservado e é independente desta seção.</p>
    <p><Link href={`/comunidade?next=${encodeURIComponent(next)}#planos`} prefetch={false}>Conhecer a assinatura anual</Link> · <Link href="/membros/assinatura">Conferir minha assinatura</Link></p>
  </section>;
}
