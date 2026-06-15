import { useState } from "react";
// Исправленные пути для новой, чистой структуры папок:
import CarCard from "../../layouts/CarCard";
import Modal from "../Modal";

// Локальная база машин прямо на фронтенде
const MOCK_CARS = [
    {
        id: "1",
        carName: "BMW M4 Competition",
        carBrand: "BMW",
        price: 150,
        image: "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=600&auto=format&fit=crop",
        transmission: "Automatic",
        fuel: "Petrol"
    },
    {
        id: "2",
        carName: "Mercedes-Benz C63 AMG",
        carBrand: "Mercedes",
        price: 160,
        image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=600&auto=format&fit=crop",
        transmission: "Automatic",
        fuel: "Petrol"
    },
    {
        id: "3",
        carName: "Porsche 911 Turbo S",
        carBrand: "Porsche",
        price: 300,
        image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=600&auto=format&fit=crop",
        transmission: "Automatic",
        fuel: "Petrol"
    },
    {
        id: "4",
        carName: "Tesla Model S Plaid",
        carBrand: "Tesla",
        price: 140,
        image: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?q=80&w=600&auto=format&fit=crop",
        transmission: "Automatic",
        fuel: "Electric"
    }
];

const CarList = () => {
    const [cars] = useState(MOCK_CARS);
    const [filter, setFilter] = useState("All");
    const [selectedCar, setSelectedCar] = useState(null);

    // Фейковые переменные авторизации, чтобы карточки не требовали Clerk
    const isSignedIn = true;
    const user = { fullName: "Test User" };

    // Логика фильтрации по кнопкам-брендам
    const filteredCars =
        filter === "All" ? cars : cars.filter((car) => car.carBrand === filter);

    const uniqueBrands = ["All", ...new Set(cars.map((car) => car.carBrand))];

    return (
        <section className="py-10 px-4 bg-gray-50">
            <h2
                className="text-center text-3xl font-bold mb-6"
                data-aos="fade-up"
                data-aos-delay="100"
            >
                Explore Our Top Deals
            </h2>

            {/* Кнопки фильтрации */}
            <div
                className="flex gap-3 justify-center mb-8 flex-wrap"
                data-aos="fade-up"
                data-aos-delay="100"
            >
                {uniqueBrands.map((brand, i) => (
                    <button
                        key={i}
                        className={`px-4 py-2 rounded-full border text-sm transition ${filter === brand
                                ? "bg-red-500 text-white border-red-500"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                            }`}
                        onClick={() => setFilter(brand)}
                    >
                        {brand}
                    </button>
                ))}
            </div>

            {/* Сетка с карточками машин */}
            <div
                className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto place-items-center"
                data-aos="fade-up"
                data-aos-delay="100"
            >
                {filteredCars.map((car) => (
                    <CarCard key={car.id} car={car} onRentClick={setSelectedCar} />
                ))}
            </div>

            {/* Модальное окно заказа при клике на машину */}
            {selectedCar && (
                <Modal
                    car={selectedCar}
                    onClose={() => setSelectedCar(null)}
                    isLoggedIn={isSignedIn}
                    user={user}
                />
            )}
        </section>
    );
};

export default CarList;