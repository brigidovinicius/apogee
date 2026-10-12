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

  return <div className={styles.page}>
    <SiteHeader current="blog" />
    <main id="experiencia" tabIndex={-1} className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Apogee / editorial</p>
        <h1>Ideias que abrem <em>caminhos.</em></h1>
        <p>Um espaço para aprender, questionar e descobrir novas possibilidades em estudos, negócios, ciência, tecnologia e tudo o que move o mundo.</p>
        <span className={styles.heroIndex} aria-hidden>01 — 06</span>
      </section>
      <nav className={styles.categories} aria-label="Temas do blog">
        <Link href="/blog" aria-current={!category ? "page" : undefined}>Todos</Link>
        {BLOG_CATEGORIES.map((item) => <Link key={item.value} href={`/blog?tema=${item.value}`} aria-current={category === item.value ? "page" : undefined}>{item.label}</Link>)}
      </nav>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Leitura / Apogee</p><h2>{category ? categoryLabel(category) : "Últimas publicações"}</h2></div><span>{total} artigo{total === 1 ? "" : "s"}</span></div>
      {posts.length ? <div className={styles.grid}>
        {posts.map((post, index) => {
          const date = postDate(post);
          const cover = post.coverMediaId ? covers.get(post.coverMediaId) : null;
          return <article className={styles.card} key={post.id}>
            <Link href={`/blog/${post.slug}`} className={styles.cardLink} aria-label={`Ler ${post.title}`}>
              <div className={styles.cardArt} data-category={post.category}>{cover && cover.postId === post.id ? <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.coverImage} src={blogMediaUrl(cover.id)} alt={cover.alt} width={cover.width} height={cover.height} loading="lazy" />
              </> : <><span>{String((page - 1) * 12 + index + 1).padStart(2, "0")}</span><span aria-hidden>✳</span></>}</div>
              <div className={styles.cardText}><div className={styles.cardMeta}><span>{categoryLabel(post.category)}</span>{date ? <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time> : null}</div><h3>{post.title}</h3><p>{post.excerpt}</p><span className={styles.readMore}>Ler artigo <span aria-hidden>↗</span></span></div>
            </Link>
          </article>;
        })}
      </div> : <div className={styles.empty}><p>Novas ideias estão a caminho.</p><span>{category ? "Ainda não há artigos publicados neste tema." : "O blog ainda não tem artigos publicados."}</span></div>}
      {pages > 1 ? <nav className={styles.pagination} aria-label="Páginas do blog">
        {page > 1 ? <Link href={pageUrl(page - 1)}>← Anterior</Link> : <span />}
        <span>{page} / {pages}</span>
        {page < pages ? <Link href={pageUrl(page + 1)}>Próxima →</Link> : <span />}
      </nav> : null}
    </main>
    <SiteFooter />
  </div>;
}
