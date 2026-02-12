export type KeetaKmBand = "UP_TO_2" | "FROM_2_TO_4" | "ABOVE_4";

export const KEETA_KM_AVG: Record<KeetaKmBand, number> = {
  UP_TO_2: 1.5,
  FROM_2_TO_4: 3.0,
  ABOVE_4: 5.0,
};

export const KEETA_COST_PER_KM_BY_BAND: Record<KeetaKmBand, number> = {
  UP_TO_2: 0.5,
  FROM_2_TO_4: 0.5,
  ABOVE_4: 0.5,
};

export function getKeetaDeliveryFeeByAvgKm(band: KeetaKmBand) {
  const kmAvg = KEETA_KM_AVG[band] ?? 0;
  const costPerKm = KEETA_COST_PER_KM_BY_BAND[band] ?? 0;
  const fee = kmAvg * costPerKm;
  return Math.round(fee * 100) / 100;
}
