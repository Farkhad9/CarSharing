import { FiZap, FiBatteryCharging, FiMapPin, FiShield } from 'react-icons/fi';

const WhyElectroStreet = () => {
  const benefits = [
    {
      number: "01",
      Icon: FiZap,
      title: "From 0.34 AZN per minute",
      text: "Forget daily rental rates and hidden surcharges. ElectroStreet runs on a simple per-minute model — the clock starts when you unlock the car and stops the moment you park. A 20-minute ride across Baku costs less than a coffee. No subscription, no deposit, no surprises.",
      note: "Rates vary slightly by vehicle model and demand zone, but you always see the final price before you confirm.",
      badge: "No hidden fees",
    },
    {
      number: "02",
      Icon: FiBatteryCharging,
      title: "Every car above 60% before your ride",
      text: "Our operations team monitors battery levels across the entire fleet in real time. Any vehicle that drops below 60% is automatically flagged and sent to the nearest charging station before it becomes available again. You will never unlock a car and worry about running out of charge mid-ride.",
      note: "Battery level, estimated range and nearest charging station are always visible on the vehicle card before you reserve.",
      badge: "Always ready",
    },
    {
      number: "03",
      Icon: FiMapPin,
      title: "Average 3 min walk to nearest EV",
      text: "ElectroStreet vehicles are distributed across Baku's highest-traffic zones: Baku Boulevard, Nizami Street, Flame Towers, Ganjlik Mall, Port Baku and Heydar Aliyev Center. Our placement algorithm ensures you're never more than a short walk from an available car — whether you're heading to work or leaving a restaurant at midnight.",
      note: "New parking zones are added regularly as the fleet grows across the city.",
      badge: "City-wide coverage",
    },
    {
      number: "04",
      Icon: FiShield,
      title: "Full insurance, zero deposit",
      text: "Every ElectroStreet ride is covered by comprehensive insurance from the moment you unlock the vehicle to the moment you end the trip. There is no security deposit, no credit card hold and no paperwork to sign. If something happens during your ride, our support team is available 24/7 and the insurance handles the rest.",
      note: "All vehicles pass a technical inspection every 30 days. Safety is not optional.",
      badge: "Zero risk",
    },
  ];

  return (
    <section className="bg-[#fafafa] py-24">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        
        {/* Хедер секции */}
        <div className="max-w-3xl mb-16">
          <span className="mb-4 block text-sm font-bold uppercase tracking-widest text-red-500">
            Why ElectroStreet
          </span>
          <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
            Why Baku Rides Electric
          </h2>
          <div className="mb-3 text-lg font-semibold text-gray-800">
            4,200+ rides completed in Baku
          </div>
          <p className="text-base text-gray-500">
            Everything you need to know before your first ride.
          </p>
          <div className="mt-8 h-1 w-24 rounded-full bg-red-500" />
        </div>

        {/* Сетка карточек */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          {benefits.map(({ number, Icon, title, text, note, badge }) => (
            <article
              key={title}
              className="group relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-8 lg:p-10 shadow-[0_2px_20px_-4px_rgba(0,0,0,0.03)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_40px_-4px_rgba(0,0,0,0.1)] border-l-4 border-l-transparent hover:border-l-red-500 flex flex-col"
            >
              
              {/* Фоновая цифра (настроена так, чтобы сидеть аккуратно внутри) */}
              <span className="pointer-events-none absolute bottom-6 right-8 z-0 select-none text-7xl font-black leading-none text-gray-100 transition-colors duration-500 group-hover:text-red-100">
                {number}
              </span>

              {/* Контент карточки */}
              <div className="relative z-10 flex flex-col h-full">
                
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl text-red-500 shadow-inner transition-transform duration-500 group-hover:scale-110">
                  <Icon />
                </div>

                <h3 className="mb-4 text-2xl font-bold text-gray-900">
                  {title}
                </h3>
                
                <p className="mb-4 text-base leading-relaxed text-gray-600 flex-grow">
                  {text}
                </p>
                
                <p className="text-sm leading-relaxed text-gray-400">
                  {note}
                </p>
                
                <div className="mt-8">
                  <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-4 py-1.5 text-sm font-bold text-red-600">
                    {badge}
                  </span>
                </div>
                
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
};

export default WhyElectroStreet;
