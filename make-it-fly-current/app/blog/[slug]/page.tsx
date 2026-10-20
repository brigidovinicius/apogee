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
import { categoryLabel, postDate } from "@/lib/blog/shared";
import { parseVideoUrl } from "@/lib/blog/video";
import styles from "../blog.module.css";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
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

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) notFound();
  const date = postDate(post);
  const media = await listPostMedia(post.id);
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const cover = post.coverMediaId ? mediaById.get(post.coverMediaId) : null;
  const video = post.videoUrl ? parseVideoUrl(post.videoUrl) : null;
  const paragraphs = post.body.trim().split(/\n\s*\n/).filter(Boolean);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title,
    description: post.excerpt, datePublished: date?.toISOString(), dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: post.authorName },
    publisher: { "@type": "Organization", name: "Apogee", url: "https://www.apogee.community" },
    mainEntityOfPage: `https://www.apogee.community/blog/${post.slug}`,
    image: cover ? `https://www.apogee.community${blogMediaUrl(cover.id)}` : undefined,
  };

  return <div className={styles.page}>
    <SiteHeader current="blog" />
    <main id="experiencia" tabIndex={-1} className={styles.articleMain}>
      <nav className={styles.breadcrumb} aria-label="Localização"><Link href="/blog">Blog</Link><span aria-hidden>/</span><span>{categoryLabel(post.category)}</span></nav>
      <header className={styles.articleHeader}><p className={styles.eyebrow}>{categoryLabel(post.category)} / Apogee</p><h1>{interfaceText(post.title)}</h1><p className={styles.articleLead}>{interfaceText(post.excerpt)}</p><div className={styles.articleByline}><span>Por {interfaceText(post.authorName)}</span>{date ? <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time> : null}</div></header>
      <ShareButton title={`${interfaceText(post.title)} | Apogee`} path={`/blog/${encodeURIComponent(post.slug)}`} />
      <div className={styles.articleArt} data-category={post.category}>{cover ? <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.coverImage} src={blogMediaUrl(cover.id)} alt={interfaceText(cover.alt)} width={cover.width} height={cover.height} />
      </> : <><span>APOGEE / IDEIAS</span><span aria-hidden><BrandMark /></span></>}</div>
      <article className={styles.articleBody}>{paragraphs.map((paragraph, index) => {
        const marker = /^\[\[media:([a-f0-9-]{36})\]\]$/.exec(paragraph.trim());
        const image = marker ? mediaById.get(marker[1]) : null;
        return image ? <figure className={styles.inlineFigure} key={index}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={blogMediaUrl(image.id)} alt={interfaceText(image.alt)} width={image.width} height={image.height} loading="lazy" />
          {image.caption ? <figcaption>{interfaceText(image.caption)}</figcaption> : null}
        </figure> : <p key={index}>{interfaceText(paragraph)}</p>;
      })}{video ? <div className={styles.videoFrame}><iframe src={video.src} title={`Vídeo do artigo no ${video.provider}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div> : null}</article>
      <div className={styles.articleEnd}><span><BrandMark /></span><p>Mais ideias para seguir em frente.</p><Link href="/blog">← Voltar ao blog</Link></div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </main>
    <SiteFooter />
  </div>;
}
