# DealHub — Shopee Affiliate Storefront & Analytics

Website frontend triển khai trên Vercel, gồm:

- `index.html`: trang tổng hợp sản phẩm affiliate Shopee.
- `dashboard.html`: dashboard click, đơn hàng, doanh thu, hoa hồng, content và sản phẩm.
- `data/products.json`: danh sách sản phẩm mặc định.
- `data/site-config.json`: cấu hình nguồn dữ liệu và tracking endpoint.
- `data/demo-conversions.csv`: file mẫu để kiểm thử import.

Backend production sử dụng Vercel Serverless Functions + Supabase. Xem `../SUPABASE_SETUP.md`.

## Cách chạy

Mở bằng static server thay vì mở trực tiếp bằng `file://`:

```bash
python3 -m http.server 8080
```

Sau đó truy cập:

- Storefront: `http://localhost:8080/shopee-affiliate/`
- Dashboard: `http://localhost:8080/shopee-affiliate/dashboard.html`

## Thay sản phẩm thật

Sửa `data/products.json`. Các trường chính:

```json
{
  "id": "ma-san-pham-noi-bo",
  "name": "Tên sản phẩm",
  "category": "Danh mục",
  "price": 189000,
  "oldPrice": 249000,
  "rating": 4.8,
  "sold": 1260,
  "badge": "BÁN CHẠY",
  "note": "Lý do nên cân nhắc",
  "proof": "1,2k+ lượt bán · 4,8/5",
  "image": "https://...",
  "affiliateUrl": "https://s.shopee.vn/...",
  "featured": 10
}
```

Có thể dùng Google Sheet đã Publish to web dưới dạng CSV bằng cách điền URL vào `productFeedUrl` trong `data/site-config.json`. Tên cột của Sheet nên trùng với các trường trên.

## Tracking theo content

Quy ước đề xuất khi tạo Custom Link trên Shopee Affiliate:

| Trường | Ý nghĩa | Ví dụ |
|---|---|---|
| Sub ID 1 | Kênh | `facebook` |
| Sub ID 2 | Content ID | `gao-ep01-a` |
| Sub ID 3 | Format | `reel` |
| Sub ID 4 | Chiến dịch | `gao-series` |
| Sub ID 5 | Phiên bản | `v1` |

Mở tab **Kế hoạch Sub ID** trong dashboard để tạo và tải CSV batch plan.

Storefront cũng đọc các tham số URL như:

```text
?utm_source=facebook&utm_medium=reel&utm_campaign=gao-series&utm_content=gao-ep01-a&variant=v1
```

Click được lưu trong `localStorage` của trình duyệt. Nếu cần thu click từ tất cả người dùng, điền một serverless webhook vào `trackingEndpoint` hoặc cấu hình GA4 trong lớp triển khai tiếp theo.

## Nhập báo cáo Shopee

Dashboard nhận `.xlsx`, `.xls`, `.csv`, `.json` và tự dò các tên cột phổ biến bằng tiếng Việt/Anh, gồm:

- ngày đặt hàng / conversion time;
- Sub ID 1–5;
- product/item ID và tên sản phẩm;
- click/conversion/order;
- giá trị đơn hàng/GMV;
- hoa hồng/estimated commission;
- trạng thái đơn.

Dữ liệu import chỉ được lưu trong trình duyệt bằng `localStorage`; không commit dữ liệu đơn hàng lên GitHub.

## Giới hạn của bản GitHub Pages

- Không tự gọi Shopee Affiliate API bằng secret ở frontend.
- Không đồng bộ báo cáo giữa nhiều thiết bị nếu chưa có backend.
- Để tự động hóa hoàn toàn, cần một serverless backend giữ App Secret, định kỳ lấy conversion report rồi trả về dữ liệu đã chuẩn hóa cho dashboard.

Tuyệt đối không đưa Shopee App Secret, access token hoặc khóa API vào repository public.
