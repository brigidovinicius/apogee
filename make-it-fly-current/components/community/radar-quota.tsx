import Link from "next/link";
export function RadarQuota({used,limit=10,next}:{used:number;limit?:number;next:string}) {
  return <aside aria-label="Consultas gratuitas do Radar"><p role="status"><strong>{used} de {limit} eventos distintos consultados.</strong> {used>=limit ? "Seu limite gratuito foi atingido. Os eventos já liberados continuam disponíveis." : `Você ainda pode consultar ${limit-used} ${limit-used===1 ? "evento novo" : "eventos novos"}.`} Reabrir não gasta outra consulta. A cota não se renova automaticamente.</p><p><Link href={`/comunidade?next=${encodeURIComponent(next)}#plano-anual`}>Ver plano com Radar completo</Link></p></aside>;
}
