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
  PurchasedTicket,
  Subscription,
  TicketDetail,
  Train,
} from "./client";

let nextId = 100;

let me: Me = {
  user: {
    id: 1,
    tg_user_id: 970956519,
    lang: "uz",
    tier: "premium",
    premium_until: "2026-12-31T00:00:00Z",
  },
  slot: { max: 3, used: 2 },
  watcher: { interval_s: 10 },
};

// Demo seed so Home renders a realistic state in mock mode.
let subscriptions: Subscription[] = [
  {
    id: 1, user_id: 1, dep_code: "2900000", arr_code: "2900700",
    dep_name: "Toshkent", arr_name: "Samarqand", travel_date: "2026-09-30",
    train_numbers: ["126Ф"], car_types: ["плацкарта"], berth: "any",
    is_active: true, muted_until: null, created_at: new Date().toISOString(),
    last_notified_at: null, notif_count: 3,
    autobuy_enabled: true, autobuy_friend_id: 1, autobuy_friend_name: "Farrux",
    autobuy_payment_method: "hamkorbank", autobuy_seat_strategy: "all",
  },
  {
    id: 2, user_id: 1, dep_code: "2900000", arr_code: "2900800",
    dep_name: "Toshkent", arr_name: "Buxoro", travel_date: "2026-10-03",
    train_numbers: [], car_types: ["купе"], berth: "lower",
    is_active: true, muted_until: null, created_at: new Date().toISOString(),
    last_notified_at: null, notif_count: 0,
    autobuy_enabled: false, autobuy_friend_id: null, autobuy_friend_name: null,
    autobuy_payment_method: null,
  },
  {
    id: 3, user_id: 1, dep_code: "2900700", arr_code: "2900000",
    dep_name: "Samarqand", arr_name: "Toshkent", travel_date: "2026-10-12",
    train_numbers: ["127Ф"], car_types: ["плацкарта"], berth: "any",
    is_active: false, muted_until: null, created_at: new Date().toISOString(),
    last_notified_at: null, notif_count: 1,
    autobuy_enabled: false, autobuy_friend_id: null, autobuy_friend_name: null,
    autobuy_payment_method: null,
  },
];

let railwayAccount: RailwayAccountStatus = {
  linked: true,
  link_status: "active",
  last_sync_at: new Date().toISOString(),
  last_login_at: new Date().toISOString(),
  masked_username: "fa***@gmail.com",
  railway_user_id: "mock-user",
};

let friends: Friend[] = [];

let savedCard: SavedCard | null = null;
// One live OTP order so Home's banner and Orders render in mock mode.
let mockOrders: AutobuyOrder[] = [
  {
    id: 62, subscription_id: 1, user_id: 1, railway_friend_cache_id: 1,
    railway_order_id: "UX780C4TSZ8JTK", payment_type: "HamkorbankHold",
    train_number: "126Ф", car_number: "7", seat_number: 12, seat_numbers: [12],
    passenger_names: ["Farrukh Ruzmetov"],
    dep_code: "2900000", arr_code: "2900700", travel_date: "2026-09-30", amount_uzs: 245140,
    status: "awaiting_otp", failure_reason: null,
    hold_until: new Date(Date.now() + 9 * 60_000).toISOString(),
    trigger_source: "auto", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    friend_name: "Farrukh Ruzmetov", last4: "1234", seconds_until_expiry: 9 * 60 + 41,
  },
];

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

// NB: railway.uz sends "DD.MM.YYYY HH:MM" (naive Tashkent wall clock), NOT ISO.
// The mock used ISO for a long time, which is precisely why a formatter that
// only understood ISO looked fine in dev and printed raw date strings in prod.
const fakeTrains: Train[] = [
  {
    number: "076Ж", brand: "Yo'lovchi",
    departure: "15.06.2026 16:05", arrival: "16.06.2026 05:23",
    time_on_way: "13:18",
    dep_station: "TOSHKENT", arr_station: "URGANCH",
    car_types: [
      { type: "плацкарта", label: "Plaskartli", free_seats: 24, price_uzs: 177990, supports_berth: true },
      { type: "купе",      label: "Kupe",       free_seats: 8,  price_uzs: 243750, supports_berth: true },
    ],
    train_id: "fake-076",
  },
  {
    number: "050Ф", brand: "Tezyurar",
    departure: "15.06.2026 21:30", arrival: "16.06.2026 09:15",
    time_on_way: "11:45",
    dep_station: "TOSHKENT", arr_station: "URGANCH",
    car_types: [
      { type: "купе", label: "Kupe", free_seats: 4, price_uzs: 243750, supports_berth: true },
      { type: "люкс", label: "Lyuks", free_seats: 2, price_uzs: 509000, supports_berth: false },
    ],
    train_id: "fake-050",
  },
  {
    number: "112Х", brand: "Yo'lovchi",
    departure: "15.06.2026 08:00", arrival: "15.06.2026 22:30",
    time_on_way: "14:30",
    dep_station: "TOSHKENT", arr_station: "URGANCH",
    car_types: [
      { type: "плацкарта", label: "Plaskartli", free_seats: 0, price_uzs: 177990, supports_berth: true },
      { type: "сидячий", label: "O'rindiqli", free_seats: 12, price_uzs: 98000, supports_berth: false },
    ],
    train_id: "fake-112",
  },
  // A train whose tickets are not on sale yet — eticket returns no cars at all
  // and 204 from the detail endpoint. Exercises the "sotuvda yo'q" group.
  {
    number: "772Ф", brand: "Afrosiyob",
    departure: "15.06.2026 19:48", arrival: "16.06.2026 00:01",
    time_on_way: "04:13",
    dep_station: "TOSHKENT", arr_station: "URGANCH",
    car_types: [],
    train_id: null,
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
  /** eticket's active list — upcoming travel only. A returned ticket stays
   *  in it until the travel date, so one is here on purpose. */
  async listTickets(): Promise<PurchasedTicket[]> {
    await wait(400);
    return [
      {
        order_id: "UX780BGW7B851Q",
        order_item_id: "ItemId-fake-1",
        created_at: "2026-08-20 11:47:55",
        final_status: "ORDER_COMPLETED_SUCCESSFULLY",
        amount_uzs: 150090,
        train_number: "095ФА", car_number: "07", car_type: "ПЛАЦ",
        dep_station: "АНДИЖОН 1", arr_station: "ТОШКЕНТ-ЙУЛОВЧИ",
        dep_at: "2026-10-15 17:20:00", arr_at: "2026-10-16 00:27:00",
        seats: ["001"],
        qr_url: "https://eticket.railway.uz/pages/check-ticket?expressId=fake",
        archived: false, status_known: true, returned: true,
        tickets: [{ ticket_id: "77215198319906", seat: "001",
                    status: "ReturnedTicket", passenger_name: "Farrux Rozmetov" }],
      },
      {
        order_id: "UX780CMQ2W9K1D",
        order_item_id: "ItemId-fake-6",
        created_at: "2026-09-02 09:05:12",
        final_status: "ORDER_COMPLETED_SUCCESSFULLY",
        amount_uzs: 175000,
        train_number: "010Ф", car_number: "04", car_type: "КУПЕ",
        dep_station: "ТОШКЕНТ-ЙУЛОВЧИ", arr_station: "БУХОРО",
        dep_at: "2026-11-02 08:10:00", arr_at: "2026-11-02 12:15:00",
        seats: ["021"],
        qr_url: null,
        archived: false, status_known: true, returned: false,
        tickets: [{ ticket_id: "77215198420001", seat: "021",
                    status: "ConfirmedTicket", passenger_name: "Farrux Rozmetov" }],
      },
    ];
  },

  /** eticket's archive is keyed by the month a ticket was BOUGHT (a 1 Sep trip
   *  ordered on 20 Aug sits in 2026-08); mirror that so the past tab behaves
   *  in the browser the way it does in production. */
  async listArchivedTickets(month: string): Promise<PurchasedTicket[]> {
    await wait(400);
    const leg = (
      t: Omit<PurchasedTicket, "archived" | "status_known" | "returned" | "tickets"
        | "final_status" | "qr_url">,
      status: "ConfirmedTicket" | "ReturnedTicket",
    ): PurchasedTicket => ({
      ...t,
      final_status: "ORDER_COMPLETED_SUCCESSFULLY",
      qr_url: null,
      archived: true,
      status_known: true,
      returned: status === "ReturnedTicket",
      tickets: [{ ticket_id: `7${t.order_item_id.slice(-6)}`, seat: t.seats[0],
                  status, passenger_name: "Farrux Rozmetov" }],
    });
    if (month === "2026-08") {
      return [
        leg({
          order_id: "UX780ALE65Q3RW", order_item_id: "ItemId-fake-2",
          created_at: "2026-08-18 17:56:47", amount_uzs: 245140,
          train_number: "056ЧА", car_number: "11", car_type: "ПЛАЦ",
          dep_station: "ТОШКЕНТ ЖАНУБИЙ", arr_station: "УРГАНЧ",
          dep_at: "2026-08-28 21:45:00", arr_at: "2026-08-29 11:24:00",
          seats: ["047"],
        }, "ConfirmedTicket"),
        leg({
          order_id: "UX780AKEH35ARL", order_item_id: "ItemId-fake-3",
          created_at: "2026-08-18 16:37:45", amount_uzs: 245140,
          train_number: "056ЧА", car_number: "11", car_type: "ПЛАЦ",
          dep_station: "ТОШКЕНТ ЖАНУБИЙ", arr_station: "УРГАНЧ",
          dep_at: "2026-08-28 21:45:00", arr_at: "2026-08-29 11:24:00",
          seats: ["043"],
        }, "ConfirmedTicket"),
        leg({
          order_id: "UX780AGT11ZZ0P", order_item_id: "ItemId-fake-4",
          created_at: "2026-08-20 16:40:53", amount_uzs: 312000,
          train_number: "060Ф", car_number: "09", car_type: "ПЛАЦ",
          dep_station: "ТОШКЕНТ ЖАНУБИЙ", arr_station: "НУКУС",
          dep_at: "2026-09-01 16:15:00", arr_at: "2026-09-02 05:23:00",
          seats: ["037"],
        }, "ReturnedTicket"),
        leg({
          order_id: "UX780AHV72QQ4M", order_item_id: "ItemId-fake-7",
          created_at: "2026-08-21 19:48:41", amount_uzs: 312000,
          train_number: "060Ф", car_number: "09", car_type: "ПЛАЦ",
          dep_station: "ТОШКЕНТ ЖАНУБИЙ", arr_station: "НУКУС",
          dep_at: "2026-09-01 16:15:00", arr_at: "2026-09-02 05:23:00",
          seats: ["038"],
        }, "ConfirmedTicket"),
      ];
    }
    if (month === "2026-07") {
      return [
        leg({
          order_id: "UX780ADQ88M1TC", order_item_id: "ItemId-fake-5",
          created_at: "2026-07-22 16:36:08", amount_uzs: 98000,
          train_number: "761Ф", car_number: "03", car_type: "СИД",
          dep_station: "САМАРКАНД", arr_station: "ТОШКЕНТ-ЙУЛОВЧИ",
          dep_at: "2026-07-24 19:20:00", arr_at: "2026-07-24 21:30:00",
          seats: ["044"],
        }, "ConfirmedTicket"),
      ];
    }
    return [];
  },

  async getTicketDetail(): Promise<TicketDetail> {
    await wait(300);
    return {
      tickets: [
        { ticket_id: "77215198319906", status: "SoldTicket", seat_number: "001",
          amount_uzs: 150090, passenger_name: "Farrux Rozmetov" },
      ],
      return_available_until: "2026-10-15T11:20:00Z",
    };
  },
};
