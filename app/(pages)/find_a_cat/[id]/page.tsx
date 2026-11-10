import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import BilaiPage from "@/components/view/BilaiPage";
import ContactButtons from "@/components/view/cat/ContactButtons";
import { getSession } from "@/lib/auth";
import { formatCatAge, getCat } from "@/lib/cats";

export default function CatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <BilaiPage currentPage="profile" mainClassName="bilai-frame bilai-inner">
      <Link href="/find_a_cat" className="bilai-outline">
        <ArrowLeft size={17} aria-hidden="true" />
        Find a cat
      </Link>
      <Suspense
        fallback={
          <p role="status" className="py-8">
            Loading cat…
          </p>
        }
      >
        <CatDetails params={params} />
      </Suspense>
    </BilaiPage>
  );
}

async function CatDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cat, session] = await Promise.all([getCat(Number(id)), getSession()]);
  if (!cat) notFound();

  return (
    <article className="mt-6">
      <div className="bilai-page-heading flex flex-wrap items-center gap-3">
        <h1>{cat.name}</h1>
        <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold capitalize">
          {cat.status}
        </span>
      </div>
      <p className="mt-2 text-muted-foreground">Parent: {cat.owner.name}</p>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {cat.images.length > 0 ? (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {cat.images.map((image, index) => (
              <figure
                key={image.id}
                className={index === 0 ? "sm:col-span-2" : ""}
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={image.url}
                    alt={image.caption || cat.name}
                    fill
                    unoptimized
                    sizes={
                      index === 0
                        ? "(min-width: 1024px) 55vw, 100vw"
                        : "(min-width: 1024px) 27vw, (min-width: 640px) 50vw, 100vw"
                    }
                    className="object-contain"
                  />
                </div>
                {image.caption ? (
                  <figcaption className="mt-2 text-sm text-muted-foreground">
                    {image.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No photos yet.</p>
        )}
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              ["Breed", cat.breed],
              ["Age", formatCatAge(cat.ageMonths)],
              ["Gender", cat.gender],
              ["Location", [cat.area, cat.district].filter(Boolean).join(", ")],
              ["Vaccinated", cat.vaccinated],
              ["Spayed / neutered", cat.neutered],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm font-bold text-[var(--bilai-action)]">
                  {label}
                </dt>
                <dd className="mt-1 capitalize [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
          {cat.status !== "adopted" ? (
            <div className="mt-5">
              <ContactButtons
                catId={cat.id}
                whatsapp={cat.contactWhatsapp}
                call={cat.contactCall}
                isLoggedIn={Boolean(session?.user)}
                isOwner={session?.user.id === cat.owner.id}
              />
            </div>
          ) : null}
        </div>
      </div>
      {[
        ["Temperament", cat.temperament],
        ["About this cat", cat.description],
        ["Reason for rehoming", cat.rehomingReason],
      ].map(([label, value]) =>
        value ? (
          <section key={label} className="mt-6 max-w-3xl">
            <h2 className="font-bold">{label}</h2>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
              {value}
            </p>
          </section>
        ) : null,
      )}
    </article>
  );
}
