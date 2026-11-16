import { BenefitsWorkspace } from "@/components/benefits/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Meus resgates", robots: { index: false, follow: false } };
export default function BenefitHistoryPage() { return <BenefitsWorkspace view="history" />; }
