import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    FiAlertTriangle,
    FiClock,
    FiCreditCard,
    FiCpu,
    FiDisc,
    FiDollarSign,
    FiDroplet,
    FiMap,
    FiNavigation,
    FiPower,
    FiUserCheck,
    FiUsers,
    FiX,
    FiZap,
} from "react-icons/fi";
import { MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RESERVATIONS_UPDATED_EVENT } from "../../utils/reservations";
import {
    DEFAULT_PICKUP_USER_LOCATION,
    formatPickupDistance,
    getDistanceMeters,
    getWalkingRouteUrl,
    getWalkMinutes,
} from "../../utils/pickupMetrics";
import { reservationApi } from "../../api/reservationApi";
import { parkingZoneApi } from "../../api/parkingZoneApi";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const userIcon = L.divIcon({
    className: "reservation-user-marker",
    html: '<span class="reservation-user-marker__dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
});

L.Marker.prototype.options.icon = defaultIcon;

const RouteBounds = ({ userLocation, carLocation, routePositions, isRouteVisible }) => {
    const map = useMap();

    useEffect(() => {
        const resizeTimers = [80, 280, 560].map((delay) =>
            window.setTimeout(() => {
                map.invalidateSize();
            }, delay)
        );

        const fitTimer = window.setTimeout(() => {
            const boundsSource = routePositions.length > 1 ? routePositions : [userLocation, carLocation];
            map.fitBounds(boundsSource, {
                paddingTopLeft: [56, 86],
                paddingBottomRight: [56, 56],
                maxZoom: isRouteVisible ? 17 : 14,
            });
        }, 320);

        return () => {
            resizeTimers.forEach((timer) => window.clearTimeout(timer));
            window.clearTimeout(fitTimer);
        };
    }, [carLocation, isRouteVisible, map, routePositions, userLocation]);

    return null;
};

const DestinationMapPicker = ({ onPick }) => {
    useMapEvents({
        click: (event) => {
            onPick([event.latlng.lat, event.latlng.lng]);
        },
    });

    return null;
};

const LocationWatcher = ({ isEnabled = true, onLocationChange, onLocationError }) => {
    useEffect(() => {
        if (!isEnabled || !("geolocation" in navigator)) {
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                onLocationChange([position.coords.latitude, position.coords.longitude]);
            },
            () => {
                onLocationError("Live location is off. Using demo pickup point.");
            },
            {
                enableHighAccuracy: true,
                maximumAge: 8000,
                timeout: 12000,
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [isEnabled, onLocationChange, onLocationError]);

    return null;
};

const getVehiclePosition = (vehicle) => [
    vehicle.location?.lat || DEFAULT_PICKUP_USER_LOCATION[0],
    vehicle.location?.lng || DEFAULT_PICKUP_USER_LOCATION[1],
];

const getDrivingRouteUrl = ([fromLat, fromLng], [toLat, toLng]) =>
    `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`;

const isPointInsidePolygon = ([lat, lng], polygon) => {
    let inside = false;
    for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index++) {
        const [currentLat, currentLng] = polygon[index];
        const [previousLat, previousLng] = polygon[previousIndex];
        const intersects =
            currentLng > lng !== previousLng > lng &&
            lat < ((previousLat - currentLat) * (lng - currentLng)) / (previousLng - currentLng) + currentLat;

        if (intersects) inside = !inside;
    }

    return inside;
};

const getStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem("electroStreetUser") || "null");
    } catch {
        return null;
    }
};

const areRideDocumentsApproved = () => {
    const verificationStatus = getStoredUser()?.verificationStatus;
    return verificationStatus === 2 || String(verificationStatus).toLowerCase() === "verified";
};

const VehicleGalleryViewer = ({ vehicle }) => {
    const galleryImages = Array.isArray(vehicle.galleryImages) && vehicle.galleryImages.length
        ? vehicle.galleryImages.slice(0, 4)
        : [vehicle.image, vehicle.image, vehicle.image, vehicle.image];
    const normalizedGallery = [...galleryImages, ...Array.from({ length: Math.max(0, 4 - galleryImages.length) }, () => vehicle.image)].slice(0, 4);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const activeImage = normalizedGallery[activeImageIndex] || vehicle.image;

    return (
        <div className="flex h-full w-full flex-col">
            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_50%_40%,#ffffff_0%,#f8fafc_58%,#eef2f7_100%)]">
                <img
                    src={activeImage}
                    alt={`${vehicle.brand} ${vehicle.model}`}
                    className="relative z-10 mx-auto aspect-[16/9] h-full w-full object-contain p-6"
                />
                <div className="absolute bottom-8 h-5 w-4/5 rounded-[100%] bg-zinc-950/10 blur-xl" />
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3">
                {normalizedGallery.map((image, index) => {
                    const isActive = index === activeImageIndex;

                    return (
                        <button
                            key={`${vehicle.id}-gallery-${index}`}
                            type="button"
                            onClick={() => setActiveImageIndex(index)}
                            className={`overflow-hidden rounded-2xl border bg-white transition ${
                                isActive ? "border-red-500 shadow-md shadow-red-200/50" : "border-gray-200 hover:border-gray-400"
                            }`}
                        >
                            <div className="aspect-[4/3] w-full bg-[linear-gradient(180deg,#fafafa,#f4f4f5)]">
                                <img
                                    src={image}
                                    alt={`${vehicle.brand} ${vehicle.model} view ${index + 1}`}
                                    className="h-full w-full object-contain p-2"
                                />
                            </div>
                            <div className="border-t border-gray-100 px-2 py-2 text-center text-[10px] font-black uppercase tracking-wide text-gray-500">
                                {index === 0 ? "Main photo" : `Photo ${index + 1}`}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const pageTransition = {
    type: "spring",
    stiffness: 115,
    damping: 24,
    mass: 0.9,
};

const sectionReveal = {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0 },
};

const cardReveal = {
    hidden: { opacity: 0, y: 16, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1 },
};

const AdvancedReservationStage = ({ vehicle, onClose, userLocation = DEFAULT_PICKUP_USER_LOCATION }) => {
    const currentUser = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("electroStreetUser") || "null");
        } catch {
            return null;
        }
    }, []);
    const savedCards = useMemo(() => {
        try {
            const cards = JSON.parse(localStorage.getItem(`electroStreetCards:${currentUser?.id || "anonymous"}`) || "[]");
            return Array.isArray(cards) ? cards : [];
        } catch {
            return [];
        }
    }, [currentUser?.id]);
    const [passengerCount, setPassengerCount] = useState(1);
    const [displayedRate, setDisplayedRate] = useState(0);
    const [isReservationConfirmed, setIsReservationConfirmed] = useState(false);
    const [reservationError, setReservationError] = useState("");
    const [isCreatingReservation, setIsCreatingReservation] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("card");
    const [isRouteVisible, setIsRouteVisible] = useState(false);
    const [routeMapReadyVehicleId, setRouteMapReadyVehicleId] = useState(null);
    const [currentUserLocation, setCurrentUserLocation] = useState(userLocation);
    const [hasResolvedUserLocation, setHasResolvedUserLocation] = useState(false);
    const [locationMessage, setLocationMessage] = useState("");
    const [destinationLabel, setDestinationLabel] = useState("");
    const [destinationPoint, setDestinationPoint] = useState(null);
    const [parkingZones, setParkingZones] = useState([]);
    const [hasLoadedParkingZones, setHasLoadedParkingZones] = useState(false);
    const [parkingZonesError, setParkingZonesError] = useState("");
    const [destinationRouteState, setDestinationRouteState] = useState({
        positions: [],
        distanceMeters: null,
        status: "idle",
        error: "",
    });
    const [routeState, setRouteState] = useState({
        positions: [],
        distanceMeters: null,
        initialDistanceMeters: null,
        durationSeconds: null,
        status: "idle",
        error: "",
    });

    const profileBalance = Number(currentUser?.balance || 0);
    const profilePendingHold = Number(currentUser?.pendingHold || 0);
    const profileDebt = Number(currentUser?.debtAmount || 0);
    const availableProfileBalance = Math.max(0, profileBalance - profilePendingHold);
    const carLocation = useMemo(() => getVehiclePosition(vehicle), [vehicle]);
    const distanceMeters = getDistanceMeters(currentUserLocation, carLocation);
    const routeDistanceMeters =
        typeof routeState.distanceMeters === "number" ? routeState.distanceMeters : distanceMeters;
    const routeRemainingPercent =
        typeof routeState.distanceMeters === "number" && typeof routeState.initialDistanceMeters === "number"
            ? Math.max(0, Math.min(100, (routeState.distanceMeters / routeState.initialDistanceMeters) * 100))
            : 100;
    const walkMinutes = getWalkMinutes(routeDistanceMeters);
    const routePositions = useMemo(
        () => (routeState.positions.length > 1 ? routeState.positions : [currentUserLocation, carLocation]),
        [carLocation, currentUserLocation, routeState.positions]
    );
    const destinationRoutePositions = useMemo(
        () => (
            destinationRouteState.positions.length > 1
                ? destinationRouteState.positions
                : destinationPoint
                    ? [carLocation, destinationPoint]
                    : []
        ),
        [carLocation, destinationPoint, destinationRouteState.positions]
    );
    const mapRoutePositions = useMemo(
        () => {
            const positions = [...routePositions];
            destinationRoutePositions.forEach((position) => {
                const last = positions[positions.length - 1];
                if (!last || last[0] !== position[0] || last[1] !== position[1]) {
                    positions.push(position);
                }
            });
            return positions;
        },
        [destinationRoutePositions, routePositions]
    );
    const parkingDecision = useMemo(() => {
        if (!destinationPoint) {
            return {
                canPark: false,
                status: "missing",
                message: "Pick your destination on the map before reserving.",
                zone: null,
            };
        }

        const activeZones = parkingZones.filter((zone) => zone.isActive !== false);
        const restrictedZone = activeZones.find((zone) =>
            zone.type === "restricted" && isPointInsidePolygon(destinationPoint, zone.positions)
        );
        if (restrictedZone) {
            return {
                canPark: false,
                status: "restricted",
                message: `Destination is inside ${restrictedZone.name}. Parking is not allowed there.`,
                zone: restrictedZone,
            };
        }

        const allowedZones = activeZones.filter((zone) => zone.type !== "restricted" && zone.allowsTripEnd !== false);
        if (!allowedZones.length && hasLoadedParkingZones) {
            return {
                canPark: true,
                status: "unmanaged",
                message: "No managed parking zones are active. Destination can be used for this demo.",
                zone: null,
            };
        }

        const allowedZone = allowedZones.find((zone) => isPointInsidePolygon(destinationPoint, zone.positions));
        if (allowedZone) {
            return {
                canPark: true,
                status: "allowed",
                message: `Parking allowed in ${allowedZone.name}.`,
                zone: allowedZone,
            };
        }

        return {
            canPark: false,
            status: "outside",
            message: hasLoadedParkingZones
                ? "Destination is outside available parking zones."
                : "Loading parking zones before reservation.",
            zone: null,
        };
    }, [destinationPoint, hasLoadedParkingZones, parkingZones]);
    const hasValidDestination = Boolean(destinationLabel.trim() && destinationPoint && parkingDecision.canPark);
    const destinationDistanceLabel = destinationPoint
        ? formatPickupDistance(destinationRouteState.distanceMeters ?? getDistanceMeters(carLocation, destinationPoint))
        : "Pick on map";
    const pickupRouteLabel = !hasResolvedUserLocation
        ? "Detecting your location..."
        : routeState.status === "loading" || routeState.status === "idle"
            ? "Loading route..."
            : `${formatPickupDistance(routeDistanceMeters)}, about ${walkMinutes} min walk`;
    const pickupRouteBadge = !hasResolvedUserLocation
        ? "Detecting location"
        : routeState.status === "loading" || routeState.status === "idle"
            ? "Loading route"
            : `${walkMinutes} min walk`;
    const specs = vehicle.specs || {};
    const isOverCapacity = passengerCount > vehicle.seats;
    const baseRate = Number(vehicle.pricePerMinute || 0);
    const finalRate = baseRate;
    const isRouteMapReady = routeMapReadyVehicleId === vehicle.id;
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setRouteMapReadyVehicleId(vehicle.id);
        }, 240);

        return () => window.clearTimeout(timer);
    }, [vehicle.id]);

    useEffect(() => {
        let isMounted = true;

        const loadParkingZones = async () => {
            setParkingZonesError("");
            try {
                const zones = await parkingZoneApi.getZones();
                if (!isMounted) return;
                setParkingZones(zones);
            } catch (error) {
                if (!isMounted) return;
                setParkingZones([]);
                setParkingZonesError(error.message || "Parking zones could not be loaded.");
            } finally {
                if (isMounted) setHasLoadedParkingZones(true);
            }
        };

        loadParkingZones();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let animationFrame;
        const duration = 900;
        const startedAt = performance.now();

        const tick = (now) => {
            const progress = Math.min((now - startedAt) / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);

            setDisplayedRate(finalRate * easedProgress);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(tick);
            }
        };

        animationFrame = requestAnimationFrame((now) => {
            setDisplayedRate(0);
            tick(now);
        });

        return () => cancelAnimationFrame(animationFrame);
    }, [finalRate]);

    const handleConfirmReservation = async () => {
        if (currentUser?.emailVerified === false) {
            setReservationError("Please verify your email before confirming a reservation.");
            return;
        }

        if (!areRideDocumentsApproved()) {
            setReservationError("Driver license and passport must be verified before reserving a car.");
            return;
        }

        if (profileDebt > 0) {
            setReservationError(`Pay your outstanding ${profileDebt.toFixed(2)} AZN balance before creating a new reservation.`);
            return;
        }

        if (isOverCapacity) {
            return;
        }

        if (!destinationLabel.trim()) {
            setReservationError("Enter your destination before confirming the reservation.");
            return;
        }

        if (!destinationPoint) {
            setReservationError("Pick your destination on the map before confirming the reservation.");
            return;
        }

        if (!parkingDecision.canPark) {
            setReservationError(parkingDecision.message);
            return;
        }

        setIsCreatingReservation(true);
        setReservationError("");

        try {
            await reservationApi.create({
                vehicleId: vehicle.id,
                passengerCount,
                destinationLabel: destinationLabel.trim(),
                destinationLatitude: destinationPoint[0],
                destinationLongitude: destinationPoint[1],
            });
            localStorage.removeItem("reservedVehicle");
            localStorage.removeItem("reservedVehicles");
            window.dispatchEvent(new CustomEvent(RESERVATIONS_UPDATED_EVENT));
            setIsReservationConfirmed(true);
        } catch (error) {
            setReservationError(error.message || "Reservation could not be created.");
            setIsReservationConfirmed(false);
        } finally {
            setIsCreatingReservation(false);
        }
    };

    const handleSuccessOk = () => {
        window.location.href = "/dashboard";
    };

    const handleLocationChange = useCallback((nextLocation) => {
        setCurrentUserLocation(nextLocation);
        setHasResolvedUserLocation(true);
        setLocationMessage("");
    }, []);

    const handleLocationError = useCallback((message) => {
        setHasResolvedUserLocation(true);
        setLocationMessage(message);
    }, []);

    const handleDestinationPick = useCallback((point) => {
        setDestinationPoint(point);
        setReservationError("");
    }, []);

    useEffect(() => {
        const resetFrame = requestAnimationFrame(() => {
            setCurrentUserLocation(userLocation);
            setRouteState((currentRoute) => ({
                ...currentRoute,
                initialDistanceMeters: null,
            }));
            setHasResolvedUserLocation(false);
        });

        return () => cancelAnimationFrame(resetFrame);
    }, [userLocation, vehicle.id]);

    useEffect(() => {
        if (!hasResolvedUserLocation) {
            return undefined;
        }

        const controller = new AbortController();

        const loadRoute = async () => {
            setRouteState((currentRoute) => ({
                ...currentRoute,
                status: "loading",
                error: "",
            }));

            try {
                const response = await fetch(getWalkingRouteUrl(currentUserLocation, carLocation), {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error("Route service is unavailable.");
                }

                const data = await response.json();
                const route = data.routes?.[0];
                const coordinates = route?.geometry?.coordinates;

                if (!coordinates?.length) {
                    throw new Error("Route was not found.");
                }

                setRouteState((currentRoute) => ({
                    ...currentRoute,
                    positions: coordinates.map(([lng, lat]) => [lat, lng]),
                    distanceMeters: route.distance,
                    initialDistanceMeters:
                        typeof currentRoute.initialDistanceMeters === "number"
                            ? Math.max(currentRoute.initialDistanceMeters, route.distance)
                            : route.distance,
                    durationSeconds: null,
                    status: "ready",
                    error: "",
                }));
            } catch (error) {
                if (error.name === "AbortError") {
                    return;
                }

                setRouteState({
                    positions: [],
                    distanceMeters: null,
                    initialDistanceMeters: null,
                    durationSeconds: null,
                    status: "error",
                    error: "Road route is temporarily unavailable.",
                });
            }
        };

        loadRoute();

        return () => controller.abort();
    }, [carLocation, currentUserLocation, hasResolvedUserLocation]);

    useEffect(() => {
        if (!destinationPoint) {
            return undefined;
        }

        const controller = new AbortController();

        const loadDestinationRoute = async () => {
            setDestinationRouteState((currentRoute) => ({
                ...currentRoute,
                status: "loading",
                error: "",
            }));

            try {
                const response = await fetch(getDrivingRouteUrl(carLocation, destinationPoint), {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error("Destination route service is unavailable.");
                }

                const data = await response.json();
                const route = data.routes?.[0];
                const coordinates = route?.geometry?.coordinates;

                if (!coordinates?.length) {
                    throw new Error("Destination route was not found.");
                }

                setDestinationRouteState({
                    positions: coordinates.map(([lng, lat]) => [lat, lng]),
                    distanceMeters: route.distance,
                    status: "ready",
                    error: "",
                });
            } catch (error) {
                if (error.name === "AbortError") {
                    return;
                }

                setDestinationRouteState({
                    positions: [carLocation, destinationPoint],
                    distanceMeters: getDistanceMeters(carLocation, destinationPoint),
                    status: "error",
                    error: "Destination route is shown as a direct line.",
                });
            }
        };

        loadDestinationRoute();

        return () => controller.abort();
    }, [carLocation, destinationPoint]);

    const specCards = [
        { icon: FiZap, label: "0-100 km/h", value: specs.acceleration || "3.8 sec" },
        { icon: FiPower, label: "Power", value: specs.power || "540 hp" },
        { icon: FiCpu, label: "Engine", value: specs.engine || "Electric motor" },
        { icon: FiNavigation, label: "Drive", value: specs.driveType || "AWD" },
        { icon: FiDisc, label: "Tires", value: specs.tires || "Winter 20 inch" },
        { icon: FiDroplet, label: "Color", value: vehicle.color || "Obsidian Black" },
        { icon: FiUserCheck, label: "Seats", value: `${vehicle.seats} seats` },
        { icon: FiUsers, label: "Interior", value: specs.interior || "Leather cabin" },
    ];

    const paymentMethods = [
        {
            id: "card",
            icon: FiCreditCard,
            label: "Card",
            detail: savedCards.length
                ? `${savedCards[0].brand || "Card"} ending ${savedCards[0].last4}`
                : "No saved card — add one in your cabinet",
        },
        {
            id: "profile_balance",
            icon: FiDollarSign,
            label: "Profile balance",
            detail: `${availableProfileBalance.toFixed(2)} AZN available`,
        },
    ];

    return (
        <motion.div
            className="fixed inset-0 z-[2400] overflow-y-auto bg-zinc-950/90 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
        >
            <style>
                {`
          .reservation-user-marker {
            align-items: center;
            display: flex;
            justify-content: center;
          }

          .reservation-user-marker__dot {
            background: #2563eb;
            border: 4px solid white;
            border-radius: 9999px;
            box-shadow: 0 10px 24px rgba(37, 99, 235, 0.35);
            height: 22px;
            width: 22px;
          }

          .reservation-close-button {
            align-items: center;
            background: #ffffff;
            border: 1px solid rgba(17, 24, 39, 0.08);
            border-radius: 9999px;
            box-shadow: 0 18px 45px rgba(17, 24, 39, 0.14);
            color: #111827;
            display: flex;
            height: 46px;
            justify-content: center;
            overflow: hidden;
            position: fixed;
            transition: color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
            width: 46px;
          }

          .reservation-close-button:before {
            background: #e53e3e;
            border-radius: inherit;
            content: "";
            inset: 4px;
            opacity: 0;
            position: absolute;
            transform: scale(0.35) rotate(35deg);
            transition: opacity 0.25s ease, transform 0.25s ease;
          }

          .reservation-close-button svg {
            position: relative;
            transition: transform 0.25s ease;
            z-index: 1;
          }

          .reservation-close-button:hover {
            box-shadow: 0 22px 50px rgba(229, 62, 62, 0.24);
            color: #ffffff;
            transform: translateY(-1px);
          }

          .reservation-close-button:hover:before {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }

          .reservation-close-button:hover svg {
            transform: rotate(90deg);
          }

          .reservation-panel-card {
            background: linear-gradient(180deg, #ffffff 0%, #fffefe 100%);
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            box-shadow: 0 16px 42px rgba(15, 23, 42, 0.04);
            padding: 22px;
            transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
          }

          .reservation-panel-card:hover {
            border-color: #fecaca;
            box-shadow: 0 22px 50px rgba(229, 62, 62, 0.08);
            transform: translateY(-1px);
          }

          .passenger-stepper {
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            display: flex;
            overflow: hidden;
            padding: 4px;
          }

          .passenger-stepper button {
            align-items: center;
            border-radius: 12px;
            color: #1f2937;
            display: flex;
            font-size: 20px;
            font-weight: 900;
            height: 42px;
            justify-content: center;
            transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
            width: 42px;
          }

          .passenger-stepper button:hover {
            background: #111827;
            color: #ffffff;
            transform: translateY(-1px);
          }

          .passenger-stepper span {
            color: #030712;
            font-size: 20px;
            font-weight: 900;
            text-align: center;
            width: 46px;
          }

          .route-pill-button {
            background: #050505;
            border-radius: 12px;
            color: #ffffff;
            font-size: 11px;
            font-weight: 900;
            overflow: hidden;
            padding: 12px 18px;
            position: relative;
            text-transform: uppercase;
            transition: background-color 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease;
          }

          .route-pill-button:hover {
            background: #e53e3e;
            box-shadow: 0 14px 26px rgba(229, 62, 62, 0.2);
            transform: translateY(-1px);
          }

          .btn-12,
          .btn-12 *,
          .btn-12 :after,
          .btn-12 :before,
          .btn-12:after,
          .btn-12:before {
            border: 0 solid;
            box-sizing: border-box;
          }

          .btn-12 {
            -webkit-tap-highlight-color: transparent;
            -webkit-appearance: button;
            background-color: #e53e3e;
            background-image: none;
            border-radius: 99rem;
            color: #fff;
            cursor: pointer;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
              Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif;
            font-size: 100%;
            font-weight: 900;
            line-height: 1.5;
            margin: 0;
            -webkit-mask-image: -webkit-radial-gradient(#000, #fff);
            overflow: hidden;
            padding: 1rem 3rem;
            position: relative;
            text-transform: uppercase;
            z-index: 0;
          }

          .btn-12:disabled {
            cursor: default;
          }

          .btn-12:-moz-focusring {
            outline: auto;
          }

          .btn-12 svg {
            display: block;
            vertical-align: middle;
          }

          .btn-12 [hidden] {
            display: none;
          }

          .btn-12 span {
            color: #fff;
            position: relative;
            z-index: 2;
          }

          .btn-12:after,
          .btn-12:before {
            content: "";
            inset: 0;
            position: absolute;
            transition: transform 0.42s ease, opacity 0.42s ease;
            z-index: 1;
          }

          .btn-12:before {
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 52%, #7f1d1d 100%);
            transform: translateX(-105%) skewX(-18deg);
          }

          .btn-12:after {
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
            opacity: 0;
            transform: translateX(-120%) skewX(-18deg);
            width: 42%;
          }

          .btn-12:hover:before {
            transform: translateX(0) skewX(0);
          }

          .btn-12:hover:after {
            opacity: 1;
            transform: translateX(260%) skewX(-18deg);
          }

          .btn-12:hover {
            box-shadow: 0 18px 34px rgba(185, 28, 28, 0.28);
            transform: translateY(-1px);
          }

          .btn-12:active {
            transform: translateY(0) scale(0.99);
          }

          .reservation-alert-backdrop {
            align-items: center;
            background: rgba(3, 7, 18, 0.5);
            display: flex;
            inset: 0;
            justify-content: center;
            padding: 20px;
            position: fixed;
            z-index: 160;
          }

          .reservation-alert-card {
            align-items: center;
            background: #ffffff;
            border-radius: 22px;
            box-shadow: 0 34px 90px rgba(15, 23, 42, 0.25);
            display: flex;
            flex-direction: column;
            max-width: 390px;
            overflow: hidden;
            padding: 34px 28px 28px;
            position: relative;
            text-align: center;
            width: min(390px, calc(100vw - 32px));
          }

          .reservation-alert-card:before {
            background: radial-gradient(circle, rgba(34, 197, 94, 0.16), transparent 64%);
            content: "";
            height: 220px;
            position: absolute;
            top: -120px;
            width: 220px;
          }

          .reservation-alert-icon {
            align-items: center;
            background: #dcfce7;
            border: 8px solid #f0fdf4;
            border-radius: 9999px;
            color: #16a34a;
            display: flex;
            height: 76px;
            justify-content: center;
            position: relative;
            width: 76px;
            z-index: 1;
          }

          .reservation-alert-title {
            color: #07111f;
            font-size: 24px;
            font-weight: 950;
            letter-spacing: -0.02em;
            margin-top: 18px;
          }

          .reservation-alert-text {
            color: #6b7280;
            font-size: 14px;
            font-weight: 700;
            line-height: 1.55;
            margin-top: 8px;
          }

          .reservation-alert-car {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            color: #111827;
            font-size: 13px;
            font-weight: 900;
            margin-top: 18px;
            padding: 12px 14px;
            width: 100%;
          }

          .reservation-alert-ok {
            background: #e53e3e;
            border-radius: 9999px;
            color: #ffffff;
            font-size: 12px;
            font-weight: 950;
            letter-spacing: 0.16em;
            margin-top: 22px;
            overflow: hidden;
            padding: 15px 26px;
            position: relative;
            text-transform: uppercase;
            transition: background-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
            width: 100%;
          }

          .reservation-alert-ok:hover {
            background: #b91c1c;
            box-shadow: 0 18px 36px rgba(185, 28, 28, 0.24);
            transform: translateY(-1px);
          }

          .payment-method-option {
            align-items: center;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            cursor: pointer;
            display: flex;
            gap: 12px;
            padding: 14px;
            position: relative;
            transition: border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
          }

          .payment-method-option:hover {
            border-color: #fecaca;
            box-shadow: 0 16px 30px rgba(229, 62, 62, 0.09);
            transform: translateY(-1px);
          }

          .payment-method-option[data-active="true"] {
            border-color: #e53e3e;
            box-shadow: 0 18px 34px rgba(229, 62, 62, 0.14);
          }

          .payment-method-option__icon {
            align-items: center;
            background: #f9fafb;
            border-radius: 12px;
            color: #111827;
            display: flex;
            flex-shrink: 0;
            height: 38px;
            justify-content: center;
            transition: background-color 0.22s ease, color 0.22s ease;
            width: 38px;
          }

          .payment-method-option[data-active="true"] .payment-method-option__icon {
            background: #fee2e2;
            color: #e53e3e;
          }

          .payment-method-option__radio {
            border: 2px solid #d1d5db;
            border-radius: 9999px;
            height: 18px;
            margin-left: auto;
            position: relative;
            transition: border-color 0.22s ease;
            width: 18px;
          }

          .payment-method-option__radio:after {
            background: #e53e3e;
            border-radius: 9999px;
            content: "";
            height: 8px;
            left: 3px;
            opacity: 0;
            position: absolute;
            top: 3px;
            transform: scale(0.4);
            transition: opacity 0.22s ease, transform 0.22s ease;
            width: 8px;
          }

          .payment-method-option[data-active="true"] .payment-method-option__radio {
            border-color: #e53e3e;
          }

          .payment-method-option[data-active="true"] .payment-method-option__radio:after {
            opacity: 1;
            transform: scale(1);
          }
        `}
            </style>

            <motion.div
                className="min-h-screen origin-bottom bg-white lg:grid lg:grid-cols-12"
                initial={{ y: 52, scale: 0.985, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 36, scale: 0.99, opacity: 0 }}
                transition={pageTransition}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="reservation-close-button fixed right-5 top-5 z-[2410]"
                    aria-label="Close reservation"
                >
                    <FiX className="text-xl" />
                </button>

                <AnimatePresence>
                    {isReservationConfirmed && (
                        <motion.div
                            className="reservation-alert-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                            <motion.div
                                className="reservation-alert-card"
                                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 18, scale: 0.96 }}
                                transition={{ type: "spring", stiffness: 170, damping: 18 }}
                            >
                                <div className="reservation-alert-icon">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 512 512"
                                        strokeWidth="0"
                                        fill="currentColor"
                                        stroke="currentColor"
                                        className="h-8 w-8"
                                    >
                                        <path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z" />
                                    </svg>
                                </div>
                                <h3 className="reservation-alert-title">Reservation confirmed</h3>
                                <p className="reservation-alert-text">
                                    Your request is ready. We will create it and open your cabinet.
                                </p>
                                <div className="reservation-alert-car">
                                    {vehicle.brand} {vehicle.model} / {vehicle.plateNumber}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSuccessOk}
                                    disabled={isCreatingReservation}
                                    className="reservation-alert-ok"
                                >
                                    {isCreatingReservation ? "Creating..." : "OK"}
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.section
                    className="lg:col-span-7 border-r border-gray-100 bg-gray-50 px-5 py-8 md:px-10 lg:px-12"
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.08, delayChildren: 0.14 } },
                    }}
                >
                    <div className="mx-auto flex min-h-full max-w-4xl flex-col">
                        <motion.div className="mb-8" variants={sectionReveal} transition={{ duration: 0.42, ease: "easeOut" }}>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E53E3E]">
                                Reservation studio
                            </p>
                            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 md:text-5xl">
                                {vehicle.brand} {vehicle.model}
                            </h1>
                            <p className="mt-2 text-sm font-bold uppercase tracking-wide text-gray-400">
                                {vehicle.plateNumber} / {vehicle.color || "Premium color"} / {vehicle.location?.label}
                            </p>
                        </motion.div>

                        <motion.div
                            className="flex flex-1 flex-col items-center justify-center rounded-[22px] border border-gray-200 bg-white px-4 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)]"
                            variants={cardReveal}
                            transition={{ duration: 0.46, ease: "easeOut" }}
                        >
                            <div className="relative w-full overflow-hidden rounded-[18px] bg-white md:min-h-[620px]">
                                <VehicleGalleryViewer vehicle={vehicle} />
                            </div>

                            <div className="mt-8 w-full max-w-md">
                                <p className="text-center text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                                    Main photo plus 3 extra photo slots ready for your future uploads
                                </p>
                            </div>
                        </motion.div>

                        <motion.div
                            className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"
                            variants={{
                                hidden: {},
                                visible: { transition: { staggerChildren: 0.035 } },
                            }}
                        >
                            {specCards.map((spec) => (
                                <motion.div
                                    key={spec.label}
                                    className="rounded-lg border border-gray-200 bg-white p-4"
                                    variants={cardReveal}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                >
                                    <spec.icon className="mb-3 text-lg text-[#E53E3E]" />
                                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                                        {spec.label}
                                    </p>
                                    <p className="mt-1 text-sm font-black text-gray-950">{spec.value}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </motion.section>

                <motion.aside
                    className="lg:col-span-5 px-5 py-8 md:px-10 lg:px-12"
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.08, delayChildren: 0.22 } },
                    }}
                >
                    <div className="mx-auto flex min-h-full max-w-xl flex-col gap-6">
                        <div className="space-y-6">
                            <motion.div
                                className="reservation-panel-card"
                                variants={cardReveal}
                                transition={{ duration: 0.38, ease: "easeOut" }}
                            >
                                <div className="mb-4 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                                            Passengers
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-gray-950">
                                            This vehicle has {vehicle.seats} seats.
                                        </p>
                                    </div>
                                    <div className="passenger-stepper">
                                        <button
                                            type="button"
                                            onClick={() => setPassengerCount((count) => Math.max(1, count - 1))}
                                            aria-label="Decrease passengers"
                                        >
                                            -
                                        </button>
                                        <span>
                                            {passengerCount}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setPassengerCount((count) => Math.min(9, count + 1))}
                                            aria-label="Increase passengers"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                {isOverCapacity && (
                                    <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                                        <div className="flex gap-3">
                                            <FiAlertTriangle className="mt-0.5 flex-shrink-0 text-red-600" />
                                            <div>
                                                <p className="text-sm font-black text-red-700">
                                                    Sorry, this car is only for {vehicle.seats} people.
                                                </p>
                                                <p className="mt-2 text-xs font-bold text-red-700/80">
                                                    Pick another EV from the fleet with enough seats.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>

                            <motion.div
                                className="overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-[0_16px_42px_rgba(15,23,42,0.04)]"
                                variants={cardReveal}
                                transition={{ duration: 0.38, ease: "easeOut" }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setIsRouteVisible((visible) => !visible)}
                                    className="flex w-full items-center justify-between gap-4 bg-white px-5 py-4 text-left"
                                >
                                    <span>
                                        <span className="flex items-center gap-2 text-sm font-black text-gray-950">
                                            <FiMap className="text-[#E53E3E]" /> Pickup route
                                        </span>
                                        <span className="mt-1 block text-xs font-bold text-gray-400">
                                            {pickupRouteLabel}
                                        </span>
                                        {isRouteVisible && (
                                            <span className="mt-3 block h-1.5 w-36 overflow-hidden rounded-full bg-gray-100">
                                                <span
                                                    className="block h-full rounded-full bg-[#E53E3E] transition-all duration-500"
                                                    style={{ width: `${routeState.status === "ready" ? routeRemainingPercent : 100}%` }}
                                                />
                                            </span>
                                        )}
                                    </span>
                                    <span className="route-pill-button">
                                        {isRouteVisible ? "Hide" : "Route"}
                                    </span>
                                </button>

                                <div className={`relative transition-all duration-500 ${isRouteVisible ? "h-80" : "h-44"}`}>
                                    {isRouteMapReady ? (
                                        <MapContainer
                                            center={userLocation}
                                            zoom={14}
                                            scrollWheelZoom
                                            zoomControl
                                            dragging
                                            doubleClickZoom
                                            touchZoom
                                            className="h-full w-full"
                                        >
                                            <LocationWatcher
                                                isEnabled
                                                onLocationChange={handleLocationChange}
                                                onLocationError={handleLocationError}
                                            />
                                            <RouteBounds
                                                userLocation={currentUserLocation}
                                                carLocation={carLocation}
                                                routePositions={mapRoutePositions}
                                                isRouteVisible={isRouteVisible}
                                            />
                                            <DestinationMapPicker onPick={handleDestinationPick} />
                                            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                                            {parkingZones.map((zone) => {
                                                const restricted = zone.type === "restricted";
                                                const color = restricted ? "#dc2626" : "#16a34a";

                                                return (
                                                    <Polygon
                                                        key={zone.id}
                                                        positions={zone.positions}
                                                        eventHandlers={{
                                                            click: (event) => {
                                                                L.DomEvent.stopPropagation(event);
                                                                handleDestinationPick([event.latlng.lat, event.latlng.lng]);
                                                            },
                                                        }}
                                                        pathOptions={{
                                                            color,
                                                            fillColor: color,
                                                            fillOpacity: restricted ? 0.18 : 0.14,
                                                            weight: restricted ? 2 : 1.5,
                                                            dashArray: restricted ? "7 7" : "0",
                                                        }}
                                                    >
                                                        <Popup>{zone.name}</Popup>
                                                    </Polygon>
                                                );
                                            })}
                                            {hasResolvedUserLocation && (
                                                <Marker position={currentUserLocation} icon={userIcon}>
                                                    <Popup>Your location</Popup>
                                                </Marker>
                                            )}
                                            <Marker position={carLocation}>
                                                <Popup>
                                                    {vehicle.brand} {vehicle.model}
                                                </Popup>
                                            </Marker>
                                            {destinationPoint && (
                                                <Marker position={destinationPoint}>
                                                    <Popup>{destinationLabel || "Destination"}</Popup>
                                                </Marker>
                                            )}
                                            {isRouteVisible && (
                                                <>
                                                    <Polyline positions={routePositions} color="#E53E3E" weight={5} opacity={0.9} />
                                                    {destinationRoutePositions.length > 1 && (
                                                        <Polyline positions={destinationRoutePositions} color="#16a34a" weight={5} opacity={0.85} />
                                                    )}
                                                </>
                                            )}
                                        </MapContainer>
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f8fafc,#eef2f7)]">
                                            <div className="rounded-2xl bg-white/85 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-gray-400 shadow-sm">
                                                Preparing map
                                            </div>
                                        </div>
                                    )}

                                    <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-lg bg-zinc-950/90 px-3 py-2 text-white">
                                        <p className="flex items-center gap-2 text-[10px] font-black uppercase">
                                            <FiClock /> {pickupRouteBadge}
                                        </p>
                                        {routeState.error && (
                                            <p className="mt-1 max-w-40 text-[10px] font-bold normal-case text-white/75">
                                                {routeState.error}
                                            </p>
                                        )}
                                        {locationMessage && (
                                            <p className="mt-1 max-w-40 text-[10px] font-bold normal-case text-white/75">
                                                {locationMessage}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                className="reservation-panel-card"
                                variants={cardReveal}
                                transition={{ duration: 0.38, ease: "easeOut" }}
                            >
                                <div className="mb-4 flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                                            Destination and parking
                                        </p>
                                        <p className="mt-1 text-xs font-bold text-gray-500">
                                            Enter your destination, then click the finish point on the map.
                                        </p>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${
                                        parkingDecision.canPark
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-amber-50 text-amber-700"
                                    }`}>
                                        {parkingDecision.canPark ? "Allowed" : "Required"}
                                    </span>
                                </div>

                                <label className="block">
                                    <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                                        Destination label
                                    </span>
                                    <input
                                        value={destinationLabel}
                                        onChange={(event) => {
                                            setDestinationLabel(event.target.value);
                                            setReservationError("");
                                        }}
                                        maxLength={200}
                                        placeholder="Example: Fountain Square parking"
                                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-950 outline-none transition focus:border-red-300 focus:bg-white"
                                    />
                                </label>

                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl bg-gray-50 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                                            Car to destination
                                        </p>
                                        <p className="mt-2 text-sm font-black text-gray-950">
                                            {destinationDistanceLabel}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-gray-50 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                                            Parking zone
                                        </p>
                                        <p className="mt-2 truncate text-sm font-black text-gray-950">
                                            {parkingDecision.zone?.name || parkingDecision.status}
                                        </p>
                                    </div>
                                </div>

                                <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs font-bold leading-5 ${
                                    parkingDecision.canPark
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                        : "border-amber-200 bg-amber-50 text-amber-800"
                                }`}>
                                    {parkingZonesError || (destinationPoint ? destinationRouteState.error : "") || parkingDecision.message}
                                </div>
                            </motion.div>

                            <motion.div
                                className="reservation-panel-card"
                                variants={cardReveal}
                                transition={{ duration: 0.38, ease: "easeOut" }}
                            >
                                <div className="mb-4 flex items-end justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                                            Payment method
                                        </p>
                                        <p className="mt-1 text-xs font-bold text-gray-500">
                                            Choose how you want to pay after the ride.
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#E53E3E]">
                                        Secure
                                    </span>
                                </div>

                                <div className="grid gap-3">
                                    {paymentMethods.map((method) => {
                                        const isSelected = selectedPaymentMethod === method.id;

                                        return (
                                            <button
                                                key={method.id}
                                                type="button"
                                                data-active={isSelected}
                                                onClick={() => {
                                                    setSelectedPaymentMethod(method.id);
                                                    setReservationError("");
                                                }}
                                                className="payment-method-option text-left"
                                                aria-pressed={isSelected}
                                            >
                                                <span className="payment-method-option__icon">
                                                    <method.icon className="text-lg" />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-black text-gray-950">
                                                        {method.label}
                                                    </span>
                                                    <span className="block truncate text-xs font-bold text-gray-400">
                                                        {method.detail}
                                                    </span>
                                                </span>
                                                <span className="payment-method-option__radio" aria-hidden="true" />
                                            </button>
                                        );
                                    })}
                                </div>

                                {selectedPaymentMethod === "profile_balance" && (
                                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800">
                                        {profileDebt > 0
                                            ? `Outstanding debt: ${profileDebt.toFixed(2)} AZN. New reservations are blocked until it is paid.`
                                            : "The final ride fare will be charged after the ride photos are approved."}
                                    </div>
                                )}
                            </motion.div>
                        </div>

                        <motion.div
                            className="mt-8 border-t border-gray-100 pt-6"
                            variants={sectionReveal}
                            transition={{ duration: 0.42, ease: "easeOut" }}
                        >
                            <div className="mb-5 flex items-end justify-between gap-4">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                                        Final rate
                                    </p>
                                    <p className="mt-1 text-xs font-bold text-gray-500">
                                        Includes 15 min free walk time.
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-black text-gray-950">
                                        {displayedRate.toFixed(2)}
                                    </span>
                                    <span className="text-xs font-bold text-gray-400"> AZN/min</span>
                                </div>
                            </div>

                            {reservationError && (
                                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                                    <p className="text-xs font-bold text-amber-700">
                                        {reservationError}
                                    </p>
                                </div>
                            )}

                            <button
                                type="button"
                                disabled={isOverCapacity || isCreatingReservation || !hasValidDestination}
                                onClick={handleConfirmReservation}
                                className="btn-12 w-full shadow-xl shadow-red-200 disabled:opacity-50 disabled:shadow-none"
                            >
                                <span>Confirm reservation</span>
                            </button>
                        </motion.div>
                    </div>
                </motion.aside>
            </motion.div>
        </motion.div>
    );
};

export default AdvancedReservationStage;
