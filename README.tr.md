# agy — Claude Code için Google Antigravity

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

**agy CLI**'yi (Google Antigravity) Claude Code içinde ikinci bir model olarak kullanın —
`codex` eklentisinin `agy` karşılığı. Sorular sorun, ikinci görüşler alın, diff'inizi
inceletin veya yazma yetkisi olan görevleri devredin; hepsi Claude Code'dan çıkmadan.

İlginç kılan ne: **agy, Gemini, Claude *ve* GPT-OSS modellerini** tek bir CLI ve hesap
arkasında çalıştırabilir. Bu eklenti bunu açığa çıkarır — her çağrıda herhangi birini
seçin ya da bir varsayılan belirleyin, doğrudan Claude Code'dan.

> ⚠️ **Resmi değildir.** Bu bir topluluk eklentisidir; Google veya Anthropic ile bağlantılı
> değildir ya da onlar tarafından desteklenmez. "Antigravity", "Gemini", "Claude" ve
> "Codex" kendi sahiplerine aittir.

---

## Neler elde edersiniz

| Komut | Ne yapar |
|---|---|
| `/agy:ask` | agy'ye tek seferlik bir soru sorun (varsayılan olarak salt okunur) |
| `/agy:research` | agy'den araştırıp bir yanıt sentezlemesini isteyin |
| `/agy:rescue` | Bir görevi/düzeltmeyi devredin — **agy dosyaları düzenleyebilir** |
| `/agy:review` | agy yerel git diff'inizi inceler (salt okunur) |
| `/agy:adversarial-review` | Diff'inizin acımasız çekişmeli incelemesi (salt okunur) |
| `/agy:model` | **Varsayılan** modeli göster veya ayarla |
| `/agy:models` | Hesabınızın kullanabileceği **tüm** modelleri listele (Gemini / Claude / GPT-OSS) |
| `/agy:update` | agy CLI'yi güncelle; model listesini yeniler |
| `/agy:setup` | Entegrasyonun sağlık kontrolünü yap |
| `/agy:install` | agy CLI'yi yükle (önce sorar) |
| `/agy:status` `/agy:result` `/agy:cancel` | Arka plan işlerini yönet |

---

## Gereksinimler

- **Claude Code** (bu, onun için bir eklentidir)
- **Node.js 18+** (çalışma ortamı Node'dur; `node-pty` ilk çalıştırmada otomatik olarak yüklenir)
- **agy CLI** (Google Antigravity). Yok mu? `/agy:install` çalıştırın (önce sorar) veya
  <https://antigravity.google> adresinden manuel olarak yükleyin. Yükledikten sonra,
  oturum açmak için bir kez `agy`'yi etkileşimli olarak çalıştırın.

**Windows** ve **Linux** (x86_64) üzerinde test edilmiştir. macOS çalışmalıdır (aynı kod
yolları) ancak test edilmemiştir. Linux/SSH uyarısı için aşağıdaki *Platform notları*
bölümüne bakın.

---

## Kurulum

> **`/plugin` komutunu göremiyor musunuz?** Claude Code'unuz çok eski — `/plugin` güncel bir
> sürüm gerektirir (2.1.143+). Önce Claude Code'u güncelleyin (Store uygulaması: Microsoft
> Store / App store üzerinden güncelleyin; CLI: `claude update`), ardından yeniden başlatın.
> Opus 4.8 gibi yeni bir *modeli* kullanabiliyor olmanız uygulamanızın güncel olduğu
> anlamına **gelmez** — modeller sunucudan gelir, `/plugin` özelliği ise uygulamadan gelir.

**Adım 1 — pazar yerini ekleyin ve yükleyin** (Claude Code içinde):

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**Adım 2 — komutların görünmesini sağlayın. ⚠️ Bu adım gereklidir ve insanların takıldığı
yerdir.** Yeni yüklenen komutlar, yeniden yükleyene veya yeniden başlatana kadar görünmez:

- **`/reload-plugins`** çalıştırın, **ve**
- eğer `/agy:*` komutları hâlâ görünmüyorsa (veya bir eklenti *güncellemesinden* sonra),
  **Claude Code'dan tamamen çıkıp yeniden açın** (yalnızca sekmeyi değil, pencereyi/uygulamayı
  tamamen kapatın). Yepyeni komut dosyaları için bazen tek başına bir yeniden yükleme yeterli
  olmaz.

**Adım 3 — sağlık kontrolü:**

```bash
/agy:setup     # agy + node-pty + kimlik doğrulamayı doğrular; ilk çalıştırmada node-pty'yi otomatik yükler
```

İlk `/agy:*` çağrısı ~15–20 sn sürer (bir defalık node-pty kurulumu + ilk model listesi
çekimi). Bu normaldir — sonrasında önbelleğe alınır, sonraki çağrılar hızlıdır.

agy'yi yönlendiren ilk komut ~15–20 sn sürebilir (bir defalık node-pty kurulumu + bir model
listesi çekimi, ikisi de sonrasında önbelleğe alınır).

---

## Nasıl çalışır (ve neden)

agy 1.0.x **yalnızca gerçek bir konsol (TTY) algıladığında çıktı üretir** — düz, başsız bir
`spawn()` hiçbir şey döndürmez. Bu nedenle bu eklenti, agy'yi **`node-pty` aracılığıyla
sentezlenmiş bir konsol (ConPTY) içinde** çalıştırır, çıktısını okur, ANSI/BOM'u temizler ve
yanıtı döndürür. `node-pty`, yaygın Node/OS kombinasyonları için önceden derlenmiş ikili
dosyalarla gelir ve ilk kullanımda otomatik olarak yüklenir (normal durumda C++ araç zinciri
gerekmez).

Model listesi, agy'nin etkileşimli `/model` menüsünden canlı olarak çekilir ve agy ikili
dosyasının parmak izine göre anahtarlanarak önbelleğe alınır — agy güncellendiğinde otomatik
olarak yeniden çekilir.

---

## Model seçimi

agy'nin **`--model` CLI bayrağı yoktur**, bu yüzden bu eklenti `~/.gemini/antigravity-cli/settings.json`
dosyasını kısa ve güvenli bir şekilde yeniden yazarak ve ardından geri yükleyerek bir model
seçer. Bu işlem bir kilit altında yapılır ve **çökmeye karşı güvenlidir** — bir çalıştırma orta
yerinde sonlandırılsa bile ayarlarınız asla bozuk bırakılmaz (orijinali kalıcı hale getirilir ve
bir sonraki çalıştırmada kurtarılır).

```bash
/agy:models                                  # hesabınızın çalıştırabileceği her şeyi görün
/agy:model                                   # geçerli varsayılanı göster
/agy:model pro                               # varsayılanı en güçlü Gemini Pro'ya ayarla
/agy:model flash                             # varsayılanı Gemini Flash'a ayarla (hızlı, ucuz)
/agy:model "Claude Opus 4.6 (Thinking)"      # varsayılanı bir Claude modeline ayarla
/agy:ask --model flash  your question        # tek seferlik geçersiz kılma (varsayılanı değiştirmez)
```

- **Takma adlar** (`pro`, `flash`, ayrıca `pro-low`, `flash-medium`, …) **yalnızca Gemini**
  içindir ve canlı listeyi izler, böylece `pro`/`flash` otomatik olarak en yeni Gemini
  katmanını takip eder.
- **Claude / GPT-OSS** modelleri **tam etiket** gerektirir — bunu `/agy:models`'ten kopyalayın.
- Varsayılan, `~/.agy-jobs/config.json` dosyasına kaydedilir — anında, oturumlar arasında
  kalıcı, terminal yeniden başlatması gerekmez. Çağrı başına bir `--model` her zaman varsayılana
  üstün gelir.
- Her çalıştırma **gerçekten kullanılan** modeli bildirir (modelin kendi raporundan değil,
  agy'nin kendi günlüğünden okunur — modeller kendilerini adlandırmada güvenilmezdir).

---

## İzinler

- `ask` / `research` varsayılan olarak **salt okunurdur**; düzenlemelere izin vermek için
  `--write` ekleyin.
- `rescue` varsayılan olarak **yazma yetkisine sahiptir**; yalnızca tavsiye için `--read-only`
  ekleyin.
- `review` / `adversarial-review` **her zaman salt okunurdur** — bulgular üzerinde harekete
  geçmek için `/agy:rescue` kullanın.
- Salt okunur çalıştırmalar agy'nin `--sandbox`'ını (terminal kısıtlamaları) geçirir: agy hâlâ
  dosyaları okuyup analiz edebilir, ancak sistem/terminal yan etkileri engellenir.

---

## Platform notları

- **Windows / Linux** — tamamen test edilmiştir (model değiştirme, çekim, çökmeye karşı güvenli
  geri yükleme hepsi çalışır).
- **Linux + SSH tuzağı**: agy, grafik bir oturumda oturum açtığınızda giriş bilgilerinizi masaüstü
  keyring'inde saklar, ancak bir SSH oturumu algıladığında (`SSH_CONNECTION`) dosya tabanlı
  belirteçlere geçer. Bu ikisi durumu paylaşmaz, bu yüzden eklentiyi **çıplak bir SSH bağlantısı
  üzerinden** çalıştırmak, masaüstünde oturum açmış olsanız bile "Authentication required"
  hatasıyla karşılaşabilir. Çözümler: oturumu SSH oturumunun *içinde* açın **veya** masaüstünden
  başlatılmış bir `tmux`/`screen` oturumunun içinde çalıştırın (ortamında `SSH_CONNECTION`
  yoktur) — o zaman agy masaüstü girişini normal şekilde okur. Bu bir agy CLI davranışıdır,
  eklenti hatası değildir.

---

## ⚠️ Gizlilik — bunu okuyun

agy, istemlerinizi (ve `review` için kod diff'inizi) **Google'ın sunucularına** gönderir.
Bunu sırlar, kimlik bilgileri, özel anahtarlar veya üçüncü bir tarafla paylaşamayacağınız gizli
/ yayımlanmamış işler üzerinde **kullanmayın**. Onu diğer herhangi bir bulut yapay zeka hizmeti
gibi değerlendirin.

---

## Sorun giderme

- **`/plugin` komutu bulunamadı** → Claude Code'unuz çok eski (2.1.143'ün altında). Uygulamayı
  güncelleyin ve yeniden başlatın (bkz. [Kurulum](#kurulum)). Yeni bir *modeli* kullanabiliyor
  olmanız uygulamanın güncel olduğu anlamına gelmez.
- **Yüklendi ama `/agy:*` komutları görünmüyor** → **`/reload-plugins`** çalıştırın; hâlâ
  görünmüyorsa Claude Code'dan **tamamen çıkıp yeniden açın**. Yeni komut dosyalarının
  yüklenmesi için bir yeniden yükleme/yeniden başlatma gerekir.
- **`/agy:setup`, `agy binary: NOT FOUND` diyor** → `/agy:install` çalıştırın veya `AGY_BIN`
  ortam değişkenini agy yürütülebilir dosyasının yoluna ayarlayın.
- **`node-pty: UNAVAILABLE`** → bir defalık otomatik kurulum başarısız oldu; Node.js + npm'in
  PATH üzerinde olduğundan ve ağınızın bulunduğundan emin olun, ardından `/agy:setup`'ı yeniden
  çalıştırın.
- **Yanıt yok / kimlik doğrulama hatası** → oturum açmak için bir terminalde bir kez `agy`'yi
  etkileşimli olarak çalıştırın.
- **agy güncellemesinden sonra model listesi eski görünüyor** → `/agy:models --refresh` veya
  `/agy:update`.

Başarısızlıkta döngüsel olarak yeniden denemeyin — temel nedeni düzeltin (kimlik doğrulama,
kurulum, ağ).

---

## Lisans

MIT. Resmi değildir; Google veya Anthropic ile bağlantılı değildir.
