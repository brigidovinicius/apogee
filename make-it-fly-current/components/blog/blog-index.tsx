import { interfaceText } from "@/lib/presentation-text.mjs";
import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getCoverMedia, listPublicPosts } from "@/lib/blog/data";
import { blogMediaUrl } from "@/lib/blog/media";
import { BLOG_CATEGORIES, categoryLabel, postDate } from "@/lib/blog/shared";
import styles from "@/app/blog/blog.module.css";




const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export async function BlogIndex({ searchParams, member = false }: { searchParams: Promise<{ tema?: string; pagina?: string }>; member?: boolean }) {
  const basePath = member ? "/membros/blog" : "/blog";
  const Content = member ? "div" : "main";
  const query = await searchParams;
  const category = BLOG_CATEGORIES.find((item) => item.value === query.tema)?.value ?? null;
  const requestedPage = Number(query.pagina);
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 10_000 ? requestedPage : 1;
  const { posts, total, pages } = await listPublicPosts(category, page);
  const coverRows = await getCoverMedia(posts.flatMap((post) => post.coverMediaId ? [post.coverMediaId] : []));
  const covers = new Map(coverRows.map((media) => [media.id, media]));
  const pageUrl = (next: number) => `${basePath}?${new URLSearchParams({ ...(category ? { tema: category } : {}), pagina: String(next) })}`;

  const renderPost = (post: (typeof posts)[number], index: number) => {
    const date = postDate(post);
    const cover = post.coverMediaId ? covers.get(post.coverMediaId) : null;
    const lead = index === 0;
    const showCover = (lead || index >= 3) && cover?.postId === post.id;
    return <article className={`${styles.card} ${lead ? styles.leadCard : ""}`} key={post.id}>
      <Link href={`${basePath}/${post.slug}`} className={styles.cardLink} aria-label={`Ler ${interfaceText(post.title)}`}>
        <div className={styles.cardText}>
          <div className={styles.cardMeta}><span>{categoryLabel(post.category)}</span>{date ? <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time> : null}</div>
          <h3 data-ap-heading="">{interfaceText(post.title)}</h3>
          <p>{interfaceText(post.excerpt)}</p>
        </div>
        {showCover && cover ? <div className={styles.cardArt}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.coverImage} src={blogMediaUrl(cover.id)} alt={interfaceText(cover.alt)} width={cover.width} height={cover.height} loading={lead ? "eager" : "lazy"} />
        </div> : null}
        <span className={styles.readMore}>Ler artigo</span>
      </Link>
    </article>;
  };

  return <div className={`${styles.page} ${styles.indexPage}`} data-member-blog={member || undefined}>
    {!member && <SiteHeader current="blog" />}
    <Content id={member ? undefined : "experiencia"} tabIndex={-1} className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Apogee / editorial</p>
        <h1>Blog</h1>
        <p>Ciência, tecnologia e empreendedorismo.</p>
      </section>
      <nav className={styles.categories} aria-label="Temas do blog">
        <Link href={basePath} aria-current={!category ? "page" : undefined}>Todos</Link>
        {BLOG_CATEGORIES.map((item) => <Link key={item.value} href={`${basePath}?tema=${item.value}`} aria-current={category === item.value ? "page" : undefined}>{item.label}</Link>)}
      </nav>
      <div data-ap-reveal="" className={styles.sectionHeading}><h2 data-ap-heading="" data-ap-title="">{category ? categoryLabel(category) : page === 1 ? "Em destaque" : "Últimas publicações"}</h2><span>{total} artigo{total === 1 ? "" : "s"}</span></div>
      {posts.length ? <>
        <div className={styles.frontGrid} data-count={Math.min(posts.length, 3)}>
          <div>{renderPost(posts[0], 0)}</div>
          {posts.length > 1 ? <div className={styles.secondary}>{posts.slice(1, 3).map((post, index) => renderPost(post, index + 1))}</div> : null}
        </div>
        {posts.length > 3 ? <div className={styles.grid}>{posts.slice(3).map((post, index) => renderPost(post, index + 3))}</div> : null}
      </> : <div className={styles.empty}><p>{category ? "Nenhum artigo publicado neste tema." : "Nenhum artigo publicado."}</p></div>}
      {pages > 1 ? <nav className={styles.pagination} aria-label="Páginas do blog">
        {page > 1 ? <Link href={pageUrl(page - 1)}>← Anterior</Link> : <span />}
        <span>{page} / {pages}</span>
        {page < pages ? <Link href={pageUrl(page + 1)}>Próxima →</Link> : <span />}
      </nav> : null}
    </Content>
    {!member && <SiteFooter />}
  </div>;
}
