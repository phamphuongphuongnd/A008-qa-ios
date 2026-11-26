# A008-evenlease — Checklist

> Làm từ trên xuống, xong mục nào (đã kiểm) tick `[x]` + commit rồi mới sang mục sau. Mỗi việc **1 dòng**.
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
- [x] 1A Khung: cài sẵn mọi thư viện, Expo + route S-01…S-27 + i18n + Jest + CI, commit `dev` (mở trên A13 dời sang dòng ghép cuối)
- [x] 1B Engine `src/engine/`: luật C1–C10, evidence, issues, rào chắn, First-come + đồng hồ, điều kiện FCRA + test §3.16
- [x] 1C DB: schema SQLite, repository, `useLive`, map ↔ engine, dữ liệu mẫu §8, `src/files`
- [x] 1D UI v2: theme sáng/tối + UI kit + gallery từ `design/v2-indigo`, icon / splash từ `logo/` (build + xem trên A13 dời sang dòng ghép cuối)
- [x] 2A Logic căn + tiêu chí (F-02, F-03) + PDF tiêu chí công bố
- [x] 2B Logic hồ sơ, Applicant mode, giấy tờ (F-04 – F-07) + PDF đơn trống
- [x] 2C Logic xác minh: tham chiếu, báo cáo ngoài, Background review (F-08 – F-10)
- [x] 2D Logic chấm, Compare, hàng đợi + đồng hồ, quyết định, thư + PDF, Decision file (F-11 – F-15)
- [x] 2E Logic onboarding, khoá, sao lưu mã hoá, dọn / xoá dữ liệu, thông báo, giao nhà + PDF (F-01, F-16 – F-19)
- Màn theo mockup v2 (sau 1D, cùng phiên 2A–2E):
- [ ] F-01 Onboarding (S-01)
- [x] F-02 Rentals list, Rental editor, Rental hub (S-02, S-03, S-06)
- [x] F-03 Criteria builder + published criteria PDF (S-04, S-05)
- [ ] F-04 Application form chủ nhà nhập + ảnh đơn giấy (S-07, S-08)
- [ ] F-05 Applicant mode (S-08a, S-08b)
- [ ] F-06 Blank application PDF
- [ ] F-07 Documents + income check (S-10)
- [x] F-08 Landlord + employer reference (S-11, S-12)
- [x] F-09 Screening report ngoài (S-13)
- [x] F-10 Background review bước 2 (S-14)
- [ ] F-11 Applicant summary (S-09)
- [ ] F-12 Compare + Order queue + thông báo đồng hồ (S-17, S-18)
- [ ] F-13 Decision (S-15)
- [ ] F-14 Letters + PDF (S-16)
- [ ] F-15 Decision file PDF (S-19)
- [ ] F-16 Move-in checklist (S-20)
- [ ] F-17 Data cleanup (S-24)
- [ ] F-18 Backup & restore mã hoá + tự động + nhắc (S-22)
- [ ] F-19 Settings, App lock, Guide, Legal, Delete all (S-21, S-23, S-25 – S-27)
- [ ] Ghép nhánh, toàn bộ test xanh + cài chạy trên Galaxy A13 → gộp `dev` → `main`

## Bước 4 — Test toàn bộ (chỉ ghi lỗi)
- [ ] Viết TESTCASES.md (100–200 case)
- [ ] Chạy hết case (test tự động + thử máy) → BUGS.md

## Bước 5 — Sửa lỗi
- [ ] Sửa hết BUGS.md (tick trong BUGS.md)
- [ ] Chạy lại toàn bộ test + case từng lỗi → gộp `dev` → `main`

## Bước 6 — Kiểm cuối & lên store
- [ ] Giả lập người dùng thật trên máy, xem giao diện từng màn
- [ ] Store listing + privacy + Data safety / App Privacy + ảnh store
- [ ] **Dừng: báo Phương** — chốt Bundle ID, Phương tạo khoá ký, Apple Team ID → tag `v1.0.0` → AAB + iOS
- [ ] checklists release-android + release-ios
- [ ] Nộp Google Play (closed test) + App Store (TestFlight)
- [ ] Retro 3 dòng APP.md + 1 dòng METRICS.md
