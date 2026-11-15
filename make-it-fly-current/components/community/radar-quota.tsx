import Link from "next/link";
export function RadarQuota({used,limit=10}:{used:number;limit?:number}) {
  return <aside aria-label="Consultas gratuitas do Radar"><p role="status"><strong>{used} de {limit} eventos distintos consultados.</strong> {used>=limit ? "Seu limite gratuito foi atingido. Os eventos já liberados continuam disponíveis." : `Você ainda pode consultar ${limit-used} ${limit-used===1 ? "evento novo" : "eventos novos"}.`} Reabrir não gasta outra consulta. A cota não se renova automaticamente.</p><p><Link href="/comunidade#planos">Conhecer a comunidade anual com Radar completo</Link></p></aside>;
}
