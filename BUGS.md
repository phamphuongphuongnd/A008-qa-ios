# A008-evenlease — Lỗi (bước 4–6)

> Bước 4 chỉ ghi, bước 5 sửa từ nặng tới nhẹ. Sửa xong + test hồi quy → tick `[x]` và ghi commit.
> Mức: 🔴 chặn/sai dữ liệu · 🟠 sai chức năng · 🟡 giao diện/chữ.
> Dải số: **B-01…B-39** phần tự động (T) · **B-40…B-52** QA-1 · **B-53…B-66** QA-2 · **B-67…B-76** QA-3 · **B-80…B-99** iOS · **B-100…B-119** A13 · **B-120…B-163** thử lại 27/11 (chi tiết `qa/runs/2026-11-27-retest-*.md`).
> Chi tiết (tái hiện, nguyên nhân nghi, ảnh) ở `qa/runs/2026-11-26-qa1|qa2|qa3|ios.md`; dưới đây mỗi lỗi 1 dòng.
> Lượt thử máy 2026-11-26: 3 máy ảo Android 17 (dev client x86_64, đóng băng `6b1fea8`) song song + iOS simulator (GitHub Actions).

<!-- Phần T (124 case, 702 test jest): chưa tìm thấy lỗi. -->

**Gộp / trùng (không sửa riêng):** B-54 → B-47 · B-74(b) → B-41 · B-66, B-77…B-79 bỏ trống (QA-3 tự gộp trùng vào B-40 / B-47 / B-48 rồi đánh lại số).
**Tổng 27/11:** đã sửa + tick (thử lại máy ảo release / A13) B-40…B-81, B-100…B-105, B-120…B-123, B-140…B-146, B-150, B-160 (B-130 lỗi build cũng đã sửa). **Đã thử A13 bản 14:32 (dev 2873479) ✅:** B-65, B-72, B-131, B-132, B-151, B-161, B-162, B-163. **Code đã sửa, chờ run iOS 45959965804:** B-85 (iPad). **Còn mở:** iOS B-84 🟡 (chờ run).

## 🔴 Chặn
- [x] B-40 🔴 [TC-127, TC-196] S-01 — Cài mới / `pm clear` → mở thẳng S-03 "New rental", không bao giờ qua onboarding (cả launcher, cả iOS); Back chết; sau Delete all về S-02 rỗng chứ không về S-01 · nghi `app/_layout.tsx` `initialRouteName: '(tabs)'` trong `Stack.Protected guard={onboarded}` (3 làn + iOS cùng gặp)
- [x] B-47 🔴 [TC-154, TC-160, TC-192] S-03 / S-08 / S-15 — "Discard changes?" → Discard: hộp hiện lại mãi, kẹt trong form (phải tắt app) · `useDiscardGuard` (`src/ui/Overlays.tsx:162`) và `ApplicationFormScreen.tsx:95–103` dispatch lại action khi `usePreventRemove` vẫn bật
- [x] B-48 🔴 [TC-144, TC-184, TC-192] S-15 — Chọn Deny → sheet `formSheet fitToContents` cao quá màn, không cuộn, mất "Save decision" → không lưu được Deny (điện thoại 411 dp + tablet); bàn phím che ô "Explain"
- [x] B-53 🔴 [TC-159, 162, 165, 167] S-08 — Không lưu được Applicant (nháp "Couldn't save the draft", Save / Submit → DrizzleError "begin"): transaction lồng `src/features/intake/form/service.ts:64, 100` → `src/db/repos/applicants.ts:79, 101`; Jest (better-sqlite3) không lộ

## 🟠 Sai chức năng
- [x] B-43 🟠 [TC-136] S-10 — Xem giấy tờ không zoom được trên Android (`maximumZoomScale` chỉ iOS, `DocumentParts.tsx:206`); PDF không xem được
- [x] B-49 🟠 [TC-146] S-16 / S-20 — Tên file chia sẻ chứa tên người / địa chỉ ("Adverse action notice - Priya Raman.pdf") — trái TC-123
- [x] B-51 🟠 [TC-151] S-20 — Ghi chú hạng mục + số đồng hồ chỉ lưu `onBlur` (`MoveInScreen.tsx:328, 373`) → rời màn khi ô còn focus là mất
- [x] B-52 🟠 [TC-152] S-20 PDF — Giờ ký in theo UTC (lệch 7 h): `src/pdf/shell.ts:92` `dateTime()` với chuỗi ISO `Z`
- [x] B-55 🟠 [TC-166] S-06 — Thoát Applicant mode → S-06 thành gốc stack, Back "GO_BACK not handled", không có tab
- [x] B-58 🟠 [TC-169, 170] §6 — Đồng hồ 72/48 h bắt đầu khi chưa có quyền thông báo → bật quyền sau cũng không bao giờ có thông báo (`decision.ts:176–186`); alarm không chính xác (+1 h)
- [x] B-63 🟠 [TC-159, 162] S-08 — Thanh nút cuối form: Next / Save không giãn hết hàng; Applicant mode bước 1 nút Next nhỏ lệch trái
- [x] B-67 🟠 [TC-180] S-22 — Lần sao lưu đầu: đặt mật khẩu xong sheet mở lại trống, không sao lưu (closure cũ `BackupScreen.tsx:35, 153–156`)
- [x] B-68 🟠 [TC-179, 180] S-22 — Huỷ share sheet vẫn ghi "Last backup" (`src/backup/native.ts:96–99` luôn true) → nhắc 30 ngày hoãn sai
- [x] B-69 🟠 [TC-189] S-17 — Chữ 130 % không thành thẻ dọc: `getFontScale() >= 1.3` mà Android trả 1.2999… (`CompareTable.tsx:36`)
- [x] B-70 🟠 [TC-191, 178] LockScreen — Khi khoá, cây a11y vẫn chứa dữ liệu Applicant phía sau (TalkBack đọc / bấm được); cần `importantForAccessibility="no-hide-descendants"`
- [x] B-71 🟠 [TC-193] S-17 / S-06 — Nghi chậm với 20 Applicant (S-17 ~6 s trên máy ảo) → đo lại A13 bản release rồi chốt

## 🟡 Giao diện / chữ
- [x] B-41 🟡 [TC-132, 188] S-06 / S-09 — Nhãn mục "APPLICANTS" / "CRITERIA" bị thẻ đè nửa dưới; S-06 thiếu "Sorted by received"
- [x] B-42 🟡 [TC-133, 143] S-09 / S-17 — Tên tiêu chí dài thay tên ngắn mockup (S-17 cắt chữ); lý do C4 / C5 lặp tên tiêu chí thay vì chứng cứ
- [x] B-44 🟡 [TC-138] S-09 — Marcus: mục ngày lệch hiện 2 lần trong Issues ("5 things" thay vì 4)
- [x] B-45 🟡 [TC-142] S-13 — Save lần đầu không báo, ‹ vẫn hỏi Discard (chưa tái hiện; có thể cùng họ B-53); "Add report" trong Issues nằm dưới nút chân
- [x] B-46 🟡 [TC-143] S-17 — Rental Compare (Ohio) vẫn hiện link "First-come rules (Seattle)"; huy hiệu cột cuối bị cắt
- [x] B-50 🟡 [TC-148] S-14 — Có án mà "Continue with the offer" bấm được khi chưa trả lời 4 câu bắt buộc
- [x] B-56 🟡 [TC-157] S-04 — "up to 1 people per bedroom" (số ít)
- [x] B-57 🟡 [TC-158] F-06 PDF — Trang cuối đơn trống: chân trang nằm giữa trang
- [x] B-59 🟡 [TC-170, 174] S-18 / S-02 — Không tính lại khi app về tiền cảnh (đồng hồ cũ, thẻ nhắc chỉ hiện sau khởi động lại)
- [x] B-60 🟡 [TC-172] F-05 — Applicant mode, app ở nền: thông báo lộ tên ứng viên khác trên thanh thông báo
- [x] B-61 🟡 [TC-174] S-02 — Đóng Rental "Offer out" không hỏi; thông báo offer cũ vẫn bắn sau khi đóng
- [x] B-62 🟡 [TC-174, 175] S-24 — Đếm cả nháp rỗng thành Applicant; sau xoá thẻ ghi "No applicants yet"
- [x] B-64 🟡 [TC-157] S-04 sheet Cx — Câu chặn từ cấm là chữ đỏ (mockup hộp cam có icon); nút Add / Edit không chia đôi
- [x] B-65 🟡 [TC-168, 170] S-06 / S-18 — Hub "New" vs Queue "In review"; banner / hàng đang xử lý / sheet "Request missing info" lệch mockup · S-06 ghi "Waiting" như S-18 + S-18 khớp mockup (R-2) → hết lỗi, A13 27/11
- [x] B-72 🟡 [TC-180] S-22 sheet mật khẩu — giữ mật khẩu cũ sau Discard, lỗi cũ không xoá, ô bật viết hoa, tablet ngang ô co về 0 · a–c máy ảo R-3, (d) tablet ngang R-3 + điện thoại dọc A13 27/11 (bàn phím mở: banner, 2 ô, nút Save đều hiện)
- [x] B-73 🟡 [TC-185] About — "Version 1.0" thiếu "1.0.0 (n)"
- [x] B-74 🟡 [TC-188, 190] S-08 "No" gãy "N/o" (320 dp, 200 %); S-20 tiêu đề 2 dòng mất ngày; đổi cỡ chữ khi đang mở → chữ cắt tới khi mở lại
- [x] B-75 🟡 [TC-188] Vùng chạm < 48 dp: ‹ / + / More 44, segmented 42, chip S-20 40, nút Issues S-09 36
- [x] B-76 🟡 [TC-178, 181, 192] Lặt vặt — Unlock dạt trái màn rộng; App lock theo đồng hồ tường; "Folder: primary:Documents"; job sao lưu tuần cần mạng (máy bay không chạy); huy hiệu S-17 bị cắt
- [x] B-80 🟡 [TC-129, iOS] S-01 trang 3 — iPhone SE chữ mặc định: ô tick "not legal advice" bị thanh chân che; mockup: ô tick ngay trên Get started, "Explore…" là link chữ (app: nút tonal to)
- [x] B-81 🟡 [TC-200, iOS] S-03 — chữ AX-XL: ô chọn "State" gãy "Choos/e" (cùng họ B-74(a))

## A13 bản release (2026-11-27, `qa/runs/2026-11-27-a13.md`)
- [x] B-100 🔴 [TC-125, 127] Build release — APK có R8 (mặc định) crash khi mở: R8 xoá `WorkDatabase_Impl.<init>` (work-runtime 2.10.5 / room 2.6.1) → .aab store sẽ crash · cần keep rule qua config plugin
- [x] B-101 🔴 [TC-180, 182] S-22 — deriveKey PBKDF2 310 000 vòng = **847 s (14 phút)** trên A13 release (~350 vòng/s, JS) → PBKDF2 native (module nhỏ trong `modules/`, Phương để điều phối chọn 2026-11-27)
- [x] B-102 🟡 [TC-181] S-22 — thư mục Google Drive hiện id SAF thô "acc=6;doc=encoded=…" thay vì tên thư mục
- [x] B-103 🟡 [TC-178] S-23 — máy có cả mặt + vân tay: app ghi "Require Face unlock" nhưng hệ thống hỏi vân tay (`lockNative.ts:31`)
- [x] B-104 🟡 [TC-195] Quyền release còn `FOREGROUND_SERVICE` + `WRITE_EXTERNAL_STORAGE` (maxSdk 28) → gỡ ở `plugins/withReleasePermissions.js` hoặc ghi lý do · giữ WRITE_EXTERNAL_STORAGE (maxSdk 28) có chủ ý, lý do ghi ở đầu plugins/withReleasePermissions.js; FOREGROUND_SERVICE đã gỡ
- Số đo A13 release: khởi động lạnh 2,2–3,1 s · S-06 (20 Applicant) 1,2–1,7 s, cuộn ổn · **S-17 4,5–4,9 s, cuộn 45 % khung trễ → B-71 xác nhận** · Drive SAF ghi/đọc ✅ · rung ✅ · vân tay ✅.
- [x] B-160 🟠 [S-08, Phương thử A13 27/11] Form đơn mới (chủ nhà nhập đơn) — ảnh / file đã chọn ở "Attach photos of the paper form" (camera / ảnh / PDF) **không xoá được** và **không xem được** (mong đợi giống Documents S-10: thumbnail + chạm xem toàn màn, phóng to / PDF mở được, xoá có xác nhận)

## Cần thử / đo trên Galaxy A13 (máy ảo không đại diện)
- deriveKey PBKDF2 310 000 vòng: máy ảo dev **14–16 phút/lần** → đo A13 bản release, chốt `BACKUP_KDF` (`src/backup/format.ts:27`); nếu vẫn lâu → thành lỗi 🔴.
- Hiệu năng 15–20 Applicant (B-71) · nghe TalkBack thật (B-70) · zoom 2 ngón (B-43) · Drive SAF (TC-181) · thông báo giờ thật (B-58) · rung · camera thật · nội dung mail (TC-140) · icon themed launcher Samsung (TC-125) · B-40 trên APK release.
- Quyền release cần soát trước Data safety: `ACCESS_LOCAL_NETWORK`, `CHANGE_WIFI_MULTICAST_STATE`, `FOREGROUND_SERVICE` chưa nằm trong danh sách gỡ (`plugins/withReleasePermissions.js`) → `aapt2 dump permissions` APK release.
- Phương xét (không phải lỗi): splash không có dòng "Same criteria for every applicant." (mockup có) · "Explore with a sample rental" vào thẳng S-06 thay vì S-02 · About thiếu "Send feedback" · S-20 bố cục khác mockup (thẻ + chip, tab phòng xuống dòng).

## Thử lại 27/11 — lỗi còn mở / mới (B-120…B-163)
- [x] B-131 🟡 [TC-169, B-58] S-18 sheet "Request missing info" — dòng "You'll get a reminder 2 hours before it ends." cố định kể cả khi chọn "Not now" · **code xong de4c94d** (hộp chỉ hứa nhắc khi có quyền thông báo), chờ thử máy
- [x] B-132 🟡 [TC-168, B-65] S-06 — hub ghi Bea / Chris "New" khi S-18 / S-09 ghi "Waiting" (cũng thấy trên A13 với Priya / Marcus / Dana: hub "New") · **code xong de4c94d** (S-06 ghi "Waiting" như S-18), chờ thử máy
- [x] B-133 🟡 [TC-167] TESTCASES lệch code — ảnh đơn giấy hiện ở thẻ "Paper form" của S-08, không phải "Other files" → sửa mong đợi TC-167 · đã sửa mong đợi TC-167 (de4c94d)
- [x] B-151 🟡 [TC-170] Hộp "Get deadline reminders on time?" đã đổi sang hộp riêng của app (fix 4e4a5e0) — chưa thử máy (A13 đã cấp sẵn quyền alarm → không hiện hộp) · A13 27/11: hộp riêng của app "Get deadline reminders on time?" [Not now] [Allow], không còn Alert hệ thống
- [x] B-161 🟡 [TC-190] S-06 hub, 320 dp + chữ 200 % — "APPLICANTS" vỡ "AP/PLI/CA/NT/S" vì "Sorted by received" chiếm chỗ (A13, `qa/runs/2026-11-27-retest-a13-r4.md`) · **code xong de4c94d**, chờ thử máy 320 dp + 200 %
- [x] B-162 🟡 [TC-190] S-02 Rentals, 320 dp + chữ 200 % — "Columbus, OH 43215" gãy giữa từ ("Columb/us, OH") cạnh huy hiệu "Offer out" · **code xong de4c94d**, chờ thử máy 320 dp + 200 %
- [x] B-163 🟡 [TC-188] Sheet "Add applicant" — dòng cuối "…Screening services collect them directly." chạm biểu tượng thanh điều hướng 3 nút (A13), thiếu đệm đáy · **code xong de4c94d** (đệm đáy theo inset), chờ thử máy A13
- [ ] B-85 🔴 [TC-144, TC-184, iOS iPad] S-15 — chọn Deny: sheet iPad là thẻ ≈ 590×660 pt nhưng khung cao cả cửa sổ → "Save decision" nằm dưới mép thẻ, không bấm được (run iOS #7, ảnh ipad-light_05a2) · **code xong de4c94d** (khung ≤ 600 pt trên iPad), chờ run iOS
