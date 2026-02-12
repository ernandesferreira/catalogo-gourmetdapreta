import type { PlatformFeeConfig } from "@/lib/platformFees";

function roundToEnd(value: number, cents: 90 | 99) {
  const inteiro = Math.floor(value);
  const final = inteiro + cents / 100;
  return final >= value ? final : inteiro + 1 + cents / 100;
}

export function calcPlatformPrice(basePrice: number, cfg: PlatformFeeConfig) {
  if (cfg.percentTotal >= 1) return basePrice;
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;

  const gross = (basePrice + cfg.fixedFee) / (1 - cfg.percentTotal);

  let rounded = gross;
  switch (cfg.rounding) {
    case "END_90":
      rounded = roundToEnd(gross, 90);
      break;
    case "END_99":
      rounded = roundToEnd(gross, 99);
      break;
    case "NONE":
    default:
      rounded = Math.round(gross * 100) / 100;
      break;
  }

  return Math.round(rounded * 100) / 100;
}
