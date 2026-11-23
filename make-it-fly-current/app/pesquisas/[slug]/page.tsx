import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SurveyForm } from "@/components/surveys/survey-form";
import styles from "@/components/surveys/surveys.module.css";
import { surveySlug } from "@/lib/surveys/contract";
import { getPublicSurvey } from "@/lib/surveys/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pesquisa | Apogee", robots: { index: false, follow: false } };

export default async function SurveyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!surveySlug.safeParse(slug).success) notFound();
  const survey = await getPublicSurvey(slug);
  if (!survey) notFound();
  return <main id="experiencia" className={styles.publicPage}>
    <header className={styles.pageHeader}>
      <Link href="/" prefetch={false} className={styles.homeLink}>Apogee</Link>
      <h1>{survey.title}</h1>
      {survey.intro && <p>{survey.intro}</p>}
    </header>
    <SurveyForm survey={survey} />
  </main>;
}
