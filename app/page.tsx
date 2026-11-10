import Navbar from "@/components/view/navbar/Navbar";
import Searchbar from "@/components/view/search/Searchbar";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#FAF6EE] font-sans">
      <Navbar />
      <Searchbar />
      <main className="wrap flex flex-1 items-center justify-center">
        <p className="font-bold text-mauve-950">This is the landing page</p>
      </main>
    </div>
  );
}
