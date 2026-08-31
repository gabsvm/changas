export type LeakageSignalType =
  | "PHONE"
  | "EMAIL"
  | "PAYMENT_HANDLE"
  | "EXTERNAL_CONTACT_REQUEST";

export type LeakageSignal = {
  type: LeakageSignalType;
  matchedText: string;
};

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const explicitInternationalPhonePattern = /(?:^|\s)(\+\d{1,3}[\s().-]*(?:\d[\s().-]*){8,14}\d)(?=\s|$|[,.!?])/g;
const cbuCvuPattern = /\b(?:cbu|cvu)\s*(?:es|:|-)?\s*(\d{22})\b/gi;
const paymentAliasPattern = /\b(?:alias|mercado\s*pago|transferime|pagame\s+por|p[aá]game\s+por)\b[^\n]{0,80}/gi;
const externalContactPattern = /\b(?:te\s+paso\s+mi\s+(?:whatsapp|wsp|telegram)|mandame\s+(?:un\s+)?mensaje\s+por\s+(?:whatsapp|wsp|telegram)|escribime\s+por\s+(?:whatsapp|wsp|telegram)|hablemos\s+por\s+(?:whatsapp|wsp|telegram))\b/gi;

function collect(
  text: string,
  pattern: RegExp,
  type: LeakageSignalType,
  signals: LeakageSignal[],
  captureGroup = 0,
): void {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const matchedText = (match[captureGroup] ?? match[0]).trim();
    if (!matchedText) continue;
    signals.push({ type, matchedText });
  }
}

export function detectContactLeakage(text: string): LeakageSignal[] {
  const normalized = text.normalize("NFKC");
  const signals: LeakageSignal[] = [];

  collect(normalized, emailPattern, "EMAIL", signals);
  collect(normalized, explicitInternationalPhonePattern, "PHONE", signals, 1);
  collect(normalized, cbuCvuPattern, "PAYMENT_HANDLE", signals);
  collect(normalized, paymentAliasPattern, "PAYMENT_HANDLE", signals);
  collect(
    normalized,
    externalContactPattern,
    "EXTERNAL_CONTACT_REQUEST",
    signals,
  );

  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.type}:${signal.matchedText.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
