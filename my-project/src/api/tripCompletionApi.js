import { staffAccounts } from "../data/staff.js";

const REQUESTS_STORAGE_KEY = "electroStreetTripCompletionRequests";
const RESERVATIONS_STORAGE_KEY = "reservedVehicles";
const COMPLETED_TRIPS_STORAGE_KEY = "electroStreetCompletedTrips";

export const TRIP_COMPLETION_UPDATED_EVENT = "electrostreet:trip-completion-updated";

export const TRIP_COMPLETION_STATUSES = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  PAID: "paid",
});

const readJson = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeRequests = (requests) => {
  localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  window.dispatchEvent(new CustomEvent(TRIP_COMPLETION_UPDATED_EVENT, { detail: requests }));
  return requests;
};

const getAssignee = (requests) => {
  const pendingCounts = staffAccounts.reduce((counts, staff) => {
    counts[staff.id] = requests.filter(
      (request) =>
        request.assigneeId === staff.id &&
        request.status === TRIP_COMPLETION_STATUSES.PENDING
    ).length;
    return counts;
  }, {});

  return [...staffAccounts].sort(
    (first, second) => pendingCounts[first.id] - pendingCounts[second.id]
  )[0];
};

export const tripCompletionApi = {
  getRequests() {
    const requests = readJson(REQUESTS_STORAGE_KEY, []);
    return Array.isArray(requests) ? requests : [];
  },

  getRequest(requestId) {
    return this.getRequests().find((request) => request.id === requestId) || null;
  },

  submitRequest({ reservation, vehicle, user, photos, rideCost }) {
    const requests = this.getRequests();
    const reservationId = reservation.id || reservation.vehicleId;
    const existingRequest = requests.find(
      (request) =>
        request.reservationId === reservationId &&
        request.status === TRIP_COMPLETION_STATUSES.PENDING
    );

    if (existingRequest) return existingRequest;

    const assignee = getAssignee(requests);
    const requestedAt = new Date().toISOString();
    const baseRideCost = Number(rideCost || 0);
    const discountPercent = Number(reservation.discountPercent || 0);
    const discountAmount = Number((baseRideCost * discountPercent / 100).toFixed(2));
    const finalRideCost = Number((baseRideCost - discountAmount).toFixed(2));
    const request = {
      id: `trip-completion-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      reservationId,
      vehicleId: reservation.vehicleId,
      vehicleName: `${vehicle.brand} ${vehicle.model}`,
      plateNumber: vehicle.plateNumber,
      userId: user?.id || user?.email || "current-user",
      userName: user?.name || "Customer",
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      status: TRIP_COMPLETION_STATUSES.PENDING,
      requestedAt,
      tripStartedAt: reservation.tripStartedAt || reservation.unlockedAt,
      baseRideCost,
      rideCost: finalRideCost,
      finalRideCost,
      discountPercent,
      discountAmount,
      promoCode: reservation.promoCode || null,
      holdAmount: Number(reservation.holdAmount || 0),
      photos,
    };

    writeRequests([request, ...requests]);
    return request;
  },

  approveRequest(requestId, staffId) {
    const requests = this.getRequests();
    const request = requests.find((item) => item.id === requestId);

    if (!request) {
      throw new Error("Trip completion request was not found.");
    }

    if (request.assigneeId !== staffId) {
      throw new Error("This request is assigned to another staff.");
    }

    if (request.status === TRIP_COMPLETION_STATUSES.APPROVED) {
      return request;
    }

    const approvedAt = new Date().toISOString();
    const approvedRequest = {
      ...request,
      status: TRIP_COMPLETION_STATUSES.APPROVED,
      approvedAt,
      approvedBy: staffId,
    };

    writeRequests(
      requests.map((item) => (item.id === requestId ? approvedRequest : item))
    );

    const reservations = readJson(RESERVATIONS_STORAGE_KEY, []);
    const nextReservations = Array.isArray(reservations)
      ? reservations.map((reservation) =>
          (reservation.id || reservation.vehicleId) === request.reservationId
            ? {
                ...reservation,
                tripStatus: "awaiting_payment",
                completionApprovedAt: approvedAt,
                baseRideCost: request.baseRideCost,
                discountPercent: request.discountPercent,
                discountAmount: request.discountAmount,
                finalRideCost: request.finalRideCost,
                holdAmount: request.holdAmount,
              }
            : reservation
        )
      : [];

    localStorage.setItem(RESERVATIONS_STORAGE_KEY, JSON.stringify(nextReservations));
    window.dispatchEvent(
      new CustomEvent(TRIP_COMPLETION_UPDATED_EVENT, {
        detail: this.getRequests(),
      })
    );

    return approvedRequest;
  },

  payRequest(requestId, paymentMethod) {
    const requests = this.getRequests();
    const request = requests.find((item) => item.id === requestId);

    if (!request) {
      throw new Error("Trip payment request was not found.");
    }

    if (request.status !== TRIP_COMPLETION_STATUSES.APPROVED) {
      throw new Error("The trip photos must be approved before payment.");
    }

    const paidAt = new Date().toISOString();
    const paidRequest = {
      ...request,
      status: TRIP_COMPLETION_STATUSES.PAID,
      paidAt,
      paymentMethod,
    };
    writeRequests(requests.map((item) => (item.id === requestId ? paidRequest : item)));

    const reservations = readJson(RESERVATIONS_STORAGE_KEY, []);
    const nextReservations = Array.isArray(reservations)
      ? reservations.filter(
          (reservation) =>
            (reservation.id || reservation.vehicleId) !== request.reservationId
        )
      : [];
    localStorage.setItem(RESERVATIONS_STORAGE_KEY, JSON.stringify(nextReservations));

    const completedTrips = readJson(COMPLETED_TRIPS_STORAGE_KEY, []);
    const nextCompletedTrips = [
      {
        id: request.id,
        reservationId: request.reservationId,
        vehicleId: request.vehicleId,
        vehicleName: request.vehicleName,
        plateNumber: request.plateNumber,
        userId: request.userId,
        userName: request.userName,
        startedAt: request.tripStartedAt,
        finishRequestedAt: request.requestedAt,
        approvedAt: request.approvedAt,
        endedAt: paidAt,
        approvedBy: request.approvedBy,
        paidAt,
        paymentMethod,
        baseTotal: request.baseRideCost,
        discountPercent: request.discountPercent,
        discountAmount: request.discountAmount,
        promoCode: request.promoCode,
        total: request.finalRideCost,
        status: "completed",
      },
      ...(Array.isArray(completedTrips) ? completedTrips : []),
    ];
    localStorage.setItem(COMPLETED_TRIPS_STORAGE_KEY, JSON.stringify(nextCompletedTrips));

    window.dispatchEvent(
      new CustomEvent(TRIP_COMPLETION_UPDATED_EVENT, {
        detail: this.getRequests(),
      })
    );

    return paidRequest;
  },

  recordPartialPayment(requestId, paymentMethod, payment) {
    const requests = this.getRequests();
    const request = requests.find((item) => item.id === requestId);

    if (!request) {
      throw new Error("Trip payment request was not found.");
    }

    if (request.status !== TRIP_COMPLETION_STATUSES.APPROVED) {
      throw new Error("The trip photos must be approved before payment.");
    }

    const paidAt = new Date().toISOString();
    const previousPaidAmount = Number(request.amountPaid || 0);
    const amountPaid = Number((previousPaidAmount + Number(payment.amountPaid || 0)).toFixed(2));
    const debtAmount = Number(payment.debtAmount || 0);
    const partialRequest = {
      ...request,
      amountPaid,
      debtAmount,
      partialPaidAt: paidAt,
      paymentMethod,
      paymentStatus: "partial",
      capturedHoldAmount: Number(payment.capturedHoldAmount || request.capturedHoldAmount || 0),
      extraBalancePayment: Number(payment.extraBalancePayment || 0),
    };

    writeRequests(requests.map((item) => (item.id === requestId ? partialRequest : item)));

    const reservations = readJson(RESERVATIONS_STORAGE_KEY, []);
    const nextReservations = Array.isArray(reservations)
      ? reservations.map((reservation) =>
          (reservation.id || reservation.vehicleId) === request.reservationId
            ? {
                ...reservation,
                tripStatus: "awaiting_payment",
                paymentStatus: "partial",
                amountPaid,
                debtAmount,
                holdStatus: "captured",
                capturedHoldAmount: Number(payment.capturedHoldAmount || 0),
                extraBalancePayment: Number(payment.extraBalancePayment || 0),
              }
            : reservation
        )
      : [];
    localStorage.setItem(RESERVATIONS_STORAGE_KEY, JSON.stringify(nextReservations));

    window.dispatchEvent(
      new CustomEvent(TRIP_COMPLETION_UPDATED_EVENT, {
        detail: this.getRequests(),
      })
    );

    return partialRequest;
  },

  applyPromoCode(requestId, promoCode) {
    const normalizedCode = String(promoCode || "").trim().toLowerCase();
    if (normalizedCode !== "farhad") {
      throw new Error("Promo code was not found.");
    }

    const requests = this.getRequests();
    const request = requests.find((item) => item.id === requestId);
    if (!request) {
      throw new Error("Trip payment request was not found.");
    }
    if (request.status !== TRIP_COMPLETION_STATUSES.APPROVED) {
      throw new Error("Promo code can only be applied before payment.");
    }
    if (request.promoCode) {
      throw new Error("A promo code is already applied to this trip.");
    }

    const baseRideCost = Number(request.baseRideCost || request.rideCost || 0);
    const discountPercent = 10;
    const discountAmount = Number((baseRideCost * discountPercent / 100).toFixed(2));
    const finalRideCost = Number((baseRideCost - discountAmount).toFixed(2));
    const updatedRequest = {
      ...request,
      promoCode: normalizedCode,
      discountPercent,
      discountAmount,
      finalRideCost,
      rideCost: finalRideCost,
    };
    writeRequests(requests.map((item) => (item.id === requestId ? updatedRequest : item)));

    const reservations = readJson(RESERVATIONS_STORAGE_KEY, []);
    localStorage.setItem(
      RESERVATIONS_STORAGE_KEY,
      JSON.stringify(
        Array.isArray(reservations)
          ? reservations.map((reservation) =>
              (reservation.id || reservation.vehicleId) === request.reservationId
                ? {
                    ...reservation,
                    promoCode: normalizedCode,
                    discountPercent,
                    discountAmount,
                    finalRideCost,
                  }
                : reservation
            )
          : []
      )
    );

    return updatedRequest;
  },

  addTripReview(requestId, review) {
    const completedTrips = readJson(COMPLETED_TRIPS_STORAGE_KEY, []);
    const tripExists = Array.isArray(completedTrips)
      && completedTrips.some((trip) => trip.id === requestId);

    if (!tripExists) {
      throw new Error("Completed trip was not found.");
    }

    const submittedAt = new Date().toISOString();
    const normalizedReview = {
      rating: Math.max(1, Math.min(5, Number(review.rating || 0))),
      comment: String(review.comment || "").trim(),
      submittedAt,
    };
    const nextCompletedTrips = completedTrips.map((trip) =>
      trip.id === requestId ? { ...trip, review: normalizedReview } : trip
    );
    localStorage.setItem(COMPLETED_TRIPS_STORAGE_KEY, JSON.stringify(nextCompletedTrips));

    const requests = this.getRequests();
    writeRequests(
      requests.map((request) =>
        request.id === requestId ? { ...request, review: normalizedReview } : request
      )
    );

    return normalizedReview;
  },

  subscribe(listener) {
    const handleCustomUpdate = (event) => listener(event.detail || this.getRequests());
    const handleStorageUpdate = (event) => {
      if (event.key === REQUESTS_STORAGE_KEY) listener(this.getRequests());
    };

    window.addEventListener(TRIP_COMPLETION_UPDATED_EVENT, handleCustomUpdate);
    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      window.removeEventListener(TRIP_COMPLETION_UPDATED_EVENT, handleCustomUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  },
};
