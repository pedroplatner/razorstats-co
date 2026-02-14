import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, UserCheck, UserX, Pencil } from 'lucide-react';

interface Barber {
  id: string;
  name: string;
  active: boolean;
}

export default function Barbers() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBarber, setNewBarber] = useState({ name: '' });
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
      const { error } = await supabase.from('barbers').insert(newBarber);
      if (error) throw error;

      toast.success('Barbeiro adicionado com sucesso!');
      setDialogOpen(false);
      setNewBarber({ name: '' });
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
        .update({ name: editingBarber.name })
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={newBarber.name}
                  onChange={(e) => setNewBarber({ name: e.target.value })}
                  placeholder="Nome do barbeiro"
                />
              </div>
              <Button onClick={handleAdd} className="w-full">
                Adicionar
              </Button>
            </div>
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
            <CardContent>
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
          {editingBarber && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome *</Label>
                <Input
                  id="edit-name"
                  value={editingBarber.name}
                  onChange={(e) =>
                    setEditingBarber({ ...editingBarber, name: e.target.value })
                  }
                  placeholder="Nome do barbeiro"
                />
              </div>
              <Button onClick={handleEdit} className="w-full">
                Salvar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
