import { AudioLines, BookOpen, Braces, Clapperboard, Globe, Layers, Palette, Search, Server, Workflow } from "lucide-react";

const categoryIcons = {
  video: Clapperboard, "imagem-e-design": Palette, audio: AudioLines,
  "texto-e-pesquisa": Search, "produtividade-e-automacao": Workflow,
  programacao: Braces, "sites-e-publicacao": Globe, infraestrutura: Server, skills: BookOpen,
};

export function ToolCategoryMark({ slug }: { slug: string }) {
  const Icon = Object.hasOwn(categoryIcons, slug) ? categoryIcons[slug as keyof typeof categoryIcons] : Layers;
  return <span data-ap-item-mark="category" aria-hidden="true"><Icon size={23} strokeWidth={1.65} /></span>;
}
