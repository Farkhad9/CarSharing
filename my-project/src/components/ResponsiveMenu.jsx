import { AnimatePresence, motion } from "framer-motion";
import { FaBolt } from "react-icons/fa6";
import { FiCreditCard, FiLogOut, FiUser } from "react-icons/fi";

const ResponsiveMenu = ({ open, menuItems = [], user, onLoginClick, onLogout }) => {
  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.25 }}
          className="fixed left-0 top-[73px] z-40 w-full px-4 md:hidden"
        >
          <div className="rounded-xl border border-gray-100 bg-white p-4 text-gray-800 shadow-2xl shadow-gray-200/70">
            <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500">
                  <FaBolt />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">
                    {user ? `Привет, ${user.name || "Farhad"}!` : "ElectroStreet Rider"}
                  </p>
                  <p className="text-xs font-semibold text-gray-400">
                    {user ? `${(user.balance || 0).toFixed(2)} AZN` : "Baku electric fleet"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500"></span>
                <span className="text-xs font-bold text-gray-500">6 EVs online</span>
              </div>
            </div>

            <ul className="flex flex-col gap-1">
              {menuItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.link}
                    className="flex items-center justify-between border-b-2 border-transparent px-3 py-3 text-base font-extrabold text-gray-700 transition hover:border-red-500 hover:text-red-500"
                  >
                    {item.title}
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                  </a>
                </li>
              ))}
            </ul>

            {user ? (
              <div className="mt-4 grid gap-2">
                <a
                  href="/dashboard"
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-red-500 px-6 py-3 font-extrabold text-white duration-200 hover:bg-red-600"
                >
                  <FiUser />
                  <span>Личный кабинет</span>
                </a>
                <a
                  href="/dashboard"
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 px-6 py-3 font-extrabold text-gray-700 duration-200 hover:border-red-200 hover:text-red-500"
                >
                  <FiCreditCard />
                  <span>Способы оплаты</span>
                </a>
                <button
                  onClick={onLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 px-6 py-3 font-extrabold text-gray-700 duration-200 hover:border-red-200 hover:text-red-500"
                >
                  <FiLogOut />
                  <span>Выйти</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-red-500 px-6 py-3 font-extrabold text-white duration-200 hover:bg-red-600"
              >
                <FiUser />
                <span>Login</span>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ResponsiveMenu;
