import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
  car_types: string[];
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
  setField: <K extends Exclude<keyof WizardState, "setField" | "reset">>(
    k: K, v: WizardState[K]
  ) => void;
  reset: () => void;
};

const initial = {
  train_numbers: [] as string[],
  car_types: [] as string[],
  berth: "any" as Berth,
  autobuy_enabled: false,
  autobuy_friend_ids: [] as number[],
  autobuy_lap_child_ids: [] as number[],
  autobuy_payment_method: null as PayMethod | null,
  autobuy_seat_strategy: "all" as SeatStrategy,
  completed: false,
};

export const useWizard = create<WizardState>()(
  persist(
    set => ({
      ...initial,
      setField: (k, v) => set({ [k]: v } as any),
      reset:    () => set({ ...initial, dep_code: undefined, dep_name: undefined,
                            arr_code: undefined, arr_name: undefined,
                            travel_date: undefined }),
    }),
    {
      name: "td-wizard",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
