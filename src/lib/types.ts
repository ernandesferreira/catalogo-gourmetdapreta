export type PartnerCatalog = {
  categories?: Category[];
};

export type Category = {
  id: number;
  name: string;
  items?: Item[];
};

export type ItemImage = {
  image_url?: string | null;
  thumbnail_url?: string | null;
};

export type Option = {
  id?: number;
  name?: string | null;
  description?: string | null;
  external_code?: string | null;
  price?: number | null;
  stock?: number | null;
  image?: ItemImage | null;
};

export type OptionGroup = {
  id?: number;
  name?: string | null;
  options?: Option[];
};

export type Item = {
  id: number;
  name: string;
  description?: string | null;
  external_code?: string | null;
  price?: number | null;
  stock?: number | null;
  image?: ItemImage | null;

  option_groups?: OptionGroup[];
};

export type CatalogItemView = {
  name: string;
  description: string;
  external_code: string;
  price: number;
  stock: number;
  image_url: string;
  thumbnail_url: string;
  category_name: string;

  price_ifood: number;
  price_99food: number;
  price_keeta: number;
};
