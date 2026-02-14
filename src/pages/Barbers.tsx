import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, UserCheck, UserX, Pencil, Phone, Percent } from 'lucide-react';

interface Barber {
  id: string;
  name: string;
  active: boolean;
  phone: string | null;
  commission_percent: number;
}

export default function Barbers() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBarber, setNewBarber] = useState({ name: '', phone: '', commission_percent: 50 });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);

  useEffect(() => {
    loadBarbers();
  }, []);

  const loadBarbers = async () => {
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('*')
        .order('name');

      if (error) throw error;
      setBarbers(data || []);
    } catch (error) {
      console.error('Error loading barbers:', error);
      toast.error('Erro ao carregar barbeiros');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newBarber.name.trim()) {
      toast.error('Digite o nome do barbeiro');
      return;
    }

    try {
      const { error } = await supabase.from('barbers').insert({
        name: newBarber.name,
        phone: newBarber.phone || null,
        commission_percent: newBarber.commission_percent,
      });
      if (error) throw error;

      toast.success('Barbeiro adicionado com sucesso!');
      setDialogOpen(false);
      setNewBarber({ name: '', phone: '', commission_percent: 50 });
      loadBarbers();
    } catch (error: any) {
      console.error('Error adding barber:', error);
      toast.error(error.message || 'Erro ao adicionar barbeiro');
    }
  };

  const handleEdit = async () => {
    if (!editingBarber || !editingBarber.name.trim()) {
      toast.error('Digite o nome do barbeiro');
      return;
    }

    try {
      const { error } = await supabase
        .from('barbers')
        .update({
          name: editingBarber.name,
          phone: editingBarber.phone || null,
          commission_percent: editingBarber.commission_percent,
        })
        .eq('id', editingBarber.id);

      if (error) throw error;

      toast.success('Barbeiro atualizado com sucesso!');
      setEditDialogOpen(false);
      setEditingBarber(null);
      loadBarbers();
    } catch (error: any) {
      console.error('Error updating barber:', error);
      toast.error(error.message || 'Erro ao atualizar barbeiro');
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('barbers')
        .update({ active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      loadBarbers();
      toast.success(currentActive ? 'Barbeiro desativado' : 'Barbeiro ativado');
    } catch (error: any) {
      console.error('Error toggling barber:', error);
      toast.error(error.message || 'Erro ao atualizar barbeiro');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const barberFormFields = (
    values: { name: string; phone: string; commission_percent: number },
    onChange: (field: string, value: any) => void
  ) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Nome do barbeiro"
        />
      </div>
      <div className="space-y-2">
        <Label>Telefone</Label>
        <Input
          value={values.phone}
          onChange={(e) => onChange('phone', e.target.value)}
          placeholder="(00) 00000-0000"
        />
      </div>
      <div className="space-y-2">
        <Label>Comissão (%)</Label>
        <Input
          type="number"
          min="0"
          max="100"
          value={values.commission_percent}
          onChange={(e) => onChange('commission_percent', parseFloat(e.target.value) || 0)}
          placeholder="50"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Barbeiros</h1>
          <p className="text-muted-foreground">Gerencie sua equipe</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Barbeiro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Barbeiro</DialogTitle>
            </DialogHeader>
            {barberFormFields(newBarber, (field, value) =>
              setNewBarber((prev) => ({ ...prev, [field]: value }))
            )}
            <Button onClick={handleAdd} className="w-full">
              Adicionar
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {barbers.map((barber) => (
          <Card key={barber.id} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{barber.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setEditingBarber({ ...barber });
                    setEditDialogOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {barber.active ? (
                  <UserCheck className="h-4 w-4 text-primary" />
                ) : (
                  <UserX className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {barber.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{barber.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Percent className="h-3.5 w-3.5" />
                <span>Comissão: {barber.commission_percent}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {barber.active ? 'Ativo' : 'Inativo'}
                </span>
                <Switch
                  checked={barber.active}
                  onCheckedChange={() => toggleActive(barber.id, barber.active)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Barbeiro</DialogTitle>
          </DialogHeader>
          {editingBarber &&
            barberFormFields(
              {
                name: editingBarber.name,
                phone: editingBarber.phone || '',
                commission_percent: editingBarber.commission_percent,
              },
              (field, value) =>
                setEditingBarber((prev) => (prev ? { ...prev, [field]: value } : prev))
            )}
          <Button onClick={handleEdit} className="w-full">
            Salvar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
