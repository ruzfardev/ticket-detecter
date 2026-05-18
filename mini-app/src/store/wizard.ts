import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Berth = "lower" | "upper" | "any";

export type WizardState = {
  dep_code?: string;
  dep_name?: string;
  arr_code?: string;
  arr_name?: string;
  travel_date?: string;     // YYYY-MM-DD
  train_number?: string;
  train_brand?: string;
  car_types: string[];
  berth: Berth;
  setField: <K extends Exclude<keyof WizardState, "setField" | "reset">>(
    k: K, v: WizardState[K]
  ) => void;
  reset: () => void;
};

const initial = {
  car_types: [] as string[],
  berth: "any" as Berth,
};

export const useWizard = create<WizardState>()(
  persist(
    set => ({
      ...initial,
      setField: (k, v) => set({ [k]: v } as any),
      reset:    () => set({ ...initial, dep_code: undefined, dep_name: undefined,
                            arr_code: undefined, arr_name: undefined,
                            travel_date: undefined, train_number: undefined,
                            train_brand: undefined }),
    }),
    {
      name: "td-wizard",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
