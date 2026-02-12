import "server-only";

export async function fetchPartnerCatalog() {
  const baseUrl = process.env.CARDAPIOWEB_BASE_URL;
  const apiKey = process.env.CARDAPIOWEB_API_KEY;

  if (!baseUrl) throw new Error("Missing env CARDAPIOWEB_BASE_URL");
  if (!apiKey) throw new Error("Missing env CARDAPIOWEB_API_KEY");

  const url = `${baseUrl}/api/partner/v1/catalog`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiKey,
    },
    // Ajuste conforme seu cenário:
    // - "no-store" => sempre busca ao vivo
    // - ou use revalidate para cache
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CardapioWeb API error ${res.status}: ${text}`);
  }

  return res.json();
}
