import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWizard, WizardState } from "@/store/wizard";

type RequiredField = Exclude<keyof WizardState, "setField" | "reset" | "loadFromSub">;

export function useWizardGuard(required: RequiredField[], redirectTo = "/new") {
  const navigate = useNavigate();
  const state = useWizard();

  useEffect(() => {
    // A finished wizard must never be reachable again. Its state is persisted
    // in sessionStorage, so without this a back-step would render a fully
    // populated Confirm screen and let the same subscription be saved twice.
    if (state.completed) {
      navigate("/home", { replace: true });
      return;
    }
    const missing = required.some(k => {
      // An empty list is a valid answer once the user chose "any" for it.
      if (k === "train_numbers" && state.any_train) return false;
      if (k === "car_types" && state.any_car_type) return false;
      const v = state[k];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === "";
    });
    if (missing) navigate(redirectTo, { replace: true });
  }, [required, redirectTo, navigate, state]);
}
