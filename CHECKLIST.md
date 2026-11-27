# A008-evenlease — Checklist

> Làm từ trên xuống, xong mục nào (**code xong + đã kiểm**; màn hình = đã thử trên máy, jest thôi chưa đủ) tick `[x]` + commit rồi mới sang mục sau. Mỗi việc **1 dòng**.
> Việc mới phát sinh → thêm dòng vào đúng bước, không làm ngay. Quy trình: `playbook/PLAYBOOK.md` · phase: `PLAN.md`.

## Bước 0 — Khảo sát
- [x] Khảo sát thực trạng, 5 đối thủ (1.538 đánh giá Play), luật, biểu mẫu → `research.md`; Phương quyết làm (2026-11-25)

## Bước 1 — Grill & product.md
- [x] Cấp mã, thư mục, APP.md, CHECKLIST.md
- [x] git `main` + `dev`, repo MA-Global-VN/P_evenlease (Phương chọn link 2026-11-25), ghi REGISTRY
- [x] Tra trùng tên 2 store (Evenlease không trùng tên chính xác)
- [x] Grill: tính năng, kiếm tiền (miễn phí), tên, bundle ID (để sau) → APP.md
- [x] Grill công nghệ: RN + Expo, không server, SQLite, không đăng nhập, sao lưu tự động → APP.md
- [x] Viết product.md (từng màn, từng nút, trạng thái, dữ liệu mẫu, luật chấm, thư FCRA) + CONTEXT.md
- [x] Điền danh sách bước 3 từ product.md
- [x] Phương duyệt product.md + PLAN.md (2026-11-25)

## Bước 2 — Mockup Hi-Fi (Artifact Design, design system mới, Phương duyệt)
- [x] Mockup v1 (teal) — thay bằng v2, đã gỡ khỏi repo 2026-11-25
- [x] Mockup v2 Indigo + logo do Phương làm → https://claude.ai/artifact/8BHE1J66vSHmZdEVKMBaZV + `design/v2-indigo/` (2026-11-25)
- [x] Phương duyệt mockup (2026-11-25)

## Bước 3 — Làm app theo mockup (phiên điều phối chạy `PLAN.md`)
- [x] 1A Khung: cài sẵn mọi thư viện, Expo + route S-01…S-27 + i18n + Jest + CI, commit `dev` — chạy trên máy ảo 26/11 (A13 chưa)
- [x] 1B Engine `src/engine/`: luật C1–C10, evidence, issues, rào chắn, First-come + đồng hồ, điều kiện FCRA + test §3.16
- [x] 1C DB: schema SQLite, repository, `useLive`, map ↔ engine, dữ liệu mẫu §8, `src/files`
- [x] 1D UI v2: theme sáng/tối + UI kit + gallery từ `design/v2-indigo`, icon / splash từ `logo/` — icon/splash/sáng-tối đúng trên máy ảo 26/11 (TC-125/126/187)
- [x] 2A Logic căn + tiêu chí (F-02, F-03) + PDF tiêu chí công bố
- [x] 2B Logic hồ sơ, Applicant mode, giấy tờ (F-04 – F-07) + PDF đơn trống
- [x] 2C Logic xác minh: tham chiếu, báo cáo ngoài, Background review (F-08 – F-10)
- [x] 2D Logic chấm, Compare, hàng đợi + đồng hồ, quyết định, thư + PDF, Decision file (F-11 – F-15)
- [x] 2E Logic onboarding, khoá, sao lưu mã hoá, dọn / xoá dữ liệu, thông báo, giao nhà + PDF (F-01, F-16 – F-19)
- Màn theo mockup v2 — code xong + jest xanh (dev bdf9385), **chưa thử máy**, đang sửa khoảng trống G-01…G-10 → chỉ tick khi đã thử trên A13 và khớp mockup:
- [x] F-01 Onboarding (S-01) — ✅ máy ảo release 27/11 (còn 🟡 trong BUGS)
- [x] F-02 Rentals list, Rental editor, Rental hub (S-02, S-03, S-06) — ✅ máy ảo release 27/11 (còn 🟡 trong BUGS)
- [x] F-03 Criteria builder + published criteria PDF (S-04, S-05) — ✅ máy ảo 26/11 (còn 🟡 trong BUGS)
- [x] F-04 Application form chủ nhà nhập + ảnh đơn giấy (S-07, S-08) — ✅ máy ảo release 27/11 (nhập qua giao diện)
- [x] F-05 Applicant mode (S-08a, S-08b) — ✅ máy ảo release 27/11 (S-08b, thoát, nháp)
- [x] F-06 Blank application PDF — ✅ máy ảo 26/11 (còn 🟡 trong BUGS)
- [ ] F-07 Documents + income check (S-10)
- [x] F-08 Landlord + employer reference (S-11, S-12) — ✅ máy ảo 26/11 (còn 🟡 trong BUGS)
- [x] F-09 Screening report ngoài (S-13) — ✅ máy ảo 26/11 (còn 🟡 trong BUGS)
- [x] F-10 Background review bước 2 (S-14) — ✅ máy ảo 26/11 (còn 🟡 trong BUGS)
- [x] F-11 Applicant summary (S-09) — ✅ máy ảo 26/11 (còn 🟡 trong BUGS)
- [x] F-12 Compare + Order queue + thông báo đồng hồ (S-17, S-18) — ✅ máy ảo + A13 27/11 (S-17 0,7 s, báo đúng giờ)
- [x] F-13 Decision (S-15) — ✅ máy ảo release 27/11 (còn 🟡 trong BUGS)
- [x] F-14 Letters + PDF (S-16) — ✅ máy ảo release 27/11 (còn 🟡 trong BUGS)
- [x] F-15 Decision file PDF (S-19) — ✅ máy ảo 26/11 (còn 🟡 trong BUGS)
- [x] F-16 Move-in checklist (S-20) — ✅ máy ảo release 27/11 (còn 🟡 trong BUGS)
- [x] F-17 Data cleanup (S-24) — ✅ máy ảo 26/11 (còn 🟡 trong BUGS)
- [x] F-18 Backup & restore mã hoá + tự động + nhắc (S-22) — ✅ máy ảo release + A13 27/11 (sao lưu đầu < 2 s trên A13)
- [ ] F-19 Settings, App lock, Guide, Legal, Delete all (S-21, S-23, S-25 – S-27)
- [ ] Thử máy dồn từ Phase 2: dev client mới (icon/splash), SQLite migration thật, files native, PDF + expo-print, formSheet/sheet kéo, ô ký trong ScrollView, 320 dp/200 %, S-01 gate + S-27 về S-01, App lock + withLockSuspended, Applicant mode qua khởi động lại, đồng hồ 72/48 h + thông báo → S-18, sao lưu nền + đo PBKDF2, iOS bookmark thư mục
- [ ] Ghép nhánh, toàn bộ test xanh + cài chạy trên Galaxy A13 → gộp `dev` → `main`

## Bước 4 — Test toàn bộ (chỉ ghi lỗi)
- [x] Viết TESTCASES.md (100–200 case) — 200 case: 124 T ✅ (jest 702), 76 M chờ thử máy
- [ ] Chạy hết case (test tự động + thử máy) → BUGS.md — Android 72 case xong 26/11 (✅ 50 · ❌ 19 · ⏭ 3, 35 lỗi); chờ iOS TC-197…200

## Bước 5 — Sửa lỗi
- [ ] Sửa hết BUGS.md (tick trong BUGS.md)
- [ ] Chạy lại toàn bộ test + case từng lỗi → gộp `dev` → `main`

## Bước 6 — Kiểm cuối & lên store
- [ ] Giả lập người dùng thật trên máy, xem giao diện từng màn
- [ ] Store listing + privacy + Data safety / App Privacy + ảnh store
- [ ] **Dừng: báo Phương** — chốt Bundle ID, Phương tạo khoá ký, Apple Team ID → tag `1.0.0` → AAB + iOS
- [ ] checklists release-android + release-ios
- [ ] Nộp Google Play (closed test) + App Store (TestFlight)
- [ ] Retro 3 dòng APP.md + 1 dòng METRICS.md
