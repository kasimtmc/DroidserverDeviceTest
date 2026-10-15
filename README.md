# DroidServer cihaz testi

DroidServer'ın gerçek telefonda denenmesi için adım adım kontrol listesi ve sonuçların tutulduğu yerel depo. Sonuçlar düz dosyalarda durur; Claude, ChatGPT, Gemini, Copilot veya Cursor gibi dosya okuyabilen her asistan bu klasörü açıp sonuçlara bakabilir.

## Kullanım

Üç yoldan birini seçin:

1. **Önerilen: küçük yerel sunucu.** Python 3.8 veya üstü yeterli; başka bir şey kurmaya gerek yok.
   ```
   python3 sunucu.py
   ```
   Tarayıcı kendiliğinden açılır. Her işaret ve not hemen `sonuclar/` klasörüne yazılır.
   - Test sayfasını telefondan açmak için: `python3 sunucu.py --ag`. Terminalde yazan adresi telefonda açın. Bu adres bir anahtar içerir, yalnızca kendi cihazlarınızla paylaşın.
   - Port doluysa: `python3 sunucu.py --port 8766`.
2. **Python yoksa: dosyayı açın.** `index.html`'i Chrome veya Edge ile açın, **Sonuç klasörüne bağla**'ya basıp bu klasörü seçin. Tarayıcı bir kez izin ister; sonuçlar yine `sonuclar/`'a yazılır.
3. **Diğer tarayıcılar (Firefox, Safari, telefon tarayıcısı).** Sonuçlar yalnızca o tarayıcıda kalır. Asistana iletmek için **Özeti kopyala**'yı kullanıp yapıştırın. Başka bir yere taşımak için **Dışa aktar (JSON)** / **İçe aktar** kullanın; içe aktarmada yalnızca daha yeni sonuçlar alınır.

Sayfadaki "Telefonun IP adresi" ve "API anahtarı" alanları yalnızca komutları doldurur. Anahtar hiçbir dosyaya yazılmaz.

## Asistana nasıl söylenir

Asistana bu klasörü gösterip şunu yazmanız yeterli:

> Bu klasördeki AGENTS.md'yi oku ve DroidServer cihaz testi sonuçlarına bak.

Asistan önce `sonuclar/SONUCLAR.md`'yi okur. Bu dosyada sorunlar en üstte, notlarıyla birlikte yer alır.

## Klasördekiler

| Dosya | Ne işe yarar |
|---|---|
| `index.html`, `sayfa.js` | Test sayfası |
| `adimlar.json` | Tüm adımlar: ne yapılacak, komut, beklenen sonuç. Adımlar yalnızca burada düzenlenir. |
| `adimlar.js` | `adimlar.json`'un sayfa için kopyası; `sunucu.py` her açılışta yeniden üretir. |
| `sonuclar/sonuclar.json` | Sonuçların asıl kaydı |
| `sonuclar/SONUCLAR.md` | Okunabilir özet; her değişiklikte yeniden üretilir |
| `sonuclar/gecmis.jsonl` | Her değişikliğin satır satır kaydı |
| `sunucu.py` | Yerel sunucu ve komut satırı araçları (`ozet`, `adim`, `isaretle`) |
| `AGENTS.md` | Asistanlar için açıklama |

İlk sonuçlar, 14 Ekim 2026'ya kadar claude.ai'deki test sayfasında işaretlenen 77 adımdır. O sayfa bundan sonra bu klasörle eşitlenmez; yeni sonuçları buraya girin.

15 Ekim 2026 güncellemesi: **Yeni arayüz** (ui1-ui5) ve **Faz 16** (otomasyon, formlar, GraphQL, yapay zekâ ve anlamsal arama; f16o1-f16y6) bölümleri eklendi. Ekran adları değiştiği için f13g2 (güvenlik duvarı izin listesi) ve f13r1 (canlı kopya kurulumu) adımlarının metni güncellendi. Var olan sonuçlar korunur.

Klasör bir git deposudur. Sonuçların sürümlerini saklamak isterseniz zaman zaman `git add -A && git commit -m "sonuçlar"` çalıştırabilirsiniz. `.anahtar` dosyası git'e girmez.
