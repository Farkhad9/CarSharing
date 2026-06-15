import { FiMapPin, FiClock, FiActivity, FiNavigation } from 'react-icons/fi';
import { useEffect, useRef, useState } from "react";
import EVMap from "../EVMap/EVMap";

const CountUpValue = ({ prefix = "", suffix = "", target }) => {
  const [value, setValue] = useState(0);
  const frameRef = useRef();

  useEffect(() => {
    const duration = 900;
    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setValue(Math.round(target * eased));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return (
    <>
      {prefix}
      {value}
      {suffix}
    </>
  );
};

const Location = () => {
  const stats = [
    {
      icon: FiActivity,
      target: 6,
      label: "Active Cars Now",
      desc: "Available around you"
    },
    {
      icon: FiClock,
      prefix: "~",
      suffix: " min",
      target: 3,
      label: "Average Wait",
      desc: "Short walk to unlock"
    },
    {
      icon: FiMapPin,
      suffix: "%",
      target: 98,
      label: "City Center Cover",
      desc: "All Baku hotspots"
    }
  ];

  return (
    <section id="rent" className="bg-white py-24 border-b border-gray-50">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-6 xl:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(460px,0.85fr)] lg:gap-14 xl:gap-20">
          
          {/* Левая колонка: Карта (Твоя готовая интерактивная карта) */}
          <div className="relative -ml-1 group sm:-ml-3 lg:-ml-6 xl:-ml-10">
            {/* Декоративное премиальное свечение под картой */}
            <div className="absolute -inset-4 bg-gradient-to-r fuchsia-500 to-red-500 rounded-3xl opacity-5 blur-xl group-hover:opacity-10 transition-opacity duration-500" />
            
            <div className="relative rounded-3xl overflow-hidden border border-gray-100 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.05)] bg-gray-50">
              <EVMap />
            </div>
          </div>

          {/* Правая колонка: Контент и Высокий дизайн статистики */}
          <div className="flex max-w-[610px] flex-col justify-center lg:justify-self-start">
            <span className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-red-500 bg-red-50/50 px-3 py-1 rounded-full w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              ElectroStreet - Live Map
            </span>
            
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 leading-[1.1] mb-6">
              Find Your Car <br />
              <span className="bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">Anywhere in Baku.</span>
            </h2>
            
            <p className="text-base leading-relaxed text-gray-500 mb-10 max-w-[570px]">
              Every available ElectroStreet car appears on the map in real time. See the battery level, distance and price before you even walk out the door. Reserve in one tap - the car waits for you, not the other way around.
            </p>

            {/* Блок со статистикой премиум-уровня */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              {stats.map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <div 
                    key={idx} 
                    className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/50 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 group"
                  >
                    {/* Иконка */}
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 transition-colors duration-300 group-hover:bg-red-500 group-hover:text-white">
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    {/* Цифра */}
                    <div className="text-2xl font-black text-gray-900 tracking-tight mb-1 tabular-nums">
                      <CountUpValue
                        prefix={stat.prefix}
                        suffix={stat.suffix}
                        target={stat.target}
                      />
                    </div>
                    
                    {/* Метка */}
                    <div className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                      {stat.label}
                    </div>
                    
                    {/* Описание микро-шрифтом */}
                    <div className="text-[11px] text-gray-400 font-medium leading-tight">
                      {stat.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Главная кнопка действия (CTA) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button className="group inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-red-600 rounded-full hover:bg-red-500 hover:shadow-[0_10px_25px_-5px_rgba(220,38,38,0.4)]">
                <FiNavigation className="mr-2 w-5 h-5 transition-transform duration-300 group-hover:rotate-45" />
                <span>Find Nearby Car</span>
              </button>
              <span className="text-xs font-semibold text-gray-400 sm:pl-2">
                Currently active in Baku - 6 cars online
              </span>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};

export default Location;
