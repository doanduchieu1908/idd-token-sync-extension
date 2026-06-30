# IDD Token Sync — Chrome Extension

Sync `iddToken` từ localStorage của 2 nguồn (WHIDD / IDDV2) vào nhiều tab target.

## Cài đặt

1. Mở Chrome → `chrome://extensions/`
2. Bật **Developer mode** (góc trên phải)
3. Click **Load unpacked** → chọn thư mục này (`idd-token-sync-extension/`)

## Cách dùng

1. **Nhập Main URL** cho WHIDD và IDDV2 (URL đang đăng nhập, có `iddToken` trong localStorage)
2. **Thêm Target URLs** bằng ô nhập + nút `+ WHIDD` / `+ IDDV2`
3. **Di chuyển URL** giữa 2 cột bằng:
   - Nút `→` / `←` trên từng item
   - Kéo thả sang cột bên kia
4. Click **⚡ Set WHIDD Token** hoặc **⚡ Set IDDV2 Token**  
   → Extension sẽ lấy `iddToken` từ main URL và gán vào tất cả target URL của cột đó

## Lưu ý

- Tất cả Main URL tabs cần đang **mở và đã đăng nhập** trước khi nhấn Set  
  (hoặc extension sẽ tự mở tab mới và chờ tải xong)
- Config được lưu tự động vào `chrome.storage.local`

## Cấu trúc file

```
manifest.json    ← khai báo extension (MV3)
popup.html       ← giao diện popup
popup.css        ← style
popup.js         ← UI logic
background.js    ← xử lý Chrome API (tabs, scripting)
```
