import { FAQ_ITEMS } from "@/lib/mock-data";
import { Accordion } from "@/components/ui/Accordion";

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
      <div className="text-center">
        <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">FAQs</span>
        <h2 className="mt-3.5 text-[28px] font-semibold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]">
          Frequently asked questions
        </h2>
      </div>

      <div className="mt-8 sm:mt-12">
        <Accordion
          items={FAQ_ITEMS.map((item) => ({ id: item.id, trigger: item.question, content: item.answer }))}
        />
      </div>
    </section>
  );
}
