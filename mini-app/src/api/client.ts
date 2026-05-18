import axios from "axios";

const initData = window.Telegram?.WebApp?.initData ?? "";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: {
    "Content-Type": "application/json",
    "X-Tg-Init-Data": initData,
  },
});

api.interceptors.response.use(
  r => r,
  err => {
    const status = err.response?.status;
    if (status === 401) {
      // Session is dead — only initData can recover; ask user to reopen.
      window.Telegram?.WebApp?.showAlert?.(
        "Sessiya tugagan. Mini App ni qaytadan oching.",
        () => window.Telegram?.WebApp?.close?.(),
      );
    }
    return Promise.reject(err);
  },
);

// ---- Types ----

export type Me = {
  user: {
    id: number;
    tg_user_id: number;
    lang: string;
    tier: "free" | "premium";
    premium_until: string | null;
  };
  slot: { max: number; used: number };
};

export type Station = {
  code: string;
  name: string;
  name_uz: string;
  name_ru: string;
  city: string | null;
};

export type TrainCarType = {
  type: string;
  free_seats: number;
  supports_berth: boolean;
};

export type Train = {
  number: string;
  brand: string;
  departure: string;
  arrival: string;
  time_on_way: string;
  dep_station: string;
  arr_station: string;
  car_types: TrainCarType[];
  train_id: string | null;
};

export type Subscription = {
  id: number;
  user_id: number;
  dep_code: string;
  arr_code: string;
  dep_name: string;
  arr_name: string;
  travel_date: string;
  train_number: string | null;
  car_types: string[];
  berth: "lower" | "upper" | "any";
  is_active: boolean;
  muted_until: string | null;
  created_at: string;
  last_notified_at: string | null;
  notif_count: number;
};

export type PlansResponse = {
  premium: { id: string; days: number; stars: number; badge: string | null }[];
  donate: { id: string; stars: number; emoji: string; label: string }[];
  donate_custom_range: { min: number; max: number };
};

// ---- Endpoints ----

export const authTg     = () => api.post<Me>("/api/v1/auth/tg").then(r => r.data);
export const getMe      = () => api.get<Me>("/api/v1/me").then(r => r.data);
export const updateLang = (lang: string) => api.patch("/api/v1/me", { lang }).then(r => r.data);

export const listStations = (q = "", lang = "uz") =>
  api.get<{ stations: Station[] }>("/api/v1/stations", { params: { q, lang } })
    .then(r => r.data.stations);

export const searchTrains = (body: { dep_code: string; arr_code: string; date: string }) =>
  api.post<{ trains: Train[] }>("/api/v1/trains/search", body).then(r => r.data.trains);

export const listSubscriptions = () =>
  api.get<{ subscriptions: Subscription[]; slot: { max: number; used: number } }>(
    "/api/v1/subscriptions"
  ).then(r => r.data);

export const createSubscription = (body: {
  dep_code: string; arr_code: string; travel_date: string;
  train_number?: string | null;
  car_types: string[]; berth: "lower" | "upper" | "any";
}) => api.post<{ subscription: Subscription }>("/api/v1/subscriptions", body)
        .then(r => r.data.subscription);

export const patchSubscription = (id: number, body: { is_active?: boolean }) =>
  api.patch<{ subscription: Subscription }>(`/api/v1/subscriptions/${id}`, body)
    .then(r => r.data.subscription);

export const deleteSubscription = (id: number) =>
  api.delete(`/api/v1/subscriptions/${id}`).then(() => null);

export const getPlans   = () => api.get<PlansResponse>("/api/v1/payments/plans").then(r => r.data);
export const getInvoice = (plan: string, amount?: number) =>
  api.get<{ invoice_link: string; type: string; plan: string; stars_amount: number }>(
    "/api/v1/payments/invoice",
    { params: { plan, amount } },
  ).then(r => r.data);
