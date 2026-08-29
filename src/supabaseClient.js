import { createClient } from "@supabase/supabase-js";

// Clé publique uniquement — jamais la clé secrète ici.
const SUPABASE_URL = "https://btarncrovitmjihnrfdz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7dtHYcGgSVyqQy8uz_E_aQ_ytllW-YT";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/* ---------------- Lecture des données ---------------- */

export async function fetchStock(mallId) {
  const { data: stores, error: storeErr } = await supabase
    .from("stores")
    .select("id, name, pos_x, pos_y")
    .eq("mall_id", mallId);

  if (storeErr) {
    console.error("Erreur chargement magasins:", storeErr);
    return [];
  }

  const { data: articles, error: articleErr } = await supabase
    .from("articles")
    .select("id, store_id, name, price, style, gender, quantity, image_url");

  if (articleErr) {
    console.error("Erreur chargement articles:", articleErr);
    return [];
  }

  const storeById = Object.fromEntries(stores.map((s) => [s.id, s]));
  return articles
    .filter((a) => storeById[a.store_id])
    .map((a) => ({
      id: a.id,
      store: storeById[a.store_id].name,
      name: a.name,
      price: Number(a.price),
      qty: a.quantity,
      style: a.style,
    }));
}

export async function fetchStorePositions(mallId) {
  const { data, error } = await supabase
    .from("stores")
    .select("name, pos_x, pos_y")
    .eq("mall_id", mallId);

  if (error) {
    console.error("Erreur positions magasins:", error);
    return {};
  }

  return Object.fromEntries(
    data.map((s) => [s.name, { x: Number(s.pos_x), y: Number(s.pos_y) }])
  );
}

/* ---------------- Écriture : créer une réservation ---------------- */

export async function createReservation({ mallId, code, items, total, paymentMethod, paymentStatus }) {
  const { data: reservation, error: resErr } = await supabase
    .from("reservations")
    .insert({
      mall_id: mallId,
      code,
      status: "En attente",
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      total,
    })
    .select()
    .single();

  if (resErr) {
    console.error("Erreur création réservation:", resErr);
    return null;
  }

  const lines = items.map((item) => ({
    reservation_id: reservation.id,
    article_id: item.id,
    price_at_reservation: item.price,
  }));

  const { error: itemsErr } = await supabase.from("reservation_items").insert(lines);
  if (itemsErr) console.error("Erreur lignes de réservation:", itemsErr);

  for (const item of items) {
    await supabase.rpc("decrement_stock", { article_id: item.id, amount: 1 }).then(
      () => {},
      () => {}
    );
  }

  return reservation;
}

export const SALERA_MALL_ID = "00000000-0000-0000-0000-000000000001";

/* ---------------- Espace Magasin : réservations et stock réels ---------------- */

export async function fetchReservations(mallId) {
  const { data: reservations, error } = await supabase
    .from("reservations")
    .select("id, code, status, payment_method, payment_status, total")
    .eq("mall_id", mallId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur chargement réservations:", error);
    return [];
  }

  const { data: items, error: itemsErr } = await supabase
    .from("reservation_items")
    .select("reservation_id, article_id, articles(name, store_id, stores(name))");

  if (itemsErr) {
    console.error("Erreur chargement lignes de réservation:", itemsErr);
    return reservations.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
      total: Number(r.total),
      store: "—",
      itemNames: [],
    }));
  }

  return reservations.map((r) => {
    const lines = items.filter((i) => i.reservation_id === r.id);
    const storeName = lines[0]?.articles?.stores?.name || "—";
    return {
      id: r.id,
      code: r.code,
      status: r.status,
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
      total: Number(r.total),
      store: storeName,
      itemNames: lines.map((l) => l.articles?.name).filter(Boolean),
    };
  });
}

export async function markReservationPicked(reservationId) {
  const { error } = await supabase
    .from("reservations")
    .update({ status: "Récupéré" })
    .eq("id", reservationId);
  if (error) console.error("Erreur mise à jour réservation:", error);
}

export async function updateArticleQuantity(articleId, quantity) {
  const { error } = await supabase
    .from("articles")
    .update({ quantity })
    .eq("id", articleId);
  if (error) console.error("Erreur mise à jour stock:", error);
}