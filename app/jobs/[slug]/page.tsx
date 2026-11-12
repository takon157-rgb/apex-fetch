import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

// Generate static params at build time for sitemap
export async function generateStaticParams() {
  const jobs = await prisma.lead.findMany({
    where: { deleted: false },
    select: { url: true },
    take: 50, // Only generate for top 50 most recent
    orderBy: { createdAt: 'desc' },
  });

  return jobs.map((job) => ({
    slug: encodeURIComponent(job.url),
  }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const job = await getJobBySlug(params.slug);

  if (!job) return { title: 'Job Not Found' };

  return {
    title: `${job.title} at ${job.company || 'Company'}`,
    description: job.description?.substring(0, 160),
  };
}

async function getJobBySlug(slug: string) {
  // Decode the URL-encoded job URL
  const decodedUrl = decodeURIComponent(slug);
  return prisma.lead.findFirst({
    where: { url: decodedUrl, deleted: false },
  });
}

export default async function JobPage({ params }: { params: { slug: string } }) {
  const job = await getJobBySlug(params.slug);

  if (!job) {
    notFound();
  }

  // JobPosting JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted: job.postedAt?.toISOString() || job.createdAt.toISOString(),
    employmentType: job.jobType || 'FULL_TIME',
    jobLocation: job.location
      ? {
          '@type': 'Place',
          address: { '@type': 'PostalAddress', addressLocality: job.location },
        }
      : undefined,
    baseSalary: job.salaryMin || job.salaryMax
      ? {
          '@type': 'MonetaryAmountSpecification',
          value: {
            '@type': 'QuantitativeValue',
            value: job.salaryMin || job.salaryMax,
            unitText: job.salaryCurrency || 'USD',
          },
        }
      : undefined,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      sameAs: job.url,
    },
    jobLocationType: job.remote ? 'REMOTE' : undefined,
    applicantLocationRequirements: job.remote
      ? { '@type': 'AdministrativeArea', name: 'Remote' }
      : undefined,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Back link */}
        <Link
          href="/jobs"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          ← Back to jobs
        </Link>

        <article className="space-y-6">
          {/* JobPosting JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLd),
            }}
          />

          <header>
            <h1 className="text-3xl font-bold text-white">{job.title}</h1>
            {job.company && (
              <p className="mt-1 text-xl text-slate-300">{job.company}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-indigo-500/10 px-3 py-0.5 text-indigo-300">
                {job.source}
              </span>
              {job.budget && (
                <span className="rounded-full bg-slate-700/50 px-3 py-0.5 text-slate-300">
                  {job.budget}
                </span>
              )}
              {job.remote !== null && (
                <span className="rounded-full bg-slate-700/50 px-3 py-0.5 text-slate-300">
                  {job.remote ? 'Remote' : 'On-site'}
                </span>
              )}
              {job.jobType && (
                <span className="rounded-full bg-slate-700/50 px-3 py-0.5 text-slate-300">
                  {job.jobType}
                </span>
              )}
            </div>
          </header>

          <div className="prose prose-slate max-w-none">
            <p>{job.description}</p>
          </div>

          <footer className="flex gap-4">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition"
            >
              View Original Posting
            </a>
            <a
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              Apply with ApexFetch
            </a>
          </footer>
        </article>
      </div>
    </div>
  );
}