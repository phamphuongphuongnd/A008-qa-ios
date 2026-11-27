# A008-evenlease — Lỗi (bước 4–6)

> Bước 4 chỉ ghi, bước 5 sửa từ nặng tới nhẹ. Sửa xong + test hồi quy → tick `[x]` và ghi commit.
> Mức: 🔴 chặn/sai dữ liệu · 🟠 sai chức năng · 🟡 giao diện/chữ.
> Dải số: **B-01…B-39** phần tự động (T) · **B-40…B-52** QA-1 · **B-53…B-66** QA-2 · **B-67…B-76** QA-3 · **B-80…B-99** iOS.
> Chi tiết (tái hiện, nguyên nhân nghi, ảnh) ở `qa/runs/2026-11-26-qa1|qa2|qa3|ios.md`; dưới đây mỗi lỗi 1 dòng.
> Lượt thử máy 2026-11-26: 3 máy ảo Android 17 (dev client x86_64, đóng băng `6b1fea8`) song song + iOS simulator (GitHub Actions).

<!-- Phần T (124 case, 702 test jest): chưa tìm thấy lỗi. -->

**Gộp / trùng (không sửa riêng):** B-54 → B-47 · B-74(b) → B-41 · B-66, B-77…B-79 bỏ trống (QA-3 tự gộp trùng vào B-40 / B-47 / B-48 rồi đánh lại số).
**Tổng:** 37 lỗi — 🔴 4 · 🟠 12 · 🟡 21 (Android 35 + iOS 2; B-40 cũng xảy ra trên iOS).

## 🔴 Chặn
- [ ] B-40 🔴 [TC-127, TC-196] S-01 — Cài mới / `pm clear` → mở thẳng S-03 "New rental", không bao giờ qua onboarding (cả launcher, cả iOS); Back chết; sau Delete all về S-02 rỗng chứ không về S-01 · nghi `app/_layout.tsx` `initialRouteName: '(tabs)'` trong `Stack.Protected guard={onboarded}` (3 làn + iOS cùng gặp)
- [ ] B-47 🔴 [TC-154, TC-160, TC-192] S-03 / S-08 / S-15 — "Discard changes?" → Discard: hộp hiện lại mãi, kẹt trong form (phải tắt app) · `useDiscardGuard` (`src/ui/Overlays.tsx:162`) và `ApplicationFormScreen.tsx:95–103` dispatch lại action khi `usePreventRemove` vẫn bật
- [ ] B-48 🔴 [TC-144, TC-184, TC-192] S-15 — Chọn Deny → sheet `formSheet fitToContents` cao quá màn, không cuộn, mất "Save decision" → không lưu được Deny (điện thoại 411 dp + tablet); bàn phím che ô "Explain"
- [ ] B-53 🔴 [TC-159, 162, 165, 167] S-08 — Không lưu được Applicant (nháp "Couldn't save the draft", Save / Submit → DrizzleError "begin"): transaction lồng `src/features/intake/form/service.ts:64, 100` → `src/db/repos/applicants.ts:79, 101`; Jest (better-sqlite3) không lộ

## 🟠 Sai chức năng
- [ ] B-43 🟠 [TC-136] S-10 — Xem giấy tờ không zoom được trên Android (`maximumZoomScale` chỉ iOS, `DocumentParts.tsx:206`); PDF không xem được
- [ ] B-49 🟠 [TC-146] S-16 / S-20 — Tên file chia sẻ chứa tên người / địa chỉ ("Adverse action notice - Priya Raman.pdf") — trái TC-123
- [ ] B-51 🟠 [TC-151] S-20 — Ghi chú hạng mục + số đồng hồ chỉ lưu `onBlur` (`MoveInScreen.tsx:328, 373`) → rời màn khi ô còn focus là mất
- [ ] B-52 🟠 [TC-152] S-20 PDF — Giờ ký in theo UTC (lệch 7 h): `src/pdf/shell.ts:92` `dateTime()` với chuỗi ISO `Z`
- [ ] B-55 🟠 [TC-166] S-06 — Thoát Applicant mode → S-06 thành gốc stack, Back "GO_BACK not handled", không có tab
- [ ] B-58 🟠 [TC-169, 170] §6 — Đồng hồ 72/48 h bắt đầu khi chưa có quyền thông báo → bật quyền sau cũng không bao giờ có thông báo (`decision.ts:176–186`); alarm không chính xác (+1 h)
- [ ] B-63 🟠 [TC-159, 162] S-08 — Thanh nút cuối form: Next / Save không giãn hết hàng; Applicant mode bước 1 nút Next nhỏ lệch trái
- [ ] B-67 🟠 [TC-180] S-22 — Lần sao lưu đầu: đặt mật khẩu xong sheet mở lại trống, không sao lưu (closure cũ `BackupScreen.tsx:35, 153–156`)
- [ ] B-68 🟠 [TC-179, 180] S-22 — Huỷ share sheet vẫn ghi "Last backup" (`src/backup/native.ts:96–99` luôn true) → nhắc 30 ngày hoãn sai
- [ ] B-69 🟠 [TC-189] S-17 — Chữ 130 % không thành thẻ dọc: `getFontScale() >= 1.3` mà Android trả 1.2999… (`CompareTable.tsx:36`)
- [ ] B-70 🟠 [TC-191, 178] LockScreen — Khi khoá, cây a11y vẫn chứa dữ liệu Applicant phía sau (TalkBack đọc / bấm được); cần `importantForAccessibility="no-hide-descendants"`
- [ ] B-71 🟠 [TC-193] S-17 / S-06 — Nghi chậm với 20 Applicant (S-17 ~6 s trên máy ảo) → đo lại A13 bản release rồi chốt

## 🟡 Giao diện / chữ
- [ ] B-41 🟡 [TC-132, 188] S-06 / S-09 — Nhãn mục "APPLICANTS" / "CRITERIA" bị thẻ đè nửa dưới; S-06 thiếu "Sorted by received"
- [ ] B-42 🟡 [TC-133, 143] S-09 / S-17 — Tên tiêu chí dài thay tên ngắn mockup (S-17 cắt chữ); lý do C4 / C5 lặp tên tiêu chí thay vì chứng cứ
- [ ] B-44 🟡 [TC-138] S-09 — Marcus: mục ngày lệch hiện 2 lần trong Issues ("5 things" thay vì 4)
- [ ] B-45 🟡 [TC-142] S-13 — Save lần đầu không báo, ‹ vẫn hỏi Discard (chưa tái hiện; có thể cùng họ B-53); "Add report" trong Issues nằm dưới nút chân
- [ ] B-46 🟡 [TC-143] S-17 — Rental Compare (Ohio) vẫn hiện link "First-come rules (Seattle)"; huy hiệu cột cuối bị cắt
- [ ] B-50 🟡 [TC-148] S-14 — Có án mà "Continue with the offer" bấm được khi chưa trả lời 4 câu bắt buộc
- [ ] B-56 🟡 [TC-157] S-04 — "up to 1 people per bedroom" (số ít)
- [ ] B-57 🟡 [TC-158] F-06 PDF — Trang cuối đơn trống: chân trang nằm giữa trang
- [ ] B-59 🟡 [TC-170, 174] S-18 / S-02 — Không tính lại khi app về tiền cảnh (đồng hồ cũ, thẻ nhắc chỉ hiện sau khởi động lại)
- [ ] B-60 🟡 [TC-172] F-05 — Applicant mode, app ở nền: thông báo lộ tên ứng viên khác trên thanh thông báo
- [ ] B-61 🟡 [TC-174] S-02 — Đóng Rental "Offer out" không hỏi; thông báo offer cũ vẫn bắn sau khi đóng
- [ ] B-62 🟡 [TC-174, 175] S-24 — Đếm cả nháp rỗng thành Applicant; sau xoá thẻ ghi "No applicants yet"
- [ ] B-64 🟡 [TC-157] S-04 sheet Cx — Câu chặn từ cấm là chữ đỏ (mockup hộp cam có icon); nút Add / Edit không chia đôi
- [ ] B-65 🟡 [TC-168, 170] S-06 / S-18 — Hub "New" vs Queue "In review"; banner / hàng đang xử lý / sheet "Request missing info" lệch mockup
- [ ] B-72 🟡 [TC-180] S-22 sheet mật khẩu — giữ mật khẩu cũ sau Discard, lỗi cũ không xoá, ô bật viết hoa, tablet ngang ô co về 0
- [ ] B-73 🟡 [TC-185] About — "Version 1.0" thiếu "1.0.0 (n)"
- [ ] B-74 🟡 [TC-188, 190] S-08 "No" gãy "N/o" (320 dp, 200 %); S-20 tiêu đề 2 dòng mất ngày; đổi cỡ chữ khi đang mở → chữ cắt tới khi mở lại
- [ ] B-75 🟡 [TC-188] Vùng chạm < 48 dp: ‹ / + / More 44, segmented 42, chip S-20 40, nút Issues S-09 36
- [ ] B-76 🟡 [TC-178, 181, 192] Lặt vặt — Unlock dạt trái màn rộng; App lock theo đồng hồ tường; "Folder: primary:Documents"; job sao lưu tuần cần mạng (máy bay không chạy); huy hiệu S-17 bị cắt
- [ ] B-80 🟡 [TC-129, iOS] S-01 trang 3 — iPhone SE chữ mặc định: ô tick "not legal advice" bị thanh chân che; mockup: ô tick ngay trên Get started, "Explore…" là link chữ (app: nút tonal to)
- [ ] B-81 🟡 [TC-200, iOS] S-03 — chữ AX-XL: ô chọn "State" gãy "Choos/e" (cùng họ B-74(a))

## Cần thử / đo trên Galaxy A13 (máy ảo không đại diện)
- deriveKey PBKDF2 310 000 vòng: máy ảo dev **14–16 phút/lần** → đo A13 bản release, chốt `BACKUP_KDF` (`src/backup/format.ts:27`); nếu vẫn lâu → thành lỗi 🔴.
- Hiệu năng 15–20 Applicant (B-71) · nghe TalkBack thật (B-70) · zoom 2 ngón (B-43) · Drive SAF (TC-181) · thông báo giờ thật (B-58) · rung · camera thật · nội dung mail (TC-140) · icon themed launcher Samsung (TC-125) · B-40 trên APK release.
- Quyền release cần soát trước Data safety: `ACCESS_LOCAL_NETWORK`, `CHANGE_WIFI_MULTICAST_STATE`, `FOREGROUND_SERVICE` chưa nằm trong danh sách gỡ (`plugins/withReleasePermissions.js`) → `aapt2 dump permissions` APK release.
- Phương xét (không phải lỗi): splash không có dòng "Same criteria for every applicant." (mockup có) · "Explore with a sample rental" vào thẳng S-06 thay vì S-02 · About thiếu "Send feedback" · S-20 bố cục khác mockup (thẻ + chip, tab phòng xuống dòng).
