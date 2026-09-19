const steps = [
  {
    number: "01",
    title: "Choose a cafe",
    description:
      "Select the cafeteria or food court you want to order from.",
  },
  {
    number: "02",
    title: "Pick your food",
    description:
      "Check the live menu, price and availability before ordering.",
  },
  {
    number: "03",
    title: "Pre-order & collect",
    description:
      "Place your order, get a token and collect your food at break time.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-t border-slate-200 bg-white"
    >
      <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20 lg:px-8">
        {/* Section Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
            Simple process
          </span>

          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            How DIU Smart Cafe works
          </h2>

          <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
            Order your food in a few simple steps and collect it when
            you are ready.
          </p>
        </div>

        {/* Steps */}
        <div className="relative mt-12 grid gap-6 md:grid-cols-3 md:gap-8">
          {/* Desktop Connecting Line */}
          <div
            aria-hidden="true"
            className="absolute left-[16.67%] right-[16.67%] top-6 hidden h-px bg-slate-200 md:block"
          />

          {steps.map((step) => (
            <div
              key={step.number}
              className="group relative rounded-2xl border border-slate-200 bg-slate-50 p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-lg sm:p-7"
            >
              {/* Step Number */}
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white shadow-sm shadow-emerald-600/20 transition duration-300 group-hover:scale-105 group-hover:bg-emerald-700">
                {step.number}
              </div>

              {/* Step Content */}
              <h3 className="mt-6 text-lg font-extrabold tracking-tight text-slate-950">
                {step.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-center">
          <p className="text-sm font-medium leading-6 text-emerald-800">
            Order ahead, get your digital token, and spend less time waiting
            in line.
          </p>
        </div>
      </div>
    </section>
  );
}