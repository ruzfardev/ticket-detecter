import { useWizard, WizardState } from "@/store/wizard";

type Field = Exclude<keyof WizardState, "setField" | "reset">;

export function useWizardField<K extends Field>(key: K): WizardState[K] {
  return useWizard(s => s[key]);
}
