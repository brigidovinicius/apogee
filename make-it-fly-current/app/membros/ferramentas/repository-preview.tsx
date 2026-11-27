import { ArrowRight, FileText, Sparkles } from "lucide-react";
import type { MemberTool } from "@/lib/toolbox/types";
import styles from "./repository-preview.module.css";

type Project = Pick<MemberTool, "categorySlug" | "description">;
type Sample =
  | { kind: "frame"; title: string; text: string; format: "Legenda" | "Título" }
  | { kind: "flow"; title: string; steps: [string, string, string] }
  | { kind: "lines"; title: string; heading: string; rows: [string, string][]; format: "chat" | "file" | "code" }
  | { kind: "table"; title: string }
  | { kind: "image"; title: string; operation: "cutout" | "edit" | "create" }
  | { kind: "screen"; title: string; heading: string; text: string; action: string };

function sampleFor({ categorySlug, description }: Project): Sample {
  const words = description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  switch (categorySlug) {
    case "github-video":
      return words.includes("legendar")
        ? { kind: "frame", title: "Vídeo com legendas", text: "Uma ideia muda o caminho.", format: "Legenda" }
        : { kind: "frame", title: "Título sobre o vídeo", text: "Comece por uma ideia.", format: "Título" };
    case "github-imagem-e-design":
      if (words.includes("remova o fundo")) return { kind: "image", title: "Remoção de fundo", operation: "cutout" };
      if (words.includes("edite imagens")) return { kind: "image", title: "Edição de uma região da imagem", operation: "edit" };
      if (words.includes("geracao de imagens")) return { kind: "image", title: "Imagem a partir de uma ideia", operation: "create" };
      if (/fluxogramas|quadro visual/.test(words)) {
        return { kind: "flow", title: "Conecte as etapas de um processo", steps: ["Ideia", "Esboço", "Revisão"] };
      }
      return { kind: "screen", title: "Protótipo de uma tela", heading: "Seu próximo evento", text: "Veja a agenda e reserve seu lugar.", action: "Ver agenda" };
    case "github-documentos-e-pesquisa":
      if (words.includes("tabelas")) return { kind: "table", title: "Tabela extraída de um PDF" };
      if (words.includes("markdown")) {
        return { kind: "lines", title: "Documento convertido para Markdown", heading: "pauta.md", rows: [["#", "Reunião de projeto"], ["-", "Revisar o protótipo"]], format: "code" };
      }
      if (words.includes("ocr")) {
        return { kind: "lines", title: "Pesquisa em documentos digitalizados", heading: "Busca por “evento”", rows: [["PDF", "Agenda do evento"], ["PDF", "Convite do evento"]], format: "file" };
      }
      return { kind: "lines", title: "Perguntas sobre seus arquivos", heading: "Agenda do evento.pdf", rows: [["Você", "Quando começa a oficina?"], ["IA", "Às 14h, segundo a agenda."]], format: "chat" };
    case "github-audio-e-transcricao":
      return { kind: "lines", title: "Gravação transformada em texto", heading: "oficina.wav", rows: [["00:01", "Bem-vindos à oficina."], ["00:04", "Vamos começar pelo esboço."]], format: "file" };
    case "github-automacao":
      if (words.includes("base de conhecimento")) {
        return { kind: "flow", title: "Assistente que consulta uma base", steps: ["Pergunta", "Documentos", "Resposta"] };
      }
      return words.includes("agendadas")
        ? { kind: "flow", title: "Resumo automático em horário marcado", steps: ["Toda manhã", "Resumo com IA", "E-mail"] }
        : { kind: "flow", title: "Organize respostas automaticamente", steps: ["Formulário", "Classificar", "Planilha"] };
    case "github-ia-local":
      if (words.includes("biblioteca")) {
        return { kind: "flow", title: "Experimento de aprendizado de máquina", steps: ["Dados", "Modelo", "Previsão"] };
      }
      if (words.includes("gguf")) {
        return { kind: "lines", title: "Execução de um modelo no computador", heading: "Modelo local", rows: [["Entrada", "modelo.gguf"], ["Saída", "Uma resposta gerada no dispositivo."]], format: "code" };
      }
      return { kind: "lines", title: "Conversa com um modelo local", heading: "Modelo local", rows: [["Você", "Resuma minhas notas."], ["IA", "Revisar o protótipo às 14h."]], format: "chat" };
    case "github-aprendizado":
      return { kind: "flow", title: "Exercício sobre agentes de IA", steps: ["Objetivo", "Ferramenta", "Resposta"] };
    case "github-programacao":
      return { kind: "screen", title: "Interface gerada para uma resposta de IA", heading: "Resumo da viagem", text: "3 dias, 2 cidades e 1 roteiro.", action: "Ver roteiro" };
    default:
      return { kind: "flow", title: "Da tarefa ao resultado", steps: ["Sua tarefa", "Projeto", "Resultado"] };
  }
}

function SampleContent({ sample }: { sample: Sample }) {
  switch (sample.kind) {
    case "frame":
      return <div className={styles.frame} data-format={sample.format}>
        <span className={styles.frameFormat}>{sample.format}</span>
        <span className={styles.frameText}>{sample.text}</span>
        <span className={styles.timeline} aria-hidden="true"><i /></span>
      </div>;
    case "flow":
      return <ol className={styles.flow} aria-label="Etapas do exemplo">
        {sample.steps.map((step, index) => <li key={step}>
          {index > 0 && <ArrowRight size={13} aria-hidden="true" />}
          <span>{step}</span>
        </li>)}
      </ol>;
    case "lines":
      return <div className={styles.lines} data-format={sample.format}>
        <p><FileText size={14} aria-hidden="true" />{sample.heading}</p>
        <dl>{sample.rows.map(([key, value]) => <div key={value}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
      </div>;
    case "table":
      return <table className={styles.table}>
        <thead><tr><th scope="col">Item</th><th scope="col">Prazo</th></tr></thead>
        <tbody><tr><td>Protótipo</td><td>Terça</td></tr><tr><td>Revisão</td><td>Quinta</td></tr></tbody>
      </table>;
    case "image": {
      const labels = sample.operation === "create" ? ["Prompt", "Imagem"]
        : sample.operation === "cutout" ? ["Imagem original", "Fundo removido"] : ["Região selecionada", "Cor editada"];
      return <div className={styles.imageDemo} data-operation={sample.operation}>
        {labels.map((label, index) => <div key={label}>
          {sample.operation === "create" && index === 0
            ? <span className={styles.sampleArt}>Pôr do sol sobre o mar</span>
            : <span className={styles.sampleArt} aria-hidden="true" />}
          <span>{label}</span>
        </div>)}
      </div>;
    }
    case "screen":
      return <div className={styles.screenSample}>
        <span className={styles.screenToolbar} aria-hidden="true">● ● ●</span>
        <strong>{sample.heading}</strong><span>{sample.text}</span><span className={styles.screenAction}>{sample.action}</span>
      </div>;
  }
}

export function RepositoryPreview({ project }: { project: Project }) {
  const sample = sampleFor(project);
  return <figure className={styles.preview} data-repository-preview={sample.kind}>
    <div className={styles.canvas}><SampleContent sample={sample} /></div>
    <figcaption className={styles.caption}>
      <Sparkles size={13} aria-hidden="true" />
      <span>{sample.title}</span>
      <small>Ilustrativo</small>
    </figcaption>
  </figure>;
}
