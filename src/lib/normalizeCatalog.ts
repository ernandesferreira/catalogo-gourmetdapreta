import type { PartnerCatalog, CatalogItemView, Item, Option } from "@/lib/types";
import { PLATFORM_FEES } from "@/lib/platformFees";
import { calcPlatformPrice } from "@/lib/pricing";
import { getKeetaDeliveryFeeByAvgKm, type KeetaKmBand } from "@/lib/keeta";

function n(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number(v.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function s(v: unknown): string {
  return v == null ? "" : String(v);
}

function buildRow(params: {
  category_name: string;
  name: string;
  description: string;
  external_code: string;
  price: number;
  stock: number;
  image_url: string;
  thumbnail_url: string;
  status: string;
  keetaFixedFee: number;
}): CatalogItemView {
  const basePrice = params.price;

  return {
    category_name: params.category_name,
    name: params.name,
    description: params.description,
    external_code: params.external_code,
    price: basePrice,
    stock: params.stock,
    image_url: params.image_url,
    thumbnail_url: params.thumbnail_url,
    status: params.status,

    price_ifood: calcPlatformPrice(basePrice, PLATFORM_FEES.ifood),
    price_99food: calcPlatformPrice(basePrice, PLATFORM_FEES.food99),
    price_keeta: calcPlatformPrice(basePrice, {
      ...PLATFORM_FEES.keeta,
      fixedFee: params.keetaFixedFee,
    }),
  };
}

function optionToRow(
  categoryName: string,
  item: Item,
  opt: Option,
  keetaFixedFee: number
): CatalogItemView {
  const optionName = s(opt.name ?? "").trim();
  const parentName = s(item.name ?? "").trim();

  // ✅ Item — Option (como você pediu)
  const name =
    parentName && optionName
      ? `${parentName} — ${optionName}`
      : optionName || parentName;

  const description = s(opt.description ?? "").trim() || s(item.description ?? "").trim();

  const external_code =
    s(opt.external_code ?? "").trim() || `${s(item.external_code ?? item.id)}:${s(opt.id ?? "")}`;

  // ✅ Se option.price == 0, herda do item pai (sabores sem adicional)
  const itemPrice = n(item.price);
  const optPrice = n(opt.price);
  const price = optPrice > 0 ? optPrice : itemPrice;

  const stock = n(opt.stock);

  const image_url = s(opt.image?.image_url ?? item.image?.image_url ?? "");
  const thumbnail_url = s(opt.image?.thumbnail_url ?? item.image?.thumbnail_url ?? "");

  const status = s(opt.status ?? item.status ?? "UNKNOWN");

  return buildRow({
    category_name: categoryName,
    name,
    description,
    external_code,
    price,
    stock,
    image_url,
    thumbnail_url,
    status,
    keetaFixedFee,
  });
}

export function normalizeCatalog(payload: PartnerCatalog, band: KeetaKmBand): CatalogItemView[] {
  const categories = payload.categories ?? [];
  const flat: CatalogItemView[] = [];

  const keetaFixedFee = getKeetaDeliveryFeeByAvgKm(band);

  for (const category of categories) {
    const categoryName = s(category.name ?? "");
    const items = category.items ?? [];

    for (const item of items) {
      const itemPrice = n(item.price);
      const groups = item.option_groups ?? [];

      // ✅ 1) Se tem option_groups/options, explode SEMPRE
      let pushedAnyOption = false;

      for (const g of groups) {
        const options = g.options ?? [];
        for (const opt of options) {
          // Se você quiser ignorar option sem nome, descomente:
          // if (!s(opt.name).trim()) continue;

          flat.push(optionToRow(categoryName, item, opt, keetaFixedFee));
          pushedAnyOption = true;
        }
      }

      // ✅ 2) Se não empurrou nenhuma option, aí sim cai no item normal (quando vendável)
      if (!pushedAnyOption && itemPrice > 0) {
        flat.push(
          buildRow({
            category_name: categoryName,
            name: s(item.name ?? ""),
            description: s(item.description ?? ""),
            external_code: s(item.external_code ?? item.id),
            price: itemPrice,
            stock: n(item.stock),
            image_url: s(item.image?.image_url ?? ""),
            thumbnail_url: s(item.image?.thumbnail_url ?? ""),
            status: s(item.status ?? "UNKNOWN"),
            keetaFixedFee,
          })
        );
      }
    }
  }

  return flat;
}
