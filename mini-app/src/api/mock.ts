/**
 * Dev mock — returned when VITE_DEV_MOCK=true and Telegram WebApp is absent.
 *
 * Lets you see all screens without backend or real Telegram. State is
 * kept in-memory so creating a subscription updates the list.
 */

import type {
  AutobuyOrder,
  Friend,
  Me,
  PaymentMethod,
  PlansResponse,
  RailwayAccountStatus,
  SavedCard,
  Station,
  Subscription,
  Train,
} from "./client";

let nextId = 100;

let me: Me = {
  user: {
    id: 1,
    tg_user_id: 970956519,
    lang: "uz",
    tier: "free",
    premium_until: null,
  },
  slot: { max: 1, used: 0 },
};

let subscriptions: Subscription[] = [];

let railwayAccount: RailwayAccountStatus = {
  linked: false,
  link_status: null,
  last_sync_at: null,
  last_login_at: null,
  masked_username: null,
  railway_user_id: null,
};

let friends: Friend[] = [];

let savedCard: SavedCard | null = null;
let mockOrders: AutobuyOrder[] = [];

const FAKE_FRIENDS_SEED: Friend[] = [
  {
    id: 1,
    railway_friend_id: "mock-self",
    firstname: "Farrukh",
    lastname: "Ruzmetov",
    midname: null,
    sex: "M",
    birth_day: "1995-03-12",
    doc_type: "ПУ",
    doc_masked: "••••1234",
    citizenship: "UZB",
    region_id: "10",
    is_self: true,
  },
  {
    id: 2,
    railway_friend_id: "mock-friend-1",
    firstname: "Yasmina",
    lastname: "Quvondiqova",
    midname: "Farrux qizi",
    sex: "F",
    birth_day: "2025-05-12",
    doc_type: "СР",
    doc_masked: "••••6191",
    citizenship: "UZB",
    region_id: "03",
    is_self: false,
  },
];

const stations: Station[] = [
  { code: "2900000", name: "Toshkent",        name_uz: "Toshkent",        name_ru: "Ташкент",   city: "Toshkent" },
  { code: "2900001", name: "Toshkent-Pass.",  name_uz: "Toshkent-Pass.",  name_ru: "Ташкент-Пасс.", city: "Toshkent" },
  { code: "2900680", name: "Samarqand",       name_uz: "Samarqand",       name_ru: "Самарканд", city: "Samarqand" },
  { code: "2900700", name: "Buxoro",          name_uz: "Buxoro",          name_ru: "Бухара",    city: "Buxoro" },
  { code: "2900790", name: "Urganch",         name_uz: "Urganch",         name_ru: "Ургенч",    city: "Urganch" },
  { code: "2900800", name: "Xiva",            name_uz: "Xiva",            name_ru: "Хива",      city: "Xorazm" },
  { code: "2900720", name: "Navoiy",          name_uz: "Navoiy",          name_ru: "Навои",     city: "Navoiy" },
  { code: "2900750", name: "Qarshi",          name_uz: "Qarshi",          name_ru: "Карши",     city: "Qashqadaryo" },
  { code: "2900760", name: "Termiz",          name_uz: "Termiz",          name_ru: "Термез",    city: "Surxondaryo" },
  { code: "2900770", name: "Qo'qon",          name_uz: "Qo'qon",          name_ru: "Коканд",    city: "Farg'ona" },
  { code: "2900780", name: "Andijon",         name_uz: "Andijon",         name_ru: "Андижан",   city: "Andijon" },
  { code: "2900730", name: "Nukus",           name_uz: "Nukus",           name_ru: "Нукус",     city: "Qoraqalpog'iston" },
  { code: "2900740", name: "Farg'ona",        name_uz: "Farg'ona",        name_ru: "Фергана",   city: "Farg'ona" },
];

const fakeTrains: Train[] = [
  {
    number: "076Ж", brand: "Yo'lovchi",
    departure: "2026-06-15T16:05:00", arrival: "2026-06-16T05:23:00",
    time_on_way: "13:18",
    dep_station: "Toshkent", arr_station: "Urganch",
    car_types: [
      { type: "плацкарта", free_seats: 24, supports_berth: true },
      { type: "купе",      free_seats: 8,  supports_berth: true },
    ],
    train_id: "fake-076",
  },
  {
    number: "050Ф", brand: "Tezyurar",
    departure: "2026-06-15T21:30:00", arrival: "2026-06-16T09:15:00",
    time_on_way: "11:45",
    dep_station: "Toshkent", arr_station: "Urganch",
    car_types: [
      { type: "купе", free_seats: 4, supports_berth: true },
      { type: "люкс", free_seats: 2, supports_berth: false },
    ],
    train_id: "fake-050",
  },
  {
    number: "112Х", brand: "Yo'lovchi",
    departure: "2026-06-15T08:00:00", arrival: "2026-06-15T22:30:00",
    time_on_way: "14:30",
    dep_station: "Toshkent", arr_station: "Urganch",
    car_types: [
      { type: "плацкарта", free_seats: 0, supports_berth: true },
      { type: "сидячий", free_seats: 12, supports_berth: false },
    ],
    train_id: "fake-112",
  },
];

const plans: PlansResponse = {
  premium: [
    { id: "premium_1d",  days: 1,  stars: 20,  badge: null },
    { id: "premium_3d",  days: 3,  stars: 50,  badge: null },
    { id: "premium_5d",  days: 5,  stars: 80,  badge: null },
    { id: "premium_10d", days: 10, stars: 150, badge: null },
    { id: "premium_30d", days: 30, stars: 350, badge: "💎" },
  ],
  donate: [
    { id: "donate_25",  stars: 25,  emoji: "☕", label: "Kichik rahmat" },
    { id: "donate_50",  stars: 50,  emoji: "🍪", label: "O'rtacha rahmat" },
    { id: "donate_100", stars: 100, emoji: "🍰", label: "Katta rahmat" },
    { id: "donate_500", stars: 500, emoji: "🎁", label: "Generous" },
  ],
  donate_custom_range: { min: 10, max: 5000 },
};

const wait = (ms = 250) => new Promise(r => setTimeout(r, ms));

export const mockApi = {
  isEnabled: import.meta.env.VITE_DEV_MOCK === "true",

  async authTg(): Promise<Me> { await wait(); return me; },
  async getMe(): Promise<Me>  { await wait(150); return me; },
  async updateLang(lang: string): Promise<void> {
    me = { ...me, user: { ...me.user, lang } };
    await wait(150);
  },

  async listStations(q = ""): Promise<Station[]> {
    await wait(200);
    if (!q) return stations;
    const lc = q.toLowerCase();
    return stations.filter(s =>
      s.name_uz.toLowerCase().includes(lc) ||
      s.name_ru.toLowerCase().includes(lc));
  },

  async searchTrains(_body: { dep_code: string; arr_code: string; date: string }): Promise<Train[]> {
    await wait(600);
    return fakeTrains;
  },

  async listSubscriptions(): Promise<{ subscriptions: Subscription[]; slot: { max: number; used: number } }> {
    await wait(150);
    const used = subscriptions.filter(s => s.is_active).length;
    return { subscriptions, slot: { max: me.user.tier === "premium" ? 3 : 1, used } };
  },

  async createSubscription(body: any): Promise<Subscription> {
    await wait(400);
    const used = subscriptions.filter(s => s.is_active).length;
    const max = me.user.tier === "premium" ? 3 : 1;
    if (used >= max) {
      const err: any = new Error("slot_limit_reached");
      err.response = { data: { error: { code: "slot_limit_reached", message: "Slot to'lgan" } } };
      throw err;
    }
    const dep = stations.find(s => s.code === body.dep_code);
    const arr = stations.find(s => s.code === body.arr_code);
    const sub: Subscription = {
      id: ++nextId,
      user_id: 1,
      dep_code: body.dep_code,
      arr_code: body.arr_code,
      dep_name: dep?.name ?? body.dep_code,
      arr_name: arr?.name ?? body.arr_code,
      travel_date: body.travel_date,
      train_numbers: body.train_numbers ?? [],
      car_types: body.car_types,
      berth: body.berth,
      is_active: true,
      muted_until: null,
      created_at: new Date().toISOString(),
      last_notified_at: null,
      notif_count: 0,
      autobuy_enabled: false,
      autobuy_friend_id: null,
      autobuy_friend_name: null,
      autobuy_payment_method: null,
    };
    subscriptions = [...subscriptions, sub];
    return sub;
  },

  async patchSubscription(id: number, body: { is_active?: boolean }): Promise<Subscription> {
    await wait(200);
    subscriptions = subscriptions.map(s =>
      s.id === id ? { ...s, ...(body.is_active !== undefined ? { is_active: body.is_active } : {}) } : s
    );
    return subscriptions.find(s => s.id === id)!;
  },

  async deleteSubscription(id: number): Promise<null> {
    await wait(200);
    subscriptions = subscriptions.filter(s => s.id !== id);
    return null;
  },

  async getPlans(): Promise<PlansResponse> { await wait(120); return plans; },

  async getInvoice(plan: string, amount?: number): Promise<{ invoice_link: string; type: string; plan: string; stars_amount: number }> {
    await wait(300);
    let stars = 0;
    let type: "premium" | "donate" = "donate";
    const pp = plans.premium.find(p => p.id === plan);
    if (pp) { stars = pp.stars; type = "premium"; }
    else {
      const dp = plans.donate.find(d => d.id === plan);
      if (dp) stars = dp.stars;
      else if (plan === "donate_custom" && amount) stars = amount;
    }
    // Simulate "paid" outcome after a short delay for dev
    setTimeout(() => {
      if (type === "premium" && pp) {
        const until = new Date();
        until.setDate(until.getDate() + pp.days);
        me = { ...me, user: { ...me.user, tier: "premium", premium_until: until.toISOString() }, slot: { max: 3, used: me.slot.used } };
      }
    }, 1500);
    return { invoice_link: "https://example.com/fake-invoice", type, plan, stars_amount: stars };
  },

  // ---- Railway account & hamrohlar ----

  async getRailwayStatus(): Promise<RailwayAccountStatus> {
    await wait(120);
    return railwayAccount;
  },

  async linkRailway(username: string, _password: string): Promise<RailwayAccountStatus> {
    await wait(500);
    railwayAccount = {
      linked: true,
      link_status: "active",
      last_sync_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      masked_username:
        username.includes("@")
          ? username[0] + "••••@" + username.split("@")[1]
          : username.slice(0, 5) + "••" + username.slice(-2),
      railway_user_id: "mock-user-id",
    };
    friends = [...FAKE_FRIENDS_SEED];
    return railwayAccount;
  },

  async unlinkRailway(): Promise<RailwayAccountStatus> {
    await wait(200);
    railwayAccount = {
      linked: false, link_status: null,
      last_sync_at: null, last_login_at: null,
      masked_username: null, railway_user_id: null,
    };
    friends = [];
    subscriptions = subscriptions.map(s => ({
      ...s,
      autobuy_enabled: false,
      autobuy_friend_id: null,
      autobuy_friend_name: null,
      autobuy_payment_method: null,
    }));
    return railwayAccount;
  },

  async getFriends(): Promise<Friend[]> {
    await wait(150);
    return friends;
  },

  async syncFriends(): Promise<Friend[]> {
    await wait(400);
    railwayAccount = { ...railwayAccount, last_sync_at: new Date().toISOString() };
    return friends;
  },

  async patchAutobuy(
    id: number,
    body: { enabled: boolean; friend_ids?: number[] | null; payment_method?: PaymentMethod | null },
  ): Promise<Subscription> {
    await wait(200);
    const ids = body.enabled ? (body.friend_ids ?? []) : [];
    const picked = ids
      .map(fid => friends.find(f => f.id === fid))
      .filter((f): f is NonNullable<typeof f> => !!f);
    subscriptions = subscriptions.map(s => {
      if (s.id !== id) return s;
      return {
        ...s,
        autobuy_enabled: body.enabled,
        autobuy_friend_id: ids[0] ?? null,
        autobuy_friend_name: picked[0]
          ? `${picked[0].firstname} ${picked[0].lastname}`.trim()
          : null,
        autobuy_friend_ids: ids.length ? ids : null,
        autobuy_friend_names: picked.length
          ? picked.map(f => `${f.firstname} ${f.lastname}`.trim())
          : null,
        autobuy_payment_method: body.enabled ? body.payment_method ?? null : null,
      };
    });
    return subscriptions.find(s => s.id === id)!;
  },

  // ---- Cards (Phase C) ----
  async getCard(): Promise<SavedCard | null> { await wait(120); return savedCard; },
  async saveCard(body: { pan: string; exp_mmyy: string; holder_name?: string | null }): Promise<SavedCard> {
    await wait(300);
    const pan = body.pan.replace(/\D/g, "");
    savedCard = {
      id: 1,
      last4: pan.slice(-4),
      holder_name: body.holder_name ?? null,
      created_at: new Date().toISOString(),
      last_used_at: null,
    };
    return savedCard;
  },
  async deleteCard(): Promise<null> { await wait(150); savedCard = null; return null; },

  // ---- Orders (Phase B+C) ----
  async listOrders(): Promise<AutobuyOrder[]> { await wait(150); return mockOrders; },
  async getOrder(id: number): Promise<AutobuyOrder> {
    await wait(120);
    const o = mockOrders.find(x => x.id === id);
    if (!o) throw new Error("order not found");
    return { ...o, seconds_until_expiry: Math.max(0, (o.seconds_until_expiry ?? 600) - 1) };
  },
  async submitOrderOtp(id: number, _otp: string): Promise<AutobuyOrder> {
    await wait(400);
    mockOrders = mockOrders.map(o => o.id === id ? { ...o, status: "paid" } : o);
    return mockOrders.find(o => o.id === id)!;
  },
  async resendOrderOtp(_id: number): Promise<null> { await wait(200); return null; },
  async cancelOrder(id: number): Promise<AutobuyOrder> {
    await wait(200);
    mockOrders = mockOrders.map(o => o.id === id ? { ...o, status: "cancelled" } : o);
    return mockOrders.find(o => o.id === id)!;
  },
};
