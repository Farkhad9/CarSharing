import { motion } from "framer-motion";
import { FiMessageCircle, FiStar } from "react-icons/fi";
import review1 from "../../assets/img/review1.jpg";
import review2 from "../../assets/img/review2.jpg";
import review3 from "../../assets/img/review3.jpg";

const userComments = [
  {
    name: "Aysel Karimova",
    role: "Daily commuter",
    avatar: review1,
    rating: 5,
    comment:
      "I use ElectroStreet for quick rides between meetings. The cars are clean, easy to find, and the battery information is always clear before I reserve.",
  },
  {
    name: "Murad Aliyev",
    role: "Weekend rider",
    avatar: review2,
    rating: 5,
    comment:
      "The reservation flow feels simple. I can see the nearest EV, walk to it, and start the trip without waiting for support or paperwork.",
  },
  {
    name: "Leyla Hasanli",
    role: "City explorer",
    avatar: review3,
    rating: 4,
    comment:
      "It makes moving around Baku more flexible. I like that pricing is transparent and the app shows where I can finish the ride.",
  },
];

const UserComments = () => (
  <section className="border-y border-zinc-200 bg-white py-20 text-zinc-950">
    <div className="container">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-red-500">User comments</p>
          <h2 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
            Real riders talk about the everyday difference.
          </h2>
        </div>
        <div className="inline-flex w-fit items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-black text-zinc-600">
          <FiMessageCircle className="text-red-500" />
          Trusted by city drivers
        </div>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {userComments.map((review, index) => (
          <motion.article
            key={review.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: index * 0.08, duration: 0.45 }}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-zinc-950/10"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <img
                  src={review.avatar}
                  alt={review.name}
                  className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-md"
                />
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black">{review.name}</h3>
                  <p className="text-sm font-bold text-zinc-500">{review.role}</p>
                </div>
              </div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-black text-red-600">
                {review.rating}.0
              </span>
            </div>

            <div className="mt-6 flex gap-1 text-red-500">
              {Array.from({ length: 5 }).map((_, starIndex) => (
                <FiStar
                  key={starIndex}
                  className={starIndex < review.rating ? "fill-current" : "text-zinc-300"}
                />
              ))}
            </div>
            <p className="mt-6 text-sm font-semibold leading-7 text-zinc-600">"{review.comment}"</p>
          </motion.article>
        ))}
      </div>
    </div>
  </section>
);

export default UserComments;
