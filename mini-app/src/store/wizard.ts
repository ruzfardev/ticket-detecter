import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Subscription } from "@/api/client";

export type Berth = "lower" | "upper" | "any";
export type PayMethod = "hamkorbank" | "payme";
export type SeatStrategy = "all" | "partial";

export type WizardState = {
  dep_code?: string;
  dep_name?: string;
  arr_code?: string;
  arr_name?: string;
  travel_date?: string;     // YYYY-MM-DD
  train_numbers: string[];  // empty = any train
  // An empty list means "any" to the backend, but to the wizard it also means
  // "not chosen yet". These flags record that the user picked "any" on
  // purpose. Without them there is no way to watch a date whose trains are
  // not published yet.
  any_train: boolean;
  car_types: string[];
  any_car_type: boolean;
  berth: Berth;
  // Auto-buy is configured inline on the last step. It lives here rather than
  // in Confirm's local state so a detour to /cards/add doesn't lose it.
  autobuy_enabled: boolean;
  autobuy_friend_ids: number[];
  autobuy_lap_child_ids: number[];
  autobuy_payment_method: PayMethod | null;
  autobuy_seat_strategy: SeatStrategy;
  // Set once the subscription is saved. Every /new/* route self-evicts to Home
  // while this is true, so back-stepping can never land on a finished wizard
  // (which previously let the user save the same subscription twice).
  completed: boolean;
  // Set when the wizard was opened to edit an existing subscription. The
  // backend can't change a subscription's route or filters in place, so
  // saving creates the edited copy and then removes this one (see Confirm).
  editing_sub_id: number | null;
  setField: <K extends Exclude<keyof WizardState, "setField" | "reset" | "loadFromSub">>(
    k: K, v: WizardState[K]
  ) => void;
  reset: () => void;
  /** Fill the wizard with an existing subscription, ready to edit. */
  loadFromSub: (sub: Subscription) => void;
};

const initial = {
  train_numbers: [] as string[],
  any_train: false,
  car_types: [] as string[],
  any_car_type: false,
  berth: "any" as Berth,
  autobuy_enabled: false,
  autobuy_friend_ids: [] as number[],
  autobuy_lap_child_ids: [] as number[],
  autobuy_payment_method: null as PayMethod | null,
  autobuy_seat_strategy: "all" as SeatStrategy,
  completed: false,
  editing_sub_id: null as number | null,
};

const WIZARD_PAY_METHODS: PayMethod[] = ["hamkorbank", "payme"];

export const useWizard = create<WizardState>()(
  persist(
    set => ({
      ...initial,
      setField: (k, v) => set({ [k]: v } as any),
      reset:    () => set({ ...initial, dep_code: undefined, dep_name: undefined,
                            arr_code: undefined, arr_name: undefined,
                            travel_date: undefined }),
      loadFromSub: sub => set({
        ...initial,
        dep_code: sub.dep_code,
        dep_name: sub.dep_name,
        arr_code: sub.arr_code,
        arr_name: sub.arr_name,
        travel_date: sub.travel_date,
        train_numbers: sub.train_numbers,
        // An empty list on a saved subscription was a deliberate "any".
        any_train: sub.train_numbers.length === 0,
        car_types: sub.car_types,
        any_car_type: sub.car_types.length === 0,
        berth: sub.berth,
        autobuy_enabled: sub.autobuy_enabled,
        autobuy_friend_ids:
          sub.autobuy_friend_ids?.length ? sub.autobuy_friend_ids
            : sub.autobuy_friend_id ? [sub.autobuy_friend_id] : [],
        autobuy_lap_child_ids: sub.autobuy_lap_child_ids ?? [],
        autobuy_payment_method: WIZARD_PAY_METHODS.includes(sub.autobuy_payment_method as PayMethod)
          ? (sub.autobuy_payment_method as PayMethod) : null,
        autobuy_seat_strategy: sub.autobuy_seat_strategy ?? "all",
        editing_sub_id: sub.id,
      }),
    }),
    {
      name: "td-wizard",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
