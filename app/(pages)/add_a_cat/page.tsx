import type { Metadata } from "next";
import BilaiPage from "@/components/view/BilaiPage";
import { headingText, headingTitle } from "@/components/view/styles";
import ListACat from "./ListACat";

export const metadata: Metadata = { title: "List a cat" };

export default function ListACatPage() {
  return (
    <BilaiPage
      currentPage="list"
      mainClassName="frame grid grid-cols-[minmax(14rem,1fr)_minmax(0,2.35fr)] items-start gap-x-[clamp(2rem,5vw,5rem)] gap-y-6 py-section max-nav:grid-cols-1"
    >
      <header>
        <h1 id="list-title" className={headingTitle}>
          List a cat
        </h1>
        <p className={headingText}>
          Share a recent photo and tell adopters what they should know about
          your cat.
        </p>
      </header>
      <ListACat />
    </BilaiPage>
  );
}
