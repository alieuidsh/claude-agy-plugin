# agy — Google Antigravity cho Claude Code

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Nederlands](README.nl.md) · [ไทย](README.th.md) · [Українська](README.uk.md)

Dùng **agy CLI** (Google Antigravity) như một mô hình thứ hai ngay trong Claude Code — phiên bản
`agy` tương ứng với plugin `codex`. Đặt câu hỏi, lấy ý kiến tham khảo, review bản
diff, hoặc giao những tác vụ có khả năng ghi file, tất cả mà không cần rời khỏi Claude Code.

Điều khiến nó thú vị: **agy có thể chạy các mô hình Gemini, Claude, *và* GPT-OSS** chỉ với
một CLI và một tài khoản duy nhất. Plugin này phơi bày điều đó — chọn bất kỳ mô hình nào cho mỗi lần gọi, hoặc đặt một
mô hình mặc định, ngay từ Claude Code.

> ⚠️ **Không chính thức.** Đây là một plugin của cộng đồng, không liên kết với hoặc được chứng thực bởi
> Google hay Anthropic. "Antigravity", "Gemini", "Claude", và "Codex" thuộc về các
> chủ sở hữu tương ứng của chúng.

---

## Bạn nhận được gì

| Lệnh | Chức năng |
|---|---|
| `/agy:ask` | Hỏi agy một câu hỏi đơn lẻ (mặc định chỉ đọc) |
| `/agy:research` | Yêu cầu agy nghiên cứu và tổng hợp một câu trả lời |
| `/agy:rescue` | Giao một tác vụ/bản sửa — **agy có thể chỉnh sửa file** |
| `/agy:review` | agy review bản git diff cục bộ của bạn (chỉ đọc) |
| `/agy:adversarial-review` | Review đối kháng không khoan nhượng đối với bản diff của bạn (chỉ đọc) |
| `/agy:model` | Hiển thị hoặc đặt mô hình **mặc định** |
| `/agy:models` | Liệt kê **tất cả** mô hình mà tài khoản của bạn có thể dùng (Gemini / Claude / GPT-OSS) |
| `/agy:update` | Cập nhật agy CLI; làm mới danh sách mô hình |
| `/agy:setup` | Kiểm tra tình trạng tích hợp |
| `/agy:install` | Cài đặt agy CLI (hỏi trước) |
| `/agy:status` `/agy:result` `/agy:cancel` | Quản lý các tác vụ chạy nền |

---

## Yêu cầu

- **Claude Code** (đây là một plugin dành cho nó)
- **Node.js 18+** (runtime là Node; `node-pty` được tự động cài đặt trong lần chạy đầu tiên)
- **agy CLI** (Google Antigravity). Chưa có nó? Chạy `/agy:install` (nó sẽ hỏi
  trước), hoặc cài đặt thủ công từ <https://antigravity.google>. Sau khi cài đặt, hãy chạy
  `agy` một lần ở chế độ tương tác để đăng nhập.

Đã được kiểm thử trên **Windows** và **Linux** (x86_64). macOS hẳn là sẽ hoạt động (cùng các đường dẫn mã) nhưng
chưa được kiểm thử. Xem phần *Ghi chú nền tảng* bên dưới về lưu ý đối với Linux/SSH.

---

## Cài đặt

> **Không thấy lệnh `/plugin`?** Claude Code của bạn quá cũ — `/plugin` cần một
> phiên bản gần đây (2.1.143+). Hãy cập nhật Claude Code trước (ứng dụng Store: cập nhật qua Microsoft
> Store / App store; CLI: `claude update`), rồi khởi động lại. Việc có thể dùng một *mô hình*
> mới như Opus 4.8 **không** có nghĩa là ứng dụng của bạn đã được cập nhật — mô hình đến từ
> máy chủ, còn tính năng `/plugin` đến từ ứng dụng.

**Bước 1 — thêm marketplace và cài đặt** (trong Claude Code):

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**Bước 2 — làm cho các lệnh xuất hiện. ⚠️ Bước này là bắt buộc, và đây là chỗ mọi người hay bị
mắc kẹt.** Các lệnh vừa được cài đặt sẽ **không** hiện ra cho đến khi bạn reload hoặc khởi động lại:

- Chạy **`/reload-plugins`**, **và**
- nếu các lệnh `/agy:*` vẫn không xuất hiện (hoặc sau khi *cập nhật* plugin),
  **thoát hoàn toàn và mở lại Claude Code** (đóng hẳn cửa sổ/ứng dụng, không chỉ
  là tab). Đôi khi chỉ reload thôi là chưa đủ đối với các file lệnh hoàn toàn mới.

**Bước 3 — kiểm tra tình trạng:**

```bash
/agy:setup     # verifies agy + node-pty + auth; auto-installs node-pty on first run
```

Lần gọi `/agy:*` đầu tiên mất khoảng 15–20 giây (cài đặt node-pty một lần + lần đầu tiên
quét danh sách mô hình). Đó là điều bình thường — sau đó nó được lưu cache, các lần gọi về sau sẽ nhanh.

Lệnh đầu tiên điều khiển agy có thể mất khoảng 15–20 giây (cài đặt node-pty một lần + một lần quét danh sách
mô hình, cả hai đều được lưu cache sau đó).

---

## Cách nó hoạt động (và tại sao)

agy 1.0.x **chỉ tạo ra đầu ra khi nó phát hiện một console thật (TTY)** — một lệnh
`spawn()` headless thuần túy sẽ không cho ra gì cả. Vì vậy plugin này điều khiển agy bên trong một **console được
tổng hợp (ConPTY) thông qua `node-pty`**, đọc đầu ra của nó, loại bỏ ANSI/BOM, và trả về câu
trả lời. `node-pty` đi kèm các binary dựng sẵn cho các tổ hợp Node/OS phổ biến và được cài đặt
tự động trong lần dùng đầu tiên (trong trường hợp thông thường không cần bộ công cụ C++).

Danh sách mô hình được quét trực tiếp từ menu `/model` tương tác của agy và được lưu cache, gắn khóa với
dấu vân tay của binary agy — nó tự động quét lại khi agy cập nhật.

---

## Chọn một mô hình

agy **không có cờ CLI `--model`**, nên plugin này chọn một mô hình bằng cách viết lại tạm thời và an toàn
`~/.gemini/antigravity-cli/settings.json`, rồi khôi phục nó. Việc này được thực hiện
dưới một khóa và **an toàn trước sự cố** — các thiết lập của bạn không bao giờ bị để lại ở trạng thái hỏng, ngay cả khi một
lần chạy bị giết giữa chừng (bản gốc được lưu lại và phục hồi bởi lần chạy kế tiếp).

```bash
/agy:models                                  # see everything your account can run
/agy:model                                   # show the current default
/agy:model pro                               # set default to the strongest Gemini Pro
/agy:model flash                             # set default to Gemini Flash (fast, cheap)
/agy:model "Claude Opus 4.6 (Thinking)"      # default to a Claude model
/agy:ask --model flash  your question        # one-off override (doesn't change default)
```

- **Bí danh** (`pro`, `flash`, cùng với `pro-low`, `flash-medium`, …) **chỉ dành cho Gemini** và
  bám theo danh sách trực tiếp, nên `pro`/`flash` tự động theo bậc Gemini mới nhất.
- Các mô hình **Claude / GPT-OSS** cần **nhãn đầy đủ** — sao chép nó từ `/agy:models`.
- Mặc định được lưu vào `~/.agy-jobs/config.json` — tức thì, tồn tại qua các phiên,
  không cần khởi động lại terminal. Cờ `--model` theo từng lần gọi luôn thắng so với mặc định.
- Mỗi lần chạy đều báo cáo mô hình **thực sự được dùng** (đọc từ chính log của agy, không phải từ
  lời tự khai của mô hình — các mô hình không đáng tin cậy trong việc tự gọi tên mình).

---

## Quyền

- `ask` / `research` mặc định là **chỉ đọc**; thêm `--write` để cho phép chỉnh sửa.
- `rescue` mặc định **có khả năng ghi**; thêm `--read-only` để chỉ nhận lời khuyên.
- `review` / `adversarial-review` **luôn luôn chỉ đọc** — dùng `/agy:rescue` để hành động dựa trên
  các phát hiện.
- Các lần chạy chỉ đọc sẽ truyền cờ `--sandbox` của agy (hạn chế terminal): agy vẫn có thể đọc và
  phân tích file, nhưng các tác động phụ lên hệ thống/terminal bị chặn.

---

## Ghi chú nền tảng

- **Windows / Linux** — đã được kiểm thử đầy đủ (chuyển đổi mô hình, quét, khôi phục an toàn trước sự cố đều hoạt động).
- **Lưu ý Linux + SSH**: agy lưu thông tin đăng nhập của nó trong keyring của desktop khi bạn đăng nhập tại
  một phiên đồ họa, nhưng chuyển sang token dạng file khi nó phát hiện một phiên SSH
  (`SSH_CONNECTION`). Hai nơi này không chia sẻ trạng thái, nên việc chạy plugin **qua một kết nối SSH
  thuần** có thể gặp lỗi "Authentication required" mặc dù bạn đã đăng nhập trên
  desktop. Cách khắc phục: đăng nhập *bên trong* phiên SSH, **hoặc** chạy bên trong một phiên `tmux`/`screen`
  được khởi động từ desktop (không có `SSH_CONNECTION` trong môi trường của nó) —
  khi đó agy đọc thông tin đăng nhập của desktop một cách bình thường. Đây là hành vi của agy CLI, không phải lỗi của plugin.

---

## ⚠️ Quyền riêng tư — hãy đọc phần này

agy gửi các prompt của bạn (và, đối với `review`, bản code diff của bạn) đến **máy chủ của Google**. Đừng
sử dụng nó với các thông tin bí mật, thông tin xác thực, khóa riêng tư, hoặc công việc mật / chưa công bố
mà bạn không thể chia sẻ với bên thứ ba. Hãy đối xử với nó như bất kỳ dịch vụ AI đám mây nào khác.

---

## Khắc phục sự cố

- **Không tìm thấy lệnh `/plugin`** → Claude Code của bạn quá cũ (dưới 2.1.143). Cập nhật
  ứng dụng và khởi động lại nó (xem [Install](#install)). Việc có thể dùng một *mô hình* mới không
  có nghĩa là ứng dụng đã được cập nhật.
- **Đã cài đặt, nhưng các lệnh `/agy:*` không hiện ra** → chạy **`/reload-plugins`**; nếu
  chúng vẫn không xuất hiện, **thoát hoàn toàn và mở lại** Claude Code. Các file lệnh mới cần một lần
  reload/khởi động lại để được nạp.
- **`/agy:setup` báo `agy binary: NOT FOUND`** → chạy `/agy:install`, hoặc đặt biến môi trường
  `AGY_BIN` trỏ tới đường dẫn của file thực thi agy.
- **`node-pty: UNAVAILABLE`** → việc tự động cài đặt một lần đã thất bại; hãy đảm bảo Node.js + npm
  có trên PATH và bạn có mạng, rồi chạy lại `/agy:setup`.
- **Không có câu trả lời / lỗi xác thực** → chạy `agy` một lần ở chế độ tương tác trong terminal để đăng nhập.
- **Danh sách mô hình trông cũ sau khi cập nhật agy** → `/agy:models --refresh` hoặc `/agy:update`.

Đừng lặp lại việc thử lại khi thất bại — hãy sửa nguyên nhân gốc rễ (xác thực, cài đặt, mạng).

---

## Giấy phép

MIT. Không chính thức; không liên kết với Google hay Anthropic.
