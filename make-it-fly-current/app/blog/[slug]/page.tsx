import { BlogArticle, generateArticleMetadata } from "@/components/blog/blog-article";
export const dynamic = "force-dynamic";
export const generateMetadata = generateArticleMetadata;
export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  return BlogArticle({ params });
}
