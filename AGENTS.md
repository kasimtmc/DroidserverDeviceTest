# Asistanlar için: DroidServer cihaz testi sonuç deposu

Bu klasör, DroidServer Android uygulamasının (kaynak: github.com/kasimtmc/droidserver) gerçek telefondaki elle test sonuçlarını tutar. Kullanıcı Türkçe konuşur; yanıtlarınızı Türkçe verin.

## Sonuçları okumak

1. Önce `sonuclar/SONUCLAR.md`'yi okuyun. İçinde sayılar, notlarıyla birlikte sorunlu adımlar, atlananlar ve bekleyenler var.
2. Bir adımın tam olarak ne istediğini görmek için `adimlar.json`'a bakın ya da `python3 sunucu.py adim <id>` çalıştırın.
3. Kesin veri `sonuclar/sonuclar.json`'dadır. Değişikliklerin sırası `sonuclar/gecmis.jsonl`'de, satır başına bir JSON nesnesi olarak durur.

## Biçim

`adimlar.json`:
```json
{ "baslik": "...", "bolumler": [ { "id": "faz15", "baslik": "...", "not": "HTML olabilir",
    "adimlar": [ { "id": "f15a1", "baslik": "...", "yapilacaklar": ["HTML"], "komut": "curl ... {IP} {KEY}", "beklenen": "HTML" } ] } ] }
```
- Komutlardaki `{IP}` telefonun adresi, `{KEY}` ise API anahtarıdır. Sayfa bunları kullanıcının girdiği değerlerle doldurur.
- Bölümler uygulamanın geliştirme fazlarına karşılık gelir (Faz 5 kullanıcılar, Faz 15 ortam/uygulamalar/katalog, Faz 16 otomasyon/formlar/GraphQL/yapay zekâ...).

`sonuclar/sonuclar.json`:
```json
{ "bicim": 1, "guncelleme": "ISO-8601 UTC",
  "sonuclar": { "<adım id>": { "durum": "ok | fail | skip", "not": "serbest metin", "zaman": "ISO-8601 UTC", "kaynak": "test sayfası | asistan | ..." } } }
```
- `ok` Tamam, `fail` Sorun, `skip` Atlandı demektir. Listede olmayan adım henüz denenmemiştir.
- Bir sonucu kim yazdıysa `kaynak` alanında görünür.

## Sonuç yazmak

- Yalnızca kullanıcı bir sonucu açıkça söylediyse veya bir adımı kendiniz doğrulayabildiyseniz yazın. Kullanıcının yerine "Tamam" işaretlemeyin.
- Komut satırını kullanın:
  ```
  python3 sunucu.py isaretle <id> ok|fail|skip|temizle "not" --kaynak "<asistan adı>"
  ```
  Bu komut `sonuclar.json`'u günceller, `SONUCLAR.md`'yi yeniden üretir ve `gecmis.jsonl`'e satır ekler. Açık test sayfası değişikliği birkaç saniye içinde görür.
- `sonuclar.json`'u elle düzenlemeniz gerekirse biçimi koruyun, `guncelleme`'yi de güncelleyin, ardından `python3 sunucu.py ozet` çalıştırın. `SONUCLAR.md`'yi elle düzenlemeyin; bir sonraki değişiklikte üzerine yazılır.
- Notlara API anahtarı, parola, token veya kişisel veri yazmayın.

## Adım eklemek veya değiştirmek

- Adımlar yalnızca `adimlar.json`'da düzenlenir. Her adımın `id`'si benzersiz olmalı; var olan bir id'yi yeniden adlandırmayın, yoksa sonucuyla bağı kopar.
- Yeni özellikler için yeni bir bölüm ekleyin. Metinler kısa olsun: ne yapılacak, varsa komut, beklenen sonuç.
- Ardından `python3 sunucu.py ozet` çalıştırın; bu, sayfanın okuduğu `adimlar.js`'i yeniden üretir.

## Sorunları değerlendirirken

- Bir adım `fail` ise notu, adımın beklenen sonucunu ve gerekirse uygulama kaynağını birlikte değerlendirin.
- Kullanıcı Loglar ekranının görüntüsünü ayrıca iletebilir; notta "ekran görüntüsü var" yazıyorsa isteyin.
- Uygulamayı kullanıcı Android Studio ile kendisi kurar; APK üretip göndermeniz gerekmez.
