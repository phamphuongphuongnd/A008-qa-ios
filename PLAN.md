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
| **1C DB** | Schema SQLite/Drizzle (căn, tiêu chí + lịch sử, hồ sơ, giấy tờ, cuộc gọi, báo cáo ngoài, quyết định, thư, giao nhà) + repository + `useLive` + map DB ↔ type engine + dữ liệu mẫu + `src/files` (lưu / xoá file). Theme/UI kit teal v1 đã bỏ (Phương: "xoá bỏ cái cũ", nhánh `wt/ui-draft` đã xoá) | `src/db/**`, `drizzle/**`, `src/files/**` | test repository + round-trip mẫu §8 xanh |
| **1D UI v2** | Theme sáng/tối từ `design/v2-indigo/design-tokens.json` + UI kit đủ component trang Components của mockup v2 + gallery `/dev/gallery`; icon / adaptive icon / splash từ `design/v2-indigo/logo/`; thanh điều hướng theo theme (plugin expo-navigation-bar) → build dev client mới (1 lượt Gradle) | `src/ui/**`, `src/theme/**`, `app/dev/**`, `assets/**`, `app.json` (icon / splash / plugin), phần theme của `app/_layout.tsx` + `app/(tabs)/_layout.tsx` + `src/navigation/ScreenPlaceholder.tsx`, `src/i18n/en/ui.json` | gallery khớp mockup v2 sáng/tối (ảnh A13), icon/splash mới trên A13 |
- Điều phối ghép 1B, 1C, 1D vào `dev` → kiểm tsc + lint + jest. `src/pdf/shell.ts` (khung PDF chung) do 1B làm. 1D chạy song song với Phase 2 bước logic.

## Phase 2 — Theo nhóm tính năng: logic trước, màn sau (5 phiên song song, sau 1C)
> Giao diện: **chỉ mockup v2 Indigo** (`design/v2-indigo/`, product.md §9). Mỗi phiên giữ 1 nhóm từ đầu tới cuối:
> **(a) Logic** ngay khi 1C ghép: service + hook nối engine ↔ repository, hàm sinh HTML/PDF có test, native bọc adapter để jest mock.
> **(b) Màn** khi 1D ghép (`git merge dev` vào nhánh): dựng S-xx đúng mockup v2 (S-12, S-23, S-26 không có trong mockup → theo design system), nối vào service/hook (a).
> Ngữ cảnh ~150k giữa chừng → điều phối mở phiên tiếp cùng nhánh.

| Phiên | Tính năng | Vùng file |
|---|---|---|
| **2A Căn + tiêu chí** | F-02, F-03 (S-02 – S-06): Rental tạo / sửa / đóng / lưu trữ, Review mode, tiêu chí qua rào chắn + khoá + lịch sử, PDF tiêu chí công bố | `app/units/**`, `src/features/units/**`, `src/features/criteria/**`, `src/pdf/publishedCriteria*`, `src/i18n/en/units.json` |
| **2B Hồ sơ** | F-04 – F-07 (S-07, S-08, S-08a, S-08b, S-10): form 7 phần (không SSN / ngày sinh), nháp / nộp + dấu giờ, Applicant mode (máy trạng thái, thoát bằng sinh trắc / mã máy, guard route), chữ ký, giấy tờ + so thu nhập, PDF đơn trống | `app/applicants/**`, `src/features/intake/**`, `src/pdf/blankApplication*`, `src/i18n/en/intake.json` |
| **2C Xác minh** | F-08 – F-10 (S-11 – S-14): phiếu gọi chủ nhà cũ / nơi làm, báo cáo ngoài + công ty báo cáo + PDF đính kèm, Background review sau Conditional offer | `app/verify/**`, `src/features/verify/**`, `src/i18n/en/verify.json` |
| **2D Chấm + quyết định** | F-11 – F-15 (S-09, S-15 – S-19): chấm sống, Compare, hàng đợi First-come + đồng hồ + thông báo 72 h / 48 h, Decision, thư + FCRA + PDF, Decision file PDF | `app/review/**`, `src/features/decision/**`, `src/pdf/letters*`, `src/pdf/decisionFile*`, `src/notifications/queueTimers*`, `src/i18n/en/decision.json` |
| **2E Hệ thống** | F-01, F-16 – F-19 (S-01, S-20 – S-27): onboarding + nạp mẫu, cài đặt, khoá app, sao lưu mã hoá + tự động + nhắc + khôi phục, dọn / xoá dữ liệu, thông báo chung, giao nhà + PDF, Guide | `app/onboarding/**`, `app/settings/**`, `app/move-in/**`, `app/guide/**`, `src/features/onboarding\|settings\|guide\|movein/**`, `src/backup/**`, `src/notifications/**` (trừ `queueTimers*`), `src/pdf/moveIn*`, `src/i18n/en/system.json`, `guide.json` |
- Điều phối giữ: `app/_layout.tsx` (trừ phần theme của 1D), `app/(tabs)/**` (tab S-02 / S-21 / S-25 chỉ re-export screen của 2A / 2E), `src/routes.ts`,
  `src/navigation/**`, `common.json`, `index.ts`; 1B/1C/1D giữ `src/engine/**`, `src/db/**`, `src/files/**`, `src/pdf/shell*`, `src/ui/**`, `src/theme/**`.
  Cần đổi file chung (cột DB, hàm engine, component UI chung, cắm vào `_layout` / `index.ts`) → báo điều phối, tạm để điểm nối `TODO(merge 2x)`;
  component chỉ dùng trong 1 nhóm → `src/features/<nhóm>/components`.
- Bước (a) chỉ jest. Bước (b) thử A13 theo lượt điều phối cấp (2B + 2D ưu tiên), Metro cổng riêng; không Gradle (dev client 1D đã cài).
  Brief: thư mục notes chung `A008-phase2-briefs.md`.

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
