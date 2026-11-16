import { radarBudgetStatus } from "@/lib/opportunities/radar-editorial-client";
const dollars = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v / 1_000_000);
export async function RadarBudgetPanel() {
  const status = await radarBudgetStatus();
  if (!status) return <section aria-label="Orçamento do Radar"><h2>Orçamento mensal compartilhado</h2><p>Controle financeiro indisponível. Limite definido: US$ 50 por mês, dividido em US$ 30 / 15 / 5. Não há confirmação de saldo nesta consulta.</p></section>;
  const m = status.monthly;
  return <section aria-label="Orçamento do Radar"><h2>Orçamento mensal compartilhado</h2>
    <p>Mês: {m.period.slice(0, 7)} · teto total {dollars(m.cap_micro)} · horário de Brasília.</p>
    <p>{m.opening_verified ? `Gasto confirmado: ${dollars(m.spent_micro)} · reservado: ${dollars(m.reserved_micro)} · disponível: ${dollars(m.available_micro)}.` : "Conciliação do consumo anterior do mês pendente. O saldo disponível ainda não está confirmado."}</p>
    <div style={{ overflowX: "auto" }}><table><thead><tr><th>Finalidade</th><th>Limite</th><th>Confirmado</th><th>Reservado</th></tr></thead><tbody>
      {Object.entries({ radar: "Radar atual", jobs: "Empregos", reserve: "Rechecagens e recuperação" }).map(([key, label]) => {
        const lane = m.streams[key as keyof typeof m.streams];
        return <tr key={key}><th scope="row">{label}</th><td>{dollars(lane.cap_micro)}</td><td>{m.opening_verified ? dollars(lane.spent_micro) : "A conciliar"}</td><td>{m.opening_verified ? dollars(lane.reserved_micro) : "A conciliar"}</td></tr>;
      })}</tbody></table></div>
    {m.warning_percent > 0 && <p role="status">O consumo e as reservas atingiram {m.warning_percent}% do teto mensal.</p>}
    <p>{status.enabled ? "Chamadas de API sujeitas à validação de orçamento, preço e crédito antes de cada envio." : "Chamadas pagas de IA desativadas. A coleta direta de fontes oficiais não exige IA paga."}</p>
  </section>;
}
