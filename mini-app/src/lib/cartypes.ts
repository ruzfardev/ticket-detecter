/**
 * Car types are stored canonically (Cyrillic, matching the backend) but shown
 * to users in the same Uzbek wording eticket itself uses — "Plaskartli", not
 * "плацкарта". Without this the picker showed eticket's label while the confirm
 * screen showed the raw canonical value, for the same choice.
 */
const LABELS: Record<string, string> = {
  "плацкарта": "Plaskartli",
  "купе": "Kupe",
  "люкс": "Lyuks",
  "св": "SV",
  "сидячий": "O'rindiqli",
  "общий": "Umumiy",
  "эконом": "Ekonom",
  "бизнес": "Biznes",
};

export function carTypeLabel(canonical: string): string {
  return LABELS[canonical] ?? canonical;
}

export function carTypeLabels(canonical: string[]): string {
  return canonical.map(carTypeLabel).join(", ");
}
