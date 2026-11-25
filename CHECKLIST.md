# A008-evenlease — Checklist

> Làm từ trên xuống, xong mục nào (đã kiểm) tick `[x]` + commit rồi mới sang mục sau. Mỗi việc **1 dòng**.
> Việc mới phát sinh → thêm dòng vào đúng bước, không làm ngay. Quy trình: `playbook/PLAYBOOK.md` · phase: `PLAN.md`.

## Bước 0 — Khảo sát
- [x] Khảo sát thực trạng, 5 đối thủ (1.538 đánh giá Play), luật, biểu mẫu → `research.md`; Phương quyết làm (2026-11-25)

## Bước 1 — Grill & product.md
- [x] Cấp mã, thư mục, APP.md, CHECKLIST.md
- [ ] git `main` + `dev`, repo MA-Global-VN/P_evenlease (Phương chọn link 2026-11-25), ghi REGISTRY
- [x] Tra trùng tên 2 store (Evenlease không trùng tên chính xác)
- [x] Grill: tính năng, kiếm tiền (miễn phí), tên, bundle ID (để sau) → APP.md
- [x] Grill công nghệ: RN + Expo, không server, SQLite, không đăng nhập, sao lưu tự động → APP.md
- [ ] Viết product.md (từng màn, từng nút, trạng thái, dữ liệu mẫu, luật chấm, thư FCRA)
- [ ] Điền danh sách bước 3 từ product.md
- [ ] Phương duyệt product.md + PLAN.md

## Bước 2 — Mockup Hi-Fi (Artifact Design, design system mới, Phương duyệt)
- [ ] Mockup đủ mọi màn S-xx (+ tối, trạng thái chính) → link + `design/` (`.dc.html` + `tokens.json`)
- [ ] Phương duyệt mockup

## Bước 3 — Làm app theo mockup (phiên điều phối chạy `PLAN.md`)
- [ ] Danh sách điền sau khi product.md được duyệt

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
