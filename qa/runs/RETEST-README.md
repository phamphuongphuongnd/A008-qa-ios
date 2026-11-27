# A008 — Thử máy lại sau 2 lượt sửa (2026-11-27)

> Luật chung cho 4 làn thử lại. Phiên điều phối: `local_e2bea1f7-a814-466d-b697-e2e01e668704`.

## Bản đang thử
- `dev` **d082205** (lượt sửa 1 + 2, jest 836 xanh). Không sửa code, không đổi nhánh repo chính, không Gradle / prebuild / Metro.
- APK **release có R8** (đúng như bản store), ABI x86_64 + armeabi-v7a, ký debug.keystore:
  `D:\Mobile App\apps\A008-evenlease\android\app\build\outputs\apk\release\app-release.apk`.
  Release: không có menu dev, không `run-as` (đọc dữ liệu qua "Back up now" nếu cần), mở thẳng từ launcher.
- Chi tiết từng lỗi + "cần thử máy" của từng nhóm sửa:
  `C:\Users\Admin\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\side-session-notes\local_e2bea1f7-a814-466d-b697-e2e01e668704\fix-nav.md | fix-intake.md | fix-decision.md | fix-review-ui (trong tin) | fix-docs.md | fix-system.md`
  + `BUGS.md`, `TESTCASES.md`, kết quả lượt trước `qa/runs/2026-11-26-qa1|qa2|qa3.md`, `2026-11-27-a13.md`.

- fix-review-ui (không có file note) cần thử máy: font_scale 1.3 → S-17 thành thẻ dọc, 1.15 vẫn bảng · S-17 Rental Ohio không có
  link Seattle, huy hiệu cột cuối không cắt, cột đầu tên ngắn · S-09 Jordan tên ngắn + lý do C3/C4/C5 theo chứng cứ, Marcus
  "4 things to check" · S-04 C7 = 1 → "1 person" · S-04 sheet thêm tiêu chí gõ "No kids" → hộp cam có icon, Edit/Add chia đôi ·
  B-71: S-06 → S-17 hiện khung ngay, cuộn ngang mount thêm cột không giật, bấm ô cột xa (vd cột 18) mở sheet chứng cứ.

## Máy
- Máy ảo: như `qa/runs/README.md` (lệnh bật, `-s emulator-<cổng>`, helper `D:\a008-metro-tmp\q.py` với `QS`). Không cần adb reverse / Metro.
- **Không bao giờ đụng `R58TC12SRZW` (A13) trừ làn R-A13.** A13 là máy riêng của Phương — fact `memory/facts/adb-device-testing.md`.
- Cài mới: `adb -s <máy> uninstall com.maglobal.evenlease` (bỏ qua lỗi) → `install <APK>`.

## Ghi kết quả
- File của làn: `qa/runs/2026-11-27-retest-<làn>.md` — bảng `| Mã (TC / B) | Kết quả | Ghi chú |`:
  lỗi cũ: **✅ hết lỗi** / **❌ còn** (ghi khác gì) · case: ✅ / ❌ B-xx / ⏭ lý do.
- Lỗi mới: dải của làn — R-1 **B-120…B-129** · R-2 **B-130…B-139** · R-3 **B-140…B-149** · R-A13 **B-150…B-159**.
  Gặp lỗi có thể làn khác cũng thấy → ghi chú "có thể trùng", điều phối gộp.
- Cuối file: màn nào **khớp mockup, hết lỗi 🔴/🟠** (để tick F-xx).
- Commit đúng 1 file đó trên `dev` bằng `git -C "D:\Mobile App\apps\A008-evenlease"` **sau khi kiểm repo chính đang ở `dev`**; không checkout gì trong repo chính.
- Xong / kẹt → `SendMessage` điều phối (số ✅/❌, lỗi cũ còn, lỗi mới 🔴/🟠). Câu hỏi cho Phương: popup tiếng Việt.

## Chia làn
| Làn | Máy | Phạm vi |
|---|---|---|
| R-1 Luồng mẫu | `emulator-5560` Medium_Phone_API_37.0 | TC-125…154 (nhất là 127–130, 136, 144–147, 150–154) + lỗi B-40, B-41…B-52, B-80 + mục cần thử máy của fix-nav (onboarding gate, deep link), fix-review-ui (S-09 / S-17 / S-04), fix-docs (S-10 zoom bằng chạm đúp, PDF, tên file, S-20) |
| R-2 First-come | `emulator-5562` B158_Phone | **Chạy lại toàn bộ** TC-155…177 bằng dữ liệu nhập qua giao diện (lượt trước 5 case dùng dữ liệu chèn tay) + B-53…B-65, B-55, B-62 + quyền báo đúng giờ (SCHEDULE_EXACT_ALARM: hỏi 1 lần, Not now → "about 2 hours left", bật sau → đặt lại; `dumpsys alarm`) |
| R-3 Hệ thống & giao diện | `emulator-5564` Tablet_API_37 | TC-178…196 (nhất là 180, 184, 185, 188–192, 196) + B-67…B-76, B-72(d) sheet + bàn phím, B-105 PIN (máy ảo không khoá màn hình), sáng/tối, 320 dp, chữ 130 / 200 %, vùng chạm 48 |
| R-A13 | Galaxy A13 `R58TC12SRZW` | B-100 (mở app release R8 không crash), B-101 (đo lần sao lưu đầu + Restore file 310k cũ + mới), B-71 (S-17 20 Applicant), báo đúng giờ trên Android 14, B-102 (tên thư mục Drive — hỏi Phương), B-103 (nhãn sinh trắc), B-105 (PIN — hỏi Phương gỡ khoá màn hình tạm), B-104 (`aapt2 dump permissions`), B-40 trên release |
