import BilaiPage from "@/components/view/BilaiPage";
import ListACat from "./ListACat";

export default function ListACatPage() {
  return (
    <BilaiPage currentPage="list" mainClassName="bilai-frame bilai-inner bilai-list-layout">
      <header className="bilai-page-heading">
        <h1 id="list-title">List a cat</h1>
        <p>Share a recent photo and tell adopters what they should know about your cat.</p>
      </header>
      <ListACat />
    </BilaiPage>
  );
}
