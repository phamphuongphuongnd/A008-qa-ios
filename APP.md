# A008-evenlease · Evenlease: Tenant Screening Checklist

> Brief tĩnh của app. **≤ 60 dòng, không ghi lịch sử** (lịch sử ở git + `memory/sessions/`).
> Tiến độ: `CHECKLIST.md` · Tính năng: `product.md` · Kế hoạch phase: `PLAN.md` · Khảo sát: `research.md` · Ý tưởng gốc: `y-tuong.md`.

**Đang ở:** Bước 3 — phiên điều phối chạy PLAN.md Phase 1 (2026-11-25). Mockup v2 Indigo: https://claude.ai/artifact/8BHE1J66vSHmZdEVKMBaZV (`design/v2-indigo/`)

## Brief
- **Mã app / thư mục:** `A008-evenlease` → `apps/A008-evenlease/`
- **Repo:** https://github.com/MA-Global-VN/P_evenlease · **Bundle ID:** chưa chốt — Phương nhắn trước khi lên Play
  (code tạm `com.maglobal.evenlease`, đổi được tới trước lần build store đầu).
- **Một câu mô tả:** chủ nhà lần đầu ở Mỹ chọn người thuê bằng một phương pháp nhất quán: đặt tiêu chí một lần → nhận hồ sơ
  → xác minh theo phiếu gọi + giấy tờ + báo cáo ngoài → chấm mọi người trên cùng một bảng → quyết định, lưu lý do, thư từ chối đúng luật.
- **Người dùng mục tiêu:** chủ nhà ở Mỹ lần đầu / mới cho thuê (1–vài căn), tự quản lý, không qua môi giới.
- **Kiếm tiền:** 1.0.0 **miễn phí toàn bộ**, không quảng cáo, không mua trong app, **không dựng code Pro**; mô hình thu phí Phương chốt sau.
  Không hứa "free forever".
- **Nền tảng:** Android + iOS, tất cả tính năng trong 1 bản; điện thoại trước, máy tính bảng dùng được.
- **Ngôn ngữ / tiền tệ / vùng:** chỉ tiếng Anh (i18n dựng sẵn), USD, Mỹ.
- **Khác đối thủ ở đâu:** TurboTenant / RentRedi / Zillow chỉ thu đơn + bán báo cáo; Evenlease là **phương pháp quyết định**:
  tiêu chí cố định có rào chắn luật, trạng thái Khách khai / Đã xác minh / Lệch, phiếu gọi tham chiếu chống người giả,
  so sánh hoặc xét theo thứ tự nộp, lưu lý do + thư FCRA. Offline, không tài khoản, mở là chạy.
- **Cố ý không làm:** không đăng tin, không thu tiền nhà, không bán / kéo báo cáo tín dụng, không điểm tổng, không khuyên
  nhận / loại, không tự quyết thay chủ nhà, không tư vấn pháp lý ("not legal advice" trên mọi màn quyết định / thư).

## Luật nghiệp vụ đã chốt (grill 2026-11-23…25)
- Đơn vào app 3 cách: chủ nhà nhập tay · **đưa máy cho khách tự điền** (thoát bằng vân tay/PIN, khách không thấy hồ sơ khác) ·
  **PDF đơn trống** in ra rồi nhập lại + đính ảnh. Đơn 7 phần theo mẫu Zillow; **không hỏi SSN, không hỏi ngày sinh**.
- Chấm bằng luật trên máy: mỗi tiêu chí Đạt / Không đạt / Thiếu + Khách khai / Đã xác minh (nguồn, ngày) / Lệch. Không AI.
- Mỗi căn 1 chế độ: **So sánh** (mặc định) hoặc **Theo thứ tự nộp** (Seattle: dấu giờ, lần lượt, 72 h bổ sung, 48 h trả lời).
- Tiền án là **bước 2**, chỉ mở sau đề nghị có điều kiện; chỉ "cần đánh giá riêng", không bao giờ tự loại.
- Tín dụng / lý lịch: dẫn ra dịch vụ ngoài (MySmartMove, Checkr…), nhập kết quả chính + PDF + thông tin công ty báo cáo.
- Từ chối / đòi cọc cao / đòi người bảo lãnh có dựa vào báo cáo → app bắt tạo thư FCRA (mẫu FTC).
- Bản 1.0 có thêm: thư từ chối / đề nghị / chấp nhận + PDF hồ sơ quyết định · checklist ngày giao nhà.
- Bản 1.0 không có: link đơn online, đơn chung cả hộ, bộ câu lọc trước, AI, tích hợp API báo cáo, luật riêng từng bang tự động.

## Công nghệ
- **FE:** React Native + Expo (TypeScript), expo-router — dùng lại khung A006/A007.
- **BE:** không có (không server, không mạng, không tài khoản).
- **DB:** SQLite trên máy (expo-sqlite + Drizzle); tiền lưu số nguyên (cent). Ảnh/PDF giấy tờ trong thư mục app.
- **Sao lưu:** 1 file mã hoá (dữ liệu + ảnh), tự ghi vào thư mục Drive/iCloud chủ nhà chọn (như A006), nút tay, nhắc > 30 ngày, khôi phục.
- **Native dự kiến:** expo-local-authentication · expo-image-picker · expo-document-picker · expo-print + expo-sharing ·
  expo-file-system · expo-notifications (local: đồng hồ 72 h/48 h, nhắc sao lưu / xoá) · ô ký tay (chốt ở Phase 1A).
- **Build:** EAS Build (tài khoản Expo đã đăng nhập). Thử Android trên Galaxy A13 qua adb; iOS qua EAS + Appetize.

## Cách làm app này
- Phương yêu cầu phiên điều phối + phiên con song song theo `PLAN.md`; phiên điều phối giao hết việc cho phiên con.
- Cấp trên của phiên điều phối: phiên grill A008 này — nhận câu hỏi, việc bị chặn, báo cáo phase; hỏi Phương bằng popup.

## Lệnh hay dùng
- Test: `npx jest` · Kiểm: `npx expo lint` + `npx tsc --noEmit` · Cài máy: `npx expo run:android --device`

## Lưu ý dễ vấp của app (mỗi ý 1 dòng)
- Dữ liệu người xin thuê là dữ liệu nhạy cảm: không log ra console, không đưa vào crash report, xoá hẳn được (FTC Disposal Rule).
- Chữ trên store / trong app không được hứa "fair housing compliant" hay "legal" — chỉ "helps you apply the same criteria".

## Retro (điền khi nộp store, 3 dòng)
- Chậm nhất ở đâu, vì sao:
- Thứ tái dùng được cho app sau:
- Cải tiến đề xuất cho Playbook:
