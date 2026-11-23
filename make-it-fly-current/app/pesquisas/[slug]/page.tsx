import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SurveyForm } from "@/components/surveys/survey-form";
import styles from "@/components/surveys/surveys.module.css";
import { surveySlug } from "@/lib/surveys/contract";
import { getPublicSurvey } from "@/lib/surveys/store";
import { codexWorkshopSurvey } from "@/lib/surveys/templates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pesquisa | Apogee", robots: { index: false, follow: false } };

export default async function SurveyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!surveySlug.safeParse(slug).success) notFound();
  const survey = await getPublicSurvey(slug);
  if (!survey) notFound();
  return <>
    <SiteHeader adaptive tone="light" prefetch={false} />
    <main id="experiencia" tabIndex={-1} aria-labelledby="survey-title">
      <section data-ap-section="" aria-labelledby="survey-title">
        <header className={styles.pageHeader}>
          <div className={styles.eventIdentity}>
            {survey.slug === codexWorkshopSurvey.slug && <Image
              src="/brand/events/codex-community.webp"
              alt="Codex Community"
              width={144}
              height={144}
              unoptimized
            />}
          </div>
          <h1 id="survey-title" data-ap-title="">{survey.title}</h1>
          {survey.intro && <p>{survey.intro}</p>}
        </header>
      </section>
      <section data-ap-section="tonal" className={styles.surveySection} aria-label="Formulário da pesquisa">
        <div className={styles.formWrap}>
          <SurveyForm survey={survey} />
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
