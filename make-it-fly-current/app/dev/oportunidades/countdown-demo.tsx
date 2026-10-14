"use client";

import { Suspense, useMemo, useState } from "react";
import { OpportunitiesBoard } from "@/components/opportunities/opportunities-board";
import { dateInBrazil, type StudentOpportunity } from "@/lib/opportunities/types";

export function CountdownDemo({ initialNow }: { initialNow: number }) {
  const [startedAt, setStartedAt] = useState(initialNow);
  const opportunities = useMemo(() => {
    const futureDay = dateInBrazil(new Date(startedAt + 2 * 86_400_000));
    const base: StudentOpportunity = {
      id: "demo-scholarship", title: "Bolsa — encerramento em 2 minutos", organization: "Demonstração local · dados fictícios",
      kind: "Bolsa", level: "Graduação", categories: ["bolsas"], location: "Brasil",
      stateCode: null, cityName: null, eligibility: "Exemplo para conferir o contador.", benefit: "Dado de demonstração.",
      summary: "Observe os segundos diminuírem até o encerramento das inscrições.", deadline: futureDay,
      deadlineAt: new Date(startedAt + 120_000).toISOString(), deadlineLabel: "Prazo de demonstração",
      officialUrl: "https://example.org", verifiedAt: dateInBrazil(new Date(startedAt)),
    };
    return [
      base,
      { ...base, id: "demo-event", kind: "Programa" as const, categories: ["eventos"] as StudentOpportunity["categories"], title: "Evento — começa em 3 minutos", summary: "O relógio conta até o início do evento.", eventStartsAt: new Date(startedAt + 180_000).toISOString() },
      { ...base, id: "demo-zero", title: "Teste rápido — encerra em 15 segundos", summary: "Ao zerar, deve aparecer Inscrições encerradas.", deadlineAt: new Date(startedAt + 15_000).toISOString() },
      { ...base, id: "demo-safe", title: "Bolsa — encerra em 10 dias", summary: "Mais de 7 dias: contador verde.", deadline: dateInBrazil(new Date(startedAt + 10 * 86_400_000)), deadlineAt: new Date(startedAt + 10 * 86_400_000).toISOString() },
      { ...base, id: "demo-date", title: "Bolsa — data sem horário", summary: "Sem horário confirmado, o contador mostra apenas dias.", deadlineAt: null },
      { ...base, id: "demo-continuous", title: "Programa — fluxo contínuo", kind: "Programa" as const, summary: "Sem data limite, não há contagem inventada.", deadline: null, deadlineAt: null, deadlineLabel: "Inscrições em fluxo contínuo" },
      { ...base, id: "demo-unknown-event", title: "Evento — início não informado", kind: "Programa" as const, categories: ["eventos"] as StudentOpportunity["categories"], summary: "A ausência de data deve ficar explícita.", eventStartsAt: null },
    ];
  }, [startedAt]);

  return <main id="experiencia" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "32px 20px", boxSizing: "border-box" }}>
    <header style={{ marginBottom: 32 }}>
      <h1>Teste local dos contadores</h1>
      <p>Dados fictícios para testar o mural. Verde: mais de 7 dias. Vermelho: 7 dias ou menos. O terceiro card encerra em 15 segundos.</p>
      <button type="button" onClick={() => setStartedAt(Date.now())} style={{ marginTop: 16, padding: "12px 18px", border: "1px solid #b9d3ee", borderRadius: 8, cursor: "pointer" }}>
        Reiniciar contadores
      </button>
    </header>
    <Suspense fallback={<p>Carregando mural…</p>}>
      <OpportunitiesBoard key={startedAt} opportunities={opportunities} />
    </Suspense>
  </main>;
}
