import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Transaction {
  id: string;
  total: number;
  created_at: string;
  notes: string | null;
  barbers: { id: string; name: string };
  payment_methods: { name: string };
  transaction_items: Array<{
    type: string;
    quantity: number;
    price: number;
    commission: number;
    services?: { name: string };
    inventory_items?: { name: string };
  }>;
}

interface Barber {
  id: string;
  name: string;
}

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState('today');
  const [filterBarber, setFilterBarber] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadBarbers();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [filterPeriod, filterBarber, startDate, endDate]);

  const loadBarbers = async () => {
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setBarbers(data || []);
    } catch (error) {
      console.error('Error loading barbers:', error);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          barbers(id, name),
          payment_methods(name),
          transaction_items(
            type,
            quantity,
            price,
            commission,
            services(name),
            inventory_items(name)
          )
        `)
        .order('created_at', { ascending: false });

      const now = new Date();
      
      if (filterPeriod === 'custom' && startDate && endDate) {
        query = query
          .gte('created_at', new Date(startDate).toISOString())
          .lte('created_at', new Date(endDate + 'T23:59:59').toISOString());
      } else if (filterPeriod === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        query = query.gte('created_at', startOfDay.toISOString());
      } else if (filterPeriod === 'week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - 7));
        query = query.gte('created_at', startOfWeek.toISOString());
      } else if (filterPeriod === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query = query.gte('created_at', startOfMonth.toISOString());
      }

      if (filterBarber !== 'all') {
        query = query.eq('barber_id', filterBarber);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Barbeiro', 'Tipo', 'Item', 'Qtd', 'Preço', 'Total', 'Comissão', 'Pagamento'];
    const rows: any[] = [];

    transactions.forEach(t => {
      t.transaction_items.forEach(item => {
        const itemName = item.type === 'SERVICE' 
          ? item.services?.name || 'Serviço'
          : item.inventory_items?.name || 'Produto';
        
        rows.push([
          format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
          t.barbers.name,
          item.type === 'SERVICE' ? 'Serviço' : 'Produto',
          itemName,
          item.quantity,
          `R$ ${Number(item.price).toFixed(2)}`,
          `R$ ${(Number(item.price) * item.quantity).toFixed(2)}`,
          `R$ ${(Number(item.commission) * item.quantity).toFixed(2)}`,
          t.payment_methods.name,
        ]);
      });
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Relatório exportado!');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório de Transações', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Período: ${filterPeriod === 'custom' && startDate && endDate 
      ? `${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}`
      : filterPeriod === 'today' ? 'Hoje' 
      : filterPeriod === 'week' ? 'Últimos 7 dias' 
      : filterPeriod === 'month' ? 'Este mês' : 'Todos'}`, 14, 30);
    
    const tableData: any[] = [];
    transactions.forEach(t => {
      t.transaction_items.forEach(item => {
        const itemName = item.type === 'SERVICE' 
          ? item.services?.name || 'Serviço'
          : item.inventory_items?.name || 'Produto';
        
        tableData.push([
          format(new Date(t.created_at), 'dd/MM HH:mm', { locale: ptBR }),
          t.barbers.name,
          item.type === 'SERVICE' ? 'Serv.' : 'Prod.',
          itemName,
          item.quantity,
          `R$ ${Number(item.price).toFixed(2)}`,
          `R$ ${(Number(item.commission) * item.quantity).toFixed(2)}`,
        ]);
      });
    });

    autoTable(doc, {
      head: [['Data', 'Barbeiro', 'Tipo', 'Item', 'Qtd', 'Preço', 'Comissão']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 35;
    doc.setFontSize(12);
    doc.text(`Total: R$ ${totalRevenue.toFixed(2)}`, 14, finalY + 10);
    doc.text(`Comissões: R$ ${totalCommission.toFixed(2)}`, 14, finalY + 17);

    doc.save(`relatorio-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF gerado!');
  };

  const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.total), 0);
  
  const totalCommission = transactions.reduce((sum, t) => 
    sum + t.transaction_items.reduce((itemSum, item) => 
      itemSum + (Number(item.commission) * item.quantity), 0
    ), 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">Análise detalhada de transações</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} disabled={transactions.length === 0} variant="outline">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button onClick={exportToPDF} disabled={transactions.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={filterPeriod} onValueChange={(value) => {
                setFilterPeriod(value);
                if (value !== 'custom') {
                  setStartDate('');
                  setEndDate('');
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Últimos 7 dias</SelectItem>
                  <SelectItem value="month">Este mês</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {filterPeriod === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label>Barbeiro</Label>
              <Select value={filterBarber} onValueChange={setFilterBarber}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Barbeiros</SelectItem>
                  {barbers.map((barber) => (
                    <SelectItem key={barber.id} value={barber.id}>
                      {barber.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
              <span className="text-sm font-medium">Receita Total</span>
              <span className="text-xl font-bold text-primary">
                R$ {totalRevenue.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
              <span className="text-sm font-medium">Comissões Totais</span>
              <span className="text-xl font-bold text-primary">
                R$ {totalCommission.toFixed(2)}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma transação encontrada
            </div>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Barbeiro</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Preço Unit.</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    transaction.transaction_items.map((item, idx) => {
                      const itemName = item.type === 'SERVICE' 
                        ? item.services?.name || 'Serviço'
                        : item.inventory_items?.name || 'Produto';
                      
                      return (
                        <TableRow key={`${transaction.id}-${idx}`}>
                          {idx === 0 && (
                            <>
                              <TableCell rowSpan={transaction.transaction_items.length}>
                                {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm', {
                                  locale: ptBR,
                                })}
                              </TableCell>
                              <TableCell rowSpan={transaction.transaction_items.length}>
                                {transaction.barbers.name}
                              </TableCell>
                            </>
                          )}
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              item.type === 'SERVICE' 
                                ? 'bg-primary/10 text-primary' 
                                : 'bg-secondary text-secondary-foreground'
                            }`}>
                              {item.type === 'SERVICE' ? 'Serviço' : 'Produto'}
                            </span>
                          </TableCell>
                          <TableCell>{itemName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell className="font-medium">
                            R$ {Number(item.price).toFixed(2)}
                          </TableCell>
                          <TableCell className="font-medium">
                            R$ {(Number(item.price) * item.quantity).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            R$ {(Number(item.commission) * item.quantity).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
