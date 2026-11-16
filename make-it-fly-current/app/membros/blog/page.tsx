import { BlogIndex } from "@/components/blog/blog-index";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { requireSignedInMember } from "@/lib/members/dal";
export const dynamic = "force-dynamic";
export const metadata = { title: "Blog", robots: { index: false, follow: false } };
export default async function MemberBlogPage({ searchParams }: { searchParams: Promise<{ tema?: string; pagina?: string }> }) {
  const member = await requireSignedInMember("/membros/blog");
  return <MemberWorkspace member={member} current="blog"><BlogIndex searchParams={searchParams} member /></MemberWorkspace>;
}
