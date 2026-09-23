import React, { useState, useEffect, useCallback } from "react";
import { fetchStock, createReservation, fetchReservations, markStoreItemsPicked, updateArticleQuantity, SALERA_MALL_ID } from "./supabaseClient";
 
/* ---------------------------------------------------------
   LOOKAID — prototype fonctionnel connecté à Supabase
--------------------------------------------------------- */
 
const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; }
    .lk-display { font-family: 'Cormorant Garamond', serif; }
    .lk-body { font-family: 'Jost', sans-serif; }
  `}</style>
);
 
const GOLD = "#7B2FF7";
const GOLD_SOFT = "#FF3D71";
const BG = "#FBF7FF";
const PANEL = "#FFFFFF";
const LINE = "#E3DCF5";
const CREAM = "#1D1730";
const CREAM_SOFT = "#756E8C";
 
const STORE_NAMES = ["Zara", "Mango", "Bershka", "Massimo Dutti", "Stradivarius", "Pull&Bear"];
 
/* Mall floor plan — simple coordinate system (0-100 x, 0-60 y) */
const ENTRANCE = { x: 50, y: 58, label: "Entrée" };
const STORE_POSITIONS = {
  Zara: { x: 15, y: 12 },
  Mango: { x: 85, y: 10 },
  Bershka: { x: 78, y: 38 },
  "Massimo Dutti": { x: 15, y: 40 },
  Stradivarius: { x: 50, y: 15 },
  "Pull&Bear": { x: 50, y: 45 },
};
 
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
 
/* Nearest-neighbour heuristic: shortest route visiting each required store once, starting at the entrance */
function computeRoute(storeNames) {
  const remaining = [...new Set(storeNames)];
  const route = [];
  let current = ENTRANCE;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((name, idx) => {
      const d = dist(current, STORE_POSITIONS[name]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    const chosen = remaining.splice(bestIdx, 1)[0];
    route.push(chosen);
    current = STORE_POSITIONS[chosen];
  }
  return route;
}
 
/* Articles d'une réservation qui appartiennent à un ensemble d'articles donné (ex. le stock d'un magasin) */
function resItemsIn(reservation, storeItems) {
  if (reservation.items) {
    const ids = reservation.items.map((x) => x.id);
    return storeItems.filter((i) => ids.includes(i.id));
  }
  return storeItems.filter((i) => (reservation.itemNames || []).includes(i.name));
}
 
/* Un magasin a-t-il remis tous SES articles de cette réservation ? */
function isPickedForStore(reservation, storeItems) {
  if (reservation.status === "Récupéré") return true;
  const mineIds = resItemsIn(reservation, storeItems).map((i) => i.id);
  if (!reservation.items || mineIds.length === 0) return false;
  return reservation.items.filter((x) => mineIds.includes(x.id)).every((x) => x.picked);
}
 
const SEED_STOCK = [
  { id: "s1", store: "Zara", name: "Blazer oversize", price: 49, qty: 8, style: "Minimaliste" },
  { id: "s2", store: "Zara", name: "Robe imprimée", price: 39, qty: 6, style: "Bohème" },
  { id: "s3", store: "Zara", name: "Pantalon droit", price: 29, qty: 11, style: "Classique" },
  { id: "s19", store: "Zara", name: "Chemise satinée", price: 32, qty: 9, style: "Classique" },
  { id: "s20", store: "Zara", name: "Sac cabas cuir", price: 45, qty: 7, style: "Minimaliste" },
  { id: "s4", store: "Mango", name: "Trench beige", price: 89, qty: 5, style: "Classique" },
  { id: "s5", store: "Mango", name: "Robe satinée", price: 54, qty: 6, style: "Bohème" },
  { id: "s6", store: "Mango", name: "Pull côtelé", price: 35, qty: 9, style: "Minimaliste" },
  { id: "s21", store: "Mango", name: "Jupe midi plissée", price: 39, qty: 8, style: "Bohème" },
  { id: "s22", store: "Mango", name: "Escarpins bout pointu", price: 49, qty: 6, style: "Classique" },
  { id: "s7", store: "Bershka", name: "Veste denim", price: 42, qty: 10, style: "Streetwear" },
  { id: "s8", store: "Bershka", name: "Sneakers minimal", price: 56, qty: 3, style: "Streetwear" },
  { id: "s9", store: "Bershka", name: "Sweat oversize", price: 32, qty: 12, style: "Streetwear" },
  { id: "s23", store: "Bershka", name: "Jean baggy", price: 36, qty: 9, style: "Streetwear" },
  { id: "s24", store: "Bershka", name: "Bomber", price: 45, qty: 6, style: "Streetwear" },
  { id: "s10", store: "Massimo Dutti", name: "Manteau en laine", price: 129, qty: 4, style: "Classique" },
  { id: "s11", store: "Massimo Dutti", name: "Chemise en lin", price: 59, qty: 7, style: "Minimaliste" },
  { id: "s12", store: "Massimo Dutti", name: "Mocassins en cuir", price: 89, qty: 5, style: "Classique" },
  { id: "s25", store: "Massimo Dutti", name: "Pantalon en laine", price: 79, qty: 6, style: "Classique" },
  { id: "s26", store: "Massimo Dutti", name: "Pull en cachemire", price: 99, qty: 4, style: "Minimaliste" },
  { id: "s13", store: "Stradivarius", name: "Jupe plissée", price: 25, qty: 9, style: "Bohème" },
  { id: "s14", store: "Stradivarius", name: "Top crop", price: 15, qty: 14, style: "Streetwear" },
  { id: "s15", store: "Stradivarius", name: "Cardigan", price: 29, qty: 8, style: "Minimaliste" },
  { id: "s27", store: "Stradivarius", name: "Robe fleurie", price: 27, qty: 10, style: "Bohème" },
  { id: "s28", store: "Stradivarius", name: "Sandales tressées", price: 22, qty: 11, style: "Bohème" },
  { id: "s16", store: "Pull&Bear", name: "Jean droit", price: 35, qty: 10, style: "Casual" },
  { id: "s17", store: "Pull&Bear", name: "Chemise oversize", price: 29, qty: 8, style: "Casual" },
  { id: "s18", store: "Pull&Bear", name: "Casquette", price: 12, qty: 15, style: "Streetwear" },
  { id: "s29", store: "Pull&Bear", name: "Sweat à capuche", price: 33, qty: 9, style: "Casual" },
  { id: "s30", store: "Pull&Bear", name: "Baskets toile", price: 39, qty: 7, style: "Casual" },
];
 
function money(n) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0 }) + " €";
}
 
function genCode() {
  return "LK-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}
 
/* ================= APP ================= */
export default function LookaidApp() {
  const [role, setRole] = useState(null); // null | 'client' | 'store' | 'mall'
  const [storeName, setStoreName] = useState(STORE_NAMES[0]);
  const [stock, setStock] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [ready, setReady] = useState(false);
 
  const refresh = useCallback(async () => {
    const [s, r] = await Promise.all([fetchStock(SALERA_MALL_ID), fetchReservations(SALERA_MALL_ID)]);
    setStock(s.length ? s : SEED_STOCK);
    setReservations(r);
    setReady(true);
  }, []);
 
  useEffect(() => {
    refresh();
  }, [refresh]);
 
  function updateStock(next) {
    setStock(next);
  }
  function updateReservations(next) {
    setReservations(next);
  }
 
  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {FONTS}
        <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 13, letterSpacing: "0.15em" }}>CHARGEMENT…</div>
      </div>
    );
  }
 
  return (
    <div style={{ minHeight: "100vh", background: BG, padding: "28px 16px 60px" }}>
      {FONTS}
      <Header role={role} storeName={storeName} onLogout={() => setRole(null)} />
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        {!role && (
          <Login
            onLogin={(r, sn) => {
              setRole(r);
              if (sn) setStoreName(sn);
            }}
          />
        )}
        {role === "client" && (
          <ClientView stock={stock} reservations={reservations} onReserve={updateReservations} />
        )}
        {role === "store" && (
          <StoreView
            storeName={storeName}
            setStoreName={setStoreName}
            stock={stock}
            reservations={reservations}
            onStockChange={updateStock}
            onReservationsChange={updateReservations}
          />
        )}
        {role === "mall" && <MallView />}
      </div>
    </div>
  );
}
 
/* ---------------- Header ---------------- */
function Header({ role, storeName, onLogout }) {
  return (
    <div style={{ maxWidth: 460, margin: "0 auto 30px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div className="lk-display" style={{ fontSize: 26, color: CREAM, letterSpacing: "0.02em" }}>
        Look<span style={{ color: GOLD, fontStyle: "italic" }}>aid</span>
      </div>
      {role && (
        <button onClick={onLogout} className="lk-body" style={btnGhost}>
          {role === "store" ? storeName + " · " : ""}Déconnexion
        </button>
      )}
    </div>
  );
}
 
/* ---------------- Login ---------------- */
function Login({ onLogin }) {
  const [pickedStore, setPickedStore] = useState(STORE_NAMES[0]);
  return (
    <div style={panelStyle}>
      <div className="lk-display" style={{ fontSize: 22, color: CREAM, marginBottom: 4 }}>Connexion</div>
      <div className="lk-body" style={{ fontSize: 13, color: CREAM_SOFT, marginBottom: 26, lineHeight: 1.6 }}>
        Choisissez votre espace pour accéder à Lookaid.
      </div>
 
      <RoleCard title="Client" desc="Découvrir, réserver et récupérer des articles en boutique." onClick={() => onLogin("client")} />
      <div style={{ marginTop: 12, border: `1px solid ${LINE}`, padding: "16px 18px" }}>
        <div className="lk-body" style={{ color: CREAM, fontSize: 15, marginBottom: 4, letterSpacing: "0.02em" }}>Magasin</div>
        <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 12, marginBottom: 12 }}>Gérer le stock et les réservations.</div>
        <select
          value={pickedStore}
          onChange={(e) => setPickedStore(e.target.value)}
          className="lk-body"
          style={selectStyle}
        >
          {STORE_NAMES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={() => onLogin("store", pickedStore)} className="lk-body" style={{ ...btnGold, marginTop: 12, width: "100%" }}>
          Entrer comme {pickedStore}
        </button>
      </div>
      <div style={{ marginTop: 12 }}>
        <RoleCard title="Mall" desc="Suivre la performance des magasins partenaires." onClick={() => onLogin("mall")} />
      </div>
    </div>
  );
}
 
function RoleCard({ title, desc, onClick }) {
  return (
    <button onClick={onClick} className="lk-body" style={{ ...cardBtn }}>
      <div style={{ color: CREAM, fontSize: 15, marginBottom: 4, letterSpacing: "0.02em" }}>{title}</div>
      <div style={{ color: CREAM_SOFT, fontSize: 12 }}>{desc}</div>
    </button>
  );
}
 
/* ---------------- Client view ---------------- */
const GENDERS = ["Femme", "Homme", "Enfant"];
const OCCASIONS = ["Travail", "Soirée", "Casual", "Cérémonie"];
const STYLES = ["Minimaliste", "Classique", "Streetwear", "Bohème"];
 
function ClientView({ stock, reservations, onReserve }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({ gender: null, occasion: null, style: null });
  const [cart, setCart] = useState([]);
  const [lastRes, setLastRes] = useState(null);
  const [payMethod, setPayMethod] = useState("card");
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "" });
  const [paying, setPaying] = useState(false);
 
  const complete = profile.gender && profile.occasion && profile.style;
  const suggestions = stock.filter((i) => i.qty > 0 && (!profile.style || i.style === profile.style));
  const cartTotal = stock.filter((i) => cart.includes(i.id)).reduce((s, i) => s + i.price, 0);
  const cardValid = payMethod === "onsite" || (card.number.replace(/\s/g, "").length >= 12 && card.expiry.length === 5 && card.cvc.length >= 3);
 
  function toggleCart(id) {
    setCart((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }
 
  function formatCardNumber(v) {
    return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }
  function formatExpiry(v) {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
  }
 
  async function payAndReserve() {
    setPaying(true);
    const items = stock.filter((i) => cart.includes(i.id));
    // simulated payment processing delay
    await new Promise((r) => setTimeout(r, 900));
    const res = {
      id: "r" + Date.now(),
      code: genCode(),
      client: profile,
      itemIds: cart,
      itemNames: items.map((i) => i.name),
      store: items[0]?.store || "—",
      total: items.reduce((s, i) => s + i.price, 0),
      status: "En attente",
      paymentMethod: payMethod === "card" ? "Carte bancaire" : "Paiement en boutique",
      paymentStatus: payMethod === "card" ? "Payé" : "À régler sur place",
      cardLast4: payMethod === "card" ? card.number.replace(/\s/g, "").slice(-4) : null,
      ts: Date.now(),
    };
    const created = await createReservation({
      mallId: SALERA_MALL_ID,
      code: res.code,
      items,
      total: res.total,
      paymentMethod: res.paymentMethod,
      paymentStatus: res.paymentStatus,
    });
    // on utilise le vrai identifiant Supabase pour que le magasin puisse valider le retrait
    if (created) res.id = created.id;
    res.items = items.map((i) => ({ id: i.id, name: i.name, store: i.store, picked: false }));
    await onReserve([res, ...reservations]);
    setLastRes(res);
    setPaying(false);
    setStep(3);
  }
 
  return (
    <div style={panelStyle}>
      <Steps step={step} labels={["Profil", "Sélection", "Paiement", "Confirmation", "Itinéraire"]} />
 
      {step === 0 && (
        <>
          <SectionTitle>Dites-nous pour qui</SectionTitle>
          <ChipGroup label="Genre" options={GENDERS} value={profile.gender} onChange={(v) => setProfile({ ...profile, gender: v })} />
          <ChipGroup label="Occasion" options={OCCASIONS} value={profile.occasion} onChange={(v) => setProfile({ ...profile, occasion: v })} />
          <ChipGroup label="Style recherché" options={STYLES} value={profile.style} onChange={(v) => setProfile({ ...profile, style: v })} />
          <button disabled={!complete} onClick={() => setStep(1)} className="lk-body" style={{ ...btnGold, width: "100%", marginTop: 20, opacity: complete ? 1 : 0.35 }}>
            Voir les suggestions
          </button>
        </>
      )}
 
      {step === 1 && (
        <>
          <SectionTitle>Sélection pour vous</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {suggestions.length === 0 && (
              <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 13 }}>Aucun article disponible pour ce style actuellement.</div>
            )}
            {suggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleCart(item.id)}
                style={{
                  border: `1px solid ${cart.includes(item.id) ? GOLD : LINE}`,
                  padding: "12px 14px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: cart.includes(item.id) ? "rgba(123,47,247,0.08)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img
                    src={item.image || `https://placehold.co/80x80/EDE7FB/7B2FF7?text=${encodeURIComponent(item.name.split(" ")[0])}`}
                    alt={item.name}
                    style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                  />
                  <div>
                    <div className="lk-body" style={{ color: CREAM, fontSize: 14 }}>{item.name}</div>
                    <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 11, marginTop: 2 }}>{item.store}</div>
                  </div>
                </div>
                <div className="lk-display" style={{ color: GOLD, fontSize: 16 }}>{money(item.price)}</div>
              </div>
            ))}
          </div>
          <button disabled={cart.length === 0} onClick={() => setStep(2)} className="lk-body" style={{ ...btnGold, width: "100%", opacity: cart.length ? 1 : 0.35 }}>
            Réserver ({cart.length})
          </button>
        </>
      )}
 
      {step === 2 && (
        <>
          <SectionTitle>Paiement</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {stock.filter((i) => cart.includes(i.id)).map((i) => (
              <div key={i.id} className="lk-body" style={{ display: "flex", justifyContent: "space-between", color: CREAM_SOFT, fontSize: 13 }}>
                <span>{i.name}</span>
                <span style={{ color: CREAM }}>{money(i.price)}</span>
              </div>
            ))}
            <div className="lk-body" style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${LINE}`, paddingTop: 8, marginTop: 4 }}>
              <span style={{ color: CREAM }}>Total</span>
              <span style={{ color: GOLD, fontSize: 16 }} className="lk-display">{money(cartTotal)}</span>
            </div>
          </div>
 
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setPayMethod("card")}
              className="lk-body"
              style={{ flex: 1, padding: "10px 8px", fontSize: 12, border: `1px solid ${payMethod === "card" ? GOLD : LINE}`, background: payMethod === "card" ? "rgba(123,47,247,0.08)" : "transparent", color: payMethod === "card" ? CREAM : CREAM_SOFT, cursor: "pointer" }}
            >
              Carte bancaire
            </button>
            <button
              onClick={() => setPayMethod("onsite")}
              className="lk-body"
              style={{ flex: 1, padding: "10px 8px", fontSize: 12, border: `1px solid ${payMethod === "onsite" ? GOLD : LINE}`, background: payMethod === "onsite" ? "rgba(123,47,247,0.08)" : "transparent", color: payMethod === "onsite" ? CREAM : CREAM_SOFT, cursor: "pointer" }}
            >
              Payer en boutique
            </button>
          </div>
 
          {payMethod === "card" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <input
                placeholder="Numéro de carte"
                value={card.number}
                onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                className="lk-body"
                style={inputStyle}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  placeholder="MM/AA"
                  value={card.expiry}
                  onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                  className="lk-body"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  placeholder="CVC"
                  value={card.cvc}
                  onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                  className="lk-body"
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              <div className="lk-body" style={{ fontSize: 10, color: CREAM_SOFT, letterSpacing: "0.03em" }}>
                Paiement simulé — aucune donnée bancaire réelle n'est transmise.
              </div>
            </div>
          )}
 
          {payMethod === "onsite" && (
            <div className="lk-body" style={{ fontSize: 12, color: CREAM_SOFT, marginBottom: 20, lineHeight: 1.6 }}>
              Le montant sera à régler directement en boutique au moment du retrait, avec votre code de retrait.
            </div>
          )}
 
          <button
            disabled={!cardValid || paying}
            onClick={payAndReserve}
            className="lk-body"
            style={{ ...btnGold, width: "100%", opacity: cardValid && !paying ? 1 : 0.35 }}
          >
            {paying ? "Traitement en cours…" : payMethod === "card" ? `Payer ${money(cartTotal)}` : "Réserver et payer sur place"}
          </button>
        </>
      )}
 
      {step === 3 && lastRes && (
        <>
          <SectionTitle>C'est réservé</SectionTitle>
          <div style={{ border: `1px solid ${GOLD}`, padding: 20, textAlign: "center", marginBottom: 18 }}>
            <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 11, letterSpacing: "0.15em", marginBottom: 8 }}>CODE DE RETRAIT</div>
            <div className="lk-display" style={{ color: GOLD, fontSize: 32, letterSpacing: "0.06em" }}>{lastRes.code}</div>
            <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 12, marginTop: 10 }}>
              Présentez ce code dans chaque boutique : {[...new Set(stock.filter((i) => lastRes.itemIds.includes(i.id)).map((i) => i.store))].join(", ")}
            </div>
          </div>
          <div className="lk-body" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: CREAM_SOFT, borderTop: `1px solid ${LINE}`, paddingTop: 12, marginBottom: 18 }}>
            <span>{lastRes.paymentMethod}</span>
            <span style={{ color: lastRes.paymentStatus === "Payé" ? "#7FA875" : GOLD }}>{lastRes.paymentStatus}</span>
          </div>
          <button onClick={() => setStep(4)} className="lk-body" style={{ ...btnGold, width: "100%" }}>
            Voir mon itinéraire
          </button>
        </>
      )}
 
      {step === 4 && lastRes && (() => {
        const items = stock.filter((i) => lastRes.itemIds.includes(i.id));
        const storesInCart = items.map((i) => i.store);
        const route = computeRoute(storesInCart);
        return (
          <>
            <SectionTitle>Le chemin le plus court</SectionTitle>
            <MallMap route={route} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "18px 0" }}>
              {route.map((storeNm, i) => (
                <div key={storeNm} style={{ display: "flex", gap: 12, alignItems: "flex-start", border: `1px solid ${LINE}`, padding: "10px 14px" }}>
                  <div className="lk-display" style={{ color: GOLD, fontSize: 20, minWidth: 22 }}>{i + 1}</div>
                  <div>
                    <div className="lk-body" style={{ color: CREAM, fontSize: 14 }}>{storeNm}</div>
                    <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 12, marginTop: 2 }}>
                      {items.filter((it) => it.store === storeNm).map((it) => it.name).join(", ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setStep(0);
                setCart([]);
                setProfile({ gender: null, occasion: null, style: null });
                setCard({ number: "", expiry: "", cvc: "" });
                setPayMethod("card");
              }}
              className="lk-body"
              style={{ ...btnGhost, width: "100%" }}
            >
              Nouvelle réservation
            </button>
          </>
        );
      })()}
    </div>
  );
}
 
/* ---------------- Store view ---------------- */
function StoreView({ storeName, setStoreName, stock, reservations, onStockChange, onReservationsChange }) {
  const myStock = stock.filter((i) => i.store === storeName);
  // Uniquement les réservations contenant au moins un article de ce magasin
  const myRes = reservations.filter((r) => resItemsIn(r, myStock).length > 0);
  const pending = myRes.filter((r) => !isPickedForStore(r, myStock)).length;
 
  async function changeQty(id, delta) {
    const item = myStock.find((i) => i.id === id);
    const newQty = Math.max(0, item.qty + delta);
    await updateArticleQuantity(id, newQty);
    const next = stock.map((i) => (i.id === id ? { ...i, qty: newQty } : i));
    onStockChange(next);
  }
 
  async function markPicked(r) {
    const mineIds = resItemsIn(r, myStock).map((i) => i.id);
    const allPicked = await markStoreItemsPicked(r.id, mineIds);
    const next = reservations.map((x) => {
      if (x.id !== r.id) return x;
      const items = (x.items || []).map((it) => (mineIds.includes(it.id) ? { ...it, picked: true } : it));
      return { ...x, items, status: allPicked ? "Récupéré" : x.status };
    });
    onReservationsChange(next);
  }
 
  return (
    <div>
      <div style={{ ...panelStyle, marginBottom: 14 }}>
        <div className="lk-body" style={{ fontSize: 11, color: CREAM_SOFT, marginBottom: 6, letterSpacing: "0.1em" }}>ESPACE MAGASIN</div>
        <select value={storeName} onChange={(e) => setStoreName(e.target.value)} className="lk-body" style={selectStyle}>
          {STORE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Kpi num={myStock.reduce((s, i) => s + i.qty, 0)} label="Articles en stock" />
          <Kpi num={pending} label="Réservations en attente" />
        </div>
      </div>
 
      <div style={{ ...panelStyle, marginBottom: 14 }}>
        <SectionTitle>Stock</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {myStock.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${LINE}`, paddingBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img
                  src={item.image || `https://placehold.co/80x80/EDE7FB/7B2FF7?text=${encodeURIComponent(item.name.split(" ")[0])}`}
                  alt={item.name}
                  style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                />
                <div>
                  <div className="lk-body" style={{ color: CREAM, fontSize: 13 }}>{item.name}</div>
                  <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 11 }}>{money(item.price)}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => changeQty(item.id, -1)} style={stepBtn}>–</button>
                <span className="lk-body" style={{ color: item.qty === 0 ? "#C0554F" : CREAM, minWidth: 18, textAlign: "center" }}>{item.qty}</span>
                <button onClick={() => changeQty(item.id, 1)} style={stepBtn}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>
 
      <div style={panelStyle}>
        <SectionTitle>Réservations</SectionTitle>
        {myRes.length === 0 && <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 13 }}>Aucune réservation pour le moment.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {myRes.map((r) => {
            const mine = resItemsIn(r, myStock);
            const done = isPickedForStore(r, myStock);
            return (
              <div key={r.id} style={{ border: `1px solid ${LINE}`, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="lk-display" style={{ color: GOLD, fontSize: 15 }}>{r.code}</span>
                  <span className="lk-body" style={{ fontSize: 11, color: done ? "#7FA875" : CREAM_SOFT }}>{done ? "Récupéré" : "En attente"}</span>
                </div>
                <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 12, marginTop: 4 }}>
                  {mine.map((i) => i.name).join(", ")}
                </div>
                <div className="lk-body" style={{ color: CREAM, fontSize: 12, marginTop: 4 }}>
                  {money(mine.reduce((s, i) => s + i.price, 0))}
                </div>
                {!done && (
                  <button onClick={() => markPicked(r)} className="lk-body" style={{ ...btnGhost, marginTop: 8, fontSize: 11 }}>Marquer récupéré</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
 
/* ---------------- Mall view ---------------- */
function MallView() {
  const [stock, setStock] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
 
  const load = useCallback(async () => {
    setLoading(true);
    const [s, r] = await Promise.all([fetchStock(SALERA_MALL_ID), fetchReservations(SALERA_MALL_ID)]);
    setStock(s);
    setReservations(r);
    setLoading(false);
    setLastUpdated(new Date());
  }, []);
 
  useEffect(() => {
    load();
  }, [load]);
 
  const byStore = STORE_NAMES.map((name) => {
    const items = stock.filter((i) => i.store === name);
    const res = reservations.filter((r) => resItemsIn(r, items).length > 0);
    return {
      name,
      articles: items.reduce((s, i) => s + i.qty, 0),
      reservations: res.length,
      // chiffre d'affaires = uniquement les articles de CE magasin dans chaque réservation
      revenue: res.reduce((s, r) => s + resItemsIn(r, items).reduce((t, i) => t + i.price, 0), 0),
    };
  });
  const maxRes = Math.max(1, ...byStore.map((s) => s.reservations));
  const top = [...byStore].sort((a, b) => b.reservations - a.reservations)[0];
 
  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <SectionTitle>Vue d'ensemble — Salera, Castellón de la Plana</SectionTitle>
        <button onClick={load} disabled={loading} className="lk-body" style={{ ...btnGhost, fontSize: 11, whiteSpace: "nowrap" }}>
          {loading ? "Actualisation…" : "Actualiser"}
        </button>
      </div>
      {lastUpdated && (
        <div className="lk-body" style={{ fontSize: 11, color: CREAM_SOFT, marginTop: -14, marginBottom: 18 }}>
          Dernière mise à jour : {lastUpdated.toLocaleTimeString("fr-FR")}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        <Kpi num={STORE_NAMES.length} label="Magasins" />
        <Kpi num={reservations.length} label="Réservations" />
        <Kpi num={stock.reduce((s, i) => s + i.qty, 0)} label="Articles" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {byStore.map((s) => (
          <div key={s.name} style={{ border: `1px solid ${s.name === top.name ? GOLD : LINE}`, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="lk-display" style={{ color: CREAM, fontSize: 17 }}>
                {s.name}{s.name === top.name && <span style={{ color: GOLD }}> ★</span>}
              </span>
              <span className="lk-body" style={{ color: GOLD, fontSize: 13 }}>{money(s.revenue)}</span>
            </div>
            <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 11, marginTop: 4 }}>
              {s.reservations} réservations · {s.articles} articles en stock
            </div>
            <div style={{ height: 3, background: LINE, marginTop: 8 }}>
              <div style={{ height: "100%", width: `${(s.reservations / maxRes) * 100}%`, background: GOLD }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
 
/* ---------------- Mall map / itinerary ---------------- */
function MallMap({ route }) {
  const points = [ENTRANCE, ...route.map((name) => STORE_POSITIONS[name])];
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
 
  return (
    <svg viewBox="0 0 100 64" style={{ width: "100%", height: "auto", background: "#F0E9FB", border: `1px solid ${LINE}` }}>
      {/* magasins hors parcours : plus discrets mais lisibles */}
      {Object.entries(STORE_POSITIONS).map(([name, p]) => {
        const onRoute = route.includes(name);
        return (
          <g key={name}>
            <circle cx={p.x} cy={p.y} r={2.6} fill={onRoute ? GOLD : "#C9BEE8"} />
            <text
              x={p.x}
              y={p.y - 4.5}
              fontSize="4"
              fill={onRoute ? CREAM : CREAM_SOFT}
              fontWeight={onRoute ? 600 : 400}
              textAnchor="middle"
              fontFamily="Jost, sans-serif"
            >
              {name}
            </text>
          </g>
        );
      })}
      {/* entrée */}
      <rect x={ENTRANCE.x - 3} y={ENTRANCE.y - 2} width={6} height={4} fill="#FFFFFF" stroke={CREAM} strokeWidth={0.5} />
      <text x={ENTRANCE.x + 5} y={ENTRANCE.y + 1.4} fontSize="3.8" fill={CREAM} textAnchor="start" fontFamily="Jost, sans-serif">Entrée</text>
 
      {/* parcours */}
      <path d={pathD} fill="none" stroke={GOLD} strokeWidth={0.7} strokeDasharray="1.6 1.2" />
      {route.map((name, i) => {
        const p = STORE_POSITIONS[name];
        return (
          <text key={name} x={p.x} y={p.y + 1.5} fontSize="3.6" fill="#FFFFFF" fontWeight={600} textAnchor="middle" fontFamily="Jost, sans-serif">
            {i + 1}
          </text>
        );
      })}
    </svg>
  );
}
 
/* ---------------- shared bits ---------------- */
function Steps({ step, labels }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
      {labels.map((l, i) => (
        <div key={l} style={{ flex: 1 }}>
          <div style={{ height: 2, background: i <= step ? GOLD : LINE, marginBottom: 6 }} />
          <div className="lk-body" style={{ fontSize: 10, letterSpacing: "0.1em", color: i <= step ? CREAM : CREAM_SOFT }}>{l.toUpperCase()}</div>
        </div>
      ))}
    </div>
  );
}
 
function SectionTitle({ children }) {
  return <div className="lk-display" style={{ fontSize: 20, color: CREAM, marginBottom: 16 }}>{children}</div>;
}
 
function ChipGroup({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="lk-body" style={{ fontSize: 11, color: CREAM_SOFT, letterSpacing: "0.1em", marginBottom: 8 }}>{label.toUpperCase()}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className="lk-body"
            style={{
              padding: "7px 14px",
              fontSize: 12,
              border: `1px solid ${value === o ? GOLD : LINE}`,
              background: value === o ? GOLD : "transparent",
              color: value === o ? "#FFFFFF" : CREAM_SOFT,
              cursor: "pointer",
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
 
function Kpi({ num, label }) {
  return (
    <div style={{ flex: 1, border: `1px solid ${LINE}`, padding: "12px 10px", textAlign: "center" }}>
      <div className="lk-display" style={{ color: GOLD, fontSize: 24 }}>{num}</div>
      <div className="lk-body" style={{ color: CREAM_SOFT, fontSize: 10, marginTop: 2, letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}
 
/* ---------------- style tokens ---------------- */
const panelStyle = {
  background: PANEL,
  border: `1px solid ${LINE}`,
  padding: "26px 22px",
};
const cardBtn = {
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: `1px solid ${LINE}`,
  padding: "16px 18px",
  cursor: "pointer",
};
const btnGold = {
  background: GOLD,
  color: "#FFFFFF",
  border: "none",
  padding: "12px 18px",
  fontSize: 13,
  letterSpacing: "0.04em",
  cursor: "pointer",
};
const btnGhost = {
  background: "transparent",
  color: CREAM_SOFT,
  border: `1px solid ${LINE}`,
  padding: "9px 14px",
  fontSize: 12,
  cursor: "pointer",
};
const inputStyle = {
  width: "100%",
  background: "#F5F0FC",
  color: CREAM,
  border: `1px solid ${LINE}`,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
};
const selectStyle = {
  width: "100%",
  background: "#F5F0FC",
  color: CREAM,
  border: `1px solid ${LINE}`,
  padding: "10px 12px",
  fontSize: 13,
};
const stepBtn = {
  width: 24,
  height: 24,
  background: "transparent",
  border: `1px solid ${LINE}`,
  color: CREAM,
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1,
};
 