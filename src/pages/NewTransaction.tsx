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

interface Product {
  id: string;
  name: string;
  quantity: number;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface TransactionItem {
  type: 'SERVICE' | 'PRODUCT';
  serviceId?: string;
  productId?: string;
  quantity: number;
  price: number;
  commission: number;
}

export default function NewTransaction() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [barbersData, servicesData, productsData, paymentMethodsData] = await Promise.all([
        supabase.from('barbers').select('*').eq('active', true),
        supabase.from('services').select('*').eq('active', true),
        supabase.from('inventory_items').select('id, name, quantity').gt('quantity', 0),
        supabase.from('payment_methods').select('*').eq('active', true),
      ]);

      if (barbersData.data) setBarbers(barbersData.data);
      if (servicesData.data) setServices(servicesData.data);
      if (productsData.data) setProducts(productsData.data);
      if (paymentMethodsData.data) setPaymentMethods(paymentMethodsData.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const addItem = (type: 'SERVICE' | 'PRODUCT') => {
    if (type === 'SERVICE' && services.length > 0) {
      setItems([
        ...items,
        { 
          type: 'SERVICE', 
          serviceId: services[0].id, 
          quantity: 1, 
          price: services[0].price,
          commission: 0
        },
      ]);
    } else if (type === 'PRODUCT' && products.length > 0) {
      setItems([
        ...items,
        { 
          type: 'PRODUCT', 
          productId: products[0].id, 
          quantity: 1, 
          price: 0,
          commission: 5
        },
      ]);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof TransactionItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'serviceId' && updated[index].type === 'SERVICE') {
      const service = services.find(s => s.id === value);
      if (service) {
        updated[index].price = service.price;
      }
    }
    
    setItems(updated);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateCommission = () => {
    return items.reduce((sum, item) => sum + (item.commission * item.quantity), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBarberId || !selectedPaymentMethodId || items.length === 0) {
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

      const itemsToInsert = items.map(item => ({
        transaction_id: transaction.id,
        type: item.type,
        service_id: item.type === 'SERVICE' ? item.serviceId : null,
        inventory_item_id: item.type === 'PRODUCT' ? item.productId : null,
        price: item.price,
        quantity: item.quantity,
        commission: item.commission,
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success('Transação registrada com sucesso!');
      navigate('/');
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      toast.error(error.message || 'Erro ao registrar transação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nova Transação</h1>
        <p className="text-muted-foreground">Registre serviços e vendas de produtos</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Detalhes da Transação</CardTitle>
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
                <Label>Itens *</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => addItem('SERVICE')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Serviço
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => addItem('PRODUCT')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Produto
                  </Button>
                </div>
              </div>
              
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-xs font-medium text-muted-foreground w-16">
                    {item.type === 'SERVICE' ? 'Serviço' : 'Produto'}
                  </span>
                  
                  {item.type === 'SERVICE' ? (
                    <Select
                      value={item.serviceId}
                      onValueChange={(value) => updateItem(index, 'serviceId', value)}
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
                  ) : (
                    <>
                      <Select
                        value={item.productId}
                        onValueChange={(value) => updateItem(index, 'productId', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} (Estoque: {product.quantity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value))}
                        className="w-24"
                        placeholder="Preço"
                      />
                    </>
                  )}
                  
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                    className="w-20"
                  />
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
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

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-4">
                <span className="text-lg font-medium">Total</span>
                <span className="text-2xl font-bold text-primary">
                  R$ {calculateTotal().toFixed(2)}
                </span>
              </div>
              {calculateCommission() > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
                  <span className="text-sm font-medium">Comissão do Barbeiro</span>
                  <span className="text-lg font-bold text-primary">
                    R$ {calculateCommission().toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/')} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Salvando...' : 'Registrar Transação'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
