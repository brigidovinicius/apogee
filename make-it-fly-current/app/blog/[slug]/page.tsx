import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getPublicPost } from "@/lib/blog/data";
import { categoryLabel, postDate } from "@/lib/blog/shared";
import styles from "../blog.module.css";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) return { title: "Artigo não encontrado | Apogee", robots: { index: false } };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt;
  return {
    title: `${title} | Apogee`, description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title, description, url: `/blog/${post.slug}`, type: "article", publishedTime: postDate(post)?.toISOString(), modifiedTime: post.updatedAt.toISOString(), authors: [post.authorName] },
    twitter: { card: "summary", title, description },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) notFound();
  const date = postDate(post);
  const paragraphs = post.body.trim().split(/\n\s*\n/).filter(Boolean);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title,
    description: post.excerpt, datePublished: date?.toISOString(), dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: post.authorName },
    publisher: { "@type": "Organization", name: "Apogee", url: "https://www.apogee.community" },
    mainEntityOfPage: `https://www.apogee.community/blog/${post.slug}`,
  };

  return <div className={styles.page}>
    <SiteHeader current="blog" />
    <main id="experiencia" tabIndex={-1} className={styles.articleMain}>
      <nav className={styles.breadcrumb} aria-label="Localização"><Link href="/blog">Blog</Link><span aria-hidden>/</span><span>{categoryLabel(post.category)}</span></nav>
      <header className={styles.articleHeader}><p className={styles.eyebrow}>{categoryLabel(post.category)} / Apogee</p><h1>{post.title}</h1><p className={styles.articleLead}>{post.excerpt}</p><div className={styles.articleByline}><span>Por {post.authorName}</span>{date ? <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time> : null}</div></header>
      <div className={styles.articleArt} data-category={post.category} aria-hidden><span>APOGEE / IDEIAS</span><span>✳</span></div>
      <article className={styles.articleBody}>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article>
      <div className={styles.articleEnd}><span>✳</span><p>Mais ideias para seguir em frente.</p><Link href="/blog">← Voltar ao blog</Link></div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </main>
    <SiteFooter />
  </div>;
}
