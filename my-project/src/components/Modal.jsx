import { useState } from "react";

const Modal = ({ car, onClose, user }) => {
  const [form, setForm] = useState({
    name: user?.fullName || "",
    email: user?.primaryEmailAddress?.emailAddress || "",
    phone: "",
    date: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Имитируем успешную отправку формы на фронтенде без GraphQL
    alert(`Успешно забронировано!\nМашина: ${car.carName}\nИмя: ${form.name}\nТелефон: ${form.phone}`);
    onClose();
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300 ease-in-out">
      <div className="bg-white p-6 rounded-2xl shadow-xl flex gap-6 w-full max-w-3xl mx-4">
        
        {/* Left: Car Info (Твой родной дизайн) */}
        <div className="flex-1">
          <img
            src={car.image} // Изменено с car.image?.url на car.image под нашу локальную базу
            alt={car.carName} // Изменено под car.carName
            className="w-full h-52 object-contain"
          />
          <h2 className="text-xl font-bold mt-2">{car.carName}</h2> {/* Изменено под car.carName */}
          <p className="text-gray-600">${car.price}/day</p>
        </div>

        {/* Right: Form (Твой родной дизайн) */}
        <form className="flex-1 space-y-4" onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Your Name"
            value={form.name}
            className="w-full border p-2 rounded"
            required
            onChange={handleChange}
          />
          <input
            type="email"
            name="email"
            placeholder="Your Email"
            value={form.email}
            className="w-full border p-2 rounded"
            required
            onChange={handleChange}
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone Number"
            value={form.phone}
            className="w-full border p-2 rounded"
            required
            onChange={handleChange}
          />
          <input
            type="date"
            name="date"
            placeholder="Booking Date"
            value={form.date}
            className="w-full border p-2 rounded"
            required
            onChange={handleChange}
          />

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded border hover:bg-gray-50 transition"
            >
              Close
            </button>
            <button
              type="submit"
              className="w-full py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
            >
              Book Ride
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Modal;
