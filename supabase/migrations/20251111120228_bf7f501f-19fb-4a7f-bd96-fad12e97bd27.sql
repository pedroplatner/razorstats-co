-- Corrigir função para incluir search_path (segurança)
CREATE OR REPLACE FUNCTION update_inventory_on_product_sale()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;