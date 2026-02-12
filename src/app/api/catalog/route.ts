import { NextResponse } from "next/server";
import { fetchPartnerCatalog } from "@/lib/cardapioweb";
import { normalizeCatalog } from "@/lib/normalizeCatalog";
import type { PartnerCatalog } from "@/lib/types";
import type { KeetaKmBand } from "@/lib/keeta";
import { getKeetaDeliveryFeeByAvgKm } from "@/lib/keeta";

function parseBand(value: string | null): KeetaKmBand {
  if (value === "UP_TO_2" || value === "FROM_2_TO_4" || value === "ABOVE_4") return value;
  return "UP_TO_2";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const band = parseBand(url.searchParams.get("km_band"));

    const keeta_fee = getKeetaDeliveryFeeByAvgKm(band);

    const raw = (await fetchPartnerCatalog()) as PartnerCatalog;
    const items = normalizeCatalog(raw, band);

    return NextResponse.json({ items, km_band: band, keeta_fee }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch catalog", message },
      { status: 500 }
    );
  }
}