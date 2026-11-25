# A008-evenlease — Báo cáo khảo sát (Bước 0)

> Khảo sát 23–25/11/2026 cho file ý tưởng `y-tuong.md` ("Đơn xin thuê + checklist chọn người thuê cho chủ nhà lần đầu").
> Phương đã đọc và quyết **làm** (2026-11-25).

## 0. Đã khảo sát gì
- Đọc **1.538 đánh giá Google Play** (tất cả Play web tải được): TurboTenant 300, RentRedi 560, Zillow Rental Manager 440,
  Stessa 221, TenantEv 17. Số sao / số đánh giá iOS từ `itunes.apple.com/lookup` (23/11/2026).
- Giá, tính năng, cách nhận đơn của 7 hãng: 5 hãng trên + Avail, RentSpree, Apartments.com; API sàng lọc (TransUnion ShareAble,
  Checkr Tenant, CRS, RentPrep, TenantAlert).
- Mẫu gốc: Zillow (đơn xin thuê), Buildium (xác minh chủ nhà cũ), FTC (FCRA cho chủ nhà), Seattle (First-in-Time).
- Luật: Fair Housing, FCRA, nguồn thu nhập, Fair Chance, phí nộp đơn, báo cáo dùng lại, AI chấm điểm.

## 1. Bài toán
Một căn trống có ~10 người hỏi. Chủ nhà phải: **thu thông tin** → **kiểm tra có thật không** → **so mọi người với cùng một
bộ tiêu chí** → **quyết định, lưu lý do, gửi thư từ chối đúng luật**. Chọn sai có thể mất ~4 tháng tiền nhà mới đuổi được;
chọn theo cảm tính có thể bị kiện Fair Housing dù không cố ý.

## 2. Thực tế
- Chủ nhà lần đầu đăng tin miễn phí trên **Zillow** / Facebook / Craigslist; nhận đơn qua nền tảng đó, PDF / giấy của hiệp hội
  chủ nhà, hoặc Google Forms / email (SSN nằm trong hộp thư — kém an toàn nhất).
- Người thuê trả **$35–100 mỗi đơn**, thường không hoàn (2024: 79% người thuê trả phí, phổ biến $50). Xu hướng báo cáo dùng lại
  (Zillow $35 / 30 ngày; luật NY, WA, CO, CA). Có lừa đảo thu phí đơn bằng tin giả.
- Chỗ bí: không có tiêu chí viết sẵn · gọi chủ nhà cũ khó lấy thông tin, gặp **người quen đóng giả chủ nhà**, chủ hiện tại nói
  tốt để người thuê đi cho nhanh · **nơi làm thường chỉ xác nhận ngày vào làm + chức danh** · không biết phải gửi thư FCRA ·
  "mọi thứ đẹp trên giấy mà vẫn hỏng" · giữ giấy tờ người lạ mà không biết phải huỷ an toàn.

## 3. Luật / chính sách ảnh hưởng
| Luật | Nội dung | Ảnh hưởng thiết kế |
|---|---|---|
| Fair Housing (liên bang) | Cấm phân biệt chủng tộc, màu da, tôn giáo, giới tính, khuyết tật, quốc tịch, gia đình có trẻ em | Tiêu chí giống nhau; không hỏi có con; tuổi chỉ để xác minh danh tính |
| Nguồn thu nhập | 23 bang + DC, 152 địa phương cấm từ chối người dùng voucher (01/2025) | Thu nhập ≥ X lần tiền thuê phải tính cả voucher |
| FCRA (FTC) | Từ chối / đòi bảo lãnh / đòi cọc cao / tăng tiền thuê dựa **dù một phần** vào báo cáo → bắt buộc thông báo | Thư từ chối theo mẫu FTC (§6.⑥) |
| FTC Disposal Rule | Dùng xong báo cáo phải huỷ an toàn | Xoá hẳn hồ sơ + báo cáo |
| Seattle First-in-Time | Công bố tiêu chí trước; liệt kê giấy tờ; dấu giờ; xét lần lượt; 72 h bổ sung; 48 h trả lời; người đầu tiên đạt được thuê | Chế độ "Theo thứ tự nộp"; không so sánh chọn người tốt nhất |
| Fair Chance | NYC, Maryland (2026): xét tiền án sau đề nghị có điều kiện; Oakland, Berkeley: cấm hỏi; Portland, Seattle: đánh giá riêng | Tiền án = bước 2, không tự loại |
| Phí nộp đơn | NY ≤ $20 (miễn nếu báo cáo ≤ 30 ngày); WA công bố tiêu chí trước khi thu phí (RCW 59.18.257); CA ~$62–69; CO báo cáo dùng lại | App không thu phí đơn |
| AI chấm điểm | SafeRent dàn xếp $2,3 triệu; FTC đề xuất dàn xếp $2,25 triệu với một công ty sàng lọc (07/2026); hướng dẫn AI của HUD 2024 (tình trạng 2026 chưa rõ) | Không điểm tổng, không lời khuyên nhận / loại |

## 4. Đối thủ chi tiết + bảng chức năng
| | TurboTenant | RentRedi | Zillow Rental Manager | Stessa | TenantEv |
|---|---|---|---|---|---|
| Thực chất | Trọn gói: tin, đơn, báo cáo, hợp đồng, thu tiền | Trọn gói, mạnh thu tiền nhà | Đăng tin free, đơn dùng lại 30 ngày | **App kế toán** | **App phía người thuê** cho hội cư dân (Florida), BBB 1/5 |
| iOS ★ / số | 4,84 / 12.393 | 4,79 / 15.603 | 4,56 / 11.858 | 4,80 / 5.269 | 4,81 / 2.721 |
| Play đã đọc (1–3★) | 300 (36%) | 560 (55%) | 440 (49%) | 221 (24%) | 17 (12 cái 1★) |
| Người thuê trả | $45–55 | $39,99–49,99 | $35 | qua RentPrep | tới ~$150 |
| Chủ nhà trả | Free / ~$119–199/năm | ~$144/năm | Free / tin nổi bật $29,99 | Free / $12–15/tháng | — |
| Bộ lọc trước | ✓ (được khen) | ? | ✗ (bị chê thiếu) | ✗ | — |
| Đơn chung cả hộ | ? | ✗ (bị chê) | lỗi | — | ✗ (bị chê) |
| **Tiêu chí cố định / so theo tiêu chí / kịch bản gọi / khách khai vs đã xác minh / lưu lý do / thư FCRA trong app / chế độ theo thứ tự** | ✗ | ✗ | ✗ (chỉ tóm tắt từng người) | ✗ | ✗ |
| Lỗi chính | App không mở, kẹt loading, đăng nhập Google (~45) | Phí thanh toán / Plaid (165), popup bán thêm, đơn rườm rà, chỉ nhận ảnh, vợ chồng phải trả 2 lần | **Báo cáo không mở trong app** (~25), không xoá đơn cũ, không thư từ chối, không tìm theo tên, đơn người 2 không hiện | Nối ngân hàng lỗi, đăng nhập lại (3/221 nhắc đơn) | Đơn 45 phút, không hỗ trợ, không nộp chung |
- Ngoài file: Apartments.com (free cho chủ nhà, người thuê ~$29, **có so sánh cạnh nhau**) · Avail (câu hỏi riêng $9/căn/tháng,
  báo cáo $55) · RentSpree ($39,99–49,99; bản cao có kiểm thu nhập ngân hàng + **kiểm tham chiếu tự động**) · MagicDoor (AI tóm tắt + chấm).
- Khen chung: dễ dùng, bộ lọc trước, thấy mọi đơn cùng chỗ. Có chủ nhà dùng **mẫu đơn riêng** và chỉ lấy báo cáo của Zillow.

## 5. Điểm đặc thù (vì sao đối thủ làm vậy)
- Mô hình: **miễn phí cho chủ nhà để kéo họ vào, kiếm tiền từ người thuê** (phí đơn + báo cáo, phí trả tiền nhà 2,9–3% thẻ,
  bảo hiểm, báo tín dụng $5,99/tháng) + gói tiện ích của chủ nhà. Nên họ **bán dữ liệu thô**, để chủ nhà tự đọc, tự quyết.
- Báo cáo đi qua API của bên báo cáo (TransUnion ShareAble, Checkr Tenant từ $24,99, CRS, RentPrep, TenantAlert) — **không
  công khai**: xác minh tài khoản, hợp đồng, FCRA, có thể cần doanh nghiệp Mỹ. Người thuê tự nhập SSN trên trang bên báo cáo.
- Cơ chế kiểm tra: tín dụng = soft pull 3 cục tín dụng; tiền án = dữ liệu nhiều bang + xác nhận hồ sơ toà quận (dễ nhầm trùng
  tên / sót), FCRA cấm báo vụ bắt chưa kết án > 7 năm; bị đuổi nhà = hồ sơ toà nhà ở quận (phân biệt phán quyết / hoà giải /
  huỷ; nhiều bang niêm phong); thu nhập = Plaid / nối payroll / phiếu lương + sao kê (soi file giả: Snappt).
- Tự làm miễn phí: nsopw.gov, cổng toà án quận, MySmartMove (báo cáo gửi thẳng chủ nhà), annualcreditreport.com (người thuê tự lấy).

## 6. Biểu mẫu
① **Câu lọc trước:** ngày dọn vào, số người lớn, thú nuôi (động vật hỗ trợ không tính), thu nhập hộ, từng bị đuổi, chỗ đậu xe,
hút thuốc. Cấm hỏi: chủng tộc, màu da, tôn giáo, giới tính, khuyết tật, quốc tịch, có con.
② **Đơn 7 phần (Zillow):** cá nhân (tên, điện thoại, email, liên hệ khẩn cấp) · hộ (người ở cùng, thú nuôi, ngày dọn vào; mỗi
người ≥ 18 một đơn) · chỗ ở 3 năm (địa chỉ, từ–đến, tiền thuê, chủ nhà + liên hệ, lý do chuyển) · việc làm + thu nhập (công ty,
địa chỉ, chức danh, gộp/tháng, nguồn khác, làm từ bao giờ, quản lý + liên hệ) · có/không (phá sản 7 năm, bị đuổi, hút thuốc) ·
đồng ý xác minh + phí + tiền giữ chỗ · ký + ngày. ≤ 5 file chứng minh thu nhập. Nhận cả ảnh lẫn PDF. **Không SSN.**
③ **Xác minh chủ nhà cũ (Buildium / Zillow / TransUnion):** tự tra chủ sở hữu thật trước (sổ địa chính quận, web công ty quản lý);
hỏi: có thuê không, từ–đến, tiền thuê (đối chiếu), đúng hạn / đủ, vi phạm hợp đồng, tình trạng nhà, lý do đi + báo trước,
hàng xóm, "có cho thuê lại không" (không phải "có" → hỏi vì sao). Dấu hiệu xấu: khoảng trống, né, từ chối câu cuối, lệch, người
nghe máy không biết chi tiết căn. Gọi cả chủ hiện tại + trước đó; email trước, gọi lại 2–3 lần; ghi mọi câu trả lời.
④ **Xác minh nơi làm:** số tổng đài / nhân sự tự tra; thường chỉ ngày vào làm + chức danh; lương → phiếu lương 2–3 tháng + sao kê.
⑤ **Tiêu chí công bố trước:** thu nhập ≥ X lần (2,5–3, tính voucher), lịch sử thuê, không bị đuổi N năm, tín dụng (nếu dùng),
giấy tờ bắt buộc, số người ở theo luật địa phương, thú nuôi; Seattle thêm quyền xin thêm thời gian, 72 h, 48 h.
⑥ **Thư từ chối FCRA (FTC):** tên, địa chỉ, điện thoại bên báo cáo · bên đó không ra quyết định, không giải thích được · quyền
khiếu nại · báo cáo miễn phí trong 60 ngày · nếu dùng điểm: điểm, nguồn, ngày, thang, yếu tố chính. Chủ nhà tự gọi tham chiếu
không thuộc FCRA; thuê dịch vụ gọi hộ thì có. Gửi văn bản để có bằng chứng.
⑦ **Huỷ dữ liệu:** xoá sao cho không khôi phục được.

## 7. File ý tưởng so với thực tế
- ✅ **Khớp:** khoảng trống "phương pháp quyết định" có thật · lời chê đối thủ khớp 1.538 đánh giá · không tự kéo điểm tín dụng ·
  không dựa đặc điểm được bảo vệ · không quảng cáo / không khoá phần cơ bản.
- ⚠️ **Cần sửa:**
| Trong file | Thực tế | Đã chốt |
|---|---|---|
| "Offline, không tài khoản" và "gửi link đơn" | Mâu thuẫn: link cần server | Bản 1.0 **offline hoàn toàn**: nhập tay / khách tự điền trên máy chủ nhà / PDF đơn trống |
| So sánh cạnh nhau | Trái luật ở Seattle | 2 chế độ: So sánh / Theo thứ tự nộp |
| Tiêu chí "số người ở" | Chạm luật gia đình có trẻ em | Theo luật số người ở địa phương + cảnh báo |
| Không nhắc tiền án | Nhiều nơi hạn chế | Bước 2 sau đề nghị có điều kiện |
| Thư từ chối ở "cân nhắc thêm" | FCRA bắt buộc | Vào bản 1.0 |
| "Chấm mọi ứng viên" | Điểm tự động bị kiện | Đạt / Không đạt / Thiếu, không điểm tổng |
| Gọi nơi làm để xác minh | Nơi làm ít khi nói lương | Thu nhập xác minh bằng phiếu lương |
| Không nói chống tham chiếu giả, huỷ dữ liệu, khách khai vs đã xác minh | Rủi ro thật | Thêm vào phiếu gọi, F-17, trạng thái xác minh |
- ❌ **Yếu nhất:** kiếm tiền (đối thủ free cho chủ nhà, dùng thưa, chưa ai kể trả tiền cho checklist) · thị trường hẹp
  (~880 lượt tìm "rental application template"/tháng) · phản chứng "mẫu hiệp hội + dịch vụ tín dụng là đủ" · chủ nhà đã quen Zillow.

## 8. Kết luận
Ý tưởng đúng chỗ trống nhưng thị trường hẹp, khó thu tiền → làm **bản nhỏ, miễn phí, ra nhanh** để thử nhu cầu; định vị là
**sổ quyết định đi kèm Zillow / mọi kênh đăng tin**. Cổng bỏ ý tưởng của file ("< 5 chủ nhà lần đầu xin mẫu") **chưa kiểm được**
(Reddit chặn) → đo bằng lượt tải / đánh giá sau khi lên store.

## 9. Giới hạn của khảo sát
Reddit chặn mọi trình duyệt Claude · Play web chỉ tải 300–560 đánh giá/app (TenantEv 17) · đánh giá App Store không tải được ·
TurboTenant, Avail, Rentec chặn truy cập từ VN / bắt kiểm tra robot · chưa dùng thử app đối thủ (cần tài khoản Mỹ) · nhiều nguồn là
blog của hãng, giá mâu thuẫn · tình trạng hướng dẫn AI của HUD 2026, giới hạn phí CA / CO, luật Minneapolis chưa kiểm bằng văn bản gốc.

## 10. Nguồn
- Zillow: https://www.zillow.com/rentals-network/rental-application-form/ · https://www.zillow.com/rental-manager/tenant-screening
- FTC: https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-landlords-need-know
- Seattle: https://www.seattle.gov/rentinginseattle/housing-providers/finding-a-tenant/first-in-time
- Buildium: https://www.buildium.com/blog/how-to-perform-a-rental-verification/
- Giá / tính năng: https://support.turbotenant.com/hc/en-us/articles/222433828-How-much-is-the-application-screening-fee- ·
  https://help.rentredi.com/en/articles/3781770-how-tenant-screening-works · https://propertyhelp.apartments.com/article/13-applicant-cost ·
  https://www.rentspree.com/upgrade · https://www.avail.com/pricing · https://toolradar.com/tools/stessa/pricing ·
  https://prod.bbb.org/us/fl/miami/profile/computer-software/tenant-evaluation-llc-0633-90167488/customer-reviews
- API: https://www.transunion.ca/product/shareable-for-rentals · https://tenant.checkr.com/ · https://crscreditapi.com/tenant-screening/ · https://rentprep.com/?p=24264
- Luật: https://www.leaserunner.com/blog/application-fee-for-rental · https://www.hud.gov/helping-americans/housing-choice-vouchers-income-protect ·
  https://www.oaklandca.gov/Community/Housing-Programs-Support/Fair-Chance-Housing-Ordinance · https://www.nyc.gov/site/cchr/media/fair-chance-housing-campaign.page ·
  https://infobytes.orrick.com/2026-07-17/ftc-announces-proposed-2-25m-settlement-with-tenant-screening-company-over-alleged-fcra-violations/
- Người thuê: https://www.americanprogress.org/article/capping-rental-application-fees-at-5/ · https://www.apartmentlist.com/renter-life/ssn-on-rental-applications
- Google Play: `com.turbotenant.owner`, `com.RentRedi.RentRedi2`, `com.zillow.postlet`, `com.stessa.stessa`, `com.tenantevaluation`.
