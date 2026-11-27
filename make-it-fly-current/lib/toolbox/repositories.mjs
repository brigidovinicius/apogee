export const repositoryModes = ["No navegador", "Instalação local", "Docker ou servidor", "Código e terminal"];

/** @param {string} slug */
export function isRepositoryCategory(slug) {
  return slug.startsWith("github-");
}

/** @param {string} href */
export function isGitHubRepository(href) {
  return /^https:\/\/github\.com\/[a-z\d](?:[a-z\d-]{0,38})\/[a-z\d_.-]{1,100}$/i.test(href)
    && !/\/(?:\.|\.\.|[^/]+\.git)$/i.test(href);
}

/** @param {string | null} conditions */
export function repositorySetup(conditions) {
  const text = conditions ?? "";
  const mode = repositoryModes.find(value => text.startsWith(value + ". ") || text === value + ".");
  return { mode, details: mode ? text.slice(mode.length + 1).trim() : text };
}

/** @param {{ name: string, description: string, url: string }} project */
export function repositoryPrompt(project) {
  return [
    `Quero conhecer o projeto ${project.name}. ${project.description}`,
    `Repositório oficial no GitHub: ${project.url}`,
    "Sou iniciante. Leia o README e a documentação oficial. Se você não conseguir abrir o link, peça que eu cole o README e diga o que falta confirmar.",
    "Primeiro, pergunte o que quero fazer e se estou no celular ou no computador. Se for relevante, pergunte qual é o sistema. Depois, sugira o caminho mais simples para eu experimentar. Se houver uma demonstração oficial que funcione no navegador, mostre essa opção primeiro.",
    "Diga em linguagem simples se preciso de conta, chave de API, instalação, um computador mais potente ou algum serviço pago. Avise se o projeto enviar arquivos para um serviço externo. Explique um passo de cada vez. Se sugerir um comando, explique o que ele faz e espere que eu confirme antes de orientar a instalação.",
    "Use apenas links e requisitos que você tenha confirmado na documentação. Nunca peça senhas, chaves de API ou arquivos privados.",
  ].join("\n\n");
}
