export function HeroSection() {
  return (
    <section className="relative flex flex-col items-center overflow-hidden px-4 py-24 text-center">
      <div
        aria-hidden
        className="absolute left-1/2 top-0 -z-10 h-64 w-3/4 -translate-x-1/2 rounded-full bg-blue-500 opacity-30 blur-3xl"
      />

      <h1 className="relative z-10 text-5xl font-bold text-gray-900 text-center">
        Pick and Build the Perfect Niche.
      </h1>

      <p className="relative z-10 mt-4 max-w-2xl text-gray-500 text-center">
        Discover profitable, low-competition niches tailored to your audience and turn them into a full-fledged
        content strategy in minutes.
      </p>

      <button className="relative z-10 mt-8 rounded-full bg-blue-600 px-8 py-3 font-semibold text-white transition hover:bg-blue-700">
        Start Bending for Free
      </button>
    </section>
  );
}
