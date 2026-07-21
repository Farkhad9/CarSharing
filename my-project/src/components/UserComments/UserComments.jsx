import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FiCheckCircle, FiMessageCircle, FiStar } from "react-icons/fi";
import { tripReviewsApi } from "../../api/tripReviewsApi";

const getInitials = (name) =>
  String(name || "Rider")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "R";

const UserComments = () => {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    tripReviewsApi.getPublic(3)
      .then((items) => {
        if (isMounted) {
          setReviews(Array.isArray(items) ? items : []);
          setError("");
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setReviews([]);
          setError(loadError.message || "Reviews could not be loaded.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
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

        {(isLoading || error || reviews.length === 0) && (
          <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-red-500">
              {isLoading ? "Loading reviews" : error ? "Reviews unavailable" : "No reviews yet"}
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-zinc-500">
              {isLoading
                ? "Reading latest rider comments from backend..."
                : error || "Rider comments will appear here after completed trips are reviewed."}
            </p>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {reviews.map((review, index) => (
              <motion.article
                key={review.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                className="group relative min-h-[310px] overflow-hidden rounded-[28px] border border-zinc-200 bg-white p-7 shadow-[0_18px_60px_rgba(15,23,42,0.055)] transition duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_28px_90px_rgba(15,23,42,0.1)]"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-red-500 opacity-0 transition duration-300 group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-5">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-red-50 text-xl font-black text-red-600 shadow-lg shadow-zinc-950/10">
                      {getInitials(review.name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black text-zinc-950">{review.name || "ElectroStreet rider"}</h3>
                      <p className="mt-1 text-sm font-bold text-zinc-500">{review.role || "ElectroStreet rider"}</p>
                      <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-600">
                        <FiCheckCircle />
                        Verified ride
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-red-50 px-4 py-3 text-center">
                    <p className="text-lg font-black text-red-600">{Number(review.rating || 0).toFixed(1)}</p>
                    <p className="text-[10px] font-black uppercase tracking-wide text-red-300">rating</p>
                  </div>
                </div>

                <div className="mt-8 flex gap-1.5 text-red-500">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <FiStar
                      key={starIndex}
                      className={starIndex < Number(review.rating || 0) ? "fill-current" : "text-zinc-300"}
                    />
                  ))}
                </div>
                <p className="mt-6 text-lg font-black leading-8 text-zinc-800">
                  "{review.comment}"
                </p>
                <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-5">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-300">
                    Rider feedback
                  </span>
                  <FiMessageCircle className="text-xl text-red-400" />
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default UserComments;
