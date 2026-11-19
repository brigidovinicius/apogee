import { sourceReferences } from "@/lib/blog/editorial-review";
import { interfaceText } from "@/lib/presentation-text.mjs";
import { BrandMark } from "@/components/ui/brand-mark";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ShareButton } from "@/components/site/share-button";
import { getPublicPost, listPostMedia } from "@/lib/blog/data";
import { blogMediaUrl } from "@/lib/blog/media";
import { articleMediaCaption } from "@/lib/blog/media-caption.mjs";
import { categoryLabel, postDate } from "@/lib/blog/shared";
import { parseVideoUrl } from "@/lib/blog/video";
import styles from "@/app/blog/blog.module.css";



const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export async function generateArticleMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) return { title: "Artigo não encontrado | Apogee", robots: { index: false } };
  const title = interfaceText(post.seoTitle || post.title);
  const description = interfaceText(post.seoDescription || post.excerpt);
  const media = post.coverMediaId ? await listPostMedia(post.id) : [];
  const cover = media.find((item) => item.id === post.coverMediaId);
  const image = cover ? { url: blogMediaUrl(cover.id), alt: cover.alt, width: cover.width, height: cover.height } : null;
  return {
    title: `${title} | Apogee`, description,
    robots: post.seoNoIndex ? { index: false, follow: true } : undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title, description, url: `/blog/${post.slug}`, type: "article", publishedTime: postDate(post)?.toISOString(), modifiedTime: post.updatedAt.toISOString(), authors: [post.authorName], images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image.url] : undefined },
  };
}

export async function BlogArticle({ params, member = false }: { params: Promise<{ slug: string }>; member?: boolean }) {
  const basePath = member ? "/membros/blog" : "/blog";
  const Content = member ? "div" : "main";
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) notFound();
  const date = postDate(post);
  const media = await listPostMedia(post.id);
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const cover = post.coverMediaId ? mediaById.get(post.coverMediaId) : null;
  const coverCaption = articleMediaCaption(cover?.caption);
  const video = post.videoUrl ? parseVideoUrl(post.videoUrl) : null;
  const paragraphs = post.body.trim().split(/\n\s*\n/).filter(Boolean);
  const references = sourceReferences(post.body);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title,
    description: post.excerpt, datePublished: date?.toISOString(), dateModified: post.updatedAt.toISOString(),
    author: { "@type": post.authorName.startsWith("Redação Apogee") ? "Organization" : "Person", name: post.authorName },
    inLanguage: "pt-BR",
    citation: references.map(source => ({ "@type": "CreativeWork", name: source.title, url: source.url })),
    publisher: { "@type": "Organization", name: "Apogee", url: "https://www.apogee.community" },
    mainEntityOfPage: `https://www.apogee.community/blog/${post.slug}`,
    image: cover ? `https://www.apogee.community${blogMediaUrl(cover.id)}` : undefined,
  };

  return <div className={styles.page} data-member-blog={member || undefined}>
    {!member && <SiteHeader current="blog" />}
    <Content id={member ? undefined : "experiencia"} tabIndex={-1} className={styles.articleMain}>
      <nav className={styles.breadcrumb} aria-label="Localização"><Link href={basePath}>Blog</Link><span aria-hidden>/</span><span>{categoryLabel(post.category)}</span></nav>
      <header className={styles.articleHeader}><p className={styles.eyebrow}>{categoryLabel(post.category)} / Apogee</p><h1>{interfaceText(post.title)}</h1><p className={styles.articleLead}>{interfaceText(post.excerpt)}</p><div className={styles.articleByline}><span>Por {interfaceText(post.authorName)}</span>{date ? <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time> : null}</div></header>
      <div className={styles.shareRow}><ShareButton title={`${interfaceText(post.title)} | Apogee`} path={`/blog/${encodeURIComponent(post.slug)}`} /></div>
      {cover ? <figure className={styles.coverFigure}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.coverImage} src={blogMediaUrl(cover.id)} alt={interfaceText(cover.alt)} width={cover.width} height={cover.height} />
        {coverCaption ? <figcaption>{interfaceText(coverCaption)}</figcaption> : null}
      </figure> : null}
      <article className={styles.articleBody}>{paragraphs.map((paragraph, index) => {
        const marker = /^\[\[media:([a-f0-9-]{36})\]\]$/.exec(paragraph.trim());
        const image = marker ? mediaById.get(marker[1]) : null;
        const imageCaption = articleMediaCaption(image?.caption);
        return image ? <figure className={styles.inlineFigure} key={index}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={blogMediaUrl(image.id)} alt={interfaceText(image.alt)} width={image.width} height={image.height} loading="lazy" />
          {imageCaption ? <figcaption>{interfaceText(imageCaption)}</figcaption> : null}
        </figure> : <p key={index}>{interfaceText(paragraph)}</p>;
      })}{video ? <div className={styles.videoFrame}><iframe src={video.src} title={`Vídeo do artigo no ${video.provider}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div> : null}</article>
      {references.length ? <section className={styles.sources} aria-labelledby="article-sources"><h2 id="article-sources">Fontes</h2><ol>{references.map((source, index) => <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{interfaceText(source.title)}</a></li>)}</ol></section> : null}
      <div className={styles.articleEnd}><span><BrandMark /></span><p>Mais ideias para seguir em frente</p><Link href={basePath}>← Voltar ao blog</Link></div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </Content>
    {!member && <SiteFooter />}
  </div>;
}
