export type Platform = "ifood" | "food99" | "keeta";

export type RoundingMode = "NONE" | "END_90" | "END_99" | "STEP_050";

export type PlatformFeeConfig = {
  label: string;
  percentTotal: number; // 0.272 = 27,2%
  fixedFee: number;     // taxa fixa em R$
  rounding: RoundingMode;
};

export const PLATFORM_FEES: Record<Platform, PlatformFeeConfig> = {
  ifood: {
    label: "iFood",
    percentTotal: 0.272, // 24% + 3,2% = 27,2%
    fixedFee: 0.99,      // taxa de serviço
    rounding: "END_90",
  },
  food99: {
    label: "99Food",
    percentTotal: 0.2369, // 22,1% + 1,59% = 23,69%
    fixedFee: 0,
    rounding: "END_90",
  },
  keeta: {
    label: "Keeta",
    percentTotal: 0.174, // 12% + 3,2% = 17,4%
    fixedFee: 0,       // taxa entrega KM (fixa, conforme sua regra atual)
    rounding: "END_90",
  },
};
