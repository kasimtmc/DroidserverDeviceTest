// DroidServer cihaz testi sayfası.
// Sonuçlar üç yoldan birine yazılır:
//   1. sunucu.py ile açıldıysa: sunucu sonuclar/ klasörüne yazar.
//   2. Dosya olarak açıldıysa ve tarayıcı izin veriyorsa (Chrome, Edge): seçilen klasöre doğrudan yazılır.
//   3. Hiçbiri yoksa: yalnızca bu tarayıcıda; Dışa aktar / Özeti kopyala ile taşınır.
"use strict";

const DATA = window.ADIMLAR || { bolumler: [] };
const SECTIONS = DATA.bolumler;
const ALL = SECTIONS.flatMap(s => s.adimlar);
const IDS = new Set(ALL.map(a => a.id));
const DURUMLAR = { ok: "Tamam", fail: "Sorun", skip: "Atlandı" };
const LOCAL_KEY = "ds-cihaz-testi-sonuclar";
const KEY_KEY = "ds-cihaz-testi-anahtar";

let results = {};      // id -> {durum, not, zaman, kaynak}
let guncelleme = "";
let store = null;      // {kind, save(id), poll()}

// ---- yardımcılar

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c])); }
function now() { return new Date().toISOString(); }
function plain(h) { const d = document.createElement("div"); d.innerHTML = h || ""; return d.textContent.trim(); }
function fillCmd(cmd) {
  const ip = document.getElementById("ip").value.trim() || "<IP>";
  const key = document.getElementById("key").value.trim() || "<ANAHTAR>";
  return cmd.replaceAll("{IP}", ip).replaceAll("{KEY}", key);
}
function setSync(text, kind) { const el = document.getElementById("sync"); el.textContent = text; el.dataset.kind = kind || ""; }
function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ guncelleme, sonuclar: results })); } catch (_) {} }
function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    results = d.sonuclar || {}; guncelleme = d.guncelleme || "";
  } catch (_) {}
}
function typingId() { const a = document.activeElement; return a && a.matches(".note textarea") ? a.closest(".step").dataset.id : null; }

// Kaynaktan gelen sonuçları uygula; yazılmakta olan not korunur.
function applyState(d) {
  const typing = typingId();
  const next = Object.assign({}, d.sonuclar || {});
  if (typing && results[typing]) next[typing] = Object.assign({}, next[typing] || {}, { not: results[typing].not });
  results = next; guncelleme = d.guncelleme || "";
  saveLocal(); renderAll();
}

function stateJson() { return { bicim: 1, guncelleme, sonuclar: sortObj(results) }; }
function sortObj(o) { return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))); }

// sunucu.py'deki ozet_md ile aynı biçim.
function summaryMd(d) {
  const s = d.sonuclar;
  const tum = SECTIONS.flatMap(b => b.adimlar.map(a => [b, a]));
  const say = { ok: 0, fail: 0, skip: 0 };
  tum.forEach(([, a]) => { const x = s[a.id]?.durum; if (x in say) say[x]++; });
  const bekleyen = tum.length - say.ok - say.fail - say.skip;
  const out = ["# DroidServer cihaz testi: sonuçlar", "",
    "> Bu dosya `sonuclar/sonuclar.json`'dan otomatik üretilir; elle düzenlemeyin.", "",
    `- Son güncelleme: ${d.guncelleme || "-"}`,
    `- ${tum.length} adım: Tamam ${say.ok}, Sorun ${say.fail}, Atlandı ${say.skip}, Bekliyor ${bekleyen}`, ""];
  const liste = (baslik, kosul, ayrinti) => {
    const og = tum.filter(([, a]) => kosul(s[a.id]?.durum));
    out.push(`## ${baslik} (${og.length})`, "");
    if (!og.length) { out.push("Yok.", ""); return; }
    og.forEach(([b, a]) => {
      const r = s[a.id] || {};
      out.push(`- **${a.id}** · ${b.baslik} › ${a.baslik}`);
      if (ayrinti) out.push(`  - Beklenen: ${plain(a.beklenen)}`);
      if (r.not) out.push("  - Not: " + r.not.replace(/\n/g, "\n    "));
      if (r.zaman) out.push(`  - Zaman: ${r.zaman}`);
    });
    out.push("");
  };
  liste("Sorunlar", x => x === "fail", true);
  liste("Atlananlar", x => x === "skip", false);
  liste("Bekleyenler", x => !(x in DURUMLAR), false);
  liste("Tamamlananlar", x => x === "ok", false);
  return out.join("\n");
}

// ---- çizim

function renderSections() {
  document.getElementById("sections").innerHTML = SECTIONS.map(sec => `
    <section aria-labelledby="sec-${sec.id}">
      <div class="sec-head"><h2 id="sec-${sec.id}">${esc(sec.baslik)}</h2><span class="sec-count" data-sec="${sec.id}"></span></div>
      ${sec.not ? `<p class="sec-note">${sec.not}</p>` : ""}
      ${sec.adimlar.map(st => `
        <article class="step" id="step-${st.id}" data-id="${st.id}">
          <div class="step-top"><span class="sid">${st.id}</span><span class="title">${esc(st.baslik)}</span></div>
          <div class="body">
            ${st.yapilacaklar ? `<ul>${st.yapilacaklar.map(b => `<li>${b}</li>`).join("")}</ul>` : ""}
            ${st.komut ? `<div class="cmd"><pre data-cmd="${esc(st.komut)}"></pre><button class="copy" type="button">Kopyala</button></div>` : ""}
            <p class="expect"><strong>Beklenen:</strong> ${st.beklenen}</p>
          </div>
          <div class="actions" role="group" aria-label="${esc(st.id)} sonucu">
            <button type="button" class="b-ok" data-set="ok" aria-pressed="false">Tamam</button>
            <button type="button" class="b-fail" data-set="fail" aria-pressed="false">Sorun</button>
            <button type="button" class="b-skip" data-set="skip" aria-pressed="false">Atla</button>
          </div>
          <div class="note" hidden><textarea id="note-${st.id}" aria-label="${esc(st.id)} notu" placeholder="Ne oldu? Hata mesajı, Loglar'daki son satırlar…"></textarea></div>
        </article>`).join("")}
    </section>`).join("");
  refreshCommands();
}

function refreshCommands() { document.querySelectorAll("pre[data-cmd]").forEach(pre => { pre.textContent = fillCmd(pre.dataset.cmd); }); }

function renderStep(id) {
  const el = document.getElementById("step-" + id);
  if (!el) return;
  const r = results[id] || {};
  el.dataset.status = r.durum || "";
  el.querySelectorAll("[data-set]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.set === r.durum)));
  const note = el.querySelector(".note");
  const ta = note.querySelector("textarea");
  if (document.activeElement !== ta) ta.value = r.not || "";
  note.hidden = !(r.durum === "fail" || r.durum === "skip" || (r.not || "").length > 0 || document.activeElement === ta);
}

function renderSummary() {
  const n = ALL.length || 1;
  const c = { ok: 0, fail: 0, skip: 0 };
  ALL.forEach(s => { const st = results[s.id]?.durum; if (st in c) c[st]++; });
  const done = c.ok + c.fail + c.skip;
  const [mOk, mBad, mSkip] = document.querySelectorAll("#meter span");
  mOk.style.width = (100 * c.ok / n) + "%"; mBad.style.width = (100 * c.fail / n) + "%"; mSkip.style.width = (100 * c.skip / n) + "%";
  document.getElementById("counts").innerHTML =
    `<span><b>${done}/${ALL.length}</b> adım</span><span>Tamam <b>${c.ok}</b></span><span>Sorun <b>${c.fail}</b></span><span>Atlanan <b>${c.skip}</b></span>`;
  SECTIONS.forEach(sec => {
    const d = sec.adimlar.filter(s => results[s.id]?.durum in DURUMLAR).length;
    const el = document.querySelector(`[data-sec="${sec.id}"]`);
    if (el) el.textContent = `${d}/${sec.adimlar.length}`;
  });
}

function renderAll() { ALL.forEach(s => renderStep(s.id)); renderSummary(); }

// ---- 1. sunucu.py

function serverStore(token) {
  const headers = { "X-Anahtar": token };
  return {
    kind: "server",
    async load() {
      const r = await fetch("api/sonuclar", { headers, cache: "no-store" });
      if (r.status === 401) throw Object.assign(new Error("anahtar"), { code: 401 });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    },
    async save(id) {
      const v = results[id] || {};
      const r = await fetch("api/sonuclar/" + encodeURIComponent(id), {
        method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify({ durum: v.durum || "", not: v.not || "" }),
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))).hata) || ("HTTP " + r.status));
      return r.json();
    },
    async poll() { const d = await this.load(); if (d.guncelleme !== guncelleme) applyState(d); },
    label: "Sonuçlar sonuclar/ klasörüne yazılıyor (sunucu.py). Asistanlar sonuclar/SONUCLAR.md dosyasını okuyabilir.",
  };
}

// ---- 2. seçilen klasör (File System Access API)

const IDB = {
  open() { return new Promise((ok, no) => { const r = indexedDB.open("ds-cihaz-testi", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); },
  async get(k) { const db = await this.open(); return new Promise(ok => { const r = db.transaction("kv").objectStore("kv").get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(undefined); }); },
  async set(k, v) { const db = await this.open(); return new Promise(ok => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => ok(); t.onerror = () => ok(); }); },
};

async function resultsDir(root) {
  // Kök klasör (adimlar.json'un olduğu) veya doğrudan sonuclar/ seçilebilir.
  try { await root.getFileHandle("sonuclar.json"); return root; } catch (_) {}
  return root.getDirectoryHandle("sonuclar", { create: true });
}

function folderStore(root, dir) {
  let lastModified = 0;
  let chain = Promise.resolve();
  async function readFile() {
    try {
      const f = await (await dir.getFileHandle("sonuclar.json")).getFile();
      lastModified = f.lastModified;
      return JSON.parse((await f.text()) || "{}");
    } catch (_) { return { bicim: 1, guncelleme: "", sonuclar: {} }; }
  }
  async function writeText(name, text, append) {
    const h = await dir.getFileHandle(name, { create: true });
    const w = await h.createWritable({ keepExistingData: !!append });
    if (append) await w.seek((await h.getFile()).size);
    await w.write(text);
    await w.close();
  }
  async function writeAll(d, changes) {
    await writeText("sonuclar.json", JSON.stringify(d, null, 2) + "\n");
    await writeText("SONUCLAR.md", summaryMd(d) + "\n");
    if (changes.length) await writeText("gecmis.jsonl", changes.map(c => JSON.stringify(c)).join("\n") + "\n", true);
    lastModified = (await (await dir.getFileHandle("sonuclar.json")).getFile()).lastModified;
  }
  return {
    kind: "folder",
    async load() {
      // Dosya esas; bu tarayıcıda daha yeni olan sonuçlar dosyaya eklenir.
      const d = await readFile();
      d.sonuclar = d.sonuclar || {};
      const changes = [];
      for (const [id, v] of Object.entries(results)) {
        if (!IDS.has(id)) continue;
        const f = d.sonuclar[id];
        if (!f || (v.zaman || "") > (f.zaman || "")) {
          d.sonuclar[id] = v;
          changes.push({ zaman: v.zaman || now(), adim: id, durum: v.durum || "", not: v.not || "", kaynak: v.kaynak || "test sayfası" });
        }
      }
      if (changes.length) {
        d.sonuclar = sortObj(d.sonuclar); d.guncelleme = now(); d.bicim = 1;
        await writeAll(d, changes);
      }
      return d;
    },
    save(id) {
      chain = chain.then(async () => {
        const d = await readFile();
        d.sonuclar = d.sonuclar || {};
        const v = results[id];
        if (!v || (!v.durum && !v.not)) delete d.sonuclar[id]; else d.sonuclar[id] = v;
        d.sonuclar = sortObj(d.sonuclar); d.guncelleme = v?.zaman || now(); d.bicim = 1;
        await writeAll(d, [{ zaman: d.guncelleme, adim: id, durum: v?.durum || "", not: v?.not || "", kaynak: "test sayfası" }]);
        return d;
      });
      return chain;
    },
    async poll() {
      const f = await (await dir.getFileHandle("sonuclar.json")).getFile();
      if (f.lastModified !== lastModified) applyState(await readFile());
    },
    label: `Sonuçlar seçilen klasöre yazılıyor (${root.name}${dir === root ? "" : "/sonuclar"}). Asistanlar SONUCLAR.md dosyasını okuyabilir.`,
  };
}

async function connectFolder(fromUser) {
  let root = await IDB.get("klasor").catch(() => undefined);
  if (root && (await root.queryPermission({ mode: "readwrite" })) !== "granted") {
    if (!fromUser) return false;
    if ((await root.requestPermission({ mode: "readwrite" })) !== "granted") root = null;
  }
  if (!root) {
    if (!fromUser) return false;
    root = await window.showDirectoryPicker({ id: "ds-cihaz-testi", mode: "readwrite" });
    await IDB.set("klasor", root);
  }
  const s = folderStore(root, await resultsDir(root));
  applyState(await s.load());
  useStore(s);
  return true;
}

// ---- 3. yalnızca bu tarayıcı

const localStore = {
  kind: "local",
  async save() {},
  async poll() {},
  label: "Sonuçlar şimdilik yalnızca bu tarayıcıda. Asistanların okuyabilmesi için sonuç klasörüne bağlayın, python3 sunucu.py ile açın veya Özeti kopyala ile yapıştırın.",
};

// ---- kaynak seçimi

let pollTimer = null;
function useStore(s) {
  store = s;
  setSync(s.label, s.kind === "local" ? "warn" : "");
  document.getElementById("b-folder").hidden = !(s.kind === "local" && "showDirectoryPicker" in window);
  clearInterval(pollTimer);
  if (s.kind !== "local") pollTimer = setInterval(() => {
    if (document.hidden) return;
    s.poll().catch(e => setSync("Sonuçlar okunamıyor (" + (e.message || e) + "); sayfayı yenileyin.", "err"));
  }, 4000);
}

async function persist(id) {
  saveLocal();
  try {
    const d = await store.save(id);
    if (d && d.guncelleme) guncelleme = d.guncelleme;
    if (store.kind !== "local") setSync(store.label);
  } catch (e) {
    setSync("Kaydedilemedi (" + (e.message || e) + "); sonuç bu tarayıcıda duruyor.", "err");
  }
}

async function init() {
  try { document.getElementById("ip").value = localStorage.getItem("ds-cihaz-testi-ip") || ""; } catch (_) {}
  loadLocal();
  renderSections();
  renderAll();
  if (!ALL.length) { setSync("adimlar.js bulunamadı: sayfayı klasördeki diğer dosyalarla birlikte açın.", "err"); return; }

  const m = /^#anahtar=([\w-]+)$/.exec(location.hash);
  if (m) { try { localStorage.setItem(KEY_KEY, m[1]); } catch (_) {} history.replaceState(null, "", location.pathname + location.search); }
  if (location.protocol.startsWith("http")) {
    let token = m ? m[1] : null;
    try { token = token || localStorage.getItem(KEY_KEY); } catch (_) {}
    const s = serverStore(token || "");
    try {
      const d = await s.load();
      // Bu tarayıcıda olup sunucuda olmayan (veya daha yeni olan) sonuçlar da sunucuya yazılır.
      const mine = Object.entries(results).filter(([id, v]) => IDS.has(id) && (v.zaman || "") > ((d.sonuclar || {})[id]?.zaman || ""));
      applyState(d);
      useStore(s);
      for (const [id, v] of mine) { results[id] = v; await persist(id); }
      if (mine.length) renderAll();
      return;
    } catch (e) {
      if (e.code === 401) { useStore(localStore); setSync("Sunucu anahtar istiyor: terminalde sunucu.py'nin yazdırdığı adresi açın.", "err"); return; }
    }
  }
  if ("showDirectoryPicker" in window && await connectFolder(false).catch(() => false)) return;
  useStore(localStore);
}

// ---- olaylar

document.addEventListener("click", async ev => {
  const setBtn = ev.target.closest("button[data-set]");
  if (setBtn) {
    const id = setBtn.closest(".step").dataset.id;
    const cur = results[id] || {};
    const durum = cur.durum === setBtn.dataset.set ? "" : setBtn.dataset.set;
    results[id] = Object.assign({}, cur, { durum, zaman: now(), kaynak: "test sayfası" });
    guncelleme = results[id].zaman;
    renderStep(id); renderSummary();
    if (durum === "fail") document.getElementById("note-" + id).focus();
    persist(id);
    return;
  }
  const copyBtn = ev.target.closest("button.copy");
  if (copyBtn) {
    const pre = copyBtn.parentElement.querySelector("pre");
    copyText(pre.textContent, copyBtn, pre);
  }
});

async function copyText(text, btn, selectEl) {
  const label = btn.textContent;
  try { await navigator.clipboard.writeText(text); btn.textContent = "Kopyalandı"; }
  catch (_) {
    if (selectEl) { const r = document.createRange(); r.selectNodeContents(selectEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Seçildi"; }
    else btn.textContent = "Kopyalanamadı";
  }
  setTimeout(() => { btn.textContent = label; }, 1500);
}

const pending = new Map();
document.addEventListener("input", ev => {
  if (ev.target.id === "ip" || ev.target.id === "key") {
    if (ev.target.id === "ip") { try { localStorage.setItem("ds-cihaz-testi-ip", ev.target.value); } catch (_) {} }
    refreshCommands();
    return;
  }
  const ta = ev.target.closest(".note textarea");
  if (!ta) return;
  const id = ta.closest(".step").dataset.id;
  results[id] = Object.assign({}, results[id] || {}, { not: ta.value, zaman: now(), kaynak: "test sayfası" });
  results[id].durum = results[id].durum || "";
  clearTimeout(pending.get(id));
  pending.set(id, setTimeout(() => persist(id), 900));
});

document.getElementById("b-folder").addEventListener("click", () => {
  connectFolder(true).catch(e => { if (e.name !== "AbortError") setSync("Klasöre bağlanılamadı (" + (e.message || e) + ").", "err"); });
});
document.getElementById("b-copy").addEventListener("click", ev => copyText(summaryMd(stateJson()), ev.currentTarget));
document.getElementById("b-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(stateJson(), null, 2) + "\n"], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "sonuclar.json" });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
document.getElementById("b-import").addEventListener("click", () => document.getElementById("f-import").click());
document.getElementById("f-import").addEventListener("change", async ev => {
  const file = ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    const gelen = d.sonuclar || {};
    // İçe aktarılan dosyadaki daha yeni sonuçlar alınır ve etkin kaynağa yazılır.
    const ids = Object.keys(gelen).filter(id => IDS.has(id) && (gelen[id].zaman || "") > (results[id]?.zaman || ""));
    ids.forEach(id => { results[id] = gelen[id]; });
    renderAll();
    for (const id of ids) await persist(id);
    setSync(ids.length + " sonuç içe aktarıldı. " + store.label);
  } catch (e) { setSync("İçe aktarılamadı: " + (e.message || e), "err"); }
});

init();
