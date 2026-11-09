import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/view/navbar/Navbar";
import { formatCatAge, getCat } from "@/lib/cats";

export default function CatPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="theme-light flex flex-1 flex-col bg-background text-foreground">
      <Navbar />
      <main className="wrap py-8">
        <Link href="/find_a_cat" className="text-sm font-bold underline">← Find a cat</Link>
        <Suspense fallback={<p role="status" className="py-8">Loading cat…</p>}>
          <CatDetails params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function CatDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = await getCat(Number(id));
  if (!cat) notFound();

  return (
    <article className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold">{cat.name}</h1>
        <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold capitalize">{cat.status}</span>
      </div>
      <p className="mt-2 text-muted-foreground">Parent: {cat.owner.name}</p>
      {cat.images.length > 0 ? <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cat.images.map((image, index) => <figure key={image.id} className={index === 0 ? "sm:col-span-2" : ""}>
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
            <Image src={image.url} alt={image.caption || cat.name} fill unoptimized sizes={index === 0 ? "(min-width: 1200px) 1100px, 100vw" : "(min-width: 640px) 50vw, 100vw"} className="object-contain" />
          </div>
          {image.caption ? <figcaption className="mt-2 text-sm text-muted-foreground">{image.caption}</figcaption> : null}
        </figure>)}
      </div> : <p className="mt-6 text-muted-foreground">No photos yet.</p>}
      <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Breed", cat.breed], ["Age", formatCatAge(cat.ageMonths)], ["Gender", cat.gender],
          ["Location", `${cat.locality}, ${cat.city}`], ["Vaccinated", cat.vaccinated], ["Spayed / neutered", cat.neutered],
        ].map(([label, value]) => <div key={label}><dt className="text-sm font-bold">{label}</dt><dd className="mt-1 capitalize text-muted-foreground">{value}</dd></div>)}
      </dl>
      {[["Temperament", cat.temperament], ["About this cat", cat.description], ["Reason for rehoming", cat.rehomingReason]].map(([label, value]) => value ? <section key={label} className="mt-6"><h2 className="font-bold">{label}</h2><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{value}</p></section> : null)}
    </article>
  );
}
