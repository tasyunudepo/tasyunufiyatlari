\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

SELECT outcome
FROM public.submit_quote_guarded(
  '{
    "customer_name":"Eşzamanlı Test",
    "customer_email":"",
    "customer_phone":"05321234567",
    "customer_company":"",
    "customer_address":"",
    "material_type":"eps",
    "brand_id":1,
    "brand_name":"Dalmaçyalı",
    "model_name":"EPS Levha",
    "thickness_cm":5,
    "area_m2":400,
    "city_code":"34",
    "city_name":"İstanbul",
    "package_name":"EPS Sistem Paketi",
    "package_description":"",
    "plate_brand_name":"Dalmaçyalı",
    "accessory_brand_name":"Dalmaçyalı",
    "total_price":120000,
    "price_per_m2":250,
    "shipping_cost":0,
    "discount_percentage":0,
    "price_without_vat":100000,
    "vat_amount":20000,
    "package_count":80,
    "package_size_m2":5,
    "items_per_package":1,
    "vehicle_type":"none",
    "lorry_capacity_packages":null,
    "truck_capacity_packages":null,
    "lorry_fill_percentage":null,
    "truck_fill_percentage":null,
    "package_items":{},
    "request_type":"whatsapp_order",
    "source_channel":"wizard",
    "kvkk_consent":true,
    "consent_version":"kvkk-teklif-v1",
    "consent_purpose":"fiyat_teklifi_ve_iletisim",
    "consent_channel":"wizard"
  }'::jsonb,
  repeat('a', 64),
  repeat('b', 64),
  repeat('c', 64),
  repeat('d', 64)
);

