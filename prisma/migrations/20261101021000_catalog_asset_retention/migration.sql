-- A referenced product image/model must be detached deliberately before physical deletion.
-- Normal project Trash and restart use logical retention; no object bytes are deleted here.
ALTER TABLE "Product" DROP CONSTRAINT "Product_imageAssetId_fkey";
ALTER TABLE "Product" DROP CONSTRAINT "Product_modelAssetId_fkey";
ALTER TABLE "Product" ADD CONSTRAINT "Product_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_modelAssetId_fkey" FOREIGN KEY ("modelAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
