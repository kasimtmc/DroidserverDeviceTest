#!/usr/bin/env python3
"""DroidServer cihaz testi: yerel sonuç deposu.

Yalnızca Python 3.8+ standart kitaplığı gerekir.

  python3 sunucu.py                 Test sayfasını açar (http://127.0.0.1:8765), sonuçları sonuclar/ klasörüne yazar.
  python3 sunucu.py --ag            Aynı ağdaki telefondan da açılabilir (adres anahtarlı yazdırılır).
  python3 sunucu.py ozet            sonuclar/SONUCLAR.md'yi yeniden üretip yazdırır.
  python3 sunucu.py adim f15a1      Bir adımın ne istediğini ve sonucunu düz metin yazdırır.
  python3 sunucu.py isaretle f15a1 fail "node bulunamadı"   Sonuç yazar (ok | fail | skip | temizle).

Sonuçların tek kaynağı sonuclar/sonuclar.json'dur; SONUCLAR.md ondan üretilir, gecmis.jsonl her değişikliği ekler.
"""
import argparse
import html
import json
import os
import re
import secrets
import socket
import sys
import tempfile
import threading
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

KOK = os.path.dirname(os.path.abspath(__file__))
ADIMLAR = os.path.join(KOK, "adimlar.json")
ADIMLAR_JS = os.path.join(KOK, "adimlar.js")
SONUC_DIR = os.path.join(KOK, "sonuclar")
SONUCLAR = os.path.join(SONUC_DIR, "sonuclar.json")
OZET = os.path.join(SONUC_DIR, "SONUCLAR.md")
GECMIS = os.path.join(SONUC_DIR, "gecmis.jsonl")
ANAHTAR = os.path.join(KOK, ".anahtar")

DURUMLAR = {"ok": "Tamam", "fail": "Sorun", "skip": "Atlandı"}
KILIT = threading.Lock()


def simdi():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def oku_json(yol, varsayilan):
    try:
        with open(yol, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return varsayilan


def yaz_atomik(yol, metin):
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    fd, gecici = tempfile.mkstemp(dir=os.path.dirname(yol), prefix=".yaziliyor-")
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
        f.write(metin)
    os.replace(gecici, yol)


def adimlar():
    return oku_json(ADIMLAR, {"bolumler": []})


def adimlar_js_uret():
    """file:// ile açılan sayfa JSON okuyamaz; adımlar aynı içerikle bir betik olarak da yazılır."""
    metin = "// adimlar.json'dan üretilir; elle düzenlemeyin.\nwindow.ADIMLAR = " + json.dumps(adimlar(), ensure_ascii=False) + ";\n"
    try:
        with open(ADIMLAR_JS, encoding="utf-8") as f:
            if f.read() == metin:
                return
    except FileNotFoundError:
        pass
    yaz_atomik(ADIMLAR_JS, metin)


def sonuclar():
    d = oku_json(SONUCLAR, {})
    d.setdefault("bicim", 1)
    d.setdefault("guncelleme", "")
    d.setdefault("sonuclar", {})
    return d


def duz(metin):
    """Adım metnindeki HTML'i düz metne çevirir."""
    return html.unescape(re.sub(r"<[^>]+>", "", metin or "")).strip()


def ozet_md(d=None):
    d = d or sonuclar()
    s = d["sonuclar"]
    bolumler = adimlar()["bolumler"]
    tum = [(b, a) for b in bolumler for a in b["adimlar"]]
    say = {k: sum(1 for _, a in tum if s.get(a["id"], {}).get("durum") == k) for k in DURUMLAR}
    bekleyen = len(tum) - sum(say.values())
    satir = [
        "# DroidServer cihaz testi: sonuçlar",
        "",
        "> Bu dosya `sonuclar/sonuclar.json`'dan otomatik üretilir; elle düzenlemeyin.",
        "",
        f"- Son güncelleme: {d['guncelleme'] or '-'}",
        f"- {len(tum)} adım: Tamam {say['ok']}, Sorun {say['fail']}, Atlandı {say['skip']}, Bekliyor {bekleyen}",
        "",
    ]

    def liste(baslik, kosul, ayrinti):
        ogeler = [(b, a) for b, a in tum if kosul(s.get(a["id"], {}).get("durum"))]
        satir.append(f"## {baslik} ({len(ogeler)})")
        satir.append("")
        if not ogeler:
            satir.extend(["Yok.", ""])
            return
        for b, a in ogeler:
            r = s.get(a["id"], {})
            satir.append(f"- **{a['id']}** · {b['baslik']} › {a['baslik']}")
            if ayrinti:
                satir.append(f"  - Beklenen: {duz(a.get('beklenen'))}")
            if r.get("not"):
                satir.append("  - Not: " + r["not"].replace("\n", "\n    "))
            if r.get("zaman"):
                satir.append(f"  - Zaman: {r['zaman']}")
        satir.append("")

    liste("Sorunlar", lambda x: x == "fail", True)
    liste("Atlananlar", lambda x: x == "skip", False)
    liste("Bekleyenler", lambda x: x not in DURUMLAR, False)
    liste("Tamamlananlar", lambda x: x == "ok", False)
    return "\n".join(satir)


def kaydet(adim_id, durum, not_metni, kaynak):
    bilinen = {a["id"] for b in adimlar()["bolumler"] for a in b["adimlar"]}
    if adim_id not in bilinen:
        raise ValueError(f"Bilinmeyen adım: {adim_id}")
    if durum not in DURUMLAR and durum != "":
        raise ValueError("Durum ok, fail, skip veya boş olmalı")
    not_metni = (not_metni or "")[:20000]
    with KILIT:
        d = sonuclar()
        zaman = simdi()
        if durum == "" and not not_metni:
            d["sonuclar"].pop(adim_id, None)
        else:
            d["sonuclar"][adim_id] = {"durum": durum, "not": not_metni, "zaman": zaman, "kaynak": kaynak}
        d["sonuclar"] = dict(sorted(d["sonuclar"].items()))
        d["guncelleme"] = zaman
        yaz_atomik(SONUCLAR, json.dumps(d, ensure_ascii=False, indent=2) + "\n")
        yaz_atomik(OZET, ozet_md(d) + "\n")
        with open(GECMIS, "a", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps({"zaman": zaman, "adim": adim_id, "durum": durum, "not": not_metni, "kaynak": kaynak}, ensure_ascii=False) + "\n")
        return d


def anahtar():
    try:
        with open(ANAHTAR, encoding="utf-8") as f:
            a = f.read().strip()
            if a:
                return a
    except FileNotFoundError:
        pass
    a = secrets.token_urlsafe(18)
    yaz_atomik(ANAHTAR, a + "\n")
    return a


class Isleyici(BaseHTTPRequestHandler):
    server_version = "CihazTesti/1"
    ag = False
    anahtar = ""

    def log_message(self, fmt, *args):
        pass

    def gonder(self, kod, govde, tur="application/json; charset=utf-8"):
        veri = govde.encode("utf-8") if isinstance(govde, str) else govde
        self.send_response(kod)
        self.send_header("Content-Type", tur)
        self.send_header("Content-Length", str(len(veri)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(veri)

    def hata(self, kod, mesaj):
        self.gonder(kod, json.dumps({"hata": mesaj}, ensure_ascii=False))

    def izinli(self):
        # Yalnızca yerelde: başka sitelerin DNS yeniden bağlama ile erişmesini Host denetimi engeller.
        if not self.ag:
            host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
            if host not in ("127.0.0.1", "localhost", "::1"):
                return False
        # Özel başlık tarayıcıda ön kontrol gerektirir; sunucu ön kontrolü onaylamadığı için başka siteler yazamaz.
        return secrets.compare_digest(self.headers.get("X-Anahtar", ""), self.anahtar)

    def do_GET(self):
        yol = urlparse(self.path).path
        dosyalar = {"/": "index.html", "/index.html": "index.html", "/sayfa.js": "sayfa.js", "/adimlar.js": "adimlar.js"}
        if yol in dosyalar:
            if yol == "/adimlar.js":
                adimlar_js_uret()
            tur = "text/html; charset=utf-8" if dosyalar[yol].endswith(".html") else "text/javascript; charset=utf-8"
            with open(os.path.join(KOK, dosyalar[yol]), "rb") as f:
                return self.gonder(200, f.read(), tur)
        if yol == "/api/sonuclar":
            if not self.izinli():
                return self.hata(401, "Anahtar gerekli: sunucu.py'nin yazdırdığı adresi açın.")
            return self.gonder(200, json.dumps(sonuclar(), ensure_ascii=False))
        self.hata(404, "Bulunamadı")

    def do_PUT(self):
        yol = urlparse(self.path).path
        m = re.fullmatch(r"/api/sonuclar/([A-Za-z0-9_-]{1,40})", yol)
        if not m:
            return self.hata(404, "Bulunamadı")
        if not self.izinli():
            return self.hata(401, "Anahtar gerekli: sunucu.py'nin yazdırdığı adresi açın.")
        uzunluk = int(self.headers.get("Content-Length") or 0)
        if uzunluk > 100_000:
            return self.hata(413, "Çok büyük")
        try:
            govde = json.loads(self.rfile.read(uzunluk) or b"{}")
            d = kaydet(m.group(1), str(govde.get("durum", "")), str(govde.get("not", "")), "test sayfası")
        except (ValueError, json.JSONDecodeError) as e:
            return self.hata(400, str(e))
        self.gonder(200, json.dumps(d, ensure_ascii=False))


def yerel_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def sun(port, ag, ac):
    adimlar_js_uret()
    if not os.path.exists(OZET):
        yaz_atomik(OZET, ozet_md() + "\n")
    Isleyici.ag = ag
    Isleyici.anahtar = anahtar()
    adres = "0.0.0.0" if ag else "127.0.0.1"
    try:
        sunucu = ThreadingHTTPServer((adres, port), Isleyici)
    except OSError as e:
        sys.exit(f"Port {port} kullanılamıyor ({e}). Başka bir port deneyin: python3 sunucu.py --port 8766")
    yerel = f"http://127.0.0.1:{port}/#anahtar={Isleyici.anahtar}"
    print("DroidServer cihaz testi çalışıyor. Durdurmak için Ctrl+C.")
    print(f"  Bu bilgisayarda: {yerel}")
    if ag:
        print(f"  Telefondan (aynı Wi-Fi): http://{yerel_ip()}:{port}/#anahtar={Isleyici.anahtar}")
        print("  Bu adresi yalnızca kendi cihazlarınızda açın; anahtarı bilen sonuç yazabilir.")
    print(f"  Sonuçlar: {SONUC_DIR}")
    if ac:
        threading.Timer(0.5, lambda: webbrowser.open(yerel)).start()
    try:
        sunucu.serve_forever()
    except KeyboardInterrupt:
        print("\nKapatıldı.")


def adim_yazdir(adim_id):
    for b in adimlar()["bolumler"]:
        for a in b["adimlar"]:
            if a["id"] == adim_id:
                r = sonuclar()["sonuclar"].get(adim_id, {})
                print(f"{a['id']} · {b['baslik']} › {a['baslik']}")
                if b.get("not"):
                    print(f"Bölüm notu: {duz(b['not'])}")
                for y in a.get("yapilacaklar") or []:
                    print(f"- {duz(y)}")
                if a.get("komut"):
                    print("Komut:\n  " + a["komut"].replace("\n", "\n  "))
                print(f"Beklenen: {duz(a.get('beklenen'))}")
                print(f"Sonuç: {DURUMLAR.get(r.get('durum'), 'Bekliyor')}" + (f" ({r['zaman']})" if r.get("zaman") else ""))
                if r.get("not"):
                    print("Not: " + r["not"])
                return
    sys.exit(f"Bilinmeyen adım: {adim_id}")


def main():
    p = argparse.ArgumentParser(description="DroidServer cihaz testi: yerel sonuç deposu")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--ag", action="store_true", help="aynı ağdaki cihazlardan erişime aç")
    p.add_argument("--acma", action="store_true", help="tarayıcıyı kendiliğinden açma")
    alt = p.add_subparsers(dest="komut")
    alt.add_parser("ozet", help="SONUCLAR.md'yi yeniden üret ve yazdır")
    a = alt.add_parser("adim", help="bir adımı ve sonucunu yazdır")
    a.add_argument("id")
    i = alt.add_parser("isaretle", help="bir adımın sonucunu yaz")
    i.add_argument("id")
    i.add_argument("durum", choices=["ok", "fail", "skip", "temizle"])
    i.add_argument("not_metni", nargs="?", default="", metavar="not")
    i.add_argument("--kaynak", default="asistan", help="sonucu kim yazdı (varsayılan: asistan)")
    x = p.parse_args()
    if x.komut == "ozet":
        adimlar_js_uret()
        metin = ozet_md()
        yaz_atomik(OZET, metin + "\n")
        print(metin)
    elif x.komut == "adim":
        adim_yazdir(x.id)
    elif x.komut == "isaretle":
        try:
            kaydet(x.id, "" if x.durum == "temizle" else x.durum, x.not_metni, x.kaynak)
        except ValueError as e:
            sys.exit(str(e))
        print(f"{x.id}: {DURUMLAR.get(x.durum, 'temizlendi')}")
    else:
        sun(x.port, x.ag, not x.acma)


if __name__ == "__main__":
    main()
