-- Allow null product_id in quotation_line_items for custom/manual items
ALTER TABLE quotation_line_items ALTER COLUMN product_id DROP NOT NULL;
