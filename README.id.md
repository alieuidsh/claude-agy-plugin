# agy — Google Antigravity untuk Claude Code

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

Gunakan **agy CLI** (Google Antigravity) sebagai model kedua di dalam Claude Code — padanan
`agy` untuk plugin `codex`. Ajukan pertanyaan, dapatkan pendapat kedua, tinjau diff Anda,
atau delegasikan tugas yang dapat menulis berkas, semuanya tanpa meninggalkan Claude Code.

Apa yang membuatnya menarik: **agy dapat menjalankan model Gemini, Claude, *dan* GPT-OSS** di balik
satu CLI dan akun tunggal. Plugin ini menampilkan kemampuan itu — pilih salah satunya per panggilan, atau tetapkan
default, langsung dari Claude Code.

> ⚠️ **Tidak resmi.** Ini adalah plugin komunitas, tidak berafiliasi dengan atau didukung oleh
> Google maupun Anthropic. "Antigravity", "Gemini", "Claude", dan "Codex" adalah milik
> pemiliknya masing-masing.

---

## Apa yang Anda dapatkan

| Perintah | Fungsinya |
|---|---|
| `/agy:ask` | Ajukan pertanyaan sekali jalan ke agy (read-only secara default) |
| `/agy:research` | Minta agy untuk meneliti dan menyusun jawaban |
| `/agy:rescue` | Delegasikan tugas/perbaikan — **agy dapat menyunting berkas** |
| `/agy:review` | agy meninjau git diff lokal Anda (read-only) |
| `/agy:adversarial-review` | Tinjauan adversarial tanpa ampun atas diff Anda (read-only) |
| `/agy:model` | Tampilkan atau tetapkan model **default** |
| `/agy:models` | Daftar **semua** model yang dapat digunakan akun Anda (Gemini / Claude / GPT-OSS) |
| `/agy:update` | Perbarui agy CLI; menyegarkan daftar model |
| `/agy:setup` | Periksa kesehatan integrasi |
| `/agy:install` | Pasang agy CLI (bertanya terlebih dahulu) |
| `/agy:status` `/agy:result` `/agy:cancel` | Kelola pekerjaan latar belakang |

---

## Persyaratan

- **Claude Code** (ini adalah plugin untuknya)
- **Node.js 18+** (runtime-nya adalah Node; `node-pty` dipasang otomatis pada saat pertama dijalankan)
- **agy CLI** (Google Antigravity). Belum punya? Jalankan `/agy:install` (akan bertanya
  terlebih dahulu), atau pasang secara manual dari <https://antigravity.google>. Setelah memasang, jalankan
  `agy` sekali secara interaktif untuk masuk.

Diuji pada **Windows** dan **Linux** (x86_64). macOS seharusnya berfungsi (jalur kode yang sama) tetapi belum
diuji. Lihat *Catatan platform* di bawah untuk keterangan tambahan tentang Linux/SSH.

---

## Pemasangan

> **Tidak melihat perintah `/plugin`?** Claude Code Anda terlalu lama — `/plugin` membutuhkan
> versi terkini (2.1.143+). Perbarui Claude Code terlebih dahulu (aplikasi Store: perbarui melalui Microsoft
> Store / App store; CLI: `claude update`), lalu mulai ulang. Dapat menggunakan
> *model* baru seperti Opus 4.8 **tidak** berarti aplikasi Anda mutakhir — model berasal dari
> server, fitur `/plugin` berasal dari aplikasi.

**Langkah 1 — tambahkan marketplace dan pasang** (di Claude Code):

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**Langkah 2 — tampilkan perintahnya. ⚠️ Langkah ini wajib, dan di sinilah orang sering
tersangkut.** Perintah yang baru dipasang **tidak** muncul sampai Anda memuat ulang atau memulai ulang:

- Jalankan **`/reload-plugins`**, **dan**
- jika perintah `/agy:*` masih belum muncul (atau setelah *pembaruan* plugin),
  **tutup sepenuhnya dan buka kembali Claude Code** (tutup jendela/aplikasi sepenuhnya, bukan sekadar
  tab). Memuat ulang saja terkadang tidak cukup untuk berkas perintah yang benar-benar baru.

**Langkah 3 — pemeriksaan kesehatan:**

```bash
/agy:setup     # memverifikasi agy + node-pty + auth; memasang node-pty otomatis pada saat pertama dijalankan
```

Panggilan `/agy:*` yang pertama memakan waktu ~15–20 dtk (pemasangan node-pty sekali jalan + pengambilan
daftar model pertama). Itu wajar — setelah itu di-cache, panggilan berikutnya cepat.

Perintah pertama yang menjalankan agy mungkin memakan waktu ~15–20 dtk (pemasangan node-pty sekali jalan + pengambilan
daftar model, keduanya di-cache setelahnya).

---

## Cara kerjanya (dan mengapa)

agy 1.0.x **hanya menghasilkan keluaran ketika mendeteksi konsol nyata (TTY)** — sebuah
`spawn()` headless biasa tidak menghasilkan apa-apa. Maka plugin ini menjalankan agy di dalam **konsol
tersintesis (ConPTY) melalui `node-pty`**, membaca keluarannya, membuang ANSI/BOM, dan mengembalikan
jawabannya. `node-pty` menyertakan biner prabangun untuk kombinasi Node/OS yang umum dan dipasang
secara otomatis saat pertama digunakan (tidak perlu toolchain C++ pada kasus normal).

Daftar model diambil secara langsung dari menu interaktif `/model` milik agy dan di-cache, dikunci pada
sidik jari biner agy — daftar diambil ulang secara otomatis saat agy diperbarui.

---

## Memilih model

agy **tidak memiliki flag CLI `--model`**, jadi plugin ini memilih model dengan secara singkat dan aman
menulis ulang `~/.gemini/antigravity-cli/settings.json`, lalu memulihkannya. Ini dilakukan
di bawah kunci dan **aman terhadap crash** — pengaturan Anda tidak pernah dibiarkan rusak, bahkan jika sebuah
proses dihentikan di tengah jalan (yang asli disimpan dan dipulihkan oleh proses berikutnya).

```bash
/agy:models                                  # lihat semua yang dapat dijalankan akun Anda
/agy:model                                   # tampilkan default saat ini
/agy:model pro                               # tetapkan default ke Gemini Pro terkuat
/agy:model flash                             # tetapkan default ke Gemini Flash (cepat, murah)
/agy:model "Claude Opus 4.6 (Thinking)"      # default ke model Claude
/agy:ask --model flash  pertanyaan Anda      # penggantian sekali jalan (tidak mengubah default)
```

- **Alias** (`pro`, `flash`, ditambah `pro-low`, `flash-medium`, …) **khusus Gemini** dan
  mengikuti daftar langsung, jadi `pro`/`flash` otomatis mengikuti tingkatan Gemini terbaru.
- Model **Claude / GPT-OSS** membutuhkan **label lengkap** — salin dari `/agy:models`.
- Default disimpan ke `~/.agy-jobs/config.json` — seketika, bertahan lintas sesi,
  tanpa memulai ulang terminal. `--model` per panggilan selalu menang atas default.
- Setiap proses melaporkan model yang **benar-benar digunakan** (dibaca dari log agy sendiri, bukan laporan
  diri model — model tidak dapat diandalkan dalam menyebut namanya sendiri).

---

## Izin

- `ask` / `research` bersifat **read-only** secara default; tambahkan `--write` untuk mengizinkan penyuntingan.
- `rescue` **dapat menulis** secara default; tambahkan `--read-only` untuk saran saja.
- `review` / `adversarial-review` **selalu read-only** — gunakan `/agy:rescue` untuk menindaklanjuti
  temuan.
- Proses read-only meneruskan `--sandbox` milik agy (pembatasan terminal): agy masih dapat membaca dan
  menganalisis berkas, tetapi efek samping sistem/terminal diblokir.

---

## Catatan platform

- **Windows / Linux** — teruji penuh (pergantian model, scrape, pemulihan aman-crash semuanya berfungsi).
- **Keterangan Linux + SSH**: agy menyimpan login-nya di keyring desktop ketika Anda masuk di
  sesi grafis, tetapi beralih ke token berbasis berkas ketika mendeteksi sesi SSH
  (`SSH_CONNECTION`). Keduanya tidak berbagi status, jadi menjalankan plugin **melalui koneksi SSH
  polos** dapat memicu "Authentication required" meskipun Anda sudah masuk di
  desktop. Solusi: masuk *di dalam* sesi SSH, **atau** jalankan di dalam sesi `tmux`/`screen`
  yang dimulai dari desktop (tanpa `SSH_CONNECTION` di lingkungannya) —
  maka agy membaca login desktop secara normal. Ini adalah perilaku agy CLI, bukan bug plugin.

---

## ⚠️ Privasi — baca ini

agy mengirimkan prompt Anda (dan, untuk `review`, code diff Anda) ke **server Google**.
**Jangan** menggunakannya pada rahasia, kredensial, kunci privat, atau pekerjaan rahasia / belum dipublikasikan
yang tidak dapat Anda bagikan ke pihak ketiga. Perlakukan seperti layanan AI cloud lainnya.

---

## Pemecahan masalah

- **Perintah `/plugin` tidak ditemukan** → Claude Code Anda terlalu lama (di bawah 2.1.143). Perbarui
  aplikasi dan mulai ulang (lihat [Pemasangan](#pemasangan)). Dapat menggunakan *model* baru
  tidak berarti aplikasi mutakhir.
- **Sudah terpasang, tetapi perintah `/agy:*` tidak muncul** → jalankan **`/reload-plugins`**; jika
  masih belum muncul, **tutup sepenuhnya dan buka kembali** Claude Code. Berkas perintah baru perlu
  dimuat ulang/dimulai ulang untuk dimuat.
- **`/agy:setup` menyatakan `agy binary: NOT FOUND`** → jalankan `/agy:install`, atau tetapkan
  variabel lingkungan `AGY_BIN` ke jalur berkas eksekusi agy.
- **`node-pty: UNAVAILABLE`** → pemasangan otomatis sekali jalan gagal; pastikan Node.js + npm
  ada di PATH dan Anda memiliki jaringan, lalu jalankan ulang `/agy:setup`.
- **Tidak ada jawaban / kesalahan auth** → jalankan `agy` sekali secara interaktif di terminal untuk masuk.
- **Daftar model tampak usang setelah pembaruan agy** → `/agy:models --refresh` atau `/agy:update`.

Jangan mengulang-ulang percobaan saat gagal — perbaiki penyebab dasarnya (auth, pemasangan, jaringan).

---

## Lisensi

MIT. Tidak resmi; tidak berafiliasi dengan Google maupun Anthropic.
