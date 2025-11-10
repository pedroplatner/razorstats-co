import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, Plus, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unit: string;
  min_quantity: number | null;
}

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState({ name: '', sku: '', quantity: 0, unit: 'un', min_quantity: 0 });
  const [movement, setMovement] = useState({ type: 'in', quantity: 0, notes: '' });
  const { user } = useAuth();

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading inventory:', error);
      toast.error('Erro ao carregar estoque');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    try {
      const { error } = await supabase.from('inventory_items').insert(newItem);
      if (error) throw error;
      
      toast.success('Item adicionado com sucesso!');
      setDialogOpen(false);
      setNewItem({ name: '', sku: '', quantity: 0, unit: 'un', min_quantity: 0 });
      loadItems();
    } catch (error: any) {
      console.error('Error adding item:', error);
      toast.error(error.message || 'Erro ao adicionar item');
    }
  };

  const handleMovement = async () => {
    if (!selectedItem || movement.quantity <= 0) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      const newQuantity = movement.type === 'in' 
        ? selectedItem.quantity + movement.quantity
        : selectedItem.quantity - movement.quantity;

      if (newQuantity < 0) {
        toast.error('Quantidade insuficiente em estoque');
        return;
      }

      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          item_id: selectedItem.id,
          type: movement.type as 'in' | 'out',
          quantity: movement.quantity,
          notes: movement.notes,
          created_by: user!.id,
        });

      if (movementError) throw movementError;

      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ quantity: newQuantity })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      toast.success('Movimentação registrada com sucesso!');
      setMovementDialogOpen(false);
      setSelectedItem(null);
      setMovement({ type: 'in', quantity: 0, notes: '' });
      loadItems();
    } catch (error: any) {
      console.error('Error recording movement:', error);
      toast.error(error.message || 'Erro ao registrar movimentação');
    }
  };

  const lowStockItems = items.filter(
    item => item.min_quantity && item.quantity <= item.min_quantity
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground">Controle de produtos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Item ao Estoque</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={newItem.sku}
                  onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantidade Inicial</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unidade</Label>
                  <Input
                    id="unit"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min">Estoque Mínimo</Label>
                <Input
                  id="min"
                  type="number"
                  min="0"
                  value={newItem.min_quantity}
                  onChange={(e) => setNewItem({ ...newItem, min_quantity: parseFloat(e.target.value) })}
                />
              </div>
              <Button onClick={handleAddItem} className="w-full">
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {lowStockItems.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {lowStockItems.length} {lowStockItems.length === 1 ? 'item está' : 'itens estão'} com estoque baixo
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.name}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {item.quantity} {item.unit}
              </div>
              {item.sku && (
                <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
              )}
              {item.min_quantity && item.quantity <= item.min_quantity && (
                <p className="mt-2 text-xs text-destructive">Estoque baixo!</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => {
                  setSelectedItem(item);
                  setMovementDialogOpen(true);
                }}
              >
                Registrar Movimento
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimentação</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-sm font-medium">{selectedItem.name}</p>
                <p className="text-xs text-muted-foreground">
                  Estoque atual: {selectedItem.quantity} {selectedItem.unit}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Movimentação</Label>
                <Select value={movement.type} onValueChange={(value) => setMovement({ ...movement, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Entrada</SelectItem>
                    <SelectItem value="out">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="move-quantity">Quantidade</Label>
                <Input
                  id="move-quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={movement.quantity}
                  onChange={(e) => setMovement({ ...movement, quantity: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="move-notes">Observações</Label>
                <Input
                  id="move-notes"
                  value={movement.notes}
                  onChange={(e) => setMovement({ ...movement, notes: e.target.value })}
                />
              </div>
              <Button onClick={handleMovement} className="w-full">
                Confirmar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
