import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  total: number;
  created_at: string;
  notes: string | null;
  barbers: { name: string };
  payment_methods: { name: string };
}

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState('today');

  useEffect(() => {
    loadTransactions();
  }, [filterPeriod]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          barbers(name),
          payment_methods(name)
        `)
        .order('created_at', { ascending: false });

      const now = new Date();
      
      if (filterPeriod === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        query = query.gte('created_at', startOfDay.toISOString());
      } else if (filterPeriod === 'week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - 7));
        query = query.gte('created_at', startOfWeek.toISOString());
      } else if (filterPeriod === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query = query.gte('created_at', startOfMonth.toISOString());
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
    const headers = ['Data', 'Barbeiro', 'Total', 'Pagamento', 'Observações'];
    const rows = transactions.map(t => [
      format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      t.barbers.name,
      `R$ ${Number(t.total).toFixed(2)}`,
      t.payment_methods.name,
      t.notes || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">Histórico de transações</p>
        </div>
        <Button onClick={exportToCSV} disabled={transactions.length === 0}>
          <FileDown className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filtrar por Período</CardTitle>
            <div className="w-[200px]">
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Últimos 7 dias</SelectItem>
                  <SelectItem value="month">Este mês</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between rounded-lg bg-secondary p-4">
            <span className="text-sm font-medium">Total do Período</span>
            <span className="text-xl font-bold text-primary">
              R$ {totalRevenue.toFixed(2)}
            </span>
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
                    <TableHead>Total</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm', {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>{transaction.barbers.name}</TableCell>
                      <TableCell className="font-medium">
                        R$ {Number(transaction.total).toFixed(2)}
                      </TableCell>
                      <TableCell>{transaction.payment_methods.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {transaction.notes || '-'}
                      </TableCell>
                    </TableRow>
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
