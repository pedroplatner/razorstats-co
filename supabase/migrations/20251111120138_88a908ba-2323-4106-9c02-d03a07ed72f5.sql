-- Criar enum para tipo de item de transação
CREATE TYPE transaction_item_type AS ENUM ('SERVICE', 'PRODUCT');

-- Adicionar campos em transaction_items para suportar produtos
ALTER TABLE transaction_items 
  ADD COLUMN type transaction_item_type NOT NULL DEFAULT 'SERVICE',
  ADD COLUMN inventory_item_id uuid REFERENCES inventory_items(id),
  ADD COLUMN commission numeric DEFAULT 0;

-- Tornar service_id nullable já que produtos não têm service_id
ALTER TABLE transaction_items ALTER COLUMN service_id DROP NOT NULL;

-- Adicionar constraint para garantir integridade dos dados
ALTER TABLE transaction_items 
  ADD CONSTRAINT check_item_type 
  CHECK (
    (type = 'SERVICE' AND service_id IS NOT NULL AND inventory_item_id IS NULL) OR
    (type = 'PRODUCT' AND inventory_item_id IS NOT NULL AND service_id IS NULL)
  );

-- Trigger para atualizar estoque automaticamente quando produto é vendido
CREATE OR REPLACE FUNCTION update_inventory_on_product_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'PRODUCT' AND NEW.inventory_item_id IS NOT NULL THEN
    -- Atualizar quantidade no estoque
    UPDATE inventory_items 
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.inventory_item_id;
    
    -- Registrar movimento de estoque
    INSERT INTO inventory_movements (item_id, type, quantity, created_by, notes)
    VALUES (
      NEW.inventory_item_id, 
      'out', 
      NEW.quantity,
      (SELECT created_by FROM transactions WHERE id = NEW.transaction_id),
      'Venda automática - Transaction ID: ' || NEW.transaction_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_on_product_sale
AFTER INSERT ON transaction_items
FOR EACH ROW
EXECUTE FUNCTION update_inventory_on_product_sale();

-- Atualizar a política RLS para permitir que usuários visualizem itens de inventário
CREATE POLICY "Authenticated users can view inventory"
ON inventory_items FOR SELECT
TO authenticated
USING (true);