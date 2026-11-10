import { interfaceText } from "@/lib/presentation-text.mjs";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getCoverMedia, listPublicPosts } from "@/lib/blog/data";
import { blogMediaUrl } from "@/lib/blog/media";
import { BLOG_CATEGORIES, categoryLabel, postDate } from "@/lib/blog/shared";
import styles from "./blog.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | Apogee",
  description: "Ideias, estudos, empreendedorismo, tecnologia, ciências e atualidades para ampliar caminhos.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "Blog | Apogee", description: "Conhecimento, ideias e perspectivas para seguir em frente.", url: "/blog", type: "website" },
};

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ tema?: string; pagina?: string }> }) {
  const query = await searchParams;
  const category = BLOG_CATEGORIES.find((item) => item.value === query.tema)?.value ?? null;
  const requestedPage = Number(query.pagina);
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 10_000 ? requestedPage : 1;
  const { posts, total, pages } = await listPublicPosts(category, page);
  const coverRows = await getCoverMedia(posts.flatMap((post) => post.coverMediaId ? [post.coverMediaId] : []));
  const covers = new Map(coverRows.map((media) => [media.id, media]));
  const pageUrl = (next: number) => `/blog?${new URLSearchParams({ ...(category ? { tema: category } : {}), pagina: String(next) })}`;

  const renderPost = (post: (typeof posts)[number], index: number) => {
    const date = postDate(post);
    const cover = post.coverMediaId ? covers.get(post.coverMediaId) : null;
    const lead = index === 0;
    const showCover = (lead || index >= 3) && cover?.postId === post.id;
    return <article className={`${styles.card} ${lead ? styles.leadCard : ""}`} key={post.id}>
      <Link href={`/blog/${post.slug}`} className={styles.cardLink} aria-label={`Ler ${interfaceText(post.title)}`}>
        <div className={styles.cardText}>
          <div className={styles.cardMeta}><span>{categoryLabel(post.category)}</span>{date ? <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time> : null}</div>
          <h3>{interfaceText(post.title)}</h3>
          <p>{interfaceText(post.excerpt)}</p>
        </div>
        {showCover && cover ? <div className={styles.cardArt}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.coverImage} src={blogMediaUrl(cover.id)} alt={interfaceText(cover.alt)} width={cover.width} height={cover.height} loading={lead ? "eager" : "lazy"} />
        </div> : null}
        <span className={styles.readMore}>Ler artigo <ArrowUpRight aria-hidden="true" size={16} /></span>
      </Link>
    </article>;
  };

  return <div className={`${styles.page} ${styles.indexPage}`}>
    <SiteHeader current="blog" />
    <main id="experiencia" tabIndex={-1} className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Apogee / editorial</p>
        <h1>Ideias que abrem caminhos</h1>
        <p>Ciência, tecnologia e possibilidades para aprender, construir e participar.</p>
      </section>
      <nav className={styles.categories} aria-label="Temas do blog">
        <Link href="/blog" aria-current={!category ? "page" : undefined}>Todos</Link>
        {BLOG_CATEGORIES.map((item) => <Link key={item.value} href={`/blog?tema=${item.value}`} aria-current={category === item.value ? "page" : undefined}>{item.label}</Link>)}
      </nav>
      <div className={styles.sectionHeading}><h2>{category ? categoryLabel(category) : page === 1 ? "Em destaque" : "Últimas publicações"}</h2><span>{total} artigo{total === 1 ? "" : "s"}</span></div>
      {posts.length ? <>
        <div className={styles.frontGrid} data-count={Math.min(posts.length, 3)}>
          <div>{renderPost(posts[0], 0)}</div>
          {posts.length > 1 ? <div className={styles.secondary}>{posts.slice(1, 3).map((post, index) => renderPost(post, index + 1))}</div> : null}
        </div>
        {posts.length > 3 ? <div className={styles.grid}>{posts.slice(3).map((post, index) => renderPost(post, index + 3))}</div> : null}
      </> : <div className={styles.empty}><p>Novas ideias estão a caminho</p><span>{category ? "Ainda não há artigos publicados neste tema" : "O blog ainda não tem artigos publicados"}</span></div>}
      {pages > 1 ? <nav className={styles.pagination} aria-label="Páginas do blog">
        {page > 1 ? <Link href={pageUrl(page - 1)}>← Anterior</Link> : <span />}
        <span>{page} / {pages}</span>
        {page < pages ? <Link href={pageUrl(page + 1)}>Próxima →</Link> : <span />}
      </nav> : null}
    </main>
    <SiteFooter />
  </div>;
}
