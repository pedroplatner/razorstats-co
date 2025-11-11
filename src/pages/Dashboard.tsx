import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, TrendingUp, Calendar, AlertTriangle, Award } from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';

interface Stats {
  dailyRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  dailyTransactions: number;
  activeBarbers: number;
  dailyCommission: number;
  weeklyCommission: number;
  monthlyCommission: number;
}

interface ChartData {
  date: string;
  revenue: number;
}

interface TopBarber {
  name: string;
  revenue: number;
  transactions: number;
}

interface RecentTransaction {
  id: string;
  barbers: { name: string };
  total: number;
  created_at: string;
}

interface LowStockItem {
  name: string;
  quantity: number;
  min_quantity: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    dailyRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    dailyTransactions: 0,
    activeBarbers: 0,
    dailyCommission: 0,
    weeklyCommission: 0,
    monthlyCommission: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [topBarbers, setTopBarbers] = useState<TopBarber[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      await Promise.all([
        loadStats(),
        loadChartData(),
        loadTopBarbers(),
        loadRecentTransactions(),
        loadLowStockItems(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const now = new Date();
      const today = startOfDay(now);
      const weekStart = startOfWeek(now, { locale: ptBR });
      const monthStart = startOfMonth(now);

      // Active barbers
      const { data: barbersData } = await supabase
        .from('barbers')
        .select('id')
        .eq('active', true);
      
      const activeBarbers = barbersData?.length || 0;

      // Daily data
      const { data: dailyData } = await supabase
        .from('transactions')
        .select('total, transaction_items(commission, quantity)')
        .gte('created_at', today.toISOString());

      const dailyRevenue = dailyData?.reduce((sum, t) => sum + Number(t.total), 0) || 0;
      const dailyTransactions = dailyData?.length || 0;
      const dailyCommission = dailyData?.reduce((sum, t) => 
        sum + (t.transaction_items?.reduce((itemSum: number, item: any) => 
          itemSum + (Number(item.commission) * item.quantity), 0) || 0), 0) || 0;

      // Weekly data
      const { data: weeklyData } = await supabase
        .from('transactions')
        .select('total, transaction_items(commission, quantity)')
        .gte('created_at', weekStart.toISOString());

      const weeklyRevenue = weeklyData?.reduce((sum, t) => sum + Number(t.total), 0) || 0;
      const weeklyCommission = weeklyData?.reduce((sum, t) => 
        sum + (t.transaction_items?.reduce((itemSum: number, item: any) => 
          itemSum + (Number(item.commission) * item.quantity), 0) || 0), 0) || 0;

      // Monthly data
      const { data: monthlyData } = await supabase
        .from('transactions')
        .select('total, transaction_items(commission, quantity)')
        .gte('created_at', monthStart.toISOString());

      const monthlyRevenue = monthlyData?.reduce((sum, t) => sum + Number(t.total), 0) || 0;
      const monthlyCommission = monthlyData?.reduce((sum, t) => 
        sum + (t.transaction_items?.reduce((itemSum: number, item: any) => 
          itemSum + (Number(item.commission) * item.quantity), 0) || 0), 0) || 0;

      setStats({
        dailyRevenue,
        weeklyRevenue,
        monthlyRevenue,
        dailyTransactions,
        activeBarbers,
        dailyCommission,
        weeklyCommission,
        monthlyCommission,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadChartData = async () => {
    try {
      const data: ChartData[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const startOfDayDate = startOfDay(date);
        const endOfDayDate = new Date(startOfDayDate);
        endOfDayDate.setHours(23, 59, 59, 999);

        const { data: dayData } = await supabase
          .from('transactions')
          .select('total')
          .gte('created_at', startOfDayDate.toISOString())
          .lte('created_at', endOfDayDate.toISOString());

        const revenue = dayData?.reduce((sum, t) => sum + Number(t.total), 0) || 0;
        
        data.push({
          date: format(date, 'dd/MM', { locale: ptBR }),
          revenue,
        });
      }

      setChartData(data);
    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  };

  const loadTopBarbers = async () => {
    try {
      const monthStart = startOfMonth(new Date());

      const { data } = await supabase
        .from('transactions')
        .select('barber_id, total, barbers(name)')
        .gte('created_at', monthStart.toISOString());

      if (!data) return;

      const barberMap = new Map<string, { name: string; revenue: number; transactions: number }>();
      
      data.forEach((t: any) => {
        const barberId = t.barber_id;
        const existing = barberMap.get(barberId);
        
        if (existing) {
          existing.revenue += Number(t.total);
          existing.transactions += 1;
        } else {
          barberMap.set(barberId, {
            name: t.barbers.name,
            revenue: Number(t.total),
            transactions: 1,
          });
        }
      });

      const sorted = Array.from(barberMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setTopBarbers(sorted);
    } catch (error) {
      console.error('Error loading top barbers:', error);
    }
  };

  const loadRecentTransactions = async () => {
    try {
      const { data } = await supabase
        .from('transactions')
        .select('id, total, created_at, barbers(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentTransactions(data || []);
    } catch (error) {
      console.error('Error loading recent transactions:', error);
    }
  };

  const loadLowStockItems = async () => {
    try {
      const { data: allItems } = await supabase
        .from('inventory_items')
        .select('name, quantity, min_quantity');

      const lowStock = (allItems || [])
        .filter(item => Number(item.quantity) <= Number(item.min_quantity))
        .sort((a, b) => Number(a.quantity) - Number(b.quantity))
        .slice(0, 5);

      setLowStockItems(lowStock);
    } catch (error) {
      console.error('Error loading low stock items:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const statCards = [
    {
      title: 'Receita Hoje',
      value: formatCurrency(stats.dailyRevenue),
      icon: DollarSign,
      description: `${stats.dailyTransactions} transações`,
      footer: `Lucro: ${formatCurrency(stats.dailyRevenue - stats.dailyCommission)}`,
    },
    {
      title: 'Receita Semanal',
      value: formatCurrency(stats.weeklyRevenue),
      icon: TrendingUp,
      description: 'Últimos 7 dias',
      footer: `Lucro: ${formatCurrency(stats.weeklyRevenue - stats.weeklyCommission)}`,
    },
    {
      title: 'Receita Mensal',
      value: formatCurrency(stats.monthlyRevenue),
      icon: Calendar,
      description: format(new Date(), 'MMMM yyyy', { locale: ptBR }),
      footer: `Lucro: ${formatCurrency(stats.monthlyRevenue - stats.monthlyCommission)}`,
    },
    {
      title: 'Barbeiros Ativos',
      value: stats.activeBarbers.toString(),
      icon: Users,
      description: 'Equipe ativa',
      footer: 'Profissionais cadastrados',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do seu negócio
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
              {card.footer && (
                <p className="mt-2 text-xs font-medium text-primary">{card.footer}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Receita dos Últimos 7 Dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Top Barbeiros do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topBarbers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum dado disponível
                </p>
              ) : (
                topBarbers.map((barber, index) => (
                  <div key={barber.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <Badge variant={index === 0 ? 'default' : 'secondary'}>
                        #{index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{barber.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {barber.transactions} transações
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-primary">
                      {formatCurrency(barber.revenue)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Atendimentos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma transação recente
                </p>
              ) : (
                recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div>
                      <p className="font-medium">{transaction.barbers.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <span className="font-bold text-primary">
                      {formatCurrency(transaction.total)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card border-orange-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Alerta de Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  ✓ Todos os itens em estoque adequado
                </p>
              ) : (
                lowStockItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Mínimo: {Number(item.min_quantity)}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      {Number(item.quantity)} restante{Number(item.quantity) !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
