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
- [x] Mockup đủ mọi màn S-01…S-27 (34 artboard, tweak tối) → https://claude.ai/artifact/E1YZve51VMfZ5dahLRTwtY + `design/`
- [x] Phương duyệt mockup (2026-11-25)

## Bước 3 — Làm app theo mockup (phiên điều phối chạy `PLAN.md`)
- [ ] 1A Khung: cài sẵn mọi thư viện, Expo + route S-01…S-27 + i18n + Jest + CI, commit `dev`
- [x] 1B Engine `src/engine/`: luật C1–C10, evidence, issues, rào chắn, First-come + đồng hồ, điều kiện FCRA + test §3.16
- [ ] 1C Theme + UI kit từ token mockup + gallery `/dev/gallery`; schema SQLite, repository, `useLive`, dữ liệu mẫu §8
- [ ] F-01 Onboarding (S-01)
- [ ] F-02 Rentals list, Rental editor, Rental hub (S-02, S-03, S-06)
- [ ] F-03 Criteria builder + published criteria PDF (S-04, S-05)
- [ ] F-04 Application form chủ nhà nhập + ảnh đơn giấy (S-07, S-08)
- [ ] F-05 Applicant mode (S-08a, S-08b)
- [ ] F-06 Blank application PDF
- [ ] F-07 Documents + income check (S-10)
- [ ] F-08 Landlord + employer reference (S-11, S-12)
- [ ] F-09 Screening report ngoài (S-13)
- [ ] F-10 Background review bước 2 (S-14)
- [ ] F-11 Applicant summary (S-09)
- [ ] F-12 Compare + Order queue + thông báo đồng hồ (S-17, S-18)
- [ ] F-13 Decision (S-15)
- [ ] F-14 Letters + PDF (S-16)
- [ ] F-15 Decision file PDF (S-19)
- [ ] F-16 Move-in checklist (S-20)
- [ ] F-17 Data cleanup (S-24)
- [ ] F-18 Backup & restore mã hoá + tự động + nhắc (S-22)
- [ ] F-19 Settings, App lock, Guide, Legal, Delete all (S-21, S-23, S-25 – S-27) + icon + splash
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
