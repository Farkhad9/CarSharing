import { useState } from "react";
import { useConfirmDialog } from "./ui/useConfirmDialog";

const Modal = ({ car, onClose, user }) => {
  const [form, setForm] = useState({
    name: user?.fullName || "",
    email: user?.primaryEmailAddress?.emailAddress || "",
    phone: "",
    date: "",
  });
  const { confirm, dialog } = useConfirmDialog();

  const handleSubmit = async (event) => {
    event.preventDefault();

    await confirm({
      title: "Booking confirmed",
      message: `Car: ${car.carName}\nName: ${form.name}\nPhone: ${form.phone}`,
      confirmLabel: "Done",
      hideCancel: true,
      tone: "success",
    });
    onClose();
  };

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm transition-opacity duration-300 ease-in-out">
      <div className="flex w-full max-w-3xl gap-6 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex-1">
          <img
            src={car.image}
            alt={car.carName}
            className="h-52 w-full object-contain"
          />
          <h2 className="mt-2 text-xl font-bold">{car.carName}</h2>
          <p className="text-gray-600">${car.price}/day</p>
        </div>

        <form className="flex-1 space-y-4" onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Your Name"
            value={form.name}
            className="w-full rounded border p-2"
            required
            onChange={handleChange}
          />
          <input
            type="email"
            name="email"
            placeholder="Your Email"
            value={form.email}
            className="w-full rounded border p-2"
            required
            onChange={handleChange}
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone Number"
            value={form.phone}
            className="w-full rounded border p-2"
            required
            onChange={handleChange}
          />
          <input
            type="date"
            name="date"
            placeholder="Booking Date"
            value={form.date}
            className="w-full rounded border p-2"
            required
            onChange={handleChange}
          />

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded border py-2 transition hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="submit"
              className="w-full rounded bg-red-500 py-2 text-white transition hover:bg-red-600"
            >
              Book Ride
            </button>
          </div>
        </form>
      </div>
      {dialog}
    </div>
  );
};

export default Modal;
