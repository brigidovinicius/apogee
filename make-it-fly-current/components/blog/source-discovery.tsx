import type { SourceDiscovery } from "@/lib/blog/pipeline";

function discoveryHref(value: string) {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !u.port ? u.href : undefined; }
  catch { return undefined; }
}


export function SourceDiscoveryDetails({ discovery, className }: { discovery: SourceDiscovery; className?: string }) {
  return (
    <details className={className}><summary>Referências descobertas e sugestões de imagem</summary>
          <p>Encontradas nas páginas consultadas, sem chamada de IA. Cadastro e popularidade não confirmam fatos; a comparação de 90% e a revisão continuam obrigatórias.</p>
          <ul>{discovery.registered?.slice(0, 6).map(r => <li key={r.url}><a href={discoveryHref(r.url)} target="_blank" rel="noopener noreferrer">{r.name} ↗</a> · {r.kind === "primary" ? "Referência primária cadastrada" : "Veículo cadastrado; conferir independência"}</li>)}</ul>
          {discovery.unregistered?.length ? <><h4>Indicações para avaliar</h4><p>Sites ainda não cadastrados: não foram acessados nem aprovados automaticamente.</p><ul>{discovery.unregistered.slice(0, 5).map(r => <li key={r.url}><a href={discoveryHref(r.url)} target="_blank" rel="noopener noreferrer">{r.host} ↗</a> · cadastro e avaliação pendentes</li>)}</ul></> : null}
          {discovery.images?.length ? <><h4>Imagens indicadas pela fonte primária</h4><p>A indicação e o crédito não autorizam reutilização. Confira a licença e o direito de uso; nenhuma imagem foi baixada ou aplicada automaticamente.</p><ul>{discovery.images.slice(0, 3).map(image => <li key={image.url}><a href={discoveryHref(image.source_url)} target="_blank" rel="noopener noreferrer">Página de origem ↗</a>{" · "}<a href={discoveryHref(image.url)} target="_blank" rel="noopener noreferrer">Conferir imagem ↗</a>{image.credit ? ` · Crédito declarado: ${image.credit}` : " · Crédito a confirmar"}{image.license_url ? <> · <a href={discoveryHref(image.license_url)} target="_blank" rel="noopener noreferrer">Licença declarada; conferir condições ↗</a></> : null} · direito de uso pendente</li>)}</ul></> : null}
        </details>
  );
}
