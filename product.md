# A008-evenlease — Evenlease: Tenant Screening Checklist · product.md

> Nguồn sự thật về tính năng + màn hình. Đủ chi tiết để vẽ mockup tới từng nút và để code không phải đoán.
> Chữ trên giao diện viết **tiếng Anh** (trong ngoặc kép). Thuật ngữ theo `CONTEXT.md`. Khảo sát: `research.md`.
> Phiên bản 1 — 2026-11-25 (grill với Phương 23–25/11).

## 1. Tóm tắt sản phẩm
- **Cho ai:** chủ nhà ở Mỹ lần đầu / mới cho thuê (1–vài căn), tự quản lý, nhận đơn từ Zillow, Facebook, Craigslist, giấy.
- **Giải quyết gì:** chọn người thuê **nhất quán và có hồ sơ**:
  1. Đặt **Criteria** một lần cho mỗi **Rental** (có rào chắn luật) và xuất trang tiêu chí công bố trước.
  2. Nhận **Application** bằng 3 cách: tự nhập · đưa máy cho khách điền (**Applicant mode**) · in đơn trống.
  3. Xác minh: **Documents**, **Reference call** chủ nhà cũ / nơi làm (có hướng dẫn chống tham chiếu giả), **Screening report**
     do khách tự mua ở dịch vụ ngoài.
  4. App chấm từng tiêu chí: **Met / Not met / Missing / Needs review** + **Claimed / Verified / Mismatch**. Không điểm tổng.
  5. **Compare** cạnh nhau, hoặc **First-come order** (Seattle).
  6. **Decision** + lý do bắt buộc + dấu giờ → **Letter** (thư FCRA khi cần) → **Decision file** PDF.
  7. **Move-in checklist** ngày giao nhà. Xoá hẳn dữ liệu người không được chọn.
- **Nguyên tắc:**
  1. **Không quyết thay chủ nhà**: không điểm tổng, không "recommended", không xếp hạng.
  2. Không bao giờ dùng / hỏi đặc điểm được luật bảo vệ; **không hỏi SSN, không hỏi ngày sinh**.
  3. Offline, không tài khoản, không server, không quảng cáo, không theo dõi. Dữ liệu chỉ nằm trên máy (+ file sao lưu của chủ nhà).
  4. Mọi màn quyết định / thư / hướng dẫn luật có dòng "Not legal advice".
  5. Không hứa "compliant", "legal", "fair housing approved" — chỉ "helps you apply the same criteria to everyone".
- **Bản đầu miễn phí toàn bộ.** Không có màn Pro, không mua trong app.

## 2. Danh sách tính năng
| Mã | Tính năng | Màn |
|---|---|---|
| F-01 | Onboarding 3 trang + đồng ý "Not legal advice" + dữ liệu mẫu | S-01 |
| F-02 | Rental: tạo / sửa / đóng / lưu trữ; chọn **Review mode** (Compare / First-come order) | S-02, S-03, S-06 |
| F-03 | Criteria: bộ mẫu + tham số + rào chắn + tiêu chí tự thêm (lọc từ cấm) + khoá & lịch sử sửa + **PDF tiêu chí công bố** | S-04, S-05 |
| F-04 | Application 7 phần do chủ nhà nhập (+ đính ảnh đơn giấy), dấu giờ nhận | S-07, S-08 |
| F-05 | **Applicant mode**: khách tự điền + ký trên máy chủ nhà; khoá thoát bằng sinh trắc / mã máy | S-08a, S-08b |
| F-06 | **Blank application PDF** theo câu hỏi của Rental | S-07 → share sheet |
| F-07 | Documents: danh sách giấy tờ bắt buộc, chụp / chọn file, đánh dấu đã kiểm, so thu nhập với phiếu lương | S-10 |
| F-08 | Reference call sheet: chủ nhà cũ (tra chủ sở hữu thật, câu hỏi có cấu trúc, lần gọi, email mẫu) + nơi làm | S-11, S-12 |
| F-09 | Screening report ngoài: hướng dẫn, mở dịch vụ, nhập kết quả chính, thông tin công ty báo cáo, đính PDF | S-13 |
| F-10 | **Background review** (bước 2, sau Conditional offer): đánh giá riêng, không tự loại | S-14 |
| F-11 | Applicant summary: trạng thái từng tiêu chí + danh sách thiếu / lệch | S-09 |
| F-12 | Compare cạnh nhau (Compare mode) · Order queue + đồng hồ 72 h / 48 h (First-come mode) | S-17, S-18 |
| F-13 | Decision: Conditional offer / Approve / Approve with conditions / Deny + lý do + dấu giờ; tự phát hiện cần thư FCRA | S-15 |
| F-14 | Letters: Adverse action (FCRA) · Denial (not report-based) · Conditional offer · Approval → PDF / share, ghi đã gửi | S-16 |
| F-15 | **Decision file** PDF của Rental | S-19 |
| F-16 | Move-in checklist: phòng, hạng mục, ảnh, đồng hồ điện nước, chìa khoá, 2 chữ ký, PDF | S-20 |
| F-17 | Data cleanup: xoá hẳn dữ liệu người không được chọn, nhắc sau N ngày đóng Rental | S-24 |
| F-18 | Backup & restore: file mã hoá, tự ghi thư mục Drive / iCloud, nút tay, nhắc 30 ngày | S-22 |
| F-19 | Settings, App lock, Guide (bài hướng dẫn ngắn), Legal & privacy, Delete all data | S-21, S-23, S-25 – S-27 |

## 3. Luật chấm (engine) — bắt buộc đúng
### 3.1 Chung
- Engine TypeScript thuần (`src/engine/`), không phụ thuộc UI; tính lại mỗi khi đổi dữ liệu (< 50 ms cho 50 Applicant × 15 tiêu chí).
- Tiền: số nguyên cent. Ngày: ISO date. Dấu giờ: ISO có múi giờ của máy.
- Mỗi **Criterion result** gồm:
  - `outcome`: **Met** · **Not met** · **Missing** (chưa đủ thông tin) · **Needs review** (có thông tin nhưng luật không tự kết luận được).
  - `evidence`: **Claimed** (khách khai) · **Verified** (có nguồn + ngày + người kiểm) · **Mismatch** (nguồn khác lời khai).
  - `source`: Application · Document · Landlord reference · Employer reference · Screening report · Landlord note.
  - `reason`: một câu tiếng Anh giải thích (vd "Household income $5,400/mo is 3.27× rent; required 3.0×").
- **Không có điểm tổng, không có thứ hạng.** Applicant status tóm tắt: "Ready to decide" (không còn Missing) hoặc "N items missing".
- **Issues** của Applicant = chỉ các mục Missing / Needs review / Mismatch, xếp: Mismatch → Needs review → Missing. Kết quả
  Not met **không** vào Issues; "N items missing" chỉ đếm Missing. (Phương chốt 2026-11-25).

### 3.2 Bộ tiêu chí mẫu (mỗi Rental bật / tắt, sửa tham số)
| Mã | Tiêu chí (chữ trên app) | Tham số mặc định | Bật sẵn |
|---|---|---|---|
| C1 | "Income: at least {x}× the rent" | x = 3.0 (2.0–4.0, bước 0.1); "Apply to tenant's share when a housing voucher pays part of the rent" = ON | ✓ |
| C2 | "At least {m} months of rental or home-ownership history" | m = 12 (0–60) | ✓ |
| C3 | "No eviction judgment in the past {y} years" | y = 5 (1–7) | ✓ |
| C4 | "Previous landlord would rent to them again" | — | ✓ |
| C5 | "No unpaid balance owed to a past landlord" | — | ✓ |
| C6 | "Required documents provided" | Photo ID + Proof of income (2 recent pay stubs, offer letter, or benefits / voucher letter) | ✓ |
| C7 | "Occupancy: up to {p} people per bedroom" | p = 2 (theo hướng dẫn HUD; ghi chú "Check your local occupancy code") | ✓ |
| C8 | "Pet policy: {policy}" | No pets / Cats only / Cats and dogs (max {n}) / Pets considered case by case (**mặc định**); assistance animals không phải pet | ✓ |
| C9 | "Credit score of at least {s}" | s = 600 | ✗ (tắt) |
| C10 | "Criminal history review (after a conditional offer)" | lookback 7 năm, chỉ án đã kết | ✗ (tắt) |
| Cx | Tiêu chí tự thêm có / không (≤ 5) | — | — |
- C8 mặc định bộ mẫu = "Pets considered case by case"; Rental mẫu §8 vẫn "Cats and dogs, max 2" (Phương chốt 2026-11-25).
- Tiêu chí tự thêm (Cx): Yes → Met · No → Not met · chưa trả lời → Missing; "Applicant answers" = Claimed (nguồn Application),
  "Landlord checks" = Verified (nguồn Landlord note) (Phương chốt 2026-11-25).
- Chính sách không chấm (chỉ in trên trang công bố): "Non-smoking property", phí nộp đơn ("We do not charge an application fee" mặc định), tiền cọc.

### 3.3 C1 Income
- `rentForTest = rent − voucherMonthly` (khi bật tuỳ chọn voucher, Applicant có voucher; tối thiểu 0). Nếu `rentForTest = 0` → Met.
  Applicant trả lời có voucher nhưng bỏ trống "Monthly amount it pays" → C1 **Missing** (reason nhắc nhập số tiền) (Phương chốt 2026-11-25).
- `householdIncome = applicant gross monthly + other income + other adults' gross monthly` (các mục trong Application §5.S-08 phần 4).
- `ratio = householdIncome / rentForTest`. Met nếu `ratio ≥ x`, ngược lại Not met. Không có số thu nhập → Missing.
- **Evidence:** Verified khi mọi nguồn thu nhập có ít nhất một Document đã kiểm mà `docMonthly ≥ stated × 0.9`; Mismatch khi có
  Document đã kiểm với `docMonthly < stated × 0.9` (reason ghi cả hai số); còn lại Claimed.
- Có Document đã kiểm → ratio tính bằng tổng `docMonthly` (số trên giấy); chưa có → bằng số khai.
- `docMonthly` của giấy không phải phiếu lương (offer letter, benefits letter): chủ nhà nhập "Monthly amount on this document".
- C5 từ Landlord reference: câu 8 "Wouldn't say" = chưa có nguồn (Missing).
- Quy đổi phiếu lương ra tháng: gross mỗi kỳ × {weekly 52, biweekly 26, semimonthly 24, monthly 12} / 12, làm tròn cent.
- Trên mọi màn hiện ratio 2 số lẻ ("3.27×"). Khi Not met hiện thêm "Short by $X/mo".

### 3.4 C2 Rental history
- Tháng = tổng thời lượng các Residence (gộp khoảng chồng nhau, tính theo tháng tròn xuống), chỉ loại Rent / Own.
  Residence hiện tại tính tới ngày nhận đơn. Met nếu ≥ m; < m → Not met; không có Residence → Missing.
- Verified khi Residence dài nhất có Landlord reference đã xác nhận ngày (lệch ≤ 31 ngày ở cả hai đầu); lệch > 31 ngày → Mismatch.
- Người lần đầu thuê (0 tháng) và m > 0 → Not met; reason gợi ý "Consider a co-signer or other evidence — your call".

### 3.5 C3 Eviction
- Nguồn Verified: Screening report (danh sách vụ: Judgment / Settled / Dismissed / Tenant won / Unknown outcome, ngày).
- Judgment trong y năm tính từ ngày nhận đơn → Not met. Chỉ có Settled / Dismissed / Tenant won / Unknown → **Needs review**
  (reason "A case was filed but there was no judgment against the applicant"). Không vụ nào → Met (Verified).
- Chưa có report: dùng câu trả lời Application "Have you been evicted…?" → No = Met (Claimed); Yes = Needs review (Claimed).
- Report "No" mà Application "Yes" (hoặc ngược lại) → Mismatch.

### 3.6 C4 Landlord reference
- Lấy từ Landlord reference của Residence gần nhất **không phải** nơi đang ở; nếu chỉ có nơi đang ở thì dùng nơi đó.
  - "Would rent again": Yes → Met · No → Not met · "Wouldn't say" → Needs review.
  - Applicant không có Residence loại Rent (nhà riêng / ở với gia đình) → **Needs review** (Claimed), reason "No previous
    landlord to call (no rented residence) — your call" (Phương chốt 2026-11-25).
  - Chưa gọi → Missing. Ghi "Unreachable" (≥ 3 lần thử, ≥ 2 cách) → Missing với reason "Unreachable after 3 attempts".
- Evidence: Verified chỉ khi đã tick "I confirmed this person owns or manages the property" (ghi nguồn); không tick → Claimed
  + issue "Landlord identity not confirmed".
- Mismatch (thêm issue, không đổi outcome): tiền thuê landlord nói lệch Application > 5% · ngày lệch > 31 ngày.

### 3.7 C5 Unpaid landlord balance
- Nguồn: Screening report ("Collections owed to a landlord or property manager": None / amount) hoặc Landlord reference ("Owes
  unpaid rent or damages?": No / Yes $). Có số > $0 → Not met; None / No → Met; chưa có nguồn → Missing.

### 3.8 C6 Documents
- Mỗi loại giấy bắt buộc cần ≥ 1 file. Đủ file → Met (Claimed); chủ nhà tick "Checked" mọi file bắt buộc → Verified.
  Thiếu loại nào → Missing (reason liệt kê loại thiếu).

### 3.9 C7 Occupancy, C8 Pets
- C7: `occupants (all ages) ≤ p × bedrooms` → Met; vượt → Not met + cảnh báo cam "Check your local occupancy code before
  denying — rules vary and families with children are protected." Application chỉ hỏi **tổng số người sẽ ở**, không hỏi tuổi.
- C8: so số / loại pet khai với policy. "Case by case" → Needs review khi có pet. Application ghi rõ "Do not list assistance
  animals — they are not pets." Không có câu hỏi nào về khuyết tật.

### 3.10 C9 Credit (tuỳ chọn)
- Score ≥ s → Met; < s → Not met; report ghi "No score" → **Needs review** (không bao giờ Not met). Chưa có report → Missing.
- Khi bật C9, màn nhập report bắt ghi thêm: score model, range, ngày tạo, tối đa 4 key factors (cần cho thư FCRA).
- Khi bật có cảnh báo: "Many renters with vouchers or no credit history have low or no scores. Some states limit this criterion."

### 3.11 C10 Criminal history (bước 2)
- Chỉ mở sau khi Applicant ở trạng thái **Conditional offer**. Trước đó tiêu chí hiện "Not reviewed yet (after offer)", không tính
  là Missing khi xét "Ready to decide" cho Conditional offer.
- Chỉ nhập **án đã kết** trong lookback (loại, ngày kết án, ngày xong án). Không có ô cho "arrest".
- Có án trong lookback → **Needs review** (luôn luôn). Không có → Met. App không bao giờ ra Not met cho C10.
- Chủ nhà phải trả lời 4 câu đánh giá riêng (§5 S-14) trước khi chọn "Withdraw offer".

### 3.12 Rào chắn tiêu chí (F-03)
- Tiêu chí tự thêm: chặn khi tiêu đề chứa từ trong danh sách (không phân biệt hoa thường, cả số nhiều): race, color, religion,
  church, christian, muslim, jewish, national origin, nationality, citizen, immigrant, accent, english, sex, gender, pregnant,
  pregnancy, children, kids, family, married, single, disability, disabled, wheelchair, age, old, young, senior, section 8,
  voucher, welfare, ssi, ssdi. Thông báo: "This looks like it could screen on a protected characteristic or source of income.
  Fair housing laws prohibit that." Nút "Edit".
- Tắt tuỳ chọn voucher ở C1 → hộp cảnh báo "In 23 states, DC and many cities, refusing or disadvantaging voucher holders is
  illegal. Keep it on unless you're sure it doesn't apply." [Keep on] [Turn off anyway].
- Đặt C7 dưới 2 người / phòng → cảnh báo tương tự (familial status).

### 3.13 Khoá & lịch sử tiêu chí
- Rental chưa có Applicant: sửa tự do. Có ≥ 1 Applicant: Criteria **khoá**; sửa phải ghi lý do; mọi Applicant được chấm lại
  bằng bản mới; lịch sử (ngày, cũ → mới, lý do) in trong Decision file.

### 3.14 First-come order (Review mode = First-come)
- Hàng đợi theo `receivedAt` (dấu giờ khi lưu Application lần đầu; Applicant mode = lúc khách bấm Submit). Không sửa được dấu giờ.
- Applicant đầu tiên chưa có kết quả cuối là **In review**. Người sau không được Approve / Conditional offer khi người trước đang
  In review / Offered (nút bị khoá + giải thích "First-come mode: decide on #2 first").
- "Request missing info" → đồng hồ **72 h**; hết giờ còn Missing → được "Move to next (incomplete)".
- Conditional offer / Approve → đồng hồ **48 h** chờ trả lời; hết giờ → "Offer expired — move to next".
- Deny / incomplete / expired → người kế tiếp thành In review.
- Thông báo local khi đồng hồ còn 2 h và khi hết.

### 3.15 Khi nào cần thư FCRA (Adverse action)
- Decision ∈ {Deny, Approve with conditions (cọc cao hơn / người bảo lãnh / tiền thuê cao hơn), Withdraw offer} **và** ít nhất một
  lý do được chọn có `source = Screening report`, **hoặc** chủ nhà tick "Information from a screening report played a part in
  this decision" (tick sẵn nếu Applicant có report đã nhập). → Letter bắt buộc loại "Adverse action notice (FCRA)".
- Ngược lại (vd chỉ dựa vào Landlord reference chủ nhà tự gọi) → "Denial letter" thường; vẫn khuyên gửi bằng văn bản.
- Nếu lý do dùng C9 → thư có thêm khối điểm (score, range, date, model, key factors).
- Thiếu tên / địa chỉ / điện thoại công ty báo cáo → không xuất được thư; nút dẫn về S-13.
- App **không** chứa sẵn địa chỉ / điện thoại công ty báo cáo chưa kiểm: thư thật lấy đúng chữ chủ nhà nhập ở S-13; dữ liệu
  mẫu + thư mẫu dùng chỗ trống "[Mailing address from the report]" / "[Phone from the report]" như mockup (Phương chốt 2026-11-25).

### 3.16 Kiểm số (unit test bắt buộc, dùng dữ liệu mẫu §8)
- Mỗi luật §3.3–3.15 ≥ 1 test; kết quả mẫu §8 phải khớp từng ô; khoảng chồng Residence; quy đổi 4 loại kỳ lương; voucher làm
  rentForTest = 0; danh sách từ cấm (số nhiều, hoa thường); đồng hồ 72 h / 48 h qua nửa đêm và đổi giờ mùa hè.

## 4. Điều hướng
- **3 tab dưới:** "Rentals" (S-02) · "Guide" (S-25) · "Settings" (S-21).
- Tạo Rental: S-02 "+" → S-03 Rental → S-04 Criteria → S-05 Published criteria (xem / xuất) → S-06 Rental hub.
- S-06 → Applicant (S-09) → Documents (S-10) / References (S-11, S-12) / Screening report (S-13) / Background (S-14) / Decision (S-15)
  → Letter (S-16). S-06 → Compare (S-17) hoặc Order queue (S-18) · Decision file (S-19) · Move-in (S-20).
- Applicant mode chiếm toàn màn, ẩn tab, không thoát được nếu không qua sinh trắc / mã máy.

## 5. Màn hình (từng nút, trạng thái)

### 5.0 Quy ước chung (dùng lại A007 §5.0)
- Một giao diện cho cả Android + iOS; khác nhau chỉ ở hành vi hệ thống (back, sheet, bộ chọn ngày, sinh trắc) như bảng A007.
- Nút: Primary 52 cao, Secondary 48, vùng chạm ≥ 48×48; 5 trạng thái Default / Pressed / Focused / Disabled / Loading.
- Ô tiền: bàn phím số, 2 số lẻ, dấu phẩy khi rời ô; kiểm lỗi khi rời ô và khi Save; Save lỗi → cuộn tới ô lỗi đầu + rung + đọc.
- Hộp xác nhận: nút an toàn trái, nút phá huỷ đỏ phải. Sheet: kéo xuống / Cancel / back; có thay đổi → "Discard changes?".
- Snackbar Undo 5 giây (lâu hơn khi bật trình đọc màn hình). Rung: tick khi đổi segmented, "success" khi Save / Decision.
- **Huy hiệu trạng thái** (luôn có icon + chữ, không chỉ màu): Met ✓ · Not met ✕ · Missing ○ · Needs review ! · Verified (khiên ✓) ·
  Claimed (bóng thoại) · Mismatch (≠).
- Cỡ máy 320–430, tablet rộng tối đa 600; chữ tới 200% (từ 130% bảng Compare thành thẻ dọc).
- Chân màn quyết định / thư / tiêu chí: "Evenlease is a checklist, not legal advice. Laws vary by state and city."

### S-01 Onboarding (3 trang)
- Trang 1: "Pick tenants the same way, every time." Phụ đề "Set your criteria once. Check every applicant against them."
- Trang 2: "Verify, don't guess." Phụ đề "Call scripts, document checks and red flags for fake references."
- Trang 3: "A checklist, not legal advice." Phụ đề "No account, no ads. Applicant data stays on this phone. We never ask for
  Social Security numbers." Ô tick bắt buộc "I understand Evenlease is not legal advice". Nút "Get started" (khoá tới khi tick),
  nút phụ "Explore with a sample rental".
- "Skip" ở trang 1–2 nhảy tới trang 3 (không bỏ qua được tick).

### S-02 Rentals (tab 1)
- Header "Rentals" + nút "+" ("New rental").
- Thẻ mỗi Rental: địa chỉ dòng 1 + thành phố, "$1,650/mo · 2 bd", chip Review mode ("Compare" / "First-come"), dòng đếm
  "4 applicants · 1 ready to decide", chip trạng thái: Open / Offer out / Leased / Closed.
- Bộ lọc segmented: "Open" · "Closed". Vuốt trái thẻ: "Close" (Open) / "Reopen" + "Delete" (Closed).
- **Rỗng:** minh hoạ chìa khoá + "No rentals yet" + "Add your first rental to set criteria and start reviewing applicants." +
  nút "New rental" + liên kết "Try a sample rental".
- Thẻ nhắc trên cùng (khi cần): "Back up your data — last backup 34 days ago" [Back up] · "2 closed rentals still hold applicant
  data" [Review].

### S-03 Rental editor
- Trường: "Street address" (bắt buộc) · "Unit" · "City" · "State" (danh sách 50 bang + DC) · "ZIP" (5 số) · "Monthly rent" ($,
  bắt buộc, > 0) · "Bedrooms" (0–8, Studio = 0 tính như 1 cho C7) · "Bathrooms" · "Available from" (ngày) · "Security deposit" ·
  "Application fee" (mặc định $0, ghi chú "Some states cap or ban fees") · "Notes".
- **Review mode:** segmented "Compare applicants" / "First-come order" + giải thích dưới mỗi lựa chọn:
  - Compare: "Review everyone, then choose. Same criteria for all."
  - First-come: "Review in the order received and offer to the first who qualifies. Required in Seattle; a good habit anywhere."
  - Bang WA → gợi ý cam "Seattle requires first-come order." (không tự đổi).
  - Đổi mode khi đã có Applicant → hộp xác nhận, ghi vào lịch sử.
- Nút "Next: criteria" (tạo mới) / "Save" (sửa). Lỗi: "Enter the street address", "Enter the monthly rent", "ZIP must be 5 digits".

### S-04 Criteria builder
- Danh sách thẻ C1…C10 theo §3.2: công tắc bật / tắt, tham số chỉnh trực tiếp (stepper / ô số / chọn), dòng giải thích 1 câu,
  link "Why this matters" mở bài Guide.
- C6 mở danh sách chọn giấy tờ: Photo ID · Proof of income · Bank statement · Reference letter · Voucher / benefits letter · Other (tự gõ).
- C10 khi bật: "Lookback" 1–10 năm, ghi chú "Only convictions. Reviewed after a conditional offer. Some cities ban this step
  (e.g. Oakland, Berkeley) or delay it (NYC, Maryland). Check local law."
- "+ Add your own yes/no criterion" (≤ 5) → sheet: tiêu đề (≤ 80 ký tự), "Applicant answers" hoặc "Landlord checks"; rào chắn §3.12.
- Chính sách không chấm: "Smoking" (Non-smoking / Smoking allowed outside / Allowed), "Deposit" (lấy từ S-03), "Fee".
- Khi đã khoá (§3.13): banner "Criteria are locked because you have applicants. Changes apply to everyone and are recorded."
  nút "Edit criteria" → sheet ghi lý do (bắt buộc) → mở khoá tạm.
- Nút cuối: "Preview published criteria".

### S-05 Published criteria
- Xem trước trang A4 / Letter: tên + địa chỉ Rental, tiền thuê, ngày trống, danh sách tiêu chí bằng câu đơn giản, giấy tờ cần nộp,
  Review mode (First-come: thêm "Applications are reviewed in the order received. If information is missing you will have 72
  hours to provide it. Offers are open for 48 hours."), "You may ask for more time or a reasonable accommodation.",
  "We do not ask for your Social Security number on this application.", câu Fair Housing chuẩn "We do not discriminate based
  on race, color, religion, sex, national origin, familial status, disability, or any other characteristic protected by law."
- Nút "Export PDF" / "Share" · "Copy as text" (để dán vào tin Zillow / Facebook). Thanh trên: "Edit criteria".

### S-06 Rental hub
- Header: địa chỉ, "$1,650/mo · 2 bd · Available Jan 1", chip mode, menu ⋯ (Edit rental · Edit criteria · Published criteria ·
  Decision file · Close rental · Delete rental).
- Nút lớn "Add applicant" → sheet S-07.
- Nút "Compare" (Compare mode) hoặc "Order queue" (First-come mode), có số người.
- Danh sách Applicant: tên, "Received Dec 2, 9:14 AM", trạng thái (New / In review / Conditional offer / Approved / Denied /
  Withdrawn / Incomplete), dòng tóm tắt ("Ready to decide" xanh nhấn hoặc "3 items missing" xám); First-come: số thứ tự "#1".
- Khi có Applicant Approved: thẻ "Move-in checklist" ở đầu.
- **Rỗng:** "No applicants yet" + "Share your published criteria, then add applicants as they come in." + 2 nút "Share criteria" ·
  "Add applicant".

### S-07 Add applicant (sheet)
- 3 lựa chọn lớn có icon:
  1. "Enter an application" — "Type it in from Zillow, email or a paper form." → S-08 (chế độ chủ nhà).
  2. "Hand the phone to the applicant" — "They fill it in and sign. They can't see anything else." → S-08a.
  3. "Print a blank application" — "A PDF with this rental's questions." → tạo PDF → share sheet.
- Dòng dưới: "Never collect Social Security numbers here. Screening services collect them directly."

### S-08 Application form (dùng chung chủ nhà / khách)
- Thanh tiến độ 7 phần; mỗi phần một màn; tự lưu nháp; "Back" / "Next".
  1. **About you:** "Full legal name" (bắt buộc) · "Phone" · "Email" (ít nhất 1 trong 2) · "Emergency contact" (tên + điện thoại).
  2. **Household:** "How many people will live here, including you?" (1–12) · "Other adults (18+)" tên từng người · "Pets"
     (số + loại: Cat / Dog / Other; ghi chú "Don't list assistance animals — they are not pets.") · "Desired move-in date" ·
     "Will a housing voucher or rental assistance pay part of the rent?" Yes / No → Yes: "Monthly amount it pays" ($, có thể để trống)
     + "Program / housing authority".
  3. **Where you've lived (past 3 years):** danh sách Residence (thêm / xoá): "Address", "From" (tháng/năm), "To" (hoặc "I live
     here now"), "Type" (Rent / Own / With family / Other), "Monthly rent or mortgage", "Landlord or manager name", "Landlord
     phone", "Landlord email", "Why are you moving?". Tổng thời gian < 3 năm → nhắc mềm "Add earlier addresses to cover 3 years".
  4. **Work & income:** "Employer" · "Job title" · "Start date" · "Gross monthly income" ($) · "Employer phone" · "Supervisor
     name" · "Other income" (danh sách: type Self-employment / Benefits / Child support / Retirement / Other + monthly $) ·
     "Income of other adults" (từng người: monthly $). Ghi chú "Gross = before taxes."
  5. **A few questions** (Yes / No + ô giải thích khi Yes): "Have you been evicted or had an eviction case filed against you in
     the past 7 years?" · "Have you filed for bankruptcy in the past 7 years?" · "Does anyone in the household smoke?"
  6. **Consent & signature:** đoạn đồng ý "I authorize the landlord to contact my current and previous landlords and employers
     to verify this application, and to review a screening report I provide or authorize." · "I certify the information is
     true and complete." · ô ký tay (xoá / ký lại) · tên in · ngày (tự điền).
  7. **Review:** tóm tắt từng phần + "Edit"; nút "Submit application" (Applicant mode) / "Save applicant" (chủ nhà).
- Chế độ chủ nhà có thêm ở phần 7: "Attach photos of the paper form" (camera / ảnh / PDF) và "Received on" (mặc định bây giờ,
  sửa được **chỉ khi tạo**, khoá sau khi lưu; First-come mode cảnh báo "Use the time you actually received it").
- Lỗi: "Enter a full name", "Add a phone number or an email", "Move-in date can't be in the past", "'To' must be after 'From'",
  "Sign to continue". Không có trường SSN / ngày sinh / giới tính / quốc tịch ở bất kỳ đâu.

### S-08a Applicant mode — bắt đầu
- Màn chuyển giao cho khách: logo + "Application for 1428 Maple St, Unit B" + "Your answers are saved only on this landlord's
  phone. Do not enter your Social Security number." + nút "Start". Thanh trên: "Applicant mode" + nút khoá nhỏ "Landlord".
- Trong mode: ẩn tab, chặn back hệ thống ra ngoài form, chặn chụp màn hình? (không — để khách chụp lại được), tắt thông báo.
- "Landlord" → sinh trắc / mã máy → hỏi "Exit applicant mode? The applicant's draft will be kept." Nếu máy không có khoá →
  bắt đặt PIN 4–6 số của app trước khi vào Applicant mode.

### S-08b Applicant mode — xong
- "Thank you, {first name}." + "Your application was received on Dec 2, 2026 at 9:14 AM." + "Please hand the phone back."
  Không hiện gì khác; chạm 3 lần hoặc chờ → yêu cầu sinh trắc để về S-06.

### S-09 Applicant detail
- Header: tên, "Received Dec 2, 9:14 AM", chip trạng thái, (First-come) "#1 in line", menu ⋯ (Edit application · Withdrawn by
  applicant · Delete applicant).
- **Summary card:** "Ready to decide" hoặc "3 items missing" + dòng "Not a score. Same criteria for every applicant."
- **Criteria list:** mỗi dòng: tên tiêu chí · huy hiệu outcome · huy hiệu evidence · reason 1 dòng; chạm → sheet chứng cứ
  (nguồn, ngày, ai kiểm, file) + nút đi tới nơi bổ sung.
- **Issues** (nếu có): thẻ cam liệt kê Mismatch / Needs review / Missing kèm nút hành động ("Add pay stubs", "Call landlord", "Add report").
- **Sections** (hàng điều hướng có trạng thái): "Application" · "Documents 2/3" · "References 1/2" · "Screening report —" ·
  "Background (after offer)" · "Decision".
- Nút dưới cố định: "Make a decision" (disabled khi First-come và chưa tới lượt — chữ giải thích dưới nút).

### S-10 Documents
- Danh sách loại giấy bắt buộc (từ C6) + "Other files". Mỗi loại: trạng thái Missing / Provided / Checked, ảnh thu nhỏ, "+ Add"
  (Camera · Photos · Files PDF).
- Mỗi file: xem toàn màn (zoom), "Mark as checked" (ghi ngày + "by you"), "Delete".
- **Income check** (khi có Proof of income): "Gross pay per period" ($) · "Pay frequency" (Weekly / Every 2 weeks / Twice a month /
  Monthly) → hiện "≈ $4,600/mo vs $5,200 stated (−12%)" + huy hiệu Mismatch khi < 90%. Mẹo "Compare pay stubs with bank deposits;
  look for mismatched fonts or totals that don't add up."
- Rỗng: "No documents yet" + nút "Add".

### S-11 Landlord reference (mỗi Residence một phiếu)
- **Bước 1 "Find the real owner"**: giải thích "Don't rely only on the number the applicant gave. Look up the property owner in the
  county property records or the management company's website." Nút "Search county records" (mở trình duyệt với truy vấn
  "{county} {state} property records {address}"). Ô "How you confirmed" (County records / Management company website / Lease
  shown by applicant / Other) + công tắc "I confirmed this person owns or manages the property".
- **Bước 2 "Call script"**: câu hỏi có cấu trúc:
  1. "Did {name} rent from you at {address}?" Yes / No / Wouldn't say
  2. "From when to when?" (tháng/năm – tháng/năm hoặc "Still there")
  3. "What was the monthly rent?" ($)
  4. "Did they pay on time and in full?" Always / Mostly / Often late / Wouldn't say
  5. "Any lease violations (extra occupants, unauthorized pets, noise)?" No / Yes + ghi chú
  6. "How did they leave the unit?" Good / Normal wear / Damage beyond normal wear / Still living there / Wouldn't say
  7. "Did they give proper notice?" Yes / No / Still living there / Wouldn't say
  8. "Do they owe unpaid rent or damages?" No / Yes $
  9. "Would you rent to them again?" Yes / No / Wouldn't say → khi không phải Yes: ô "Why?"
  - Ô "Notes".
- **Red flags tự động** (thẻ cam): ngày lệch > 31 ngày · tiền thuê lệch > 5% · chưa xác nhận chủ sở hữu · "Wouldn't say" ở câu 9 ·
  khoảng trống > 2 tháng giữa các Residence.
- **Attempts log**: "+ Log attempt" → thời gian (mặc định bây giờ) · Call / Email / Text · Reached / No answer / Left message / Wrong
  number. ≥ 3 lần không gặp bằng ≥ 2 cách → nút "Mark as unreachable".
- "Email a verification request" → mở app mail với tiêu đề + thân thư mẫu (danh sách câu hỏi) — app không gửi gì.
- Nhắc "Call both the current and the previous landlord. A current landlord may give a good reference just to see them go."

### S-12 Employer reference
- Bước 1: "Find the employer's main number yourself (company website or directory) and ask for HR or payroll."
- Câu hỏi: "Is {name} employed with you?" Yes / No / Won't confirm · "Since when?" · "Job title?" · ô Notes.
- Ghi chú cố định: "Many employers only confirm dates and title. Verify income with pay stubs instead."
- Attempts log như S-11.

### S-13 Screening report (external)
- Thẻ giải thích "Screening reports come from licensed companies. The applicant pays and enters their SSN on the company's site —
  you never handle it."
- Nút: "Open MySmartMove" · "Open Checkr" · "Other service" (mở trình duyệt). Lựa chọn "The applicant already has a recent report
  (30 days or less)".
- Form kết quả:
  - **Company that supplied the report** (bắt buộc cho thư FCRA): "Name", "Mailing address", "Phone (toll-free if listed)"
    (gợi ý "Copy these from the top of the report").
  - "Report date".
  - **Eviction records:** "None found" hoặc danh sách vụ: năm / ngày + kết quả (Judgment against applicant / Settled / Dismissed /
    Applicant won / Outcome not shown).
  - **Collections owed to a landlord or property manager:** None / amount $.
  - **Credit score** (chỉ hiện khi C9 bật): score, "No score", model, range, date, key factors (≤ 4).
  - "Attach report (PDF or photos)".
- Phần tiền án **không có ở đây** (S-14).

### S-14 Background review (bước 2)
- Khoá tới khi Applicant = Conditional offer: "Unlocks after you make a conditional offer."
- Banner luật: "Some cities and states ban or delay criminal history checks (e.g. NYC, Maryland, Oakland, Berkeley, Seattle,
  Portland, Cook County). Check your local law."
- Nhập: "No convictions in the past {N} years" hoặc danh sách án: loại (Violent / Property / Drug / Fraud / Other), ngày kết án,
  ngày xong án. Ghi chú "Arrests without a conviction must not be considered."
- 4 câu đánh giá riêng (bắt buộc khi có án): "How serious was it, and how does it relate to the safety of residents or property?"
  · "How long ago was it?" (tự tính từ ngày) · "Any evidence of rehabilitation or good tenant history since?" · "Anything else the
  applicant told you?"
- Kết quả: "Continue with the offer" hoặc "Withdraw the offer" (→ S-15 với lý do; §3.15 nếu dựa vào report).

### S-15 Decision (sheet)
- Lựa chọn theo trạng thái: "Conditional offer" (chỉ khi C10 bật) · "Approve" · "Approve with conditions" (Higher deposit /
  Co-signer or guarantor / Higher rent — ghi số) · "Deny" · "Withdraw offer" (sau Conditional offer).
- "Reasons" (bắt buộc khi Deny / conditions / withdraw): tick các tiêu chí Not met / Needs review + ô "Explain in your words".
  Chặn lý do chứa từ cấm §3.12 với thông báo tương tự.
- Tick "Information from a screening report played a part in this decision" (theo §3.15).
- Cảnh báo khi Deny có tiêu chí Missing: "Some information is missing. In first-come mode, give the applicant 72 hours first."
- Nút "Save decision" → dấu giờ → nếu cần thư FCRA: hộp "An adverse action notice is required" [Create notice] (không bỏ qua
  được: decision lưu ở trạng thái "Notice pending" tới khi xuất thư).

### S-16 Letter
- Loại: "Adverse action notice (FCRA)" · "Denial letter" · "Conditional offer" · "Approval letter".
- Ô tự điền: ngày, tên + địa chỉ người nhận (từ Application), địa chỉ Rental, tên chủ nhà (Settings), lý do (từ S-15),
  công ty báo cáo (S-13), khối điểm (nếu C9), hạn trả lời (48 h ở First-come).
- Nội dung FCRA bắt buộc: tên / địa chỉ / điện thoại công ty báo cáo; "The company did not make this decision and cannot tell you
  why it was made."; quyền xin bản báo cáo miễn phí trong 60 ngày; quyền khiếu nại thông tin sai hoặc thiếu với công ty đó.
- Chủ nhà sửa được câu mở / kết; không xoá được khối FCRA bắt buộc.
- Nút "Preview PDF" · "Share" · "Mark as sent" (ngày + cách: Email / Text / Mail / In person).

### S-17 Compare (Compare mode)
- Bảng: hàng = tiêu chí đang bật, cột = Applicant (cuộn ngang, cột đầu ghim), ô = huy hiệu outcome + chấm evidence; hàng cuối
  "Issues" (số). Bộ lọc "Hide denied / withdrawn". Chạm ô → sheet chứng cứ.
- Dòng cố định trên: "Not a ranking. Columns are in the order applications were received."
- Từ 130% chữ: mỗi Applicant một thẻ dọc.
- Rỗng (< 2 Applicant): "Add at least two applicants to compare."

### S-18 Order queue (First-come mode)
- Danh sách theo thứ tự nhận: "#1 Jordan Ellis · Dec 2, 9:14 AM · In review", trạng thái + đồng hồ ("Missing info — 41 h left",
  "Offer — 22 h left").
- Hành động cho người đang In review: "Review" (→ S-09) · "Request missing info" (bắt đầu 72 h, chọn cách đã báo khách) ·
  "Move to next (incomplete)" (chỉ khi hết 72 h) · "Offer expired — move to next" (khi hết 48 h).
- Banner: "First-come order: review one at a time, in the order received."

### S-19 Decision file
- PDF của Rental: trang tiêu chí công bố + lịch sử sửa tiêu chí; danh sách Applicant theo thứ tự nhận (dấu giờ); với mỗi người: bảng
  tiêu chí + chứng cứ (nguồn, ngày), Decision + lý do + dấu giờ, thư đã gửi (ngày, cách). **Không** kèm ảnh giấy tờ / báo cáo
  (tuỳ chọn "Include document thumbnails" tắt sẵn).
- Nút "Export PDF" · "Share".

### S-20 Move-in checklist
- Tạo từ Applicant Approved: tên người thuê, ngày giao, địa chỉ.
- Phòng tự tạo theo Bedrooms / Bathrooms + Kitchen, Living room, Entry (thêm / đổi tên / xoá). Mỗi phòng các hạng mục (Walls,
  Floors, Windows, Doors & locks, Lights & outlets, Appliances…): Good / Fair / Damaged + ghi chú + ảnh.
- "Meter readings" (Electric / Gas / Water) · "Keys handed over" (số) · "Smoke & CO alarms tested" (Yes / No).
- Chữ ký: "Landlord" · "Tenant" (ký trên máy) → "Export PDF" · "Share". Có thể làm dở và quay lại.

### S-21 Settings (tab 3)
- "Your name" (in trên thư) · "Your mailing address / phone" (cho thư) · "App lock" (S-23) · "Appearance" (System / Light / Dark) ·
  "Backup & restore" (S-22) · "Data cleanup" (S-24) · "Reminders" (backup, cleanup, timers) · "Load sample rental" / "Remove sample
  rental" · "Legal & privacy" (S-26) · "About" · "Delete all data" (S-27).

### S-22 Backup & restore
- "Back up now" → tạo 1 file mã hoá (mật khẩu backup do người dùng đặt lần đầu, bắt nhập 2 lần, cảnh báo "If you forget it, the
  backup can't be opened") → share sheet hoặc thư mục tự động.
- "Automatic backup": Off / Weekly vào thư mục đã chọn (Android SAF — Google Drive; iOS: Files → iCloud Drive).
- "Last backup: Nov 30, 2026 · 12.4 MB". Nhắc khi > 30 ngày.
- "Restore from backup" → chọn file → mật khẩu → "This replaces all data on this phone." [Cancel] [Replace].

### S-23 App lock
- Công tắc "Require Face ID / fingerprint to open" + "Lock after" (Immediately / 1 min / 5 min). Dùng cùng khoá này để thoát
  Applicant mode. Máy không có sinh trắc → PIN 4–6 số của app.

### S-24 Data cleanup
- Giải thích "Federal rules require you to securely dispose of screening information once you no longer need it."
- Danh sách Rental đã đóng có Applicant không được chọn: "{n} applicants not selected · closed 45 days ago" → "Delete their data".
- Xoá = xoá DB + mọi file + PDF đã tạo của họ; giữ dòng ẩn danh trong Decision file ("Applicant 3 — data deleted Jan 10").
  Xác nhận: "Permanently delete data for 3 applicants? This can't be undone." [Cancel] [Delete].
- Nhắc mặc định 60 ngày sau khi đóng Rental (Settings: 30 / 60 / 90 / 180 / Off).

### S-25 Guide (tab 2)
- Danh sách bài ngắn (mỗi bài ≤ 400 từ, có "Sources" + "Not legal advice"): "How Evenlease works" · "Writing fair criteria" ·
  "Fair housing basics" · "Housing vouchers and income rules" · "Spotting fake references" · "Verifying income" · "Screening
  reports explained (credit, eviction, criminal)" · "When you must send an adverse action notice" · "First-come rules (Seattle)" ·
  "Criminal history laws by city" · "Getting rid of applicant data".
- Tìm kiếm theo tiêu đề. Các màn khác link thẳng tới bài liên quan.

### S-26 Legal & privacy
- "Evenlease is a checklist tool, not a law firm. It does not give legal advice…" · "Your data: stays on this phone and in backups
  you create. We have no servers and collect nothing." · nguồn (FTC, HUD, Seattle).

### S-27 Delete all data
- Gõ "DELETE" để xác nhận → xoá DB + mọi file → về S-01.

## 6. Thông báo (local, không mạng)
- First-come: "Jordan Ellis — 2 hours left to provide missing info" · "Offer to Jordan Ellis expires in 2 hours" · khi hết giờ. Chạm → S-18.
- "Time to back up — last backup 31 days ago." Chạm → S-22.
- "2 closed rentals still hold applicant data." Chạm → S-24.
- Hỏi quyền thông báo lần đầu khi bật First-come mode hoặc bật nhắc. Không thông báo quảng cáo.

## 7. Dữ liệu (SQLite) — khung
- `rentals` (địa chỉ, rent_cents, bedrooms, bathrooms, available_on, deposit_cents, fee_cents, review_mode, status, closed_at, is_sample)
- `criteria` (rental_id, code, enabled, params JSON, order) · `criteria_history` (rental_id, at, before JSON, after JSON, reason)
- `applicants` (rental_id, received_at, status, source: landlord|applicant_mode|paper, full_name, phone, email, emergency JSON,
  occupants, other_adults JSON, pets JSON, move_in_on, voucher_cents, voucher_program, answers JSON, signature_path, signed_at, deleted_at)
- `residences` (applicant_id, address, from_month, to_month, current, type, rent_cents, landlord_name/phone/email, reason)
- `incomes` (applicant_id, kind, employer, title, start_on, monthly_cents, phone, supervisor, person)
- `documents` (applicant_id, type, file_path, mime, checked_at, pay_gross_cents, pay_frequency)
- `references` (applicant_id, kind: landlord|employer, residence_id, owner_confirmed, confirm_source, answers JSON, unreachable)
- `attempts` (reference_id, at, method, result)
- `reports` (applicant_id, company_name, company_address, company_phone, report_date, evictions JSON, landlord_collections_cents,
  score, score_model, score_range, score_date, key_factors JSON, file_paths JSON)
- `background` (applicant_id, convictions JSON, assessment JSON, outcome)
- `decisions` (applicant_id, kind, conditions JSON, reasons JSON, note, report_influenced, at, notice_required, notice_status)
- `letters` (decision_id, kind, body, pdf_path, sent_at, sent_method)
- `timers` (applicant_id, kind: missing_info|offer, started_at, ends_at, resolved_at)
- `movein` (rental_id, applicant_id, rooms JSON, meters JSON, keys, alarms, signatures JSON, done_at)
- `settings`
- Ảnh / PDF: `documentDirectory/applicants/{id}/…`, xoá cùng hồ sơ. Không log dữ liệu Applicant.

## 8. Dữ liệu mẫu ("Explore with a sample rental") — cũng là kết quả mong đợi của test
- **Rental:** "1428 Maple St, Unit B, Columbus, OH 43215" · $1,650/mo · 2 bd / 1 ba · available Jan 1, 2027 · deposit $1,650 ·
  fee $0 · **Compare mode**. Tiêu chí: C1 3.0× (voucher ON) · C2 12 tháng · C3 5 năm · C4 · C5 · C6 Photo ID + Proof of income ·
  C7 2/bedroom (≤ 4 người) · C8 Cats and dogs, max 2 · C9 off · C10 on, lookback 7 năm.
- **#1 Jordan Ellis** — received Dec 2, 2026 9:14 AM · 2 người · 1 dog · income $5,400 (pay stubs biweekly $2,470 →
  $5,351.67/mo, checked) · residence 26 tháng, landlord confirmed (county records), dates + rent khớp, would rent again Yes ·
  report MySmartMove (TransUnion): no evictions, no landlord collections · docs đủ + checked.
  → C1 Met · Verified ("$5,351.67/mo is 3.24× rent") · C2 Met · Verified · C3 Met · Verified · C4 Met · Verified · C5 Met · Verified ·
  C6 Met · Verified · C7 Met · C8 Met · C10 "Not reviewed yet (after offer)" → **Ready to decide**.
- **#2 Priya Raman** — Dec 2, 2:40 PM · 1 người · income $4,700 claimed, chưa có giấy · landlord: 2 attempts no answer (Call, Call) ·
  report: no evictions, **collections owed to a landlord $2,310**, company "TransUnion Rental Screening Solutions", địa chỉ "[Mailing address from the report]", điện thoại "[Phone from the report]" (Phương chốt 2026-11-25).
  residence 30 tháng (claimed).
  → C1 **Not met** · Claimed ("$4,700/mo is 2.85× rent; required 3.0× · Short by $250/mo") · C2 Met · Claimed · C3 Met · Verified ·
  C4 Missing · C5 **Not met** · Verified (report) · C6 Missing ("Proof of income") · C7 Met · C8 Met → "2 items missing".
  Demo quyết định: Deny với lý do C5 → **bắt thư FCRA**.
- **#3 Marcus Webb** — Dec 3, 11:05 AM · 3 người · income $6,100 (pay stubs semimonthly $3,050 → $6,100/mo, checked) · residence
  khai Mar 2022 – now, rent $1,200; landlord confirmed owner, nói từ Jan 2023, rent $1,550, câu 8 (owes) "Wouldn't say", would
  rent again "Wouldn't say" · chưa có report · không pet.
  → C1 Met · Verified (3.70×) · C2 Met · **Mismatch** (dates) · C3 Met · Claimed · C4 **Needs review** + issue rent mismatch (+29%) ·
  C5 Missing · C6 Met · Verified · C7 Met (3 ≤ 4) · C8 Met → "1 item missing". Demo: Deny chỉ dựa vào C4 (tự gọi) → **Denial letter thường**, không FCRA.
- **#4 Dana Ortiz** — Dec 4, 8:20 AM · 2 người · voucher $900/mo → rentForTest $750 · income $2,600 (benefits letter, checked) ·
  residence 40 tháng, landlord confirmed, Yes · report: 1 case 2021 **Settled**, no collections · docs đủ.
  → C1 Met · Verified ("3.47× your share of the rent ($750)") · C2 Met · Verified · C3 **Needs review** · Verified · C4 Met ·
  Verified · C5 Met · Verified · C6 Met · Verified · C7 Met · C8 Met → **Ready to decide** (Needs review không chặn).
- Sample rental gắn cờ `is_sample`, xoá được một chạm; không đếm vào nhắc dọn dữ liệu.

## 9. Định hướng thiết kế — **v2 Indigo (Phương, 2026-11-25)**
- **Nguồn giao diện duy nhất:** `design/v2-indigo/`:
  - mockup Hi-Fi https://claude.ai/artifact/8BHE1J66vSHmZdEVKMBaZV (bản export `Evenlease-HiFi-mockups.html`);
  - design system https://claude.ai/artifact/MKbbmJpjerYdFyEw2UngXU;
  - `design-tokens.json` (màu sáng/tối, chữ, khoảng cách, bo góc, đổ bóng);
  - `logo/` (icon iOS 1024, Play 512, adaptive Android, logo nền sáng/tối, wordmark).
- **Quy tắc khi lệch:** về giao diện (màu, chữ, bố cục, câu chữ trên màn) thì **mockup v2 thắng**; về luật chấm, dữ liệu, hành vi thì **product.md thắng**. S-12, S-23, S-26 không có màn riêng trong mockup → dựng theo cùng design system, nội dung theo §5.
- Màu nhấn **indigo** (#4f46e5 / tối #a5b4fc); amber cho Needs review / Mismatch / cảnh báo; crimson chỉ cho Not met và hành động xoá. Trạng thái luôn có icon + chữ. Không có điểm tổng, không có "winner".
- Chữ Inter, số tabular; vùng chạm ≥ 48; nội dung tablet tối đa 600; sáng + tối; chữ tới 200%.

## 10. Store (ghi sẵn)
- **Tên Play (≤ 30):** "Evenlease: Tenant Screening" · App Store subtitle: "Same criteria for every applicant".
- **Mô tả ngắn:** "Set rental criteria once, check every applicant the same way, and keep a record of every decision."
- Không hứa "compliant" / "legal"; ghi "Not legal advice". Không hứa "free forever".
- **Quyền:** Camera (chụp giấy tờ), sinh trắc, thông báo. Ảnh / file qua bộ chọn hệ thống (không xin quyền bộ nhớ).
- **Data safety:** không thu thập, không chia sẻ (không server). Android Auto Backup: **tắt** cho DB + file người xin thuê
  (dữ liệu nhạy cảm của bên thứ ba; sao lưu chỉ qua file mã hoá của app). iOS: loại file người xin thuê khỏi iCloud backup.
- Bundle ID: chưa chốt (Phương nhắn trước khi lên Play).
