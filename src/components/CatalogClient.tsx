"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogItemView } from "@/lib/types";


type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "MISSING";

type KeetaKmBand = "UP_TO_2" | "FROM_2_TO_4" | "ABOVE_4";

type ApiResponse = { items: CatalogItemView[]; km_band?: KeetaKmBand; keeta_fee?: number };

type LoadState =
  | { status: "loading" }
  | { status: "success"; items: CatalogItemView[]; keeta_fee: number; km_band: KeetaKmBand }
  | { status: "error"; message: string };

type Grouped = Record<string, CatalogItemView[]>;

function groupByCategory(items: CatalogItemView[]): Grouped {
  return items.reduce<Grouped>((acc, item) => {
    const key = item.category_name || "Sem categoria";
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(status: string) {
  if (status === "ACTIVE") return "Ativo";
  if (status === "INACTIVE") return "Inativo";
  if (status === "MISSING") return "Em falta";
  return status;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: unknown) {
  const s = String(value ?? "");
  // troca quebras de linha e escapa aspas duplas
  const cleaned = s.replace(/\r?\n/g, " ").replace(/"/g, '""');
  return `"${cleaned}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeCsv).join(",");

  const lines = rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(","));
  return [headerLine, ...lines].join("\n");
}

const KM_BANDS: Array<{ value: KeetaKmBand; label: string; fee: number }> = [
  { value: "UP_TO_2", label: "Até 2km", fee: 3.5 },
  { value: "FROM_2_TO_4", label: "De 2 a 4km", fee: 5.5 },
  { value: "ABOVE_4", label: "Acima de 4km", fee: 6.5 },
];

// Presets (edite com seus bairros reais)
const PRESETS: Array<{ value: string; label: string; band: KeetaKmBand }> = [
  { value: "custom", label: "Escolher manualmente…", band: "UP_TO_2" },

  // Exemplos — ajuste conforme sua logística real:
  { value: "vila-emil", label: "Vila Emil", band: "UP_TO_2" },
  { value: "centro-mesquita", label: "Centro de Mesquita", band: "FROM_2_TO_4" },
  { value: "edson-passos", label: "Edson Passos", band: "ABOVE_4" },
];

export default function CatalogClient() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // filtros
  const [query, setQuery] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");



  // Keeta controls
  const [preset, setPreset] = useState<string>("custom");
  const [band, setBand] = useState<KeetaKmBand>("UP_TO_2");

  // accordion
  const [open, setOpen] = useState<Record<string, boolean>>({});

async function fetchCatalog(currentBand: KeetaKmBand) {
  setState({ status: "loading" });

  const res = await fetch(`/api/catalog?km_band=${encodeURIComponent(currentBand)}`);
  const json = (await res.json()) as ApiResponse;

  if (!res.ok) throw new Error((json as any)?.message || `HTTP ${res.status}`);

  const items = json.items ?? [];
  const keeta_fee = typeof json.keeta_fee === "number" ? json.keeta_fee : 0;
  const km_band = (json.km_band ?? currentBand) as KeetaKmBand;

  setState({ status: "success", items, keeta_fee, km_band });

  if (Object.keys(open).length === 0) {
    const grouped = groupByCategory(items);
    const names = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    const initial: Record<string, boolean> = {};
    for (const name of names.slice(0, 3)) initial[name] = true;
    setOpen(initial);
  }
}

  // inicial
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await fetchCatalog(band);
      } catch (e) {
        if (!alive) return;
        const message = e instanceof Error ? e.message : "Unknown error";
        setState({ status: "error", message });
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // quando band muda, recalcula
  useEffect(() => {
    const t = setTimeout(() => {
      (async () => {
        try {
          await fetchCatalog(band);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unknown error";
          setState({ status: "error", message });
        }
      })();
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band]);

  // ao trocar preset (bairro), ajusta band automaticamente (exceto custom)
  useEffect(() => {
    const p = PRESETS.find((x) => x.value === preset);
    if (!p) return;

    if (preset !== "custom") {
      setBand(p.band);
    }
  }, [preset]);


  const feeLabel = useMemo(() => {
    const found = KM_BANDS.find((x) => x.value === band);
    return found ? `${found.label} (taxa Keeta: ${formatBRL(found.fee)})` : "";
  }, [band]);

  const allItems = state.status === "success" ? state.items : [];

  const allCategoryNames = useMemo(() => {
    const set = new Set<string>();
    for (const it of allItems) {
      if (it.category_name) set.add(it.category_name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allItems]);

  
  // Se você filtrar status/busca e a categoria selecionada deixar de existir, pode ficar “vazio” e parecer bug.
  useEffect(() => {
    if (categoryFilter !== "ALL" && !allCategoryNames.includes(categoryFilter)) {
      setCategoryFilter("ALL");
    }
  }, [allCategoryNames, categoryFilter]);

  const filtered = useMemo(() => {
  const q = query.trim().toLowerCase();
  

  return allItems.filter((it) => {
    const matchCategory = categoryFilter === "ALL" || it.category_name === categoryFilter;
    const matchQuery =
      !q ||
      it.name.toLowerCase().includes(q) ||
      it.external_code.toLowerCase().includes(q);

    const matchStock = !onlyInStock || it.stock > 0;
    
    const matchStatus =
      statusFilter === "ALL"
    ? true
    : statusFilter === "ACTIVE"
    ? it.status === "ACTIVE"
    : statusFilter === "INACTIVE"
    ? it.status === "INACTIVE"
    : it.status === "MISSING";

    return matchQuery && matchStock && matchStatus && matchCategory;
  });

  


}, [allItems, query, onlyInStock, statusFilter, categoryFilter]);

  const grouped = useMemo(() => {
    const g = groupByCategory(filtered);
    for (const k of Object.keys(g)) g[k].sort((a, b) => a.name.localeCompare(b.name));
    return g;
  }, [filtered]);

  const categoryNames = useMemo(
    () => Object.keys(grouped).sort((a, b) => a.localeCompare(b)),
    [grouped]
  );

  function toggleCategory(name: string) {
    setOpen((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function openAll() {
    const all: Record<string, boolean> = {};
    for (const name of categoryNames) all[name] = true;
    setOpen(all);
  }

  function closeAll() {
    setOpen({});
  }

  if (state.status === "error") {
    return (
      <div className="p-6">
        <p className="font-semibold">Erro</p>
        <p className="text-sm text-red-700">{state.message}</p>
      </div>
    );
  }

  function handleExportJson() {
  if (state.status !== "success") return;

  const payload = {
    exported_at: new Date().toISOString(),
    km_band: band,
    keeta_fee: state.keeta_fee,
    items: state.items, // TODO o catálogo (não filtrado)
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });

  downloadBlob(`catalogo_${band}_${new Date().toISOString().slice(0, 10)}.json`, blob);
}

    function handleExportExcelCsv() {
    if (state.status !== "success") return;

    // Para CSV, é melhor achatar tudo em colunas fixas
    const rows = state.items.map((it) => ({
        category_name: it.category_name,
        name: it.name,
        description: it.description,
        external_code: it.external_code,
        stock: it.stock,
        price_base: it.price,
        price_ifood: it.price_ifood,
        price_99food: it.price_99food,
        price_keeta: it.price_keeta,
        image_url: it.image_url,
        thumbnail_url: it.thumbnail_url,
        km_band: band,
        keeta_fee: state.keeta_fee,
    }));

    const csv = toCsv(rows);

    // Excel no Brasil às vezes prefere ; (separador). Se o seu Excel abrir tudo em 1 coluna,
    // eu te mando a versão com ;. Por padrão deixei ",".
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

    downloadBlob(`catalogo_${band}_${new Date().toISOString().slice(0, 10)}.csv`, blob);
    }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catálogo</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {state.status === "success" ? (
              <>
                Itens: <span className="font-semibold">{filtered.length}</span>{" "}
                <span className="text-neutral-400">/ {state.items.length}</span> •
                Categorias: <span className="font-semibold">{categoryNames.length}</span>
              </>
            ) : (
              "Carregando…"
            )}
          </p>
         {state.status === "success" && (
            <p className="mt-1 text-xs text-neutral-500">
                Keeta: <span className="font-semibold">{KM_BANDS.find(b => b.value === band)?.label}</span> •
                Taxa média usada: <span className="font-semibold">{formatBRL(state.keeta_fee)}</span>
            </p>
            )}
        </div>



        <div className="flex flex-wrap items-center gap-2">
            <button
                onClick={openAll}
                className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                type="button"
            >
                Abrir tudo
            </button>

            <button
                onClick={closeAll}
                className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                type="button"
            >
                Fechar tudo
            </button>

            <div className="h-6 w-px bg-neutral-200" />

            <button
                onClick={handleExportJson}
                disabled={state.status !== "success"}
                className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
                type="button"
            >
                Exportar JSON
            </button>

            <button
                onClick={handleExportExcelCsv}
                disabled={state.status !== "success"}
                className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
                type="button"
            >
                Exportar Excel (CSV)
            </button>
            </div>
      </div>

      {/* CONTROLES */}
      <div className="mt-6 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-neutral-600">
            Buscar por nome ou código
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: sacolé chocolate ou 3276447"
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-semibold text-neutral-600">Categoria</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option value="ALL">Todas</option>
            {allCategoryNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-semibold text-neutral-600">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativos</option>
              <option value="INACTIVE">Inativos</option>
              <option value="EM_FALTA">Em falta</option>
            </select>
            <p className="mt-1 text-[11px] text-neutral-500">Selecione o status do produto</p>
        </div>

        {/* Preset */}
        <div className="sm:col-span-1">
          <label className="block text-xs font-semibold text-neutral-600">
            Preset (loja/bairro)
          </label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-neutral-500">
            Ao escolher um bairro, a faixa de KM ajusta automaticamente.
          </p>
        </div>

        {/* Band */}
        <div className="sm:col-span-1">
          <label className="block text-xs font-semibold text-neutral-600">
            Faixa Keeta (KM)
          </label>
          <select
            value={band}
            onChange={(e) => setBand(e.target.value as KeetaKmBand)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            disabled={preset !== "custom"}
            title={preset !== "custom" ? "Selecione 'Escolher manualmente…' no preset" : ""}
          >
            {KM_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-neutral-500">
            ≤2: 3,50 • 2–4: 5,50 • &gt;4: 6,50
          </p>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="mt-6 space-y-3">
        {state.status === "loading" && (
          <div className="rounded-2xl border bg-white p-6 text-sm text-neutral-700">
            Recalculando preços…
          </div>
        )}

        {state.status === "success" && categoryNames.length === 0 && (
          <div className="rounded-2xl border bg-white p-6 text-sm text-neutral-700">
            Nenhum item encontrado com os filtros atuais.
          </div>
        )}

        {state.status === "success" &&
          categoryNames.map((cat) => {
            const items = grouped[cat] ?? [];
            const isOpen = !!open[cat];
            const inStockCount = items.reduce((acc, it) => acc + (it.stock > 0 ? 1 : 0), 0);

            return (
              <section key={cat} className="rounded-2xl border bg-white">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div>
                    <h2 className="text-base font-bold">{cat}</h2>
                    <p className="mt-1 text-xs text-neutral-600">
                      {items.length} itens • {inStockCount} em estoque
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold">
                      {items.length}
                    </span>
                    <span className="text-sm font-semibold text-neutral-600">
                      {isOpen ? "—" : "+"}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t p-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((it, idx) => (
                        <article
                          key={`${it.external_code}-${idx}`}
                          className="rounded-2xl border p-4"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold leading-tight">{it.name}</h3>
                              <div className="mb-2 flex items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                    it.status === "ACTIVE"
                                      ? "bg-green-100 text-green-700"
                                      : it.status === "MISSING"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : it.status === "INACTIVE"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-neutral-100 text-neutral-600"
                                  }`}
                                >
                                  {statusLabel(it.status)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-neutral-500">
                                Código: <span className="font-mono">{it.external_code}</span>
                              </p>
                            </div>

                            {it.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={it.thumbnail_url}
                                alt={it.name}
                                className="h-14 w-14 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="h-14 w-14 rounded-xl bg-neutral-100" />
                            )}
                          </div>

                          {it.description ? (
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                              {it.description}
                            </p>
                          ) : (
                            <p className="text-sm text-neutral-400">Sem descrição</p>
                          )}

                          {/* preços */}
                          <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm">
                            {/* BASE */}
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-purple-600">Base</span>
                              <span className="font-bold text-purple-700">
                                {formatBRL(it.price)}
                              </span>
                            </div>

                            {/* IFOOD */}
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-red-600">iFood</span>
                              <span className="font-bold text-red-700">
                                {formatBRL(it.price_ifood)}
                              </span>
                            </div>

                            {/* 99FOOD */}
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-yellow-600">99Food</span>
                              <span className="font-bold text-yellow-700">
                                {formatBRL(it.price_99food)}
                              </span>
                            </div>

                            {/* KEETA */}
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-green-600">Keeta</span>
                              <span className="font-bold text-green-700">
                                {formatBRL(it.price_keeta)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span
                              className={`text-sm ${
                                it.stock > 0 ? "text-neutral-700" : "text-red-700"
                              }`}
                            >
                              Estoque: {it.stock}
                            </span>
                          </div>

                          {it.image_url && (
                            <a
                              href={it.image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-block text-xs font-semibold text-blue-600"
                            >
                              Ver imagem
                            </a>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
      </div>
    </main>
  );
}
