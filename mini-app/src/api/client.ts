import axios from "axios";
import { mockApi } from "./mock";

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
    if (status === 401 && !mockApi.isEnabled) {
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

export type PaymentMethod = "payme" | "click" | "hamkorbank" | "kapitalbank";

export type Subscription = {
  id: number;
  user_id: number;
  dep_code: string;
  arr_code: string;
  dep_name: string;
  arr_name: string;
  travel_date: string;
  train_numbers: string[];
  car_types: string[];
  berth: "lower" | "upper" | "any";
  is_active: boolean;
  muted_until: string | null;
  created_at: string;
  last_notified_at: string | null;
  notif_count: number;
  autobuy_enabled: boolean;
  autobuy_friend_id: number | null;
  autobuy_friend_name: string | null;
  autobuy_payment_method: PaymentMethod | null;
};

export type RailwayAccountStatus = {
  linked: boolean;
  link_status: "active" | "login_failed" | "revoked" | null;
  last_sync_at: string | null;
  last_login_at: string | null;
  masked_username: string | null;
  railway_user_id: string | null;
};

export type Friend = {
  id: number;
  railway_friend_id: string;
  firstname: string;
  lastname: string;
  midname: string | null;
  sex: "M" | "F" | null;
  birth_day: string;            // yyyy-mm-dd
  doc_type: string | null;
  doc_masked: string | null;
  citizenship: string | null;
  region_id: string | null;
  is_self: boolean;
};

export type SavedCard = {
  id: number;
  last4: string;
  holder_name: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type AutobuyOrderStatus =
  | "reserving"
  | "awaiting_otp"
  | "paying"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";

export type AutobuyOrder = {
  id: number;
  subscription_id: number;
  user_id: number;
  railway_friend_cache_id: number | null;
  railway_order_id: string | null;
  payment_type: string | null;
  train_number: string;
  car_number: string;
  seat_number: number;
  dep_code: string;
  arr_code: string;
  travel_date: string;
  amount_uzs: number | null;
  status: AutobuyOrderStatus;
  failure_reason: string | null;
  hold_until: string | null;
  trigger_source: "auto" | "manual";
  created_at: string;
  updated_at: string;
  friend_name: string | null;
  last4: string | null;
  seconds_until_expiry: number | null;
};

export type PlansResponse = {
  premium: { id: string; days: number; stars: number; badge: string | null }[];
  donate: { id: string; stars: number; emoji: string; label: string }[];
  donate_custom_range: { min: number; max: number };
};

// ---- Endpoints (mocked when VITE_DEV_MOCK=true) ----

export const authTg = () =>
  mockApi.isEnabled
    ? mockApi.authTg()
    : api.post<Me>("/api/v1/auth/tg").then(r => r.data);

export const getMe = () =>
  mockApi.isEnabled
    ? mockApi.getMe()
    : api.get<Me>("/api/v1/me").then(r => r.data);

export const updateLang = (lang: string) =>
  mockApi.isEnabled
    ? mockApi.updateLang(lang)
    : api.patch("/api/v1/me", { lang }).then(r => r.data);

export const listStations = (q = "", lang = "uz") =>
  mockApi.isEnabled
    ? mockApi.listStations(q)
    : api.get<{ stations: Station[] }>("/api/v1/stations", { params: { q, lang } })
        .then(r => r.data.stations);

export const searchTrains = (body: { dep_code: string; arr_code: string; date: string }) =>
  mockApi.isEnabled
    ? mockApi.searchTrains(body)
    : api.post<{ trains: Train[] }>("/api/v1/trains/search", body).then(r => r.data.trains);

export const listSubscriptions = () =>
  mockApi.isEnabled
    ? mockApi.listSubscriptions()
    : api.get<{ subscriptions: Subscription[]; slot: { max: number; used: number } }>(
        "/api/v1/subscriptions"
      ).then(r => r.data);

export const createSubscription = (body: {
  dep_code: string; arr_code: string; travel_date: string;
  train_numbers: string[];
  car_types: string[]; berth: "lower" | "upper" | "any";
}) =>
  mockApi.isEnabled
    ? mockApi.createSubscription(body)
    : api.post<{ subscription: Subscription }>("/api/v1/subscriptions", body)
        .then(r => r.data.subscription);

export const patchSubscription = (id: number, body: { is_active?: boolean }) =>
  mockApi.isEnabled
    ? mockApi.patchSubscription(id, body)
    : api.patch<{ subscription: Subscription }>(`/api/v1/subscriptions/${id}`, body)
        .then(r => r.data.subscription);

export const deleteSubscription = (id: number) =>
  mockApi.isEnabled
    ? mockApi.deleteSubscription(id)
    : api.delete(`/api/v1/subscriptions/${id}`).then(() => null);

export const getPlans = () =>
  mockApi.isEnabled
    ? mockApi.getPlans()
    : api.get<PlansResponse>("/api/v1/payments/plans").then(r => r.data);

export const getInvoice = (plan: string, amount?: number) =>
  mockApi.isEnabled
    ? mockApi.getInvoice(plan, amount)
    : api.get<{ invoice_link: string; type: string; plan: string; stars_amount: number }>(
        "/api/v1/payments/invoice",
        { params: { plan, amount } },
      ).then(r => r.data);

// ---- Railway account & hamrohlar (Phase A) ----

export const getRailwayStatus = () =>
  mockApi.isEnabled
    ? mockApi.getRailwayStatus()
    : api.get<{ account: RailwayAccountStatus }>("/api/v1/railway-account/status")
        .then(r => r.data.account);

export const linkRailway = (username: string, password: string) =>
  mockApi.isEnabled
    ? mockApi.linkRailway(username, password)
    : api.post<{ account: RailwayAccountStatus }>(
        "/api/v1/railway-account/link",
        { username, password },
      ).then(r => r.data.account);

export const unlinkRailway = () =>
  mockApi.isEnabled
    ? mockApi.unlinkRailway()
    : api.post<{ account: RailwayAccountStatus }>("/api/v1/railway-account/unlink")
        .then(r => r.data.account);

export const getFriends = () =>
  mockApi.isEnabled
    ? mockApi.getFriends()
    : api.get<{ friends: Friend[] }>("/api/v1/friends").then(r => r.data.friends);

export const syncFriends = () =>
  mockApi.isEnabled
    ? mockApi.syncFriends()
    : api.post<{ friends: Friend[] }>("/api/v1/friends/sync").then(r => r.data.friends);

export const patchAutobuy = (
  subId: number,
  body: { enabled: boolean; friend_id?: number | null; payment_method?: PaymentMethod | null },
) =>
  mockApi.isEnabled
    ? mockApi.patchAutobuy(subId, body)
    : api
        .patch<{ subscription: Subscription }>(
          `/api/v1/subscriptions/${subId}/autobuy`,
          body,
        )
        .then(r => r.data.subscription);

// ---- Cards (Phase C) ----

export const getCard = () =>
  mockApi.isEnabled
    ? mockApi.getCard()
    : api.get<{ card: SavedCard | null }>("/api/v1/cards").then(r => r.data.card);

export const saveCard = (body: { pan: string; exp_mmyy: string; holder_name?: string | null }) =>
  mockApi.isEnabled
    ? mockApi.saveCard(body)
    : api.post<{ card: SavedCard }>("/api/v1/cards", body).then(r => r.data.card);

export const deleteCard = () =>
  mockApi.isEnabled
    ? mockApi.deleteCard()
    : api.delete("/api/v1/cards").then(() => null);

// ---- Orders (Phase B+C) ----

export const listOrders = () =>
  mockApi.isEnabled
    ? mockApi.listOrders()
    : api.get<{ orders: AutobuyOrder[] }>("/api/v1/orders").then(r => r.data.orders);

export const getOrder = (id: number) =>
  mockApi.isEnabled
    ? mockApi.getOrder(id)
    : api.get<{ order: AutobuyOrder }>(`/api/v1/orders/${id}`).then(r => r.data.order);

export const submitOrderOtp = (id: number, otp: string) =>
  mockApi.isEnabled
    ? mockApi.submitOrderOtp(id, otp)
    : api.post<{ order: AutobuyOrder }>(`/api/v1/orders/${id}/otp`, { otp })
        .then(r => r.data.order);

export const resendOrderOtp = (id: number) =>
  mockApi.isEnabled
    ? mockApi.resendOrderOtp(id)
    : api.post(`/api/v1/orders/${id}/resend-otp`).then(() => null);

export const cancelOrder = (id: number) =>
  mockApi.isEnabled
    ? mockApi.cancelOrder(id)
    : api.post<{ order: AutobuyOrder }>(`/api/v1/orders/${id}/cancel`)
        .then(r => r.data.order);
