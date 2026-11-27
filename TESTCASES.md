# A008-evenlease — Test cases (bước 4)

> Sinh từ `product.md` (§2, §3, §5, §6, §7, §8, §10) + `APP.md`, trên bản đóng băng `dev` 4eaf195. Mỗi case 1 dòng.
> Kết quả: ✅ đạt · ❌ lỗi (ghi mã B-xx) · ⏭ bỏ (lý do).
> Cách chạy: **T** = test tự động jest (ghi file test, chạy `npx jest --maxWorkers=2`) · **M** = thử trên Galaxy A13 qua adb.
> Phần A (T) đã chạy 2026-11-26 trên nhánh `wt/testcases`. Phần B (M) **để trống cột Kết quả**, sắp đúng thứ tự đi một lượt
> trên máy (cài mới → onboarding → luồng mẫu → rental tự tạo First-come → nhánh phụ → hệ thống → giao diện / trợ năng → cài đè → xoá hết).
> Lỗi → `BUGS.md` (dải B-01…B-39 cho phần T; phiên thử máy dùng tiếp B-40…).
> **Tổng: 200 case** — T 124 (✅ 124 · ❌ 0) · M 76 (72 Android + 4 iOS). Jest: 67 suite / 702 test xanh (29 test mới trong 5 file, đánh dấu `(mới)`).
> **Phần B Android đã chạy 2026-11-26** trên 3 máy ảo Android 17 song song (dev client x86_64, đóng băng `6b1fea8`, chi tiết `qa/runs/2026-11-26-qa1|qa2|qa3.md`):
> **✅ 50** (5 ✅* dữ liệu chèn tay vì B-53) · **❌ 19** · **⏭ 3** → 35 lỗi trong `BUGS.md` (🔴 4 · 🟠 12 · 🟡 19). iOS (TC-197…200, GitHub Actions simulator, `qa/runs/2026-11-26-ios.md`): ✅ 1 · ⏭ 3 (16/16 luồng Maestro kẹt ở B-40) · TC-127 ❌ B-40 cả trên iOS.
> Ước tính một lượt máy: B1 15′ · B2 70′ · B3 75′ · B4 30′ · B5 45′ · B6 40′ · B7 15′ ≈ **4,5 – 5 giờ**.

## A. Tự động (T)

| Mã | Tính năng | Trường hợp | Kết quả mong đợi | Cách | Kết quả |
|---|---|---|---|---|---|
| TC-001 | F-11 C1 | Thu nhập đúng 3.0× tiền thuê; thiếu 1 cent; Không có số thu nhập nào | 3.0× → Met; thiếu 1 cent → Not met, hiện "2.99×" (không làm tròn lên 3.00×) + "Short by $0.01/mo"; Missing | T: src/engine/__tests__/income.test.ts | ✅ |
| TC-002 | F-11 C1 | Thu nhập hộ = người nộp + other income + người lớn khác; hệ số 2.5× tuỳ chỉnh | Cộng đủ 3 nguồn; ratio 2 số lẻ | T: src/engine/__tests__/income.test.ts | ✅ |
| TC-003 | F-11 C1 | Voucher trả hết tiền thuê (rentForTest = 0); tắt tuỳ chọn voucher; Có voucher nhưng bỏ trống "Monthly amount it pays" | = 0 → Met; tắt → dùng nguyên tiền thuê; Missing, reason nhắc nhập số tiền | T: src/engine/__tests__/income.test.ts | ✅ |
| TC-004 | F-11 C1 | Phiếu lương đã kiểm ≥ 90 % / đúng 90 % / < 90 % số khai; Giấy chưa kiểm; 2 nguồn thu nhập chỉ 1 nguồn có giấy kiểm | ≥ 90 % → Verified, ratio tính theo giấy; < 90 % → Mismatch, reason có cả 2 số; Claimed, dùng số khai | T: src/engine/__tests__/income.test.ts | ✅ |
| TC-005 | F-07 | Quy đổi phiếu lương 4 kỳ (weekly 52 / biweekly 26 / semimonthly 24 / monthly 12) | Đúng tới cent | T: src/engine/__tests__/income.test.ts | ✅ |
| TC-006 | F-11 C2 | Residence chồng nhau; một residence nằm trong residence khác; Residence hiện tại; loại With family / Other | Gộp, tính 1 lần; Tính tới ngày nhận đơn, tròn xuống; chỉ Rent / Own được tính | T: src/engine/__tests__/history.test.ts | ✅ |
| TC-007 | F-11 C2 | Đúng m tháng / m − 1 / không residence / lần đầu thuê; Ngày landlord xác nhận lệch ≤ 31 / > 31 ngày; residence dài nhất được kiểm | Met / Not met / Missing / Not met + gợi ý "co-signer… your call"; Verified / Mismatch | T: src/engine/__tests__/history.test.ts | ✅ |
| TC-008 | F-11 C3 | Judgment trong 5 năm; đúng mốc 5 năm; sớm hơn 1 ngày; chỉ có năm | Not met (Verified); mốc nằm trong; ngoài mốc → Met; chỉ năm ở năm biên → Needs review | T: src/engine/__tests__/report.test.ts | ✅ |
| TC-009 | F-11 C3 | Chỉ có Settled / Dismissed / Tenant won / Unknown; không vụ nào | Needs review "filed but no judgment"; không vụ → Met Verified | T: src/engine/__tests__/report.test.ts | ✅ |
| TC-010 | F-11 C3 | Chưa có report: đơn No / Yes / trống; report "No" mà đơn "Yes" (và ngược lại) | Met Claimed / Needs review Claimed / Missing; lệch → Mismatch | T: src/engine/__tests__/report.test.ts | ✅ |
| TC-011 | F-11 C4 | Would rent again Yes / No / Wouldn't say; chưa gọi; Unreachable | Met / Not met / Needs review; Missing; Missing "Unreachable after N attempts" | T: src/engine/__tests__/history.test.ts | ✅ |
| TC-012 | F-11 C4 | Chỉ ở nhà riêng / với gia đình; nhà riêng + 1 nơi thuê cũ | Needs review · Claimed "No previous landlord to call…"; có nơi thuê cũ → gọi landlord đó | T: src/engine/__tests__/qaGaps.test.ts (mới) | ✅ |
| TC-013 | F-11 C4 | Dùng nơi thuê gần nhất không phải nơi đang ở; chưa xác nhận chủ; tiền thuê lệch > 5 % / đúng 5 % | Chọn đúng residence; Claimed + issue "Landlord identity not confirmed"; > 5 % → Mismatch, outcome giữ nguyên | T: src/engine/__tests__/history.test.ts | ✅ |
| TC-014 | F-11 C5 | Report có nợ > $0; None / landlord No; landlord "Wouldn't say"; report None nhưng landlord nói còn nợ | Not met Verified; Met; Missing; Not met + Mismatch | T: src/engine/__tests__/report.test.ts | ✅ |
| TC-015 | F-11 C6 · F-11 C7 | Thiếu 1 loại giấy; đủ file; mọi file đã "Checked"; Đúng p × bedrooms; thêm 1 người; Studio; chưa trả lời | Missing (liệt kê loại thiếu); Met Claimed; Met Verified; Met; Not met + cảnh báo cam "Check your local occupancy code…"; Studio = 1; Missing | T: src/engine/__tests__/household.test.ts | ✅ |
| TC-016 | F-11 C8 | No pets + mèo; Cats only + chó; Cats and dogs max 2 với 2 / 3 / thú khác; Case by case có pet | Not met; Not met; Met / Not met / Not met; Needs review | T: src/engine/__tests__/household.test.ts | ✅ |
| TC-017 | F-11 C9 | Điểm = s; s − 1; "No score"; chưa có report | Met; Not met; Needs review (không bao giờ Not met); Missing | T: src/engine/__tests__/report.test.ts | ✅ |
| TC-018 | F-10 C10 | Trước Conditional offer; Sau offer: chưa nhập / không án / có án trong lookback / mốc 7 năm | "Not reviewed yet (after offer)", không tính là Missing khi xét Ready to decide; Missing / Met / Needs review (không bao giờ Not met) / mốc nằm trong, sớm 1 ngày nằm ngoài | T: src/engine/__tests__/household.test.ts · sample.test.ts | ✅ |
| TC-019 | F-03 Cx | Tiêu chí tự thêm: khách Yes / No / trống; "Landlord checks" | Met Claimed / Not met / Missing; Verified (Landlord note) | T: src/engine/__tests__/household.test.ts | ✅ |
| TC-020 | F-11 | Issues & tóm tắt | Issues chỉ Mismatch → Needs review → Missing; Not met không vào Issues; "N items missing" chỉ đếm Missing | T: src/engine/__tests__/sample.test.ts · src/features/decision/__tests__/review.test.ts | ✅ |
| TC-021 | §8 | #1 Jordan Ellis — từng ô; #4 Dana Ortiz — từng ô | C1 Met Verified "$5,351.67/mo is 3.24× rent" … C10 Not reviewed yet → Ready to decide; C1 "3.47× your share of the rent ($750)", C3 Needs review → Ready to decide | T: src/engine/__tests__/sample.test.ts | ✅ |
| TC-022 | §8 | #2 Priya Raman — từng ô; #3 Marcus Webb — từng ô | C1 Not met "2.85× … Short by $250/mo", C5 Not met (report), C4/C6 Missing → "2 items missing"; C2 Mismatch (ngày), C4 Needs review + rent +29 %, C5 Missing → "1 item missing" | T: src/engine/__tests__/sample.test.ts | ✅ |
| TC-023 | F-12 | Không điểm tổng / thứ hạng | Cột theo thứ tự nhận, không score; lọc Hide denied / withdrawn | T: src/engine/__tests__/sample.test.ts · src/features/decision/__tests__/review.test.ts | ✅ |
| TC-024 | §3.1 | Hiệu năng engine 50 Applicant × 15 tiêu chí | < 50 ms | T: src/engine/__tests__/sample.test.ts | ✅ |
| TC-025 | F-12/F-15 | Dữ liệu lớn qua DB: 50 Applicant × 15 tiêu chí (C1–C10 bật + 5 Cx), nhận lệch thứ tự chèn | S-17 50 cột + 15 hàng + Issues, đúng thứ tự nhận, < 1,5 s; S-09 15 dòng; S-18 1 In review + 49 chờ; Decision file đủ 50 người, "N of 15 Met" | T: src/features/decision/__tests__/largeData.test.ts (mới) | ✅ |
| TC-026 | F-03 | Bộ mẫu §3.2 + khoảng tham số | C1–C8 bật, C9/C10 tắt; 2.0–4.0×, 0–60 tháng, 1–7 năm | T: src/engine/__tests__/criteria.test.ts | ✅ |
| TC-027 | F-03 | Từ cấm trong tiêu chí tự thêm (hoa thường, số nhiều); > 80 ký tự; thứ 6 | Chặn + câu Fair housing + nút Edit; giới hạn 80 ký tự; tối đa 5 | T: src/engine/__tests__/criteria.test.ts · src/features/criteria/__tests__/criteriaEditor.test.ts · criteriaService.test.ts | ✅ |
| TC-028 | F-03 | Tắt voucher C1; C7 < 2; bật C9 / C10 | Hộp "In 23 states…" [Keep on] [Turn off anyway]; cảnh báo familial status; ghi chú C9 / C10 | T: src/features/criteria/__tests__/criteriaEditor.test.ts | ✅ |
| TC-029 | F-03 | Khoá tiêu chí khi có Applicant; sửa không lý do / có lý do / không đổi gì | Bắt lý do; ghi lịch sử (ngày, cũ → mới, lý do) + chấm lại mọi người; không đổi → không ghi | T: src/engine/__tests__/criteria.test.ts · src/features/criteria/__tests__/criteriaService.test.ts | ✅ |
| TC-030 | F-03 | Thẻ tiêu chí S-04 (mockup), link Guide từ C4, nút cuối theo trạng thái | Đúng tham số mockup; khoá → chỉ Preview tới khi mở bằng lý do | T: src/features/criteria/__tests__/screenModels.test.ts | ✅ |
| TC-031 | F-03 S-05 | Trang công bố của Rental mẫu; First-come; phí; Cx; "Copy as text"; Export / Share | Đúng câu mockup; có câu 72 h / 48 h, câu không hỏi SSN, câu Fair housing; không score; Văn bản thuần; tên file an toàn; báo copy thành công / lỗi | T: src/pdf/__tests__/publishedCriteria.test.ts | ✅ |
| TC-032 | F-02 S-03 | Kiểm form: thiếu địa chỉ, rent ≤ 0, ZIP ≠ 5 số, bedrooms 0–8, bathrooms nửa; Bang WA | Lỗi đúng chữ product.md; lỗi đầu theo thứ tự màn khi Save; Gợi ý cam "Seattle requires first-come order.", không tự đổi mode | T: src/features/units/__tests__/rentalForm.test.ts · src/engine/__tests__/criteria.test.ts | ✅ |
| TC-033 | F-02 | Tạo Rental hợp lệ / không hợp lệ; Đóng / mở lại / xoá Rental | Lưu kèm bộ tiêu chí mẫu; sai → không ghi gì; closedAt ghi; xoá cả Applicant + file | T: src/features/units/__tests__/rentalService.test.ts | ✅ |
| TC-034 | F-02 | Đổi Review mode trước / sau khi có Applicant; về Compare khi đồng hồ đang chạy | Trước: tự do; sau: hộp xác nhận + lịch sử; dừng đồng hồ First-come | T: src/features/units/__tests__/rentalService.test.ts | ✅ |
| TC-035 | F-02 §6 | Lần đầu chọn First-come | Hỏi quyền thông báo một lần | T: src/features/units/__tests__/rentalService.test.ts | ✅ |
| TC-036 | F-02 S-02/S-06 | Thẻ Rental + Hub: chip Open / Offer out / Leased, đếm "1 ready to decide", thẻ Move-in, số FCRA chờ | Đúng chữ mockup, theo thứ tự nhận, không xếp hạng | T: src/features/units/__tests__/rentalQueries.test.ts | ✅ |
| TC-037 | F-02 S-02 | Rỗng, vuốt Close / Reopen + Delete, menu ⋯ | Đúng trạng thái rỗng; Delete cuối và đỏ | T: src/features/units/__tests__/screenModels.test.ts | ✅ |
| TC-038 | F-04 S-08 | Phần 1: thiếu tên; không phone lẫn email; sai định dạng; Phần 2: số người 0 / 13; pets; move-in trong quá khứ; voucher | "Enter a full name", "Add a phone number or an email"; Chặn ngoài 1–12; "Move-in date can't be in the past" | T: src/features/intake/__tests__/validate.test.ts | ✅ |
| TC-039 | F-04 S-08 | Phần 3: To trước From; tổng < 3 năm; Phần 4 + 6: other income thiếu số; thiếu tick / chữ ký / tên in | "'To' must be after 'From'"; nhắc mềm, không chặn; Chặn; "Sign to continue"; chủ nhà được bỏ chữ ký | T: src/features/intake/__tests__/validate.test.ts | ✅ |
| TC-040 | F-04 | Chữ ký: chạm 1 lần, nét quá ngắn, gõ tên thay chữ ký (trợ năng) | Chấm; từ chối nét quá ngắn; tên ≥ 2 chữ được nhận; SVG đã escape | T: src/features/intake/__tests__/signature.test.ts · src/ui/__tests__/signaturePath.test.ts | ✅ |
| TC-041 | F-04 §7 | Không có ô SSN / ngày sinh / giới tính / quốc tịch (form, DB, PDF, chữ) | Không trường, không cột; chỉ câu nhắc "không ghi SSN" | T: src/features/intake/__tests__/validate.test.ts · src/db/__tests__/repos.test.ts · src/i18n/__tests__/copyAudit.test.ts (mới) | ✅ |
| TC-042 | F-04 | Nháp tự lưu; nháp chưa hiện ở danh sách; huỷ nháp giữa chừng | Lưu đủ 7 phần; chỉ hiện khi Save; Discard xoá nháp, không bao giờ xoá Applicant đã lưu | T: src/features/intake/__tests__/service.test.ts · controller.test.ts | ✅ |
| TC-043 | F-04 | "Received on" giờ tương lai; sửa sau khi lưu | Từ chối; chỉ sửa được khi tạo, giữ giờ tường + offset | T: src/features/intake/__tests__/service.test.ts · screenModels.test.ts | ✅ |
| TC-044 | F-04 | Đính ảnh đơn giấy | source = paper, ảnh ở "Other files", tách khỏi giấy bắt buộc | T: src/features/intake/__tests__/service.test.ts · documents.test.ts | ✅ |
| TC-045 | F-04 | Engine đọc đơn nhập tay | C1 Claimed theo số trên form | T: src/features/intake/__tests__/service.test.ts · src/db/__tests__/repos.test.ts | ✅ |
| TC-046 | F-05 | Máy trạng thái Applicant mode: Start → form → ký → review → done; sự kiện sai thứ tự; Thoát Applicant mode | Đúng thứ tự; bỏ qua sự kiện sai; Bắt xác thực; có nháp → hỏi, nháp được giữ; về S-06 | T: src/features/intake/__tests__/applicantMode.test.ts | ✅ |
| TC-047 | F-05 | Khách không thấy hồ sơ khác | Chỉ truy cập được Applicant của phiên | T: src/features/intake/__tests__/applicantMode.test.ts | ✅ |
| TC-048 | F-05 | Khởi động lại app khi đang Applicant mode (kill) | Phiên được khôi phục ở trạng thái khoá, không có đường ra nếu không mở khoá | T: src/features/intake/__tests__/applicantMode.test.ts | ✅ |
| TC-049 | F-05 | Máy không có khoá màn hình | Không vào được nếu chưa đặt PIN 4–6 số của app | T: src/features/intake/__tests__/applicantMode.test.ts · src/features/settings/__tests__/actions.test.ts | ✅ |
| TC-050 | F-05 S-08b | Chạm 3 lần nhanh ở màn cảm ơn | Gọi mở khoá; chữ "Thank you, {first name}." + giờ nhận | T: src/features/intake/__tests__/applicantMode.test.ts · screenModels.test.ts | ✅ |
| TC-051 | F-05 | Khách bấm Submit | receivedAt = lúc Submit; chữ ký lưu thành file | T: src/features/intake/__tests__/service.test.ts | ✅ |
| TC-052 | F-06 | PDF đơn trống | Có Rental, 7 phần, mọi câu S-08, câu tự thêm, giấy tờ; không hỏi SSN / ngày sinh; chân trang disclaimer | T: src/pdf/__tests__/blankApplication.test.ts | ✅ |
| TC-053 | F-07 S-10 | Ô giấy từ C6; thêm → Provided → Checked | C6 đi Missing → Met Claimed → Met Verified | T: src/features/intake/__tests__/documents.test.ts | ✅ |
| TC-054 | F-07 S-10 | Income check: $2,123.08 2 tuần/lần vs $5,200; Jordan $2,470 vs $5,400 | "−12 %" Mismatch; Jordan không Mismatch | T: src/features/intake/__tests__/documents.test.ts | ✅ |
| TC-055 | F-07 | Quyền camera bị từ chối; lỗi native; lưu file lỗi | Vẫn có Photos / Files; trả lỗi, không crash; không để dòng rác | T: src/features/intake/__tests__/documents.test.ts | ✅ |
| TC-056 | F-08 S-11 | Marcus: red flags | Ngày lệch + tiền thuê +29 %; C4 dùng residence hiện tại | T: src/features/verify/__tests__/service.test.ts | ✅ |
| TC-057 | F-08 S-11 | Priya: 2 cuộc gọi không ai nghe + 1 email → "Mark as unreachable" | Chỉ hiện khi ≥ 3 lần, ≥ 2 cách; C4 Missing "Unreachable…" | T: src/features/verify/__tests__/service.test.ts · src/engine/__tests__/history.test.ts | ✅ |
| TC-058 | F-08 | Email xác minh + link county records | mailto có 9 câu, không lộ tiền / ngày khách khai; chỉ mở https / mailto | T: src/features/verify/__tests__/pure.test.ts | ✅ |
| TC-059 | F-08 S-11/S-12 | Lưu phiếu → engine đọc; phiếu nơi làm mỗi nguồn thu nhập | C4 Met Verified kèm ngày gọi; ghi ngày gọi | T: src/features/verify/__tests__/service.test.ts · viewModels.test.ts | ✅ |
| TC-060 | F-09 S-13 | Nhập report cho Marcus; xoá report | C3 Verified, C5 Met; xoá → quay về số khai | T: src/features/verify/__tests__/service.test.ts | ✅ |
| TC-061 | F-09 S-13 | C9 bật: thiếu model / range / ngày / > 4 key factors; C9 tắt; Thông tin công ty báo cáo; báo cáo > 30 ngày; đính / gỡ file | Bắt nhập đủ; tắt thì bỏ qua; Các ô thư FCRA cần; nhắc báo cũ; file qua src/files | T: src/features/verify/__tests__/pure.test.ts · service.test.ts | ✅ |
| TC-062 | F-10 S-14 | Mở S-14 trước Conditional offer; C10 tắt; Có án → Withdraw | Khoá "Unlocks after…"; tắt hẳn khi C10 off; Không bao giờ tự loại; Withdraw cần án trong lookback + 4 câu đánh giá | T: src/features/verify/__tests__/pure.test.ts · viewModels.test.ts · service.test.ts · src/engine/__tests__/household.test.ts | ✅ |
| TC-063 | F-13 S-15 | Lựa chọn theo trạng thái | Conditional offer chỉ khi C10 bật; Withdraw chỉ sau offer; Approved → không còn lựa chọn | T: src/features/decision/__tests__/decision.test.ts | ✅ |
| TC-064 | F-13 §3.15 | Deny / Approve with conditions / Withdraw với lý do từ report | Bắt thư "Adverse action notice (FCRA)" | T: src/engine/__tests__/decision.test.ts | ✅ |
| TC-065 | F-13 §3.15 | Priya Deny vì C5; Marcus Deny chỉ vì C4 (tự gọi) | Priya → FCRA; Marcus → Denial letter thường | T: src/features/decision/__tests__/decision.test.ts · src/engine/__tests__/sample.test.ts | ✅ |
| TC-066 | F-13 §3.15 | Approve / Conditional offer; tick "Information from a screening report played a part" | Không cần FCRA; tick → bắt FCRA (tick sẵn khi có report) | T: src/engine/__tests__/decision.test.ts · src/features/decision/__tests__/viewModel.test.ts | ✅ |
| TC-067 | F-13 | Deny không lý do; lý do chứa từ cấm; Deny khi còn Missing | Chặn; chặn kèm câu Fair housing; cảnh báo "give the applicant 72 hours first" | T: src/engine/__tests__/decision.test.ts · src/features/decision/__tests__/decision.test.ts | ✅ |
| TC-068 | F-13 | Approve with conditions: cọc cao / tiền thuê cao không số; co-signer | Bắt số; co-signer không cần số; Approve không kèm lý do | T: src/features/decision/__tests__/viewModel.test.ts · src/engine/__tests__/decision.test.ts | ✅ |
| TC-069 | F-13 | Lưu quyết định cần FCRA | Dấu giờ local; "Notice pending" thay nút quyết định tới khi tạo thư → created → sent | T: src/features/decision/__tests__/decision.test.ts · viewModel.test.ts · src/db/__tests__/repos.test.ts | ✅ |
| TC-070 | F-13 (Phương chốt) | Withdraw offer | Trạng thái đọc là **Denied** + ghi chú lý do; xử lý như từ chối (FCRA nếu dựa report) | T: src/features/decision/__tests__/viewModel.test.ts · decision.test.ts | ✅ |
| TC-071 | F-13 (Phương chốt) | Không có nút "Applicant accepted"; First-come: Conditional offer rồi Approve | Approve dừng đồng hồ 48 h; không còn offer chờ | T: src/features/decision/__tests__/decision.test.ts | ✅ |
| TC-072 | F-13 S-09 | "Withdrawn by applicant" ở Compare / First-come | Trạng thái Withdrawn; First-come chuyển lượt cho người kế | T: src/features/decision/__tests__/decision.test.ts | ✅ |
| TC-073 | F-14 S-16 | Thư FCRA của Priya | Tên / địa chỉ / ĐT công ty (chỗ trống §8), "did not make this decision", quyền bản miễn phí 60 ngày, quyền khiếu nại, chân trang | T: src/pdf/__tests__/letters.test.ts · src/features/decision/__tests__/letters.test.ts | ✅ |
| TC-074 | F-14 | Thiếu tên / địa chỉ / ĐT công ty báo cáo | Không xuất được thư, nút dẫn về S-13 | T: src/features/decision/__tests__/letters.test.ts · src/engine/__tests__/decision.test.ts | ✅ |
| TC-075 | F-14 | Lý do dùng C9 | Thư có khối điểm (score, range, date, model, ≤ 4 key factors) | T: src/pdf/__tests__/letters.test.ts · src/engine/__tests__/decision.test.ts | ✅ |
| TC-076 | F-14 | Thư Conditional offer ở First-come | Có hạn trả lời 48 h theo giờ local; không khối FCRA | T: src/features/decision/__tests__/letters.test.ts · src/pdf/__tests__/letters.test.ts | ✅ |
| TC-077 | F-14 | Sửa câu mở / kết; giá trị người dùng có ký tự HTML | Khối FCRA khoá; mọi giá trị được escape | T: src/features/decision/__tests__/viewModel.test.ts · src/pdf/__tests__/letters.test.ts | ✅ |
| TC-078 | F-14 | Export thư | In PDF + share, bản lưu kèm Applicant, pending → created → sent; "Mark as sent" có ngày + cách | T: src/features/decision/__tests__/letters.test.ts | ✅ |
| TC-079 | F-12 §3.14 | Đồng hồ 72 h qua nửa đêm; 48 h qua đổi giờ mùa hè (xuân / thu); Thứ tự hàng đợi (offset múi giờ khác nhau) | Cùng giờ tường sau 3 ngày; 48 giờ thật (giờ tường ±1 h); Theo receivedAt; người đầu chưa xong = In review, còn lại chờ | T: src/engine/__tests__/firstCome.test.ts | ✅ |
| TC-080 | F-12 §3.14 | Người sau muốn Approve / Offer khi người trước In review / Offered | Nút khoá + "First-come mode: decide on #n first" | T: src/engine/__tests__/firstCome.test.ts · src/features/decision/__tests__/viewModel.test.ts | ✅ |
| TC-081 | F-12 §3.14 | 72 h hết còn Missing; 48 h hết | "Move to next (incomplete)"; "Offer expired — move to next" | T: src/engine/__tests__/firstCome.test.ts · src/features/decision/__tests__/decision.test.ts | ✅ |
| TC-082 | F-12 §3.14 | Deny / incomplete / expired | Người kế thành In review; đồng hồ mở được đóng | T: src/engine/__tests__/firstCome.test.ts | ✅ |
| TC-083 | F-12 §6 | Thông báo còn 2 h + hết giờ; mốc đã qua; lỗi lên lịch | Lên lịch 2 cái, chạm mở S-18; bỏ mốc đã qua; lỗi không chặn | T: src/engine/__tests__/firstCome.test.ts · src/notifications/__tests__/queueTimers.test.ts | ✅ |
| TC-084 | F-12 §6 | Quyền thông báo bị từ chối | Chỉ hỏi 1 lần; đồng hồ vẫn chạy | T: src/features/decision/__tests__/decision.test.ts | ✅ |
| TC-085 | F-12 S-17 | Compare: thứ tự cột, hàng Issues, < 2 người, chạm ô (G-01) | Theo thứ tự nhận; Issues cuối; rỗng "Add at least two…"; chạm ô → sheet chứng cứ, ô Issues → S-09 | T: src/features/decision/__tests__/viewModel.test.ts | ✅ |
| TC-086 | F-12 S-18 | Dòng hàng đợi + sheet "Request missing info" | Số thứ tự, nút đúng trạng thái; hết 72 h tính từ bây giờ | T: src/features/decision/__tests__/viewModel.test.ts | ✅ |
| TC-087 | F-15 S-19 · F-15/F-17 | Nội dung Decision file; Applicant đã xoá dữ liệu; ảnh thu nhỏ | Tiêu chí, lịch sử sửa, Applicant theo thứ tự nhận + chứng cứ, quyết định + lý do + dấu giờ, thư đã gửi; "Notice pending"; Dòng "Applicant n — data deleted …"; thumbnails chỉ khi bật (tắt sẵn) | T: src/features/decision/__tests__/decisionFile.test.ts | ✅ |
| TC-088 | F-15 (Phương chốt) | "N of M Met" | Chỉ ở S-19 / PDF Decision file; không màn nào khác dùng | T: src/features/decision/__tests__/viewModel.test.ts · src/__tests__/appConfig.test.ts (mới) | ✅ |
| TC-089 | F-16 S-20 | Phòng tự tạo; sửa hạng mục / ghi chú / ảnh / đồng hồ / chìa / phòng; Ký rồi sửa; xuất khi thiếu 1 chữ ký | Theo bd / ba + Kitchen, Living room, Entry; tự lưu; file bỏ được xoá; Sửa sau khi ký xoá cả 2 chữ ký; "Both signatures needed" | T: src/features/movein/__tests__/movein.test.ts · model.view.test.ts | ✅ |
| TC-090 | F-16 S-20 | Đơn vị đồng hồ | Electric kWh · Gas ccf · Water gallons; Gas chỉ hiện khi có số / được thêm | T: src/features/movein/__tests__/movein.test.ts · model.view.test.ts | ✅ |
| TC-091 | F-16 | PDF Move-in | Đủ trường, escape, disclaimer, 2 chữ ký; không ảnh ngoài data URI; tên file theo địa chỉ, không theo người | T: src/features/movein/__tests__/movein.test.ts | ✅ |
| TC-092 | F-17 S-24 | Danh sách dọn dữ liệu | Rental đã đóng có người không được chọn, chữ mockup; Rental mẫu không bao giờ tính | T: src/features/settings/__tests__/dataCleanup.test.ts · src/features/units/__tests__/rentalQueries.test.ts | ✅ |
| TC-093 | F-17 | Xoá dữ liệu 1 / nhiều Applicant (Disposal) | Xoá mọi dòng + file + PDF; giữ dòng ẩn danh; người khác không đổi; huỷ đồng hồ, chuyển lượt First-come | T: src/db/__tests__/repos.test.ts · src/features/decision/__tests__/decision.test.ts | ✅ |
| TC-094 | F-17 §6 | Nhắc dọn N ngày sau đóng; Off | Lên lịch đúng ngày, chạm → S-24; Off → không lịch | T: src/notifications/__tests__/reminders.test.ts | ✅ |
| TC-095 | F-18 | Mã hoá / giải mã với mật khẩu; Mật khẩu backup < 8 ký tự / nhập 2 lần khác nhau | Khôi phục đúng; nonce mới mỗi lần; Chặn | T: src/backup/__tests__/format.test.ts | ✅ |
| TC-096 | F-18 | Sai mật khẩu; file không phải backup; bản mới hơn; file hỏng | Báo đúng từng lỗi; dữ liệu trên máy không đổi | T: src/backup/__tests__/format.test.ts · service.test.ts | ✅ |
| TC-097 | F-18 | Sao lưu → khôi phục sang "máy khác" | Đủ dòng + file, kết quả §8 giữ nguyên; cài đặt riêng máy được giữ | T: src/backup/__tests__/service.test.ts | ✅ |
| TC-098 | F-18 | File bị sửa byte / đường dẫn thoát thư mục app; ghi file lỗi giữa chừng | Từ chối; dữ liệu cũ giữ nguyên | T: src/backup/__tests__/service.test.ts | ✅ |
| TC-099 | F-18 | Tự sao lưu hằng tuần | Đến hạn sau 7 ngày khi có thư mục; giữ 3 file mới nhất của app; tắt / thiếu mật khẩu / mất thư mục → không văng, lỗi hiện ở S-22 | T: src/backup/__tests__/auto.test.ts | ✅ |
| TC-100 | F-18 §6 | Nhắc sao lưu > 30 ngày; "Later"; chưa từng sao lưu | Thẻ hiện sau 30 ngày, ẩn 7 ngày; thông báo 31 ngày lúc 10:00, chạm → S-22; chưa có dữ liệu → không nhắc | T: src/backup/__tests__/auto.test.ts · src/notifications/__tests__/reminders.test.ts | ✅ |
| TC-101 | F-18 | Huỷ giữa chừng: bật Weekly rồi huỷ chọn thư mục; không có share sheet | Giữ Off; không ghi nhận đã sao lưu | T: src/backup/__tests__/auto.test.ts | ✅ |
| TC-102 | F-18 §6 | Sau khôi phục | Huỷ thông báo cũ, lên lịch lại đồng hồ + nhắc; không quyền → chỉ huỷ | T: src/notifications/__tests__/afterRestore.test.ts | ✅ |
| TC-103 | F-19 S-23 | App lock: Lock after Immediately / 1 / 5 phút; PIN app 4–6 số nhập 2 lần; sai 5 lần | Khoá khi quay lại sau đủ thời gian, không trước; giữ mốc nền đầu tiên; Lưu hash có salt, không lưu PIN; chờ tăng gấp đôi tới 15 phút | T: src/features/settings/__tests__/lock.test.ts | ✅ |
| TC-104 | F-19 S-23 | withLockSuspended (share sheet, picker, hộp sinh trắc) | Không khoá khi sheet hệ thống của app mở; tiếp tục khi sheet ném lỗi | T: src/features/settings/__tests__/lock.test.ts · src/features/verify/__tests__/pure.test.ts | ✅ |
| TC-105 | F-19 S-23 | Bật App lock trên máy không khoá màn hình; tắt App lock | Bắt đặt PIN trước; tắt thì quên PIN | T: src/features/settings/__tests__/actions.test.ts · view.test.ts | ✅ |
| TC-106 | F-19 S-27 | Delete all: gõ sai / đúng "DELETE" | Sai → không xoá; đúng → xoá dòng, cài đặt, file, thông báo → về S-01 | T: src/features/settings/__tests__/dataCleanup.test.ts · src/db/__tests__/repos.test.ts | ✅ |
| TC-107 | F-19 S-21 | Tên / địa chỉ / ĐT chủ nhà; Bật nhắc (reminder) | Nhận trống, ĐT Mỹ; từ chối ĐT sai, chữ quá dài; Hỏi quyền một lần, lên lịch lại | T: src/features/settings/__tests__/summary.test.ts · actions.test.ts · src/features/settings/__tests__/actions.test.ts · src/notifications/__tests__/reminders.test.ts | ✅ |
| TC-108 | F-19 S-21 | Các dòng Settings theo thứ tự mockup | Đúng thứ tự + giá trị; dòng backup "Today / n days ago / Never" | T: src/features/settings/__tests__/view.test.ts · summary.test.ts | ✅ |
| TC-109 | F-19 About | Phiên bản + số build; Licenses | "Version 1.0.0 (build)"; mọi thư viện runtime có license, Inter dưới OFL | T: src/features/settings/__tests__/about.test.ts | ✅ |
| TC-110 | F-19 S-25 | Guide: 11 bài, ≤ 400 từ, có Sources, tìm theo tiêu đề, slug lạ | Đủ 11 bài đúng thứ tự; không hứa "compliant"; slug lạ → null | T: src/features/guide/__tests__/articles.test.ts | ✅ |
| TC-111 | F-19 S-25 | Link ngữ cảnh từ các màn (G-02) | Mỗi màn trỏ đúng bài | T: src/features/guide/__tests__/contextLinks.test.ts | ✅ |
| TC-112 | F-01 S-01 | Next / Skip / tick; nạp mẫu 2 lần; gỡ mẫu | Skip tới trang 3 nhưng không qua được tick; mẫu nạp 1 lần; gỡ một chạm | T: src/features/onboarding/__tests__/onboarding.test.ts · src/features/units/__tests__/rentalService.test.ts | ✅ |
| TC-113 | F-01 §8 | Nạp mẫu vào DB rồi đọc lại | Cờ is_sample; kết quả engine giống fixture §8 | T: src/db/__tests__/repos.test.ts | ✅ |
| TC-114 | Mặc định | Mặc định đúng APP.md / product.md | Theme System, App lock tắt, Auto backup Off, nhắc dọn 60 ngày, nhắc bật; Rental mới Compare + phí $0; C8 Case by case | T: src/features/settings/__tests__/defaults.test.ts (mới) | ✅ |
| TC-115 | §7 | DB mới: mọi bảng; tiền là INTEGER; cent không trôi | Đủ bảng; không cột nhạy cảm; cent chính xác | T: src/db/__tests__/repos.test.ts · src/ui/__tests__/moneyInput.test.ts · src/features/verify/__tests__/pure.test.ts | ✅ |
| TC-116 | §7 cài đè | Chạy lại migration trên DB đã có dữ liệu | Không lỗi, dữ liệu còn nguyên | T: src/features/settings/__tests__/defaults.test.ts (mới) | ✅ |
| TC-117 | §10 | app.json: allowBackup false, không quyền bộ nhớ / media / danh bạ / vị trí / billing; bản release bỏ INTERNET, AD_ID | Đúng | T: src/__tests__/appConfig.test.ts (mới) | ✅ |
| TC-118 | Offline · APP.md | Không gọi mạng trong code; không SDK quảng cáo / analytics / crash / tài khoản; Không log dữ liệu Applicant | Không có; Không có console.* trong code app | T: src/__tests__/appConfig.test.ts (mới) | ✅ |
| TC-119 | Chữ | Rà toàn bộ chữ en: không "compliant / guarantee / free forever", không rank / winner, SSN chỉ là câu "không hỏi", không chuỗi rỗng / TODO | Sạch | T: src/i18n/__tests__/copyAudit.test.ts (mới) | ✅ |
| TC-120 | i18n | Mọi khoá dùng khi chạy có trong file chữ | Không thiếu khoá | T: src/i18n/__tests__/i18n.test.ts · src/features/intake/__tests__/screenModels.test.ts | ✅ |
| TC-121 | Sáng / tối | Token màu 2 theme; tương phản | Đủ token; chữ ≥ 4.5, thành phần ≥ 3 | T: src/theme/__tests__/tokens.test.ts | ✅ |
| TC-122 | PDF (5 loại) | Published criteria, Blank application, Letter, Decision file, Move-in qua cùng khung | US Letter, header / footer + đầu bảng lặp mỗi trang, logo + kiểu in đen-trắng, escape | T: src/pdf/__tests__/shell.test.ts | ✅ |
| TC-123 | §7 file | Tên file theo loại + id, không theo người; đường dẫn ngoài thư mục app | Không có tên người; từ chối | T: src/files/__tests__/files.test.ts · native.test.ts | ✅ |
| TC-124 | §4 | Mọi màn §5 có route; route file chỉ là vỏ | Đủ màn, không route chết | T: src/navigation/__tests__/screens.test.ts · src/__tests__/routes.test.ts | ✅ |

## B. Thử trên máy (M) — Galaxy A13 `R58TC12SRZW`

### Dữ liệu thử chuẩn bị trước
- **Rental mẫu §8** ("Explore with a sample rental"): 1428 Maple St, Unit B, Columbus OH · Compare · Jordan / Priya / Marcus / Dana.
- **R2 (tự tạo, First-come):** 22 Lake Rd, Unit 3, Seattle, WA 98101 · $2,000/mo · 1 bd / 1 ba · cọc $2,000 · phí $0 · bật C9 (600) và C10 (7 năm) · thêm Cx "Has renter's insurance" (Applicant answers).
- **H1 Alex Rivera** (chủ nhà nhập tay vào R2): 1 người · 555-0142 · không pet · thu nhập $6,500/mo · thuê 2023-01 → nay, $1,800, landlord Sam Lee 206-555-0177 · bị đuổi: No.
- **H2 Bea Novak** (Applicant mode, R2): 2 người · 1 cat · voucher Yes, bỏ trống số tiền · thu nhập $3,000 · ở với gia đình 2021-06 → nay · ký tay.
- **H3 Chris Park** (đơn giấy → nhập + đính ảnh, R2): 4 người (> 1 bd × 2 → C7 Not met) · nhà riêng 2019 → nay.
- **Mật khẩu backup thử:** `qa-backup-pass-1` (chỉ dùng cho máy thử). **PIN app** (khi cần): `1357`.
- Ảnh giấy tờ: chụp tờ giấy bất kỳ bằng camera; 1 file PDF bất kỳ trong Downloads.
- Lệnh adb hay dùng: chữ `adb shell settings put system font_scale 1.3` / `2.0` / `1.0` · 320 dp `adb shell wm density 540` (trả `adb shell wm density reset`) · tối `adb shell cmd uimode night yes|no` · chạy job sao lưu `adb shell cmd jobscheduler run -f com.maglobal.evenlease <id>` · thanh hệ thống `adb shell dumpsys window | findstr apr`.
- Đồng hồ 72 h / 48 h: tắt "Ngày giờ tự động" rồi chỉnh giờ máy tới trước mốc (còn < 2 h) và qua mốc; trả lại giờ tự động sau nhóm B4.

| Mã | Tính năng | Trường hợp | Kết quả mong đợi | Cách | Kết quả |
|---|---|---|---|---|---|
| **B1** | | **Cài mới, khởi động, onboarding** (bật chế độ máy bay suốt lượt thử, trừ khi ghi khác) | | | |
| TC-125 | Cài mới | Gỡ bản cũ, cài APK release (armeabi-v7a) bản đóng băng | Cài được; launcher hiện icon Evenlease indigo; icon đơn sắc (themed icon) đúng | M | ✅ |
| TC-126 | Splash | Mở lần đầu, nền sáng rồi nền tối | Splash nền #f6f7fb / #0f1117, logo giữa; xem có dòng "Same criteria for every applicant." theo mockup không (ghi lại) | M | ✅ |
| TC-127 | §7 migration | Lần mở đầu tiên | DB tạo xong < 2 s, không màn trắng / crash | M | ❌ B-40 |
| TC-128 | F-01 S-01 | Đi 3 trang bằng Next; Skip ở trang 1 | Đúng chữ + minh hoạ mockup; Skip nhảy trang 3 | M | ✅ |
| TC-129 | F-01 S-01 | Trang 3: chưa tick → "Get started"; tick; back hệ thống | Nút khoá tới khi tick; back về trang trước, không thoát onboarding sai | M | ✅ |
| TC-130 | F-01 | "Explore with a sample rental" | Vào S-02 có Rental mẫu, không hỏi gì thêm | M | ✅ |
| **B2** | | **Luồng mẫu đầy đủ (Compare)** | | | |
| TC-131 | F-02 S-02 | Thẻ Rental mẫu | "1428 Maple St…", "$1,650/mo · 2 bd", chip Compare, "4 applicants · 2 ready to decide", chip Open | M | ✅ |
| TC-132 | F-02 S-06 | Mở Hub | Header + "Available Jan 1", nút Compare (4), danh sách theo thứ tự nhận, "Ready to decide" / "2 items missing"; menu ⋯ đủ 6 mục | M | ✅ |
| TC-133 | F-11 S-09 | Jordan | Summary "Ready to decide" + "Not a score…"; 9 dòng tiêu chí đúng §8 + huy hiệu có icon + chữ; không có "N of M Met" | M | ✅ |
| TC-134 | F-11 S-09 | Chạm dòng C1 của Jordan | Sheet chứng cứ: nguồn Document, ngày, "by you", file; nút đi tới nơi bổ sung | M | ✅ |
| TC-135 | F-11 S-09 | Priya: thẻ Issues | Chỉ 2 mục Missing (C4, C6) có nút "Call landlord" / "Add pay stubs"; C1 / C5 Not met không nằm trong Issues | M | ✅ |
| TC-136 | F-07 S-10 | Priya → Documents: thêm Proof of income bằng Camera, rồi Photos, rồi Files PDF | 3 nguồn đều được; ảnh nén, thumbnail hiện; xem toàn màn zoom được | M | ❌ B-43 |
| TC-137 | F-07 S-10 | Income check: nhập $2,123.08 Every 2 weeks (stated $4,700) → Mark as checked | Hiện "≈ … vs $4,700 stated (…%)", huy hiệu đúng; C1 ở S-09 đổi theo | M | ✅ |
| TC-138 | F-08 S-11 | Marcus → Landlord reference | Red flags cam (ngày, tiền thuê +29 %); bước 1 "Search county records" mở trình duyệt (tắt máy bay cho case này) | M | ✅ |
| TC-139 | F-08 S-11 | Priya: Log attempt Email no answer → "Mark as unreachable" xuất hiện → bấm | Nút chỉ hiện sau lần 3 (2 cách); C4 "Unreachable after 3 attempts" | M | ✅ |
| TC-140 | F-08 S-11 | "Email a verification request" | Mở app mail với tiêu đề + 9 câu; app không tự gửi | M | ⏭ máy ảo không có tài khoản mail → A13 |
| TC-141 | F-08 S-12 | Employer reference của Jordan | Chữ hướng dẫn + ghi chú cố định; Attempts log như S-11 | M | ✅ |
| TC-142 | F-09 S-13 | Marcus: "Open MySmartMove" / "Open Checkr"; nhập report None + đính PDF | Mở trình duyệt; lưu được; C3 Verified, C5 Met | M | ✅ |
| TC-143 | F-12 S-17 | Compare 4 cột | Cột đầu ghim, cuộn ngang mượt; "Not a ranking…"; hàng Issues; chạm ô → sheet chứng cứ (G-01); lọc Hide denied / withdrawn | M | ✅ |
| TC-144 | F-13 S-15 | Priya → Make a decision → Deny, lý do C5 | Tick report sẵn; "Save decision" → hộp "An adverse action notice is required" [Create notice], không bỏ qua được | M | ❌ B-48 |
| TC-145 | F-13 S-15 | Gõ lý do "too many kids" | Bị chặn + câu Fair housing | M | ✅ |
| TC-146 | F-14 S-16 | Thư FCRA của Priya → Preview PDF → Share → Mark as sent (Email) | PDF trang Letter đen-trắng + logo, khối FCRA khoá, chỗ trống "[Mailing address from the report]"; share sheet mở; S-06 hết "Notice pending" | M | ✅ |
| TC-147 | F-14 | Marcus → Deny chỉ vì C4 | Ra "Denial letter" thường, không FCRA | M | ✅ |
| TC-148 | F-10 S-14 | Jordan → Conditional offer → Background: có 1 án (Property, 2022) | Banner luật; 4 câu đánh giá bắt buộc; "How long ago" tự tính; không có nút tự loại | M | ✅ |
| TC-149 | F-13 | Jordan → "Continue with the offer" → Approve | Trạng thái Approved; Hub có thẻ "Move-in checklist"; không có nút "Applicant accepted" | M | ✅ |
| TC-150 | F-13 | Dana → Conditional offer → Withdraw offer (sau 4 câu) | Trạng thái hiện **Denied** + lý do; nếu tick report → bắt thư FCRA | M | ✅ |
| TC-151 | F-16 S-20 | Move-in của Jordan: sửa phòng, chụp ảnh hạng mục, đồng hồ (kWh / ccf / gal), chìa, báo khói | Lưu dở → thoát → quay lại còn nguyên; đơn vị đúng | M | ❌ B-51 |
| TC-152 | F-16 S-20 | Ký Landlord + Tenant trong ScrollView → Export PDF | Ký không làm cuộn màn; thiếu 1 chữ ký → "Both signatures needed"; PDF đủ trang | M | ✅ |
| TC-153 | F-15 S-19 | Decision file → Export / Share; bật "Include document thumbnails" | PDF có "N of M Met", lịch sử, thứ tự nhận, thư đã gửi; bảng ngắt trang đẹp; thumbnails chỉ khi bật | M | ✅ |
| TC-154 | F-03 S-05 | Rental mẫu → Published criteria → Export PDF / Copy as text | PDF đúng câu mockup; dán ra Notes đúng văn bản | M | ✅ |
| **B3** | | **Rental tự tạo R2 (First-come) + 3 cách nhận đơn** | | | |
| TC-155 | F-02 S-03 | "+" → nhập R2, ZIP 4 số, rent trống → Save | Lỗi đúng chữ, cuộn tới ô lỗi đầu + rung; bang WA → gợi ý cam "Seattle requires first-come order." | M | ✅ |
| TC-156 | F-02 §6 | Chọn First-come lần đầu | Hộp xin quyền thông báo của Android hiện 1 lần → **Từ chối** (thử đường bị từ chối) | M | ✅ |
| TC-157 | F-03 S-04 | Bật C9, C10; tắt voucher C1; C7 = 1; Cx "Has kids?" rồi "Has renter's insurance" | Cảnh báo voucher [Keep on]; cảnh báo C7; Cx chứa từ cấm bị chặn; Cx thứ 2 thêm được | M | ✅ |
| TC-158 | F-06 S-07 | Add applicant → "Print a blank application" | PDF đơn trống có câu Cx + giấy tờ; share sheet | M | ✅ |
| TC-159 | F-04 S-08 | H1 Alex nhập tay đủ 7 phần; Received on để mặc định | Thanh tiến độ 7 phần, "Draft saved"; bàn phím đẩy footer; First-come cảnh báo "Use the time you actually received it" | M | ❌ B-53 |
| TC-160 | F-04 | Bắt đầu đơn rồi back ra giữa chừng (huỷ) | Hỏi "Discard changes?" / nháp được giữ; Discard xoá nháp | M | ❌ B-47 |
| TC-161 | F-03 §3.13 | Sau khi có H1 → S-04 | Banner khoá; "Edit criteria" bắt lý do; sửa xong lịch sử ghi | M | ✅ |
| TC-162 | F-05 S-08a | H2 Bea: "Hand the phone to the applicant" → Start → điền → ký → Submit | Toàn màn, ẩn tab; chữ "Do not enter your Social Security number."; S-08b "Thank you, Bea." + giờ nhận | M | ❌ B-53 |
| TC-163 | F-05 | Trong Applicant mode: back hệ thống, vuốt back, nút Home rồi mở lại | Back bị nuốt; mở lại vẫn ở form khách | M | ✅ |
| TC-164 | F-05 | Kill app (vuốt khỏi Recents) trong Applicant mode rồi mở lại | Vẫn Applicant mode, khoá; không thấy Rental / hồ sơ khác | M | ✅ |
| TC-165 | F-05 S-08b | Chạm 3 lần; rồi để yên 60 s | Hiện vân tay / mã máy; huỷ → ở lại; để yên 60 s → tự hỏi xác thực | M | ⏭ cần S-08b, chặn bởi B-53 |
| TC-166 | F-05 | "Landlord" → vân tay đúng → "Exit applicant mode?" | Về S-06; nháp khách được giữ nếu chưa Submit | M | ✅ |
| TC-167 | F-04 | H3 Chris: nhập + "Attach photos of the paper form" (Camera) | Ảnh ở "Other files"; source paper; C7 Not met + cảnh báo cam; C4 Needs review "No previous landlord…" | M | ❌ B-53 |
| TC-168 | F-12 S-18 | Order queue | Banner First-come; #1 Alex In review, #2/#3 chờ; Bea/Chris "Make a decision" khoá + "decide on #1 first" | M | ✅* dữ liệu chèn tay — thử lại sau B-53 |
| TC-169 | F-12 §6 | #1 → "Request missing info" (Text) → bật lại quyền thông báo trong Settings Android → chỉnh giờ máy tới còn 1 h 50 | Hàng hiện "Missing info — … h left"; thông báo "Alex Rivera — 2 hours left…" tới; chạm → mở S-18 | M | ❌ B-58 |
| TC-170 | F-12 | Chỉnh giờ qua 72 h | Thông báo hết giờ; nút "Move to next (incomplete)" → Bea In review | M | ❌ B-58 |
| TC-171 | F-12 | Bea → Conditional offer → chỉnh giờ qua 48 h | "Offer — … h left" rồi "Offer expired — move to next" → Chris In review | M | ✅* dữ liệu chèn tay — thử lại sau B-53 |
| TC-172 | F-05 §6 | Đang Applicant mode thì tới giờ thông báo | Không hiện / chạm không mở màn nào ngoài form khách | M | ✅* dữ liệu chèn tay — thử lại sau B-53 |
| **B4** | | **Nhánh phụ: quyền, huỷ, xoá** | | | |
| TC-173 | F-07 | Thu hồi quyền Camera (Settings Android) → S-10 "+ Add" → Camera | Thông báo "Open settings"; Photos / Files vẫn dùng được | M | ✅ |
| TC-174 | F-17 S-24 | Đóng R2 (vuốt Close) → chỉnh giờ qua 60 ngày → S-24 | Thẻ nhắc trên S-02 + thông báo "… closed rentals still hold applicant data" → chạm mở S-24; Rental mẫu không tính | M | ✅* dữ liệu chèn tay — thử lại sau B-53 |
| TC-175 | F-17 S-24 | "Delete their data" → [Cancel] rồi [Delete] | Hộp "Permanently delete data for n applicants?…"; xoá xong file biến mất (`adb shell run-as … ls files/applicants`); Decision file còn dòng "Applicant n — data deleted" | M | ✅* dữ liệu chèn tay — thử lại sau B-53 |
| TC-176 | F-02 S-02 | Vuốt Closed → Reopen / Delete Rental | Đúng hành động; Delete hỏi xác nhận, nút đỏ bên phải | M | ✅ |
| TC-177 | F-19 | Settings → "Remove sample rental" rồi "Load sample rental" | Gỡ một chạm, nạp lại đúng §8 | M | ✅ |
| **B5** | | **Hệ thống: khoá, sao lưu, Guide, About** | | | |
| TC-178 | F-19 S-23 | Bật App lock (vân tay), Lock after = 1 min; ra Home 30 s / 70 s | 30 s không khoá; 70 s khoá, vân tay mở; huỷ → vẫn khoá | M | ✅ |
| TC-179 | F-19 S-23 | Đang mở Share sheet / bộ chọn file lâu > Lock after | Không bị khoá khi quay về (withLockSuspended) | M | ✅ |
| TC-180 | F-18 S-22 | "Back up now" lần đầu: mật khẩu 2 lần khác nhau → đúng | Bắt nhập lại; cảnh báo "If you forget it…"; share sheet; "Last backup: … · x MB"; ghi thời gian deriveKey trên A13 | M | ❌ B-67 |
| TC-181 | F-18 S-22 | Automatic backup Weekly → chọn thư mục Drive (SAF) → chạy job | File mới trong thư mục; giữ tối đa 3 file | M | ✅ |
| TC-182 | F-18 S-22 | Restore: file ảnh JPG; sai mật khẩu; đúng mật khẩu → [Cancel] → [Replace] | Báo "not a backup" trước khi hỏi mật khẩu; sai mật khẩu → dữ liệu giữ nguyên; Replace → dữ liệu giống lúc sao lưu, đồng hồ lên lịch lại | M | ✅ |
| TC-183 | F-18 | Restore file bị cắt dở (copy nửa file) | Báo file hỏng, không đổi dữ liệu | M | ✅ |
| TC-184 | F-19 S-25 | Guide: tìm "fake"; mở bài; link từ S-13 / S-15 / S-24 | Kết quả đúng; bài có Sources + Not legal advice; link ngữ cảnh mở đúng bài | M | ❌ B-48 |
| TC-185 | F-19 About | Settings → About → Licenses; Legal & privacy | "Version 1.0.0 (n) · No account · No servers"; Licenses mở; S-26 có nguồn FTC / HUD / Seattle | M | ❌ B-73 |
| TC-186 | Offline | Toàn bộ B1–B5 làm khi bật máy bay | Không màn nào báo lỗi mạng / quay vòng chờ; chỉ link ngoài cần mạng | M | ✅ |
| **B6** | | **Giao diện & trợ năng** | | | |
| TC-187 | Sáng / tối | Appearance: System / Light / Dark; tối ở S-02, S-09, S-17, S-20, sheet S-15 | Màu đúng token v2; thanh trạng thái + điều hướng đổi màu (`dumpsys` apr=); không chữ đen trên nền tối | M | ✅ |
| TC-188 | 320 dp | `wm density 540` → S-02, S-08, S-09, S-15, S-17, S-20 | Không tràn chữ / cắt nút; vùng chạm ≥ 48 | M | ❌ B-74 |
| TC-189 | Chữ 130 % | font_scale 1.3 → S-17 | Compare thành thẻ dọc mỗi Applicant; chạm thẻ vẫn mở chứng cứ | M | ❌ B-69 |
| TC-190 | Chữ 200 % | font_scale 2.0 → S-01, S-03, S-08, S-09, S-16 | Đọc được, cuộn được, nút không chồng | M | ❌ B-74 |
| TC-191 | TalkBack | Bật TalkBack: S-09 dòng C1, S-18 dòng đồng hồ, huy hiệu S-17 | Đọc như bảng mockup ("Income, met, verified: 3.24 times rent"; "Missing info, 41 hours left"); Undo snackbar lâu hơn | M | ❌ B-70 |
| TC-192 | Tablet / xoay | `wm size 1200x1920` (rộng ≥ 600 dp) | Nội dung tối đa 600, căn giữa | M | ❌ B-48 |
| TC-193 | Hiệu năng | Rental có 15+ Applicant (nạp mẫu + thêm) → S-17 / S-06 | Cuộn mượt, mở màn < 1 s | M | ⏭ máy ảo không đại diện → đo A13 (B-71) |
| **B7** | | **Cài đè & xoá hết** | | | |
| TC-194 | Cài đè | `adb install -r` cùng APK (hoặc bản build mới hơn) khi đang có dữ liệu | Dữ liệu + cài đặt + backup còn nguyên; không chạy lại onboarding | M | ✅ |
| TC-195 | §10 | `adb backup` / Auto Backup: kiểm `allowBackup=false` trong manifest đã cài (`dumpsys package`) | Không cho sao lưu hệ thống | M | ✅ |
| TC-196 | F-19 S-27 | Delete all data: gõ "delete" (thường) rồi "DELETE" | Sai chữ → nút khoá; đúng → về S-01, thư mục files trống, không còn thông báo hẹn | M | ❌ B-40 |
| **B8** | | **iOS** | | | |
| TC-197 | iOS | Face ID thoát Applicant mode; khoá app | Như Android | M | ⏭ iOS: luồng không tới được (B-40); Face ID không có trên simulator |
| TC-198 | iOS (G-05) | File Applicant không vào iCloud backup | `isExcludedFromBackup` trên documentDirectory/applicants | M | ✅ iOS G-05 EXCLUDED (3 run × 2 làn) |
| TC-199 | iOS (G-06) | Tự sao lưu tuần vào iCloud Drive sau khi khởi động lại app | Vẫn ghi được (bookmark thư mục) | M | ⏭ iOS: luồng không tới được (B-40); iCloud Drive không có trên simulator |
| TC-200 | iOS | Sheet S-07 / S-15 (formSheet), bộ chọn ngày, share sheet, PDF expo-print | Đúng kiểu iOS | M | ⏭ iOS: luồng 03–05 không tới được (B-40); S-01/S-03 đã xem, B-80/B-81 |
