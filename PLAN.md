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
| **1C UI kit + DB** | Theme từ `design/tokens.json`, `src/ui/**`, gallery `/dev/gallery`; schema SQLite/Drizzle (căn, tiêu chí + lịch sử, hồ sơ, giấy tờ, cuộc gọi, báo cáo ngoài, quyết định, thư, giao nhà) + repository + `useLive` + dữ liệu mẫu | `src/ui/**`, `src/theme/**`, `src/db/**`, `app/dev/**` | gallery khớp mockup (ảnh A13); test repository xanh |
- Điều phối ghép 1B, 1C vào `dev` → kiểm tsc + lint + jest.

## Phase 2 — Màn hình (5 phiên song song, sau Phase 1)
| Phiên | Tính năng | Vùng file |
|---|---|---|
| **2A Căn + tiêu chí** | F-02, F-03 | `app/units/**`, `src/features/units/**`, `src/features/criteria/**` |
| **2B Hồ sơ** | F-04, F-05, F-06, F-07 | `app/applicants/**` (trừ chấm / quyết định), `src/features/intake/**`, `src/pdf/blankApplication*` |
| **2C Xác minh** | F-08, F-09, F-10 | `app/verify/**`, `src/features/verify/**` |
| **2D Chấm + quyết định** | F-11 – F-15 | `app/review/**`, `src/features/decision/**`, `src/pdf/letters*`, `src/pdf/decisionFile*` |
| **2E Hệ thống** | F-01, F-16 – F-19, icon, splash | `app/onboarding/**`, `app/settings/**`, `app/move-in/**`, `app/guide/**`, `src/backup/**`, `src/features/onboarding\|settings\|guide\|movein/**`, `assets/**` |
- 1A/điều phối giữ: `app/_layout.tsx`, `app/(tabs)/**`, `src/routes.ts`, `src/navigation/**`, `common.json`, `index.ts` — phiên cần cắm vào thì để điểm nối `TODO(merge 2x)`, điều phối nối khi ghép (bảng route: `docs/ROUTES.md`).
- Màn nối nhau chỉ qua route đã khai ở 1A. Thử máy: 2B + 2D dùng A13 trước, các phiên khác giả lập / chờ lượt.

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
