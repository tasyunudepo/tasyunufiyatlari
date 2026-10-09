-- YALNIZ yerel sentetik veritabanı (scripts/ofis-test). "Taşıma günü" hâlini
-- kurar: tablolar var, proje ve iş yok, teklifler bağsız.
BEGIN;
UPDATE sales_projects SET valuation_quote_id=NULL, valuation_revision=NULL, valuation_net_amount=NULL, valuation_selected_at=NULL, valuation_selected_by=NULL;
DELETE FROM sales_tasks;
DELETE FROM customer_interactions WHERE project_id IS NOT NULL OR operation_id IS NOT NULL;
DELETE FROM office_operations;
UPDATE quotes SET project_id=NULL;
DELETE FROM sales_projects;
-- Sentetik veride bütün teklifler ofis teklifi; ilk temas dalı da sınansın diye
-- beş tek teklifli müşteri site talebine çevrilir.
UPDATE quotes SET request_type='pdf_quote' WHERE quote_code IN ('TE-2026-000005','TE-2026-000006','TE-2026-000007','TE-2026-000008','TE-2026-000027');
COMMIT;
