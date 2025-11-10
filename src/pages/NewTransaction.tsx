import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Barber {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface ServiceItem {
  serviceId: string;
  quantity: number;
  price: number;
}

export default function NewTransaction() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [barbersData, servicesData, paymentMethodsData] = await Promise.all([
        supabase.from('barbers').select('*').eq('active', true),
        supabase.from('services').select('*').eq('active', true),
        supabase.from('payment_methods').select('*').eq('active', true),
      ]);

      if (barbersData.data) setBarbers(barbersData.data);
      if (servicesData.data) setServices(servicesData.data);
      if (paymentMethodsData.data) setPaymentMethods(paymentMethodsData.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const addServiceItem = () => {
    if (services.length > 0) {
      setServiceItems([
        ...serviceItems,
        { serviceId: services[0].id, quantity: 1, price: services[0].price },
      ]);
    }
  };

  const removeServiceItem = (index: number) => {
    setServiceItems(serviceItems.filter((_, i) => i !== index));
  };

  const updateServiceItem = (index: number, field: keyof ServiceItem, value: any) => {
    const updated = [...serviceItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'serviceId') {
      const service = services.find(s => s.id === value);
      if (service) {
        updated[index].price = service.price;
      }
    }
    
    setServiceItems(updated);
  };

  const calculateTotal = () => {
    return serviceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBarberId || !selectedPaymentMethodId || serviceItems.length === 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      const total = calculateTotal();

      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          barber_id: selectedBarberId,
          payment_method_id: selectedPaymentMethodId,
          total,
          notes,
          created_by: user!.id,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      const itemsToInsert = serviceItems.map(item => ({
        transaction_id: transaction.id,
        service_id: item.serviceId,
        price: item.price,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success('Atendimento registrado com sucesso!');
      navigate('/');
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      toast.error(error.message || 'Erro ao registrar atendimento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Novo Atendimento</h1>
        <p className="text-muted-foreground">Registre um novo atendimento</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Detalhes do Atendimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="barber">Barbeiro *</Label>
              <Select value={selectedBarberId} onValueChange={setSelectedBarberId}>
                <SelectTrigger id="barber">
                  <SelectValue placeholder="Selecione o barbeiro" />
                </SelectTrigger>
                <SelectContent>
                  {barbers.map((barber) => (
                    <SelectItem key={barber.id} value={barber.id}>
                      {barber.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Serviços *</Label>
                <Button type="button" size="sm" onClick={addServiceItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Serviço
                </Button>
              </div>
              
              {serviceItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Select
                    value={item.serviceId}
                    onValueChange={(value) => updateServiceItem(index, 'serviceId', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - R$ {service.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateServiceItem(index, 'quantity', parseInt(e.target.value))}
                    className="w-20"
                  />
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeServiceItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment">Forma de Pagamento *</Label>
              <Select value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId}>
                <SelectTrigger id="payment">
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações sobre o atendimento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-4">
              <span className="text-lg font-medium">Total</span>
              <span className="text-2xl font-bold text-primary">
                R$ {calculateTotal().toFixed(2)}
              </span>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/')} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Salvando...' : 'Registrar Atendimento'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
