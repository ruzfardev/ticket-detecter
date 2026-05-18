import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWizard, WizardState } from "@/store/wizard";

type RequiredField = Exclude<keyof WizardState, "setField" | "reset">;

export function useWizardGuard(required: RequiredField[], redirectTo = "/new") {
  const navigate = useNavigate();
  const state = useWizard();

  useEffect(() => {
    const missing = required.some(k => {
      const v = state[k];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === "";
    });
    if (missing) navigate(redirectTo, { replace: true });
  }, [required, redirectTo, navigate, state]);
}
