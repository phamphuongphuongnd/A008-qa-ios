# A008 — Bước 5 sửa lỗi, lượt 1 (2026-11-26)

> Luật chung cho 6 phiên con sửa lỗi song song. Phiên điều phối: `local_e2bea1f7-a814-466d-b697-e2e01e668704`.

## Chỗ làm
- Mỗi phiên **một worktree + một nhánh riêng**, cắt từ `dev` `cc8edd6`: `D:\Mobile App\apps\A008-wt\fix-<nhóm>` (nhánh `fix/<nhóm>`).
  `node_modules` là junction tới repo chính — **không `npm install`, không thêm thư viện** (cần thư viện mới → nhắn điều phối).
- Chỉ sửa file thuộc nhóm mình (bảng dưới). Cần sửa file của nhóm khác → **nhắn điều phối**, đừng tự sửa.
- File chung khó tránh (`src/i18n/en.json`…): chỉ thêm / sửa đúng khoá của mình, không định dạng lại cả file.
- **Không** chạy Metro, Gradle, prebuild, máy ảo, adb. Thử máy làm 1 lượt sau khi điều phối ghép hết.
- Không sửa `TESTCASES.md`, `CHECKLIST.md`, `APP.md`. Trong `BUGS.md` **không sửa** — ghi kết quả vào báo cáo (điều phối tick).

## Đọc trước
- `BUGS.md` (repo chính `D:\Mobile App\apps\A008-evenlease\BUGS.md`) + chi tiết lỗi ở `qa/runs/2026-11-26-qa1|qa2|qa3.md` (cùng thư mục repo chính).
- `product.md` các màn liên quan, mockup `design/v2-indigo/Evenlease-HiFi-mockups.html`.
- `D:\Mobile App\memory\facts\expo-device-bugs-checklist.md`, `react-compiler-use-no-memo.md`, `expo-router-stack-cleanup.md`.

## Cách sửa
- Sửa từ gốc (đúng nguyên nhân), không vá triệu chứng. Mỗi lỗi có test hồi quy khi test được (jest); lỗi chỉ thấy trên máy
  (sheet, bàn phím, zoom…) → ghi rõ "cần thử máy: …" cho lượt thử cuối.
- Jest chạy better-sqlite3 nên **không bắt được lỗi riêng của expo-sqlite** (transaction lồng…) — nếu đụng DB, thêm test giả
  hành vi expo-sqlite khi có thể.
- Commit trên nhánh của mình, message `[A008-evenlease] fix B-xx: …`, có dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Không push, không merge vào `dev`.
- Xong: `npx tsc --noEmit` + `npx expo lint --no-cache` + `npx jest --maxWorkers=2` xanh trong worktree.

## Báo về
- `SendMessage` tới điều phối: lỗi nào đã sửa (commit), lỗi nào chưa / không sửa và vì sao, file chung đã đụng, danh sách
  "cần thử máy". Câu hỏi cho Phương: popup tiếng Việt.

## Nhóm & phạm vi file (gợi ý — theo đúng lỗi, file thực tế có thể khác)
| Nhóm | Lỗi | Vùng file chính |
|---|---|---|
| fix-nav | B-40, B-47, B-55 | `app/_layout.tsx`, `app/onboarding/`, `src/ui/Overlays.tsx` (`useDiscardGuard`), thoát Applicant mode, điều hướng sau Delete all |
| fix-intake | B-53, B-62, B-63, B-74(a), phần Discard riêng của `ApplicationFormScreen` (B-47 ở S-08) | `src/features/intake/`, `src/db/repos/applicants.ts`, `app/applicants/`, đếm nháp ở cleanup |
| fix-decision | B-48, B-50, B-58, B-59, B-60, B-61, B-65 | S-15 sheet quyết định, S-14, `src/features/decision/`, S-18 / S-06 hàng đợi, thông báo, đóng Rental |
| fix-review-ui | B-42, B-44, B-46, B-56, B-64, B-69 | S-04 criteria builder, S-09 summary / Issues, S-17 Compare (`CompareTable.tsx`), câu reason |
| fix-docs | B-43, B-45, B-49, B-51, B-52, B-57 | S-10 documents viewer, S-13 report, `src/pdf/`, tên file share, S-20 move-in |
| fix-system | B-41, B-67, B-68, B-70, B-72, B-73, B-74(b–d), B-75, B-76 | `src/backup/`, S-22, LockScreen, S-21 / About, UI kit dùng chung (nhãn mục, vùng chạm) |
