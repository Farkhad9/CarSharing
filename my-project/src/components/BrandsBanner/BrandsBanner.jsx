// Пути к картинкам
import banner1 from "../../assets/img/banner-1.png";
import banner2 from "../../assets/img/banner-2.png";
import banner3 from "../../assets/img/banner-3.png";
import banner4 from "../../assets/img/banner-4.png";
import banner5 from "../../assets/img/banner-5.png";
import banner6 from "../../assets/img/banner-6.png";
import banner7 from "../../assets/img/banner-7.png";
import banner8 from "../../assets/img/banner-8.png";
import banner9 from "../../assets/img/banner-9.png";
import banner10 from "../../assets/img/banner-10.png";

const BRAND_LOGOS = [
    banner1, banner2, banner3, banner4, banner5,
    banner6, banner7, banner8, banner9, banner10
];

const BrandsBanner = () => {
    const duplicatedLogos = [...BRAND_LOGOS, ...BRAND_LOGOS];

    return (
        // Добавляем fade-up только на общую обертку секции, чтобы она плавно проявилась
        <section 
            data-aos="fade-up" 
            className="py-12 overflow-hidden bg-white w-full border-y border-gray-100"
        >
            {/* Саму ленту не трогаем, тут работает чистый бесконечный скролл Tailwind */}
            <div className="w-max flex items-center gap-32 animate-infinite-scroll">
                {duplicatedLogos.map((logo, index) => (
                    <img
                        key={index}
                        src={logo}
                        alt="car brand logo"
                        className="h-[65px] md:h-[85px] w-auto object-contain flex-shrink-0"
                        aria-hidden={index >= BRAND_LOGOS.length}
                    />
                ))}
            </div>
        </section>
    );
};

export default BrandsBanner;
