import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, TrendingUp, Calendar } from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Stats {
  dailyRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  dailyTransactions: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    dailyRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    dailyTransactions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const now = new Date();
      const today = startOfDay(now);
      const weekStart = startOfWeek(now, { locale: ptBR });
      const monthStart = startOfMonth(now);

      // Daily revenue and count
      const { data: dailyData } = await supabase
        .from('transactions')
        .select('total')
        .gte('created_at', today.toISOString());

      const dailyRevenue = dailyData?.reduce((sum, t) => sum + Number(t.total), 0) || 0;
      const dailyTransactions = dailyData?.length || 0;

      // Weekly revenue
      const { data: weeklyData } = await supabase
        .from('transactions')
        .select('total')
        .gte('created_at', weekStart.toISOString());

      const weeklyRevenue = weeklyData?.reduce((sum, t) => sum + Number(t.total), 0) || 0;

      // Monthly revenue
      const { data: monthlyData } = await supabase
        .from('transactions')
        .select('total')
        .gte('created_at', monthStart.toISOString());

      const monthlyRevenue = monthlyData?.reduce((sum, t) => sum + Number(t.total), 0) || 0;

      setStats({
        dailyRevenue,
        weeklyRevenue,
        monthlyRevenue,
        dailyTransactions,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
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
      description: `${stats.dailyTransactions} atendimentos`,
    },
    {
      title: 'Receita Semanal',
      value: formatCurrency(stats.weeklyRevenue),
      icon: TrendingUp,
      description: 'Últimos 7 dias',
    },
    {
      title: 'Receita Mensal',
      value: formatCurrency(stats.monthlyRevenue),
      icon: Calendar,
      description: format(new Date(), 'MMMM yyyy', { locale: ptBR }),
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

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
