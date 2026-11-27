# A008 — Lượt thử máy song song (2026-11-26)

> Luật chung cho các phiên con thử máy. Phiên điều phối: `local_e2bea1f7-a814-466d-b697-e2e01e668704`.

## Bản đang thử
- Repo app `D:\Mobile App\apps\A008-evenlease`, nhánh `dev`, code đóng băng **6b1fea8**. **Không sửa code, không npm install,
  không Gradle / prebuild, không đổi nhánh.** Bước 4 chỉ ghi lỗi, không sửa.
- APK dev client x86_64 (icon/splash v2): `android/app/build/outputs/apk/debug/app-debug.apk`.
- **Metro do điều phối giữ ở cổng 8094** (cache `D:\a008-metro-tmp`) — không tự bật / tắt Metro. Metro sập → nhắn điều phối.

## Máy ảo (mỗi phiên 1 máy riêng)
- Bật: `& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd <AVD> -port <cổng> -gpu swiftshader_indirect -crash-report-mode never -no-snapshot-save -no-audio`
- **Mọi lệnh adb có `-s emulator-<cổng>`. Không bao giờ đụng `R58TC12SRZW` (Galaxy A13 của Phương).**
- Cài: `adb -s <máy> install -r <APK>` → `adb -s <máy> reverse tcp:8094 tcp:8094` →
  `adb -s <máy> shell am start -a android.intent.action.VIEW -d "exp+evenlease://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8094" com.maglobal.evenlease`
- Lần đầu: Android 17 hỏi "nearby devices" (quyền mạng cục bộ của **dev client**) → **Allow** (không thì app không nối Metro) ·
  menu dev hiện → Continue → Close. Mở lần đầu có thể mất 1–2 phút (bundle 18 MB).
- Chế độ máy bay: `adb -s <máy> shell cmd connectivity airplane-mode enable` (adb reverse vẫn chạy).
- Vân tay: Settings máy ảo → đặt khoá màn hình PIN + thêm vân tay; chạm vân tay bằng `adb -s <máy> emu finger touch 1`.
- Helper: `python D:\a008-metro-tmp\q.py <lệnh>` với biến môi trường `QS=emulator-<cổng>` (chỉ cho phép emulator-*):
  `d` (dump chữ + toạ độ) · `t "<chữ>"` (chạm theo chữ) · `te` (khớp đúng) · `w "<chữ>" <giây>` (chờ chữ) · `s <tên>` (chụp, lưu cạnh
  q.py trong `shots/` — **đặt tên có tiền tố làn**, vd `qa2-tc155`) · `xy x y` · `sw x1 y1 x2 y2` · `up` / `down` · `key <keycode>` · `sh <lệnh>`.
- Đọc trước: `memory/facts/adb-device-testing.md` (chờ chữ rồi mới bấm, `input text` phá touch mode, sheet/bàn phím làm dịch chỗ,
  không chạm backdrop "Close"…), `TESTCASES.md` phần B (dữ liệu thử dòng 143–152), `product.md` §5 các màn của làn + §8,
  mockup `design/v2-indigo/Evenlease-HiFi-mockups.html` (hoặc https://claude.ai/artifact/8BHE1J66vSHmZdEVKMBaZV).

## Ghi kết quả (tránh 4 phiên sửa chung 1 file)
- **Chỉ ghi vào file của làn mình** `qa/runs/2026-11-26-<làn>.md`. Không sửa `TESTCASES.md`, `BUGS.md`, `CHECKLIST.md`, `APP.md`.
- Mẫu file: bảng `| Mã | Kết quả | Ghi chú |` (✅ / ❌ B-xx / ⏭ lý do), rồi danh sách lỗi theo định dạng `BUGS.md`:
  `- [ ] B-xx 🔴/🟠/🟡 [TC-yyy] S-zz — mô tả ngắn · cách tái hiện · mong đợi vs thực tế · ảnh <tên>` (chỉ dùng dải số của làn).
  Cuối file: màn nào **đã thử khớp mockup** (để điều phối tick F-xx), thứ gì không thử được trên máy ảo (để dành A13).
- Commit trong repo app: `git add qa/runs/2026-11-26-<làn>.md` (đúng 1 file) → `git commit -m "[A008-evenlease] qa <làn>: results"`.
  Không `git add -A`, không push.
- Xong / kẹt / cần Phương → `SendMessage` tới phiên điều phối ở trên (tóm tắt: số ✅/❌/⏭, lỗi 🔴). Câu hỏi cho Phương: popup tiếng Việt.
- Xong làn: trả cài đặt máy ảo (density, font, giờ tự động), tắt máy ảo của mình.
