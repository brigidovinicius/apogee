import { BlogArticle, generateArticleMetadata } from "@/components/blog/blog-article";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { requireSignedInMember } from "@/lib/members/dal";
export const dynamic = "force-dynamic";
export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  return { ...await generateArticleMetadata(props), robots: { index: false, follow: false } };
}
export default async function MemberBlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const member = await requireSignedInMember(`/membros/blog/${encodeURIComponent(slug)}`);
  return <MemberWorkspace member={member} current="blog"><BlogArticle params={params} member /></MemberWorkspace>;
}
