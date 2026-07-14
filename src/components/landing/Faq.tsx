import { FAQ_ITEMS } from "@/lib/mock-data";
import { Accordion } from "@/components/ui/Accordion";

export function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-heading sm:text-3xl">Frequently asked questions</h2>
      </div>

      <div className="mt-10">
        <Accordion
          items={FAQ_ITEMS.map((item) => ({ id: item.id, trigger: item.question, content: item.answer }))}
        />
      </div>
    </section>
  );
}
