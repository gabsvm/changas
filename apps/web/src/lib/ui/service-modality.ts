const serviceModalityLabels: Record<string, string> = {
  IN_PERSON: "Presencial",
  REMOTE: "Remoto",
  BOTH: "Presencial o remoto",
};

export function getServiceModalityLabel(modality: string): string {
  return serviceModalityLabels[modality] ?? "Modalidad a coordinar";
}
