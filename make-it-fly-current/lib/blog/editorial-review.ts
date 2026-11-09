export function sourceReferences(body: string) {
  // HTML forms submit CRLF; generated drafts use LF. Preserve both formats.
  const section = body.replace(/\r\n?/g,"\n").split(/\n\nFontes:\s*\n/).at(1) ?? "";
  return section.split("\n").slice(0,10).flatMap(line => {
    const match = /^\[\d+\]\s+(.+?)\s+—\s+(https:\/\/\S+)(?:\s+\(\d{4}-\d{2}-\d{2}\))?$/.exec(line.trim());
    if (!match) return [];
    try { const url = new URL(match[2]); if(url.username || url.password) return []; return [{ title:match[1], url:url.href }]; } catch { return []; }
  });
}
export function editorialChecks(post: { title: string; body: string; seoTitle: string | null; seoDescription: string | null; hasCover: boolean; noIndex: boolean }) {
  return [
    { label:"Título informativo entre 8 e 140 caracteres", ok:post.title.trim().length>=8 && post.title.length<=140 },
    { label:"Título de busca preenchido, até 70 caracteres", ok:!!post.seoTitle && post.seoTitle.length<=70 },
    { label:"Descrição de busca preenchida, até 160 caracteres", ok:!!post.seoDescription && post.seoDescription.length<=160 },
    { label:"Fontes originais identificadas", ok:sourceReferences(post.body).length>0 },
    { label:"Capa disponível para revisão", ok:post.hasCover },
    { label:post.noIndex?"Indexação bloqueada até revisão editorial":"Indexação permitida após publicação", ok:true },
  ];
}
