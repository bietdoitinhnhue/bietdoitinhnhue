# DealHub — Supabase + Vercel Serverless Setup

## Kiến trúc

```text
Facebook / TikTok / YouTube / Threads
                ↓ UTM + Sub ID
         Storefront DealHub
                ↓ POST /api/track
       Vercel Serverless Functions
                ↓ service-role secret
             Supabase DB
                ↓ admin token
          Analytics Dashboard
```

Trình duyệt không nhận `SUPABASE_SERVICE_ROLE_KEY`. Dashboard token chỉ được giữ trong `sessionStorage` và gửi tới API cùng domain.

## 1. Tạo Supabase database

1. Tạo project Supabase.
2. Mở **SQL Editor**.
3. Chạy toàn bộ file `supabase/schema.sql`.
4. Kiểm tra 4 bảng: `products`, `affiliate_links`, `click_events`, `conversions`.

RLS đã được bật và quyền `anon`/`authenticated` bị thu hồi. Chỉ Vercel Functions dùng service-role mới truy cập được dữ liệu.

## 2. Cấu hình secret trên Vercel

Vào **Project → Settings → Environment Variables**, thêm:

| Variable | Nội dung |
|---|---|
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key, chỉ lưu trên Vercel |
| `DASHBOARD_ADMIN_TOKEN` | Token dài, dùng đăng nhập dashboard |
| `TRACKING_SALT` | Chuỗi bí mật khác để hash IP/client ID |

Tạo token ngẫu nhiên bằng:

```bash
openssl rand -hex 32
```

Tạo hai token riêng cho `DASHBOARD_ADMIN_TOKEN` và `TRACKING_SALT`. Không commit `.env` thật lên GitHub.

## 3. Redeploy

Sau khi thêm biến môi trường, redeploy Production trên Vercel. Kiểm tra:

- `/api/products` trả JSON.
- Storefront vẫn chạy nếu DB chưa có sản phẩm vì có fallback tĩnh.
- Dashboard → **Kết nối DB** → nhập `DASHBOARD_ADMIN_TOKEN`.
- Vào **Quản lý link** → chọn **Khởi tạo 7 sản phẩm** để đưa catalog hiện tại vào Supabase.

## 4. Tracking social

Ví dụ link gắn vào Facebook Reel:

```text
https://bietdoitinhnhue.com/shopee-affiliate?utm_source=facebook&utm_medium=reel&utm_campaign=gao-series&utm_content=gao-ep01-a&variant=v1
```

Quy ước:

- `utm_source`: Facebook, TikTok, YouTube, Threads...
- `utm_medium`: reel, short, post, story...
- `utm_campaign`: chiến dịch.
- `utm_content`: mã duy nhất của video/bài đăng.
- `variant`: phiên bản hook/link.

Khi khách nhấn sản phẩm, `/api/track` lưu kênh, content, format, campaign, sản phẩm và affiliate link. IP chỉ được lưu dưới dạng SHA-256 có salt.

## 5. Hoa hồng Shopee

Xuất Conversion Report từ Shopee Affiliate và nhập tại dashboard. Khi dashboard đã kết nối DB, file sẽ được gửi tới `/api/conversions` và upsert theo `order_id`, tránh trùng đơn.

Để tự động đồng bộ từ Shopee Open API, thêm một Vercel Cron/API riêng sau khi tài khoản được cấp App ID và App Secret. Hai giá trị này cũng phải nằm trong Vercel Environment Variables.
