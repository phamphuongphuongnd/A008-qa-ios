# A008-evenlease — Kế hoạch phase (phiên điều phối + phiên con song song)

> Phương duyệt kế hoạch 2026-11-25. Phiên điều phối do Claude mở sau khi **mockup được duyệt**. Phiên điều phối
> **không tự làm** — giao hết cho phiên con. Mỗi phiên con: 1 worktree `apps/A008-wt/<việc>` (nhánh `wt/<việc>` từ `dev`)
> + junction node_modules (fact `app-repo-worktree-sessions`), 1 nhóm file không chồng lấn, brief theo
> `playbook/templates/BRIEF-phien-con.md`, **không npm install**, báo về điều phối bằng SendMessage. Tối đa ~2 phiên nặng
> (A13 / giả lập / Gradle) cùng lúc + 1 Gradle. Build iOS / Android release đẩy lên EAS cloud.

## Phase 0 — Chuẩn bị (phiên grill, trước khi mở điều phối)
- [x] Khảo sát + grill + kế hoạch (Phương duyệt 2026-11-25).
- [x] product.md → Phương duyệt (2026-11-25).
- [x] Mockup Hi-Fi bằng Artifact Design (design system mới) → Phương duyệt → `design/` (2026-11-25).
- [x] Commit + push `main`/`dev` lên MA-Global-VN/P_evenlease → mở phiên điều phối (2026-11-25).

## Phase 1 — Nền móng (3 phiên; 1B/1C chờ 1A push)
| Phiên | Việc | Sửa được | Xong khi |
|---|---|---|---|
| **1A Khung** | Expo như A007 + **cài sẵn mọi thư viện cả app** (expo-sqlite, drizzle, image-picker, document-picker, print, sharing, file-system, local-authentication, notifications, ô ký tay…), expo-router đủ route S-xx (màn trống), i18n EN, Jest, ESLint, CI lint+test, eas.json, app.json (bundle tạm) | toàn repo | lint + tsc + jest xanh; dev build mở trên A13 |
| **1B Engine** | `src/engine/` TS thuần theo product.md: chấm tiêu chí, trạng thái xác minh, phát hiện lệch, rào chắn tiêu chí, hàng đợi + đồng hồ 72 h / 48 h, điều kiện bắt thư FCRA; ≥ 60 unit test (dữ liệu mẫu product.md) | `src/engine/**` | test xanh, mỗi luật có ≥ 1 test |
| **1C DB** | ~~Theme + UI kit + gallery~~ (Phương 2026-11-25: dừng giao diện, cất ở nhánh `wt/ui-draft`); schema SQLite/Drizzle (căn, tiêu chí + lịch sử, hồ sơ, giấy tờ, cuộc gọi, báo cáo ngoài, quyết định, thư, giao nhà) + repository + `useLive` + map DB ↔ type engine + dữ liệu mẫu + `src/files` (lưu / xoá file) | `src/db/**`, `drizzle/**`, `src/files/**` | test repository + round-trip mẫu §8 xanh |
- Điều phối ghép 1B, 1C vào `dev` → kiểm tsc + lint + jest. `src/pdf/shell.ts` (khung PDF chung, CSS trung tính) do 1B làm thêm.

## Phase 2 — Logic từng nhóm, CHƯA làm màn (5 phiên song song, sau Phase 1)
> Phương 2026-11-25: "dừng làm giao diện, làm logic code trước" — Phương làm mockup mới rồi gửi. Màn S-xx giữ khung 1A
> (`app/**`, `src/features/*/screens/**` không sửa). Mỗi nhóm làm phần không có giao diện: service + hook nối engine ↔ repository,
> hàm sinh HTML/PDF có test, native bọc sau adapter nhỏ để jest mock. Thử máy phần native (sao lưu, khoá, thông báo, in) để tới Phase 3.

| Phiên | Logic | Vùng file |
|---|---|---|
| **2A Căn + tiêu chí** | F-02, F-03: tạo / sửa / đóng / lưu trữ Rental, đổi Review mode (luật khi đã có hồ sơ), lưu tiêu chí qua rào chắn + khoá + lịch sử, PDF tiêu chí công bố | `src/features/units/**`, `src/features/criteria/**` (trừ `screens/`), `src/pdf/publishedCriteria*`, `src/i18n/en/units.json` |
| **2B Hồ sơ** | F-04 – F-07: model + kiểm hợp lệ form 7 phần (không SSN / ngày sinh), nháp / nộp + dấu giờ, Applicant mode (máy trạng thái, thoát bằng sinh trắc / mã máy, danh sách route được phép), dữ liệu chữ ký (path SVG), giấy tờ (chụp / chọn / đánh dấu đã kiểm / so thu nhập), PDF đơn trống | `src/features/intake/**` (trừ `screens/`), `src/pdf/blankApplication*`, `src/i18n/en/intake.json` |
| **2C Xác minh** | F-08 – F-10: phiếu gọi chủ nhà cũ / nơi làm (lần gọi, dấu hiệu giả, không liên lạc được, email mẫu), nhập báo cáo ngoài + công ty báo cáo + đính PDF, Background review chỉ mở sau Conditional offer | `src/features/verify/**` (trừ `screens/`), `src/i18n/en/verify.json` |
| **2D Chấm + quyết định** | F-11 – F-15: hook chấm sống (evaluateApplicant trên DB), dữ liệu Compare, hàng đợi First-come + đồng hồ + thông báo 72 h / 48 h, Decision (lý do, dấu giờ, chuyển trạng thái, mở bước 2), thư từ chối / đề nghị / chấp nhận / FCRA + PDF, Decision file PDF | `src/features/decision/**` (trừ `screens/`), `src/pdf/letters*`, `src/pdf/decisionFile*`, `src/notifications/queueTimers*`, `src/i18n/en/decision.json` |
| **2E Hệ thống** | F-01, F-16 – F-19: trạng thái onboarding + nạp mẫu, cài đặt, khoá app (sinh trắc / mã máy, khoá khi ra nền), sao lưu mã hoá + tự động (SAF / iCloud, background task) + nhắc > 30 ngày + khôi phục, dọn dữ liệu (Disposal), xoá tất cả, thông báo chung (quyền, handler, nhắc sao lưu / dọn), biên bản giao nhà + PDF, nội dung Guide | `src/features/onboarding\|settings\|guide\|movein/**` (trừ `screens/`), `src/backup/**`, `src/notifications/**` (trừ `queueTimers*`), `src/pdf/moveIn*`, `src/i18n/en/system.json`, `guide.json` |
- 1A/điều phối giữ: `app/**`, `src/features/*/screens/**`, `src/routes.ts`, `src/navigation/**`, `common.json`, `index.ts`; 1B/1C giữ `src/engine/**`,
  `src/db/**`, `src/files/**`, `src/pdf/shell*`. Cần đổi file chung (cột DB, hàm engine, cắm vào `_layout` / `index.ts`) → báo điều phối, tạm để điểm nối `TODO(merge 2x)`.
- Không cần A13 / giả lập / Gradle: chỉ jest. Brief nháp: thư mục notes chung `A008-phase2-briefs.md`.

## Phase 2M — Màn hình (chờ mockup mới của Phương)
- Khi Phương gửi mockup mới: dựng theme + UI kit (dùng lại được `wt/ui-draft`) → chia màn theo vùng như bảng trên (thêm `app/<vùng>/**`
  + `src/features/<vùng>/screens/**`), nối vào service / hook Phase 2. Điều phối viết lại bảng này khi có mockup.

## Phase 3 — Ghép + thử máy (1 phiên)
- **3A:** ghép 2A–2E vào `dev` → lint / tsc / jest → cài A13 → đi hết luồng mẫu (tạo căn → tiêu chí → 4 hồ sơ bằng 3 cách
  nhập → gọi → báo cáo → chấm → so sánh / thứ tự → quyết định → thư FCRA → PDF hồ sơ → giao nhà → xoá → sao lưu / khôi phục)
  → gộp `dev` → `main`.

## Phase 4 — Test toàn bộ (3 phiên, dải số lỗi riêng; 100–200 case tổng)
| Phiên | Phạm vi | Số lỗi |
|---|---|---|
| **4A Engine + chấm + quyết định** | luật chấm, lệch, chế độ thứ tự + đồng hồ, thư FCRA, PDF | B-01…B-39 |
| **4B Hồ sơ + xác minh** | nhập 3 cách, chế độ khách tự điền (không lộ hồ sơ khác), giấy tờ, quyền camera bị từ chối, dữ liệu lớn | B-40…B-79 |
| **4C Hệ thống + iOS** | onboarding, sao lưu / khôi phục, xoá, khoá, sáng / tối, 320dp, chữ 200%, TalkBack, iOS (EAS / Appetize) | B-80…B-119 |
- Mỗi phiên viết phần TESTCASES riêng (`qa/tc-4a.md`…), điều phối ghép `TESTCASES.md` + `BUGS.md`.

## Phase 5 — Sửa lỗi (2–3 phiên theo vùng file của lỗi)
- Mỗi lỗi: sửa → test hồi quy → thử máy → tick. **5Z Kiểm cuối:** toàn bộ test + case từng lỗi → gộp `dev` → `main`.

## Phase 6 — Kiểm cuối & chuẩn bị store (1–2 phiên)
- **6A:** giả lập người dùng thật trên A13 (cài mới, sáng / tối, 320dp, 200%, TalkBack).
- **6B:** listing, privacy (GitHub Pages như A006), Data safety ("không thu thập dữ liệu"), ảnh store.
- **Dừng hẳn:** báo Phương — chốt Bundle ID, Phương tạo khoá ký + Apple Team ID. Chỉ khi Phương bảo mới build release / nộp store.
