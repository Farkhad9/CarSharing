import { IoIosSpeedometer } from "react-icons/io";
import { BsFillFuelPumpFill } from "react-icons/bs";
import { BsFillGrid1X2Fill } from "react-icons/bs";

const CarCard = ({ car, onRentClick }) => {
  return (
    <div className="bg-white rounded-2xl shadow p-4 max-w-sm w-full space-y-2">
      <img
        src={car.image?.url} // This is conditional rendering if img not in backend still it works
        alt={car.name}
        className="h-48 object-contain w-full bg-gray-200 rounded-md"
      />
      <h3 className="text-lg font-bold mt-3">{car.name}</h3>
      <p className="text-red-500 font-semibold">${car.price}/day</p>
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>
          <IoIosSpeedometer className=" inline pr-1.5" size={24} />
          {car.carAvg}k
        </span>
        <span>
          <BsFillGrid1X2Fill className=" inline pr-1.5" size={19} />
          {car.carType}
        </span>
        <span>
          <BsFillFuelPumpFill className=" inline pr-1.5" size={20} />
          {car.fuelType}
        </span>
      </div>
      <button
        className="mt-2 w-full bg-red-500 text-white rounded-md py-1.5"
        onClick={() => onRentClick(car)}
      >
        Rent Now
      </button>
    </div>
  );
};

export default CarCard;
