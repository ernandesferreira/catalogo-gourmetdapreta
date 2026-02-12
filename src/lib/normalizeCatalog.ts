import type { PartnerCatalog, CatalogItemView, Item, Option } from "@/lib/types";
import { PLATFORM_FEES } from "@/lib/platformFees";
import { calcPlatformPrice } from "@/lib/pricing";
import { getKeetaDeliveryFeeByAvgKm, type KeetaKmBand } from "@/lib/keeta";

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
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
  // imagem: option primeiro, senão item
  const image_url = s(opt.image?.image_url ?? item.image?.image_url ?? "");
  const thumbnail_url = s(opt.image?.thumbnail_url ?? item.image?.thumbnail_url ?? "");

  // NOME: aqui usei SOMENTE o nome da option (como você pediu)
  // Se você quiser "Item — Option", troque para:
  // const name = item.name && opt.name ? `${item.name} — ${opt.name}` : s(opt.name ?? item.name);
  const optionName = s(opt.name ?? "").trim();
const parentName = s(item.name ?? "").trim();

const name =
  parentName && optionName
    ? `${parentName} — ${optionName}`
    : (optionName || parentName);

  // descrição: se option vier vazia, cai na descrição do item (bom fallback)
  const description = s(opt.description ?? "").trim() || s(item.description ?? "").trim();

  // external_code: preferir option.external_code, fallback seguro
  const external_code =
    s(opt.external_code ?? "").trim() || `${s(item.external_code ?? item.id)}:${s(opt.id ?? "")}`;

  const price = n(opt.price);
  const stock = n(opt.stock);

  return buildRow({
    category_name: categoryName,
    name,
    description,
    external_code,
    price,
    stock,
    image_url,
    thumbnail_url,
    status: s(opt.status ?? item.status ?? "UNKNOWN"),
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

      // Caso 1: item com preço -> retorna item normal
      if (itemPrice > 0) {
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
            status: s(item.status ?? "UNKNOWN"), // 👈 novo
            keetaFixedFee,
          })
        );
        continue;
      }

      // Caso 2: item.price == 0 -> explodir options (option_groups/options)
      const groups = item.option_groups ?? [];
      for (const g of groups) {
        const options = g.options ?? [];
        for (const opt of options) {
          const optPrice = n(opt.price);

          // se option também não tiver preço, ignora
          if (optPrice <= 0) continue;

          flat.push(optionToRow(categoryName, item, opt, keetaFixedFee));
        }
      }
    }
  }

  return flat;
}
