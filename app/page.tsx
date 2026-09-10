'use client';

import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Calculator,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Download,
  FileText,
  FlaskConical,
  BookOpenCheck,
  Layers3,
  LogOut,
  Menu,
  Moon,
  PackageOpen,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Settings,
  ShoppingBasket,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  UserRound,
  UtensilsCrossed,
  WalletCards,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  calculateBreakEven,
  calculatePricing,
  calculatePromotion,
  ingredientUnitCost,
} from '@/lib/pricing';
import {
  authenticatedFetch,
  getAuthConfig,
  getSupabaseBrowserClient,
  signInWithUsername,
} from '@/lib/supabase-browser';

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
type Kind =
  | 'ingredient'
  | 'packaging'
  | 'expense'
  | 'recipe'
  | 'product'
  | 'sale';
type Stored<T> = T & { id: number };
type ApiRecord<T = Record<string, unknown>> = {
  id: number;
  kind: Kind;
  payload: T;
};
type AppRole = 'admin' | 'employee' | 'viewer';
type CurrentUser = {
  id: string;
  username: string;
  name: string;
  role: AppRole;
  storeId: string;
};
type Ingredient = {
  name: string;
  category: string;
  unit: string;
  baseUnit: string;
  qty: number;
  price: number;
  supplier: string;
  date: string;
  expiry: string;
  stock: number;
  minStock: number;
  wastePercent?: number;
  lot?: string;
  notes?: string;
  active?: boolean;
};
type Packaging = { name: string; type: string; pack: number; price: number };
type Expense = { name: string; category: string; value: number };
type RecipeItem = {
  ingredientId: number;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  cost: number;
};
type Recipe = {
  name: string;
  items: RecipeItem[];
  yieldQty: number;
  yieldUnit: string;
  waste: number;
  cost: number;
  unit: number;
  notes: string;
  preparationMinutes: number;
};
type Product = {
  name: string;
  size: string;
  recipe: string;
  ingredientsCost: number;
  packagingCost: number;
  extras: number;
  labor: number;
  fees: number;
  cost: number;
  price: number;
  margin: number;
  profit: number;
  tone: string;
  wastePercent?: number;
  fixedAllocation?: number;
  taxPercent?: number;
  cardPercent?: number;
  marketplacePercent?: number;
  commissionPercent?: number;
  minimumPrice?: number;
  promotionalPrice?: number;
  wholesalePrice?: number;
  cmvPercent?: number;
  contributionMargin?: number;
};
type Sale = {
  productId: number;
  name: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  gross: number;
  discount: number;
  fee: number;
  deliveryCost: number;
  netRevenue: number;
  cost: number;
  profit: number;
  date: string;
  payment: string;
  channel: string;
  customer: string;
  status: string;
  notes: string;
};

const ingredientCategories = [
  'Laticínios',
  'Chocolates e cacau',
  'Frutas',
  'Açúcares e adoçantes',
  'Biscoitos e bases',
  'Aromas e essências',
  'Confeitos e decoração',
  'Outros',
];
const kindViews: Record<Kind, string> = {
  ingredient: 'Ingredientes',
  packaging: 'Embalagens',
  expense: 'Despesas',
  recipe: 'Receitas',
  product: 'Produtos',
  sale: 'Vendas',
};

const nav = [
  { label: 'Visão geral', icon: BarChart3 },
  { label: 'Ingredientes', icon: ShoppingBasket },
  { label: 'Embalagens', icon: PackageOpen },
  { label: 'Receitas', icon: FlaskConical },
  { label: 'Produtos', icon: UtensilsCrossed },
  { label: 'Vendas', icon: ShoppingCart },
  { label: 'Despesas', icon: WalletCards },
  { label: 'Simulador', icon: Calculator },
  { label: 'Relatórios', icon: FileText },
];

async function requestRecords<T = Record<string, unknown>>() {
  const response = await authenticatedFetch('/api/records');
  if (response.status === 401)
    throw new Error(
      'Sua sessão expirou. Atualize a página para entrar novamente.',
    );
  if (!response.ok) throw new Error('Não foi possível carregar os dados.');
  return response.json() as Promise<ApiRecord<T>[]>;
}

function useRecords<T extends object>(kind: Kind) {
  const [items, setItems] = useState<Stored<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const records = await requestRecords<T>();
      setItems(
        records
          .filter((record) => record.kind === kind)
          .map((record) => ({ ...record.payload, id: record.id })),
      );
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function save(payload: T, id?: number) {
    const response = await authenticatedFetch('/api/records', {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(id ? { id, payload } : { kind, payload }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error || 'Não foi possível salvar.');
    }
    const record = (await response.json()) as ApiRecord<T>;
    const saved = { ...record.payload, id: record.id } as Stored<T>;
    setItems((current) =>
      id
        ? current.map((item) => (item.id === id ? saved : item))
        : [saved, ...current],
    );
    return saved;
  }
  async function remove(id: number) {
    const response = await authenticatedFetch('/api/records', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) throw new Error('Não foi possível excluir.');
    setItems((current) => current.filter((item) => item.id !== id));
  }
  return { items, loading, save, remove };
}

export default function Home() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeView, setActiveView] = useState('Visão geral');
  const [searchQuery, setSearchQuery] = useState('');
  const [allRecords, setAllRecords] = useState<ApiRecord[]>([]);
  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient()
      .then((client) => client.auth.getSession())
      .then(async ({ data }) => {
        if (!active) return;
        if (!data.session) return setUser(null);
        const response = await authenticatedFetch('/api/me');
        if (!active) return;
        if (!response.ok) {
          await (await getSupabaseBrowserClient()).auth.signOut();
          setUser(null);
          return;
        }
        setUser(await response.json());
      })
      .catch(() => active && setUser(null));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  useEffect(() => {
    if (user && activeView === 'Visão geral')
      requestRecords()
        .then(setAllRecords)
        .catch(() => setAllRecords([]));
  }, [activeView, user]);

  if (user === undefined) return <AuthLoading />;
  if (!user)
    return (
      <SignInScreen
        onSignedIn={async () => {
          const response = await authenticatedFetch('/api/me');
          if (!response.ok) throw new Error('Conta sem acesso a esta loja.');
          setUser(await response.json());
        }}
      />
    );

  const logout = async () => {
    await (await getSupabaseBrowserClient()).auth.signOut();
    setAllRecords([]);
    setUser(null);
  };

  const dashboardProducts = allRecords
    .filter((record) => record.kind === 'product')
    .map((record) => ({ ...record.payload, id: record.id }) as Stored<Product>);
  const dashboardIngredients = allRecords.filter(
    (record) => record.kind === 'ingredient',
  );
  const dashboardExpenses = allRecords
    .filter((record) => record.kind === 'expense')
    .map((record) => record.payload as Expense);
  const dashboardSales = allRecords
    .filter((record) => record.kind === 'sale')
    .map((record) => ({ ...record.payload, id: record.id }) as Stored<Sale>)
    .filter((sale) => sale.status !== 'Cancelada');
  const switchView = (label: string) => {
    setActiveView(label);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const searchResults =
    searchQuery.trim().length >= 2
      ? allRecords
          .filter((record) =>
            String((record.payload as { name?: string }).name || '')
              .toLocaleLowerCase('pt-BR')
              .includes(searchQuery.toLocaleLowerCase('pt-BR')),
          )
          .slice(0, 6)
      : [];
  return (
    <main className="min-h-screen bg-background text-foreground">
      <aside className={`sidebar-shell ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <Sparkles size={19} />
          </div>
          <div>
            <p className="brand-name">Doce Margem</p>
            <p className="brand-kicker">Gestão de preços</p>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="main-nav" aria-label="Navegação principal">
          <p className="nav-label">Minha operação</p>
          {nav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => switchView(label)}
              className={`nav-item ${activeView === label ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Ingredientes' && (
                <span className="nav-count">{dashboardIngredients.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="monthly-card">
            <span className="mini-icon">
              <TrendingUp size={15} />
            </span>
            <p>Lucro em vendas</p>
            <strong>
              {money.format(
                dashboardSales.reduce((sum, item) => sum + item.profit, 0),
              )}
            </strong>
            <small>
              {dashboardSales.reduce((sum, item) => sum + item.quantity, 0)}{' '}
              unidades vendidas
            </small>
          </div>
          <button
            className={`nav-item ${activeView === 'Minha conta' ? 'active' : ''}`}
            onClick={() => switchView('Minha conta')}
          >
            <Settings size={18} />
            <span>Minha conta</span>
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <nav className="mobile-dock" aria-label="Navegação rápida">
        {[
          { label: 'Visão geral', short: 'Início', icon: BarChart3 },
          { label: 'Ingredientes', short: 'Insumos', icon: ShoppingBasket },
          { label: 'Produtos', short: 'Produtos', icon: UtensilsCrossed },
          { label: 'Vendas', short: 'Vendas', icon: ShoppingCart },
        ].map(({ label, short, icon: Icon }) => (
          <button
            key={label}
            className={activeView === label ? 'active' : ''}
            onClick={() => switchView(label)}
          >
            <Icon size={20} />
            <span>{short}</span>
          </button>
        ))}
        <button onClick={() => setMobileOpen(true)}>
          <Menu size={20} />
          <span>Mais</span>
        </button>
      </nav>

      <section className="app-content">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="mobile-page-title">
            <span>Doce Margem</span>
            <strong>{activeView}</strong>
          </div>
          <div className="search-shell">
            <div className="search-box">
              <Search size={17} />
              <input
                aria-label="Buscar"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar receitas, produtos, insumos..."
              />
              <kbd>⌘ K</kbd>
            </div>
            {searchQuery.trim().length >= 2 && (
              <div className="search-results">
                {searchResults.length ? (
                  searchResults.map((record) => (
                    <button
                      key={record.id}
                      onClick={() => {
                        switchView(kindViews[record.kind]);
                        setSearchQuery('');
                      }}
                    >
                      <span>
                        {String((record.payload as { name?: string }).name)}
                      </span>
                      <small>{kindViews[record.kind]}</small>
                    </button>
                  ))
                ) : (
                  <p>Nenhum resultado na sua conta.</p>
                )}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label="Alternar tema"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Notificações"
            >
              <Bell size={18} />
            </button>
            <div className="user-chip">
              <div className="avatar">{initials}</div>
              <div>
                <strong>{user.name}</strong>
                <small>Minha conta</small>
              </div>
              <ChevronDown size={15} />
            </div>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="Sair da conta"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <div className="page-wrap">
          {activeView === 'Visão geral' ? (
            <Dashboard
              products={dashboardProducts}
              sales={dashboardSales}
              ingredients={dashboardIngredients.length}
              expenses={dashboardExpenses}
              onNavigate={switchView}
            />
          ) : (
            <ModuleRouter view={activeView} user={user} onLogout={logout} />
          )}
        </div>
      </section>
    </main>
  );
}

function AuthLoading() {
  return (
    <main className="auth-screen">
      <div className="auth-card loading-auth">
        <span className="brand-mark">
          <Sparkles size={22} />
        </span>
        <p>Preparando sua conta...</p>
      </div>
    </main>
  );
}
function SignInScreen({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError('');
    try {
      await signInWithUsername(
        String(form.get('username')),
        String(form.get('password')),
      );
      await onSignedIn();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Não foi possível entrar.',
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">
            <Sparkles size={21} />
          </span>
          <span>Doce Margem</span>
        </div>
        <div className="auth-icon">
          <UserRound size={30} />
        </div>
        <p className="eyebrow">ACESSO À LOJA</p>
        <h1>Entre na sua conta.</h1>
        <p>
          Use o usuário e a senha fornecidos pelo administrador da loja.
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>Usuário</span>
            <input
              name="username"
              autoComplete="username"
              minLength={3}
              maxLength={32}
              required
              autoFocus
              placeholder="seu.usuario"
            />
          </label>
          <label>
            <span>Senha</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              maxLength={128}
              required
              placeholder="Sua senha"
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-button" disabled={submitting}>
            <UserRound size={17} /> {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <small>Cada pessoa deve usar sua própria conta.</small>
      </section>
    </main>
  );
}

function Dashboard({
  products,
  sales,
  ingredients,
  expenses,
  onNavigate,
}: {
  products: Stored<Product>[];
  sales: Stored<Sale>[];
  ingredients: number;
  expenses: Expense[];
  onNavigate: (view: string) => void;
}) {
  const totalFixed = expenses.reduce((sum, item) => sum + item.value, 0);
  const revenue = sales.reduce((sum, item) => sum + item.netRevenue, 0);
  const salesProfit = sales.reduce((sum, item) => sum + item.profit, 0);
  const units = sales.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GESTÃO COMPLETA</p>
          <h1>Sua operação em números.</h1>
          <p>Acompanhe custos, preços, vendas e lucro real em um só lugar.</p>
        </div>
        <Button onClick={() => onNavigate('Vendas')} className="primary-action">
          <Plus size={17} /> Lançar venda
        </Button>
      </div>
      <div className="alert-strip">
        <div className="alert-icon">
          <Sparkles size={19} />
        </div>
        <div>
          <strong>
            {sales.length
              ? `${sales.length} vendas lançadas`
              : ingredients
                ? 'Sua base de custos está pronta'
                : 'Comece montando sua base'}
          </strong>
          <p>
            {sales.length
              ? `${units} unidades vendidas com ${money.format(salesProfit)} de lucro calculado.`
              : ingredients
                ? 'Cadastre produtos e lance as vendas para acompanhar o resultado real.'
                : 'Cadastre ingredientes, receitas e produtos; depois registre cada venda.'}
          </p>
        </div>
        <button
          onClick={() =>
            onNavigate(
              sales.length || products.length ? 'Vendas' : 'Ingredientes',
            )
          }
        >
          {sales.length || products.length ? 'Vender' : 'Começar'}{' '}
          <ArrowUpRight size={15} />
        </button>
      </div>
      <section className="metric-grid" aria-label="Indicadores principais">
        <Metric
          icon={<CircleDollarSign size={20} />}
          label="Faturamento líquido"
          value={money.format(revenue)}
          detail={`${sales.length} vendas lançadas`}
          tone="rose"
        />
        <Metric
          icon={<TrendingUp size={20} />}
          label="Lucro nas vendas"
          value={money.format(salesProfit)}
          detail={`${units} unidades vendidas`}
          tone="sage"
        />
        <Metric
          icon={<ReceiptText size={20} />}
          label="Ticket médio"
          value={money.format(sales.length ? revenue / sales.length : 0)}
          detail={`${products.length} produtos ativos`}
          tone="cream"
        />
        <Metric
          icon={<UtensilsCrossed size={20} />}
          label="Despesas mensais"
          value={money.format(totalFixed)}
          detail={`${expenses.length} despesas cadastradas`}
          tone="lilac"
        />
      </section>
      <section className="dashboard-grid">
        <article className="panel performance-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">PORTFÓLIO</p>
              <h2>Custo, preço e lucro</h2>
            </div>
          </div>
          {products.length ? (
            <div className="bar-chart compact-bars">
              {products.slice(0, 6).map((product) => {
                const scale = Math.max(product.price, 1);
                return (
                  <div className="bar-month" key={product.id}>
                    <div className="bar-group">
                      <span
                        className="bar cost"
                        style={{ height: `${(product.cost / scale) * 80}%` }}
                      />
                      <span className="bar revenue" style={{ height: '80%' }} />
                      <span
                        className="bar profit"
                        style={{ height: `${(product.profit / scale) * 80}%` }}
                      />
                    </div>
                    <small>{product.name.slice(0, 8)}</small>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 />}
              title="Sem produtos ainda"
              text="O gráfico aparecerá assim que você cadastrar seu primeiro produto."
              action="Cadastrar produto"
              onAction={() => onNavigate('Produtos')}
            />
          )}
        </article>
        <article className="panel quick-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">ATALHOS</p>
              <h2>Ações frequentes</h2>
            </div>
          </div>
          <QuickLink
            onClick={() => onNavigate('Vendas')}
            icon={<ShoppingCart size={19} />}
            tone="green"
            title="Lançar venda"
            detail="Registre e calcule o lucro"
          />
          <QuickLink
            onClick={() => onNavigate('Produtos')}
            icon={<UtensilsCrossed size={19} />}
            tone="gold"
            title="Novo produto"
            detail="Forme o preço de venda"
          />
          <QuickLink
            onClick={() => onNavigate('Simulador')}
            icon={<Calculator size={19} />}
            tone="rose"
            title="Simular preço"
            detail="Teste margem e desconto"
          />
        </article>
      </section>
      <section className="panel products-panel">
        <div className="panel-header">
          <div>
            <p className="section-kicker">VENDAS RECENTES</p>
            <h2>Movimento da operação</h2>
          </div>
          <button className="text-button" onClick={() => onNavigate('Vendas')}>
            Ver todas <ArrowUpRight size={15} />
          </button>
        </div>
        {sales.length ? (
          <SalesTable items={sales.slice(0, 6)} readOnly />
        ) : (
          <EmptyState
            icon={<ShoppingCart />}
            title="Nenhuma venda lançada"
            text="Registre a primeira venda para acompanhar faturamento e lucro real."
            action="Lançar venda"
            onAction={() => onNavigate('Vendas')}
          />
        )}
      </section>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}
function QuickLink({
  icon,
  tone,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="quick-link">
      <span className={`quick-icon ${tone}`}>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <ArrowUpRight size={17} />
    </button>
  );
}
function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action && (
        <button onClick={onAction}>
          <Plus size={14} /> {action}
        </button>
      )}
    </div>
  );
}
function ModuleHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading module-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function RowActions({
  onEdit,
  onDelete,
  onDuplicate,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}) {
  return (
    <div className="row-actions">
      {onEdit && (
        <button aria-label="Editar" onClick={onEdit}>
          <Pencil size={14} />
        </button>
      )}
      {onDuplicate && (
        <button aria-label="Duplicar" onClick={onDuplicate}>
          <Copy size={14} />
        </button>
      )}
      {onDelete && (
        <button className="danger" aria-label="Excluir" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
function confirmDelete(callback: () => void) {
  if (window.confirm('Excluir este registro permanentemente?')) callback();
}

function ModuleRouter({
  view,
  user,
  onLogout,
}: {
  view: string;
  user: CurrentUser;
  onLogout: () => Promise<void>;
}) {
  if (view === 'Ingredientes') return <IngredientsView />;
  if (view === 'Embalagens') return <PackagingView />;
  if (view === 'Despesas') return <ExpensesView />;
  if (view === 'Receitas') return <RecipesView />;
  if (view === 'Produtos') return <ProductsView />;
  if (view === 'Vendas') return <SalesView />;
  if (view === 'Simulador') return <SimulatorView />;
  if (view === 'Minha conta')
    return <AccountView user={user} onLogout={onLogout} />;
  return <ReportsView />;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  employee: 'Colaborador',
  viewer: 'Somente leitura',
};

function AccountView({
  user,
  onLogout,
}: {
  user: CurrentUser;
  onLogout: () => Promise<void>;
}) {
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const password = String(form.get('password'));
    const confirmation = String(form.get('confirmation'));
    if (password !== confirmation) return setError('As senhas não são iguais.');
    setSaving(true);
    setError('');
    const { error: updateError } = await (
      await getSupabaseBrowserClient()
    ).auth.updateUser({ password });
    setSaving(false);
    if (updateError) return setError('Não foi possível alterar a senha.');
    formElement.reset();
    setNotice('Senha alterada com sucesso.');
  }

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const [client, config] = await Promise.all([
        getSupabaseBrowserClient(),
        getAuthConfig(),
      ]);
      const { data } = await client.auth.getSession();
      const response = await fetch(`${config.url}/functions/v1/account-admin`, {
        method: 'POST',
        headers: {
          apikey: config.publishableKey,
          authorization: `Bearer ${data.session?.access_token || ''}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          username: String(form.get('username')),
          displayName: String(form.get('displayName')),
          password: String(form.get('newUserPassword')),
          role: String(form.get('role')),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error || 'Não foi possível criar.');
      formElement.reset();
      setNotice('Conta criada. A pessoa já pode entrar com esse usuário.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ModuleHeading
        eyebrow="SEGURANÇA"
        title="Minha conta"
        subtitle="Sua operação fica vinculada à sua identidade e separada das demais contas."
      />
      <section className="panel account-panel">
        <div className="auth-icon">
          <UserRound size={27} />
        </div>
        <div>
          <small>NOME</small>
          <strong>{user.name}</strong>
          <small>USUÁRIO</small>
          <p>{user.username}</p>
          <small>ACESSO</small>
          <p>{roleLabels[user.role]}</p>
          <span>
            <CheckCircle2 size={15} /> Dados protegidos e isolados por usuário
          </span>
        </div>
        <button className="account-logout" onClick={onLogout}>
          <LogOut size={16} /> Sair da conta
        </button>
      </section>
      <section className="account-grid">
        <form className="panel data-form account-form" onSubmit={changePassword}>
          <div className="panel-header">
            <div>
              <p className="section-kicker">MINHA SEGURANÇA</p>
              <h2>Alterar senha</h2>
            </div>
          </div>
          <label>
            <span>Nova senha</span>
            <input name="password" type="password" minLength={10} maxLength={128} required />
          </label>
          <label>
            <span>Confirmar nova senha</span>
            <input name="confirmation" type="password" minLength={10} maxLength={128} required />
          </label>
          <Button disabled={saving}>Salvar nova senha</Button>
        </form>
        {user.role === 'admin' && (
          <form className="panel data-form account-form" onSubmit={createAccount}>
            <div className="panel-header">
              <div>
                <p className="section-kicker">EQUIPE</p>
                <h2>Criar conta de usuário</h2>
              </div>
            </div>
            <div className="form-row">
              <label>
                <span>Nome da pessoa</span>
                <input name="displayName" required maxLength={100} />
              </label>
              <label>
                <span>Usuário</span>
                <input name="username" required minLength={3} maxLength={32} pattern="[a-z0-9._-]+" />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Senha inicial</span>
                <input name="newUserPassword" type="password" required minLength={10} maxLength={128} />
              </label>
              <label>
                <span>Nível de acesso</span>
                <select name="role" defaultValue="employee">
                  <option value="admin">Administrador</option>
                  <option value="employee">Colaborador</option>
                  <option value="viewer">Somente leitura</option>
                </select>
              </label>
            </div>
            <Button disabled={saving}>Criar conta</Button>
          </form>
        )}
      </section>
      {notice && <div className="save-toast"><CheckCircle2 size={16} /> {notice}</div>}
      {error && <div className="form-error">{error}</div>}
    </>
  );
}

function IngredientsView() {
  const records = useRecords<Ingredient>('ingredient');
  const [editing, setEditing] = useState<Stored<Ingredient> | null>(null);
  const [saved, setSaved] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const qty = Number(form.get('qty'));
    const item: Ingredient = {
      name: String(form.get('name')),
      category: String(form.get('category')),
      unit: String(form.get('unit')),
      baseUnit: String(form.get('baseUnit')),
      qty,
      price: Number(form.get('price')),
      supplier: String(form.get('supplier')),
      date: String(form.get('date')),
      expiry: String(form.get('expiry')),
      stock: Number(form.get('stock') || qty),
      minStock: Number(form.get('minStock') || 0),
      wastePercent: Number(form.get('wastePercent') || 0),
      lot: String(form.get('lot')),
      notes: String(form.get('notes')),
      active: form.get('active') === 'on',
    };
    await records.save(item, editing?.id);
    setEditing(null);
    formElement.reset();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  const visible =
    categoryFilter === 'Todas'
      ? records.items
      : records.items.filter((item) => item.category === categoryFilter);
  const lowStock = records.items.filter(
    (item) => item.minStock > 0 && item.stock <= item.minStock,
  ).length;
  return (
    <>
      <ModuleHeading
        eyebrow="CADASTRO"
        title="Ingredientes e compras"
        subtitle="Organize os insumos por categoria, lote, validade, estoque e custo útil."
      />
      {saved && <SaveToast text="Ingrediente salvo" />}
      <div className="module-layout">
        <EditorPanel
          title={editing ? 'Editar ingrediente' : 'Novo ingrediente'}
          editing={!!editing}
          onCancel={() => setEditing(null)}
        >
          <form
            key={editing?.id || 'new'}
            onSubmit={submit}
            className="data-form"
          >
            <label>
              Nome
              <input
                name="name"
                maxLength={120}
                required
                defaultValue={editing?.name}
                placeholder="Ex.: Leite condensado"
              />
            </label>
            <label>
              Categoria
              <select
                name="category"
                required
                defaultValue={editing?.category || ingredientCategories[0]}
              >
                {ingredientCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Embalagem de compra
                <input
                  name="unit"
                  required
                  defaultValue={editing?.unit}
                  placeholder="Ex.: caixa 395 g"
                />
              </label>
              <label>
                Quantidade útil na embalagem
                <input
                  name="qty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={editing?.qty}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Unidade usada na receita
                <select name="baseUnit" defaultValue={editing?.baseUnit || 'g'}>
                  <option value="g">grama (g)</option>
                  <option value="ml">mililitro (ml)</option>
                  <option value="un">unidade (un)</option>
                  <option value="kg">quilo (kg)</option>
                  <option value="l">litro (l)</option>
                </select>
              </label>
              <label>
                Preço pago
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={editing?.price}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Perda estimada (%)
                <input
                  name="wastePercent"
                  type="number"
                  min="0"
                  max="99"
                  step="0.1"
                  defaultValue={editing?.wastePercent || 0}
                />
              </label>
              <label>
                Data da compra
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={
                    editing?.date?.includes('-')
                      ? editing.date
                      : new Date().toLocaleDateString('en-CA')
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Estoque atual
                <input
                  name="stock"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={editing?.stock}
                  placeholder="Na unidade usada"
                />
              </label>
              <label>
                Alerta de estoque mínimo
                <input
                  name="minStock"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={editing?.minStock || 0}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Fornecedor
                <input name="supplier" defaultValue={editing?.supplier} />
              </label>
              <label>
                Lote
                <input name="lot" defaultValue={editing?.lot} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Validade
                <input
                  name="expiry"
                  type="date"
                  defaultValue={editing?.expiry}
                />
              </label>
              <label className="checkbox-field">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={editing?.active !== false}
                />{' '}
                Ingrediente ativo
              </label>
            </div>
            <label>
              Observações
              <textarea
                name="notes"
                maxLength={2000}
                defaultValue={editing?.notes}
              />
            </label>
            <div className="cost-preview">
              <Calculator size={17} />
              <span>
                A perda reduz a quantidade útil. O custo usado nas receitas será{' '}
                {money.format(
                  ingredientUnitCost(
                    editing?.price || 0,
                    editing?.qty || 0,
                    editing?.wastePercent || 0,
                  ),
                )}{' '}
                por {editing?.baseUnit || 'unidade'}.
              </span>
            </div>
            <SaveButton editing={!!editing} />
          </form>
        </EditorPanel>
        <section className="panel data-panel">
          <div className="panel-header responsive-header">
            <DataHeader title={`${records.items.length} ingredientes`} />
            {lowStock > 0 && (
              <span className="stock-alert">
                <AlertTriangle size={14} /> {lowStock} com estoque baixo
              </span>
            )}
          </div>
          <div className="category-filters">
            <button
              className={categoryFilter === 'Todas' ? 'active' : ''}
              onClick={() => setCategoryFilter('Todas')}
            >
              Todas
            </button>
            {ingredientCategories
              .filter((category) =>
                records.items.some((item) => item.category === category),
              )
              .map((category) => (
                <button
                  className={categoryFilter === category ? 'active' : ''}
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                >
                  {category}
                </button>
              ))}
          </div>
          {records.loading ? (
            <Loading />
          ) : visible.length ? (
            <IngredientTable
              items={visible}
              onEdit={setEditing}
              onDelete={(id) => confirmDelete(() => records.remove(id))}
            />
          ) : (
            <EmptyState
              icon={<ShoppingBasket />}
              title="Nenhum ingrediente nesta categoria"
              text="Cadastre o primeiro insumo para iniciar os cálculos."
            />
          )}
        </section>
      </div>
    </>
  );
}

function PackagingView() {
  const records = useRecords<Packaging>('packaging');
  const [editing, setEditing] = useState<Stored<Packaging> | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await records.save(
      {
        name: String(form.get('name')),
        type: String(form.get('type')),
        pack: Number(form.get('pack')),
        price: Number(form.get('price')),
      },
      editing?.id,
    );
    setEditing(null);
    formElement.reset();
  }
  return (
    <>
      <ModuleHeading
        eyebrow="CADASTRO"
        title="Embalagens e adicionais"
        subtitle="Gerencie potes, tampas, colheres, etiquetas e extras com custo unitário real."
      />
      <div className="module-layout">
        <EditorPanel
          title={editing ? 'Editar embalagem' : 'Nova embalagem'}
          editing={!!editing}
          onCancel={() => setEditing(null)}
        >
          <form
            key={editing?.id || 'new'}
            onSubmit={submit}
            className="data-form"
          >
            <label>
              Nome
              <input name="name" required defaultValue={editing?.name} />
            </label>
            <div className="form-row">
              <label>
                Categoria
                <input name="type" required defaultValue={editing?.type} />
              </label>
              <label>
                Quantidade no pacote
                <input
                  name="pack"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={editing?.pack}
                />
              </label>
            </div>
            <label>
              Preço pago
              <input
                name="price"
                type="number"
                step="0.01"
                required
                defaultValue={editing?.price}
              />
            </label>
            <SaveButton editing={!!editing} />
          </form>
        </EditorPanel>
        <section className="panel data-panel">
          <DataHeader title={`${records.items.length} embalagens`} />
          {records.loading ? (
            <Loading />
          ) : records.items.length ? (
            <PackagingTable
              items={records.items}
              onEdit={setEditing}
              onDelete={(id) => confirmDelete(() => records.remove(id))}
            />
          ) : (
            <EmptyState
              icon={<PackageOpen />}
              title="Nenhuma embalagem"
              text="Adicione o primeiro item de embalagem."
            />
          )}
        </section>
      </div>
    </>
  );
}

function ExpensesView() {
  const records = useRecords<Expense>('expense');
  const [editing, setEditing] = useState<Stored<Expense> | null>(null);
  const total = records.items.reduce((sum, item) => sum + item.value, 0);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await records.save(
      {
        name: String(form.get('name')),
        category: String(form.get('category')),
        value: Number(form.get('value')),
      },
      editing?.id,
    );
    setEditing(null);
    formElement.reset();
  }
  return (
    <>
      <ModuleHeading
        eyebrow="ESTRUTURA"
        title="Despesas fixas e rateio"
        subtitle="Mantenha os gastos mensais atualizados para formar preços sustentáveis."
      />
      <div className="module-layout">
        <EditorPanel
          title={editing ? 'Editar despesa' : 'Nova despesa'}
          editing={!!editing}
          onCancel={() => setEditing(null)}
        >
          <form
            key={editing?.id || 'new'}
            onSubmit={submit}
            className="data-form"
          >
            <label>
              Nome
              <input name="name" required defaultValue={editing?.name} />
            </label>
            <label>
              Categoria
              <input
                name="category"
                required
                defaultValue={editing?.category}
              />
            </label>
            <label>
              Valor mensal
              <input
                name="value"
                type="number"
                step="0.01"
                required
                defaultValue={editing?.value}
              />
            </label>
            <SaveButton editing={!!editing} />
          </form>
        </EditorPanel>
        <section className="panel data-panel">
          <div className="panel-header">
            <DataHeader title={money.format(total)} />
            <span className="rate-badge">
              {money.format(total / 650)} / unidade
            </span>
          </div>
          {records.loading ? (
            <Loading />
          ) : records.items.length ? (
            <ExpenseTable
              items={records.items}
              onEdit={setEditing}
              onDelete={(id) => confirmDelete(() => records.remove(id))}
            />
          ) : (
            <EmptyState
              icon={<WalletCards />}
              title="Nenhuma despesa"
              text="Cadastre aluguel, energia, pró-labore e demais gastos."
            />
          )}
        </section>
      </div>
    </>
  );
}

function RecipesView() {
  const records = useRecords<Recipe>('recipe');
  const ingredients = useRecords<Ingredient>('ingredient');
  const [editing, setEditing] = useState<Stored<Recipe> | null>(null);
  const [draftItems, setDraftItems] = useState<
    { ingredientId: number; quantity: number }[]
  >([]);
  const [wastePreview, setWastePreview] = useState(0);
  const [yieldPreview, setYieldPreview] = useState(1);
  const rawCost = draftItems.reduce((sum, item) => {
    const ingredient = ingredients.items.find(
      (candidate) => candidate.id === item.ingredientId,
    );
    return (
      sum +
      (ingredient
        ? ingredientUnitCost(
            ingredient.price,
            ingredient.qty,
            ingredient.wastePercent,
          ) * item.quantity
        : 0)
    );
  }, 0);
  const totalCost = rawCost * (1 + wastePreview / 100);
  const portionCost = yieldPreview ? totalCost / yieldPreview : 0;
  function startEdit(recipe: Stored<Recipe>) {
    setEditing(recipe);
    setDraftItems(
      (recipe.items || []).map((item) => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
      })),
    );
    setWastePreview(recipe.waste || 0);
    setYieldPreview(recipe.yieldQty || 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEdit() {
    setEditing(null);
    setDraftItems([]);
    setWastePreview(0);
    setYieldPreview(1);
  }
  function addIngredient() {
    const firstAvailable = ingredients.items.find(
      (ingredient) =>
        !draftItems.some((item) => item.ingredientId === ingredient.id),
    );
    if (firstAvailable)
      setDraftItems((items) => [
        ...items,
        { ingredientId: firstAvailable.id, quantity: 1 },
      ]);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const yieldQty = Number(form.get('yieldQty'));
    const waste = Number(form.get('waste'));
    const items: RecipeItem[] = draftItems.map((draft) => {
      const ingredient = ingredients.items.find(
        (candidate) => candidate.id === draft.ingredientId,
      )!;
      const unitCost = ingredientUnitCost(
        ingredient.price,
        ingredient.qty,
        ingredient.wastePercent,
      );
      return {
        ingredientId: ingredient.id,
        name: ingredient.name,
        quantity: draft.quantity,
        unit: ingredient.baseUnit || 'un',
        unitCost,
        cost: unitCost * draft.quantity,
      };
    });
    const cost =
      items.reduce((sum, item) => sum + item.cost, 0) * (1 + waste / 100);
    await records.save(
      {
        name: String(form.get('name')),
        items,
        yieldQty,
        yieldUnit: String(form.get('yieldUnit')),
        waste,
        cost,
        unit: cost / yieldQty,
        notes: String(form.get('notes')),
        preparationMinutes: Number(form.get('preparationMinutes') || 0),
      },
      editing?.id,
    );
    formElement.reset();
    cancelEdit();
  }
  function duplicate(recipe: Stored<Recipe>) {
    const { id: _id, ...copy } = recipe;
    return records.save({ ...copy, name: `${recipe.name} (cópia)` });
  }
  return (
    <>
      <ModuleHeading
        eyebrow="FICHAS TÉCNICAS"
        title="Receitas"
        subtitle="Escolha os ingredientes disponíveis; custos e valor por porção são calculados automaticamente."
      />
      <div className="module-layout recipe-layout">
        <EditorPanel
          title={editing ? 'Editar receita' : 'Nova receita'}
          editing={!!editing}
          onCancel={cancelEdit}
        >
          <form
            key={editing?.id || 'new'}
            onSubmit={submit}
            className="data-form"
          >
            <label>
              Nome da receita
              <input
                name="name"
                required
                defaultValue={editing?.name}
                placeholder="Ex.: Mousse de chocolate"
              />
            </label>
            <div className="ingredient-builder">
              <div className="builder-heading">
                <div>
                  <span>Ingredientes da receita</span>
                  <small>
                    {ingredients.items.length} disponíveis na sua conta
                  </small>
                </div>
                <button
                  type="button"
                  onClick={addIngredient}
                  disabled={
                    !ingredients.items.length ||
                    draftItems.length >= ingredients.items.length
                  }
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
              {ingredients.loading ? (
                <Loading />
              ) : !ingredients.items.length ? (
                <div className="builder-empty">
                  <AlertTriangle size={18} />
                  <span>Cadastre ingredientes antes de montar a receita.</span>
                </div>
              ) : draftItems.length ? (
                draftItems.map((draft, index) => {
                  const ingredient = ingredients.items.find(
                    (item) => item.id === draft.ingredientId,
                  );
                  const lineCost = ingredient
                    ? ingredientUnitCost(
                        ingredient.price,
                        ingredient.qty,
                        ingredient.wastePercent,
                      ) * draft.quantity
                    : 0;
                  return (
                    <div
                      className="builder-row"
                      key={`${draft.ingredientId}-${index}`}
                    >
                      <label>
                        <span>Ingrediente</span>
                        <select
                          aria-label={`Ingrediente ${index + 1}`}
                          value={draft.ingredientId}
                          onChange={(event) =>
                            setDraftItems((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      ingredientId: Number(event.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          {ingredients.items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ·{' '}
                              {money.format(
                                ingredientUnitCost(
                                  item.price,
                                  item.qty,
                                  item.wastePercent,
                                ),
                              )}
                              /{item.baseUnit || 'un'}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Quantidade ({ingredient?.baseUnit || 'un'})</span>
                        <input
                          aria-label={`Quantidade do ingrediente ${index + 1}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={draft.quantity}
                          onChange={(event) =>
                            setDraftItems((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      quantity: Number(event.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <strong>{money.format(lineCost)}</strong>
                      <button
                        type="button"
                        aria-label={`Remover ingrediente ${index + 1}`}
                        onClick={() =>
                          setDraftItems((items) =>
                            items.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="builder-empty">
                  <Layers3 size={18} />
                  <span>Clique em “Adicionar” para selecionar os insumos.</span>
                </div>
              )}
            </div>
            <div className="form-row">
              <label>
                Rendimento
                <input
                  name="yieldQty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={editing?.yieldQty || 1}
                  onChange={(event) =>
                    setYieldPreview(Number(event.target.value))
                  }
                />
              </label>
              <label>
                Unidade de rendimento
                <select
                  name="yieldUnit"
                  defaultValue={editing?.yieldUnit || 'porções'}
                >
                  <option value="porções">porções</option>
                  <option value="g">gramas</option>
                  <option value="ml">mililitros</option>
                  <option value="unidades">unidades</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Perda estimada (%)
                <input
                  name="waste"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={editing?.waste || 0}
                  onChange={(event) =>
                    setWastePreview(Number(event.target.value))
                  }
                />
              </label>
              <label>
                Tempo de preparo (min)
                <input
                  name="preparationMinutes"
                  type="number"
                  min="0"
                  defaultValue={editing?.preparationMinutes || 0}
                />
              </label>
            </div>
            <label>
              Modo de preparo e observações
              <textarea
                name="notes"
                defaultValue={editing?.notes}
                placeholder="Etapas, temperatura, conservação..."
              />
            </label>
            <div className="recipe-cost-summary">
              <span>
                <small>Ingredientes</small>
                <strong>{money.format(rawCost)}</strong>
              </span>
              <span>
                <small>Com perdas</small>
                <strong>{money.format(totalCost)}</strong>
              </span>
              <span className="featured">
                <small>Custo por porção</small>
                <strong>{money.format(portionCost)}</strong>
              </span>
            </div>
            <SaveButton editing={!!editing} />
          </form>
        </EditorPanel>
        <section className="panel data-panel">
          <DataHeader title={`${records.items.length} receitas`} />
          {records.loading ? (
            <Loading />
          ) : records.items.length ? (
            <div className="recipe-list">
              {records.items.map((recipe) => (
                <article className="recipe-card" key={recipe.id}>
                  <div className="recipe-top">
                    <span className="recipe-glyph">
                      <FlaskConical size={18} />
                    </span>
                    <div>
                      <strong>{recipe.name}</strong>
                      <small>
                        {recipe.items?.length || 0} ingredientes ·{' '}
                        {recipe.yieldQty} {recipe.yieldUnit}
                        {recipe.preparationMinutes
                          ? ` · ${recipe.preparationMinutes} min`
                          : ''}
                      </small>
                    </div>
                    <RowActions
                      onEdit={() => startEdit(recipe)}
                      onDuplicate={() => duplicate(recipe)}
                      onDelete={() =>
                        confirmDelete(() => records.remove(recipe.id))
                      }
                    />
                  </div>
                  {recipe.items?.length > 0 && (
                    <div className="recipe-ingredient-tags">
                      {recipe.items.slice(0, 4).map((item) => (
                        <span key={item.ingredientId}>{item.name}</span>
                      ))}
                    </div>
                  )}
                  <div className="recipe-metrics">
                    <span>
                      <small>Custo total</small>
                      <strong>{money.format(recipe.cost)}</strong>
                    </span>
                    <span>
                      <small>
                        Custo por{' '}
                        {recipe.yieldUnit === 'porções' ? 'porção' : 'unidade'}
                      </small>
                      <strong>{money.format(recipe.unit)}</strong>
                    </span>
                    <span>
                      <small>Perda</small>
                      <strong>{recipe.waste}%</strong>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<FlaskConical />}
              title="Nenhuma receita"
              text="Monte sua primeira ficha técnica usando os ingredientes cadastrados."
            />
          )}
        </section>
      </div>
    </>
  );
}

function ProductsView() {
  const records = useRecords<Product>('product');
  const recipes = useRecords<Recipe>('recipe');
  const packaging = useRecords<Packaging>('packaging');
  const [editing, setEditing] = useState<Stored<Product> | null>(null);
  const [recipeCost, setRecipeCost] = useState(0);
  const [packagingCost, setPackagingCost] = useState(0);
  function startEdit(product: Stored<Product>) {
    setEditing(product);
    setRecipeCost(product.ingredientsCost);
    setPackagingCost(product.packagingCost);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEdit() {
    setEditing(null);
    setRecipeCost(0);
    setPackagingCost(0);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ingredientsCost = Number(form.get('ingredientsCost'));
    const packageCost = Number(form.get('packagingCost'));
    const extras = Number(form.get('extras'));
    const labor = Number(form.get('labor'));
    const fees = Number(form.get('fees'));
    const margin = Number(form.get('margin'));
    const wastePercent = Number(form.get('wastePercent'));
    const fixedAllocation = Number(form.get('fixedAllocation'));
    const taxPercent = Number(form.get('taxPercent'));
    const cardPercent = Number(form.get('cardPercent'));
    const marketplacePercent = Number(form.get('marketplacePercent'));
    const commissionPercent = Number(form.get('commissionPercent'));
    const result = calculatePricing({
      ingredients: ingredientsCost,
      packaging: packageCost,
      addons: extras + fees,
      labor,
      wastePercent,
      fixedAllocation,
      taxPercent,
      cardPercent,
      marketplacePercent,
      sellerCommissionPercent: commissionPercent,
      targetMarginPercent: margin,
    });
    const promo = calculatePromotion(
      result.recommendedPrice,
      Number(form.get('promotionPercent')),
      result.minimumPrice,
    );
    await records.save(
      {
        name: String(form.get('name')),
        size: String(form.get('size')),
        recipe: String(form.get('recipe')),
        ingredientsCost,
        packagingCost: packageCost,
        extras,
        labor,
        fees,
        cost: result.totalCostBeforeRates,
        price: result.recommendedPrice,
        margin: result.netMarginPercent,
        profit: result.estimatedProfit,
        tone: editing?.tone || 'berry',
        wastePercent,
        fixedAllocation,
        taxPercent,
        cardPercent,
        marketplacePercent,
        commissionPercent,
        minimumPrice: result.minimumPrice,
        promotionalPrice: promo.promotionalPrice,
        wholesalePrice: Number(
          form.get('wholesalePrice') || result.minimumPrice,
        ),
        cmvPercent: result.cmvPercent,
        contributionMargin: result.contributionMargin,
      },
      editing?.id,
    );
    formElement.reset();
    cancelEdit();
  }
  function duplicate(product: Stored<Product>) {
    const { id: _id, ...copy } = product;
    return records.save({ ...copy, name: `${product.name} (cópia)` });
  }
  return (
    <>
      <ModuleHeading
        eyebrow="PRECIFICAÇÃO"
        title="Produtos finais"
        subtitle="Selecione receita e embalagem para preencher os custos automaticamente."
      />
      <div className="module-layout">
        <EditorPanel
          title={editing ? 'Editar produto' : 'Novo produto'}
          editing={!!editing}
          onCancel={cancelEdit}
        >
          <form
            key={editing?.id || 'new'}
            onSubmit={submit}
            className="data-form"
          >
            <div className="form-row">
              <label>
                Nome
                <input name="name" required defaultValue={editing?.name} />
              </label>
              <label>
                Tamanho ou apresentação
                <input
                  name="size"
                  required
                  defaultValue={editing?.size}
                  placeholder="Ex.: pote 120 ml"
                />
              </label>
            </div>
            <label>
              Receita base
              <select
                name="recipe"
                defaultValue={editing?.recipe || ''}
                onChange={(event) => {
                  const recipe = recipes.items.find(
                    (item) => item.name === event.target.value,
                  );
                  setRecipeCost(recipe?.unit || 0);
                }}
              >
                <option value="">Selecione uma receita</option>
                {recipes.items.map((recipe) => (
                  <option key={recipe.id} value={recipe.name}>
                    {recipe.name} · {money.format(recipe.unit)} por{' '}
                    {recipe.yieldUnit === 'porções' ? 'porção' : 'unidade'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Embalagem cadastrada
              <select
                defaultValue=""
                onChange={(event) => {
                  const item = packaging.items.find(
                    (candidate) => candidate.id === Number(event.target.value),
                  );
                  setPackagingCost(
                    item && item.pack ? item.price / item.pack : 0,
                  );
                }}
              >
                <option value="">Selecionar embalagem (opcional)</option>
                {packaging.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ·{' '}
                    {money.format(item.pack ? item.price / item.pack : 0)}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Custo da receita
                <input
                  name="ingredientsCost"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={recipeCost}
                  onChange={(event) =>
                    setRecipeCost(Number(event.target.value))
                  }
                />
              </label>
              <label>
                Custo da embalagem
                <input
                  name="packagingCost"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={packagingCost}
                  onChange={(event) =>
                    setPackagingCost(Number(event.target.value))
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Adicionais
                <input
                  name="extras"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={editing?.extras || 0}
                />
              </label>
              <label>
                Mão de obra
                <input
                  name="labor"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={editing?.labor || 0}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Adicionais em reais
                <input
                  name="fees"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={editing?.fees || 0}
                />
              </label>
              <label>
                Perdas do produto (%)
                <input
                  name="wastePercent"
                  type="number"
                  min="0"
                  step="0.1"
                  max="99"
                  defaultValue={editing?.wastePercent || 0}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Rateio fixo por unidade
                <input
                  name="fixedAllocation"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={editing?.fixedAllocation || 0}
                />
              </label>
              <label>
                Margem desejada (%)
                <input
                  name="margin"
                  type="number"
                  min="0"
                  step="0.1"
                  max="90"
                  required
                  defaultValue={editing?.margin || 50}
                />
              </label>
            </div>
            <details className="form-details">
              <summary>Taxas, promoção e atacado</summary>
              <div className="form-row">
                <label>
                  Impostos (%)
                  <input
                    name="taxPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    defaultValue={editing?.taxPercent || 0}
                  />
                </label>
                <label>
                  Cartão (%)
                  <input
                    name="cardPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    defaultValue={editing?.cardPercent || 0}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Marketplace (%)
                  <input
                    name="marketplacePercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    defaultValue={editing?.marketplacePercent || 0}
                  />
                </label>
                <label>
                  Comissão (%)
                  <input
                    name="commissionPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    defaultValue={editing?.commissionPercent || 0}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Desconto promocional (%)
                  <input
                    name="promotionPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    defaultValue={
                      editing?.promotionalPrice && editing.price
                        ? (1 - editing.promotionalPrice / editing.price) * 100
                        : 0
                    }
                  />
                </label>
                <label>
                  Preço de atacado
                  <input
                    name="wholesalePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editing?.wholesalePrice || 0}
                  />
                </label>
              </div>
            </details>
            <div className="cost-preview">
              <BookOpenCheck size={17} />
              <span>
                Preço = custo total ÷ (1 − taxas percentuais − margem). Markup e
                margem são tratados separadamente.
              </span>
            </div>
            <SaveButton editing={!!editing} />
          </form>
        </EditorPanel>
        <section className="panel data-panel">
          <DataHeader title={`${records.items.length} produtos`} />
          {records.loading ? (
            <Loading />
          ) : records.items.length ? (
            <ProductTable
              items={records.items}
              onEdit={startEdit}
              onDuplicate={duplicate}
              onDelete={(id) => confirmDelete(() => records.remove(id))}
            />
          ) : (
            <EmptyState
              icon={<UtensilsCrossed />}
              title="Nenhum produto"
              text="Cadastre o primeiro produto final."
            />
          )}
        </section>
      </div>
    </>
  );
}

function SalesView() {
  const records = useRecords<Sale>('sale');
  const products = useRecords<Product>('product');
  const [editing, setEditing] = useState<Stored<Sale> | null>(null);
  const [productId, setProductId] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [fee, setFee] = useState(0);
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [statusFilter, setStatusFilter] = useState('Todas');
  const product = products.items.find((item) => item.id === productId);
  const gross = quantity * unitPrice;
  const netRevenue = Math.max(0, gross - discount - fee - deliveryCost);
  const fallbackUnitCost = editing
    ? editing.cost / Math.max(editing.quantity, 1)
    : 0;
  const cost = (product?.cost || fallbackUnitCost) * quantity;
  const profit = netRevenue - cost;
  const validSales = records.items.filter(
    (sale) => sale.status !== 'Cancelada',
  );
  const totalRevenue = validSales.reduce(
    (sum, sale) => sum + sale.netRevenue,
    0,
  );
  const totalProfit = validSales.reduce((sum, sale) => sum + sale.profit, 0);
  const totalUnits = validSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const visibleSales =
    statusFilter === 'Todas'
      ? records.items
      : records.items.filter((sale) => sale.status === statusFilter);
  function resetSale() {
    setEditing(null);
    setProductId(0);
    setQuantity(1);
    setUnitPrice(0);
    setDiscount(0);
    setFee(0);
    setDeliveryCost(0);
  }
  function startEdit(sale: Stored<Sale>) {
    setEditing(sale);
    setProductId(sale.productId);
    setQuantity(sale.quantity);
    setUnitPrice(sale.unitPrice);
    setDiscount(sale.discount);
    setFee(sale.fee);
    setDeliveryCost(sale.deliveryCost);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const selectedProduct = products.items.find(
      (item) => item.id === productId,
    );
    if (!selectedProduct && !editing) return;
    const status = String(form.get('status'));
    const productName =
      selectedProduct?.name || editing?.productName || 'Produto';
    await records.save(
      {
        productId,
        name: `Venda · ${productName}`,
        productName,
        quantity,
        unitPrice,
        gross,
        discount,
        fee,
        deliveryCost,
        netRevenue,
        cost,
        profit,
        date: String(form.get('date')),
        payment: String(form.get('payment')),
        channel: String(form.get('channel')),
        customer: String(form.get('customer')),
        status,
        notes: String(form.get('notes')),
      },
      editing?.id,
    );
    formElement.reset();
    resetSale();
  }
  return (
    <>
      <ModuleHeading
        eyebrow="CAIXA E RESULTADOS"
        title="Lançar vendas"
        subtitle="Registre cada pedido e acompanhe faturamento, custos e lucro real automaticamente."
      />
      <section className="sales-summary-grid">
        <Metric
          icon={<CircleDollarSign size={20} />}
          label="Faturamento líquido"
          value={money.format(totalRevenue)}
          detail={`${validSales.length} vendas válidas`}
          tone="rose"
        />
        <Metric
          icon={<TrendingUp size={20} />}
          label="Lucro realizado"
          value={money.format(totalProfit)}
          detail={`${totalUnits} unidades vendidas`}
          tone="sage"
        />
        <Metric
          icon={<ReceiptText size={20} />}
          label="Ticket médio"
          value={money.format(
            validSales.length ? totalRevenue / validSales.length : 0,
          )}
          detail="Por lançamento"
          tone="cream"
        />
      </section>
      <div className="module-layout sales-layout">
        <EditorPanel
          title={editing ? 'Editar venda' : 'Nova venda'}
          editing={!!editing}
          onCancel={resetSale}
        >
          <form
            key={editing?.id || 'new'}
            onSubmit={submit}
            className="data-form"
          >
            <label>
              Produto
              <select
                name="product"
                required
                value={productId || ''}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  const selected = products.items.find(
                    (item) => item.id === id,
                  );
                  setProductId(id);
                  setUnitPrice(selected?.price || 0);
                }}
              >
                <option value="">Selecione um produto</option>
                {products.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {money.format(item.price)}
                  </option>
                ))}
              </select>
            </label>
            {!products.loading && !products.items.length && (
              <div className="builder-empty sale-empty">
                <AlertTriangle size={17} /> Cadastre um produto antes de lançar
                vendas.
              </div>
            )}
            <div className="form-row">
              <label>
                Quantidade
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </label>
              <label>
                Preço unitário
                <input
                  name="unitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Data da venda
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={
                    editing?.date || new Date().toLocaleDateString('en-CA')
                  }
                />
              </label>
              <label>
                Status
                <select
                  name="status"
                  defaultValue={editing?.status || 'Concluída'}
                >
                  <option>Concluída</option>
                  <option>Pendente</option>
                  <option>Cancelada</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Forma de pagamento
                <select name="payment" defaultValue={editing?.payment || 'Pix'}>
                  <option>Pix</option>
                  <option>Dinheiro</option>
                  <option>Cartão de débito</option>
                  <option>Cartão de crédito</option>
                  <option>Transferência</option>
                  <option>Outro</option>
                </select>
              </label>
              <label>
                Canal de venda
                <select
                  name="channel"
                  defaultValue={editing?.channel || 'WhatsApp'}
                >
                  <option>WhatsApp</option>
                  <option>Instagram</option>
                  <option>Loja física</option>
                  <option>Delivery</option>
                  <option>Encomenda</option>
                  <option>Outro</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Desconto total
                <input
                  name="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(event) => setDiscount(Number(event.target.value))}
                />
              </label>
              <label>
                Taxas da venda
                <input
                  name="fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={fee}
                  onChange={(event) => setFee(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Custo de entrega
                <input
                  name="deliveryCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deliveryCost}
                  onChange={(event) =>
                    setDeliveryCost(Number(event.target.value))
                  }
                />
              </label>
              <label>
                Cliente (opcional)
                <input
                  name="customer"
                  defaultValue={editing?.customer}
                  placeholder="Nome do cliente"
                />
              </label>
            </div>
            <label>
              Observações
              <textarea
                name="notes"
                defaultValue={editing?.notes}
                placeholder="Pedido, endereço, detalhes..."
              />
            </label>
            <div className="sale-calculation">
              <span>
                <small>Total bruto</small>
                <strong>{money.format(gross)}</strong>
              </span>
              <span>
                <small>Receita líquida</small>
                <strong>{money.format(netRevenue)}</strong>
              </span>
              <span>
                <small>Custo</small>
                <strong>{money.format(cost)}</strong>
              </span>
              <span className={profit >= 0 ? 'positive' : 'negative'}>
                <small>Lucro</small>
                <strong>{money.format(profit)}</strong>
              </span>
            </div>
            <SaveButton editing={!!editing} />
          </form>
        </EditorPanel>
        <section className="panel data-panel">
          <div className="panel-header responsive-header">
            <DataHeader title={`${records.items.length} vendas`} />
            <button
              className="export-small"
              onClick={() => exportSalesCsv(records.items)}
            >
              <Download size={14} /> Exportar
            </button>
          </div>
          <div className="category-filters">
            {['Todas', 'Concluída', 'Pendente', 'Cancelada'].map((status) => (
              <button
                key={status}
                className={statusFilter === status ? 'active' : ''}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
          {records.loading ? (
            <Loading />
          ) : visibleSales.length ? (
            <SalesTable
              items={visibleSales}
              onEdit={startEdit}
              onDelete={(id) => confirmDelete(() => records.remove(id))}
            />
          ) : (
            <EmptyState
              icon={<ShoppingCart />}
              title="Nenhuma venda encontrada"
              text="Lance a primeira venda para começar a medir seu resultado."
            />
          )}
        </section>
      </div>
    </>
  );
}

function exportSalesCsv(sales: Stored<Sale>[]) {
  const rows = [
    [
      'Data',
      'Produto',
      'Quantidade',
      'Preço unitário',
      'Bruto',
      'Desconto',
      'Taxas',
      'Entrega',
      'Líquido',
      'Custo',
      'Lucro',
      'Pagamento',
      'Canal',
      'Cliente',
      'Status',
    ],
    ...sales.map((sale) => [
      sale.date,
      sale.productName,
      sale.quantity,
      sale.unitPrice,
      sale.gross,
      sale.discount,
      sale.fee,
      sale.deliveryCost,
      sale.netRevenue,
      sale.cost,
      sale.profit,
      sale.payment,
      sale.channel,
      sale.customer,
      sale.status,
    ]),
  ];
  const blob = new Blob(
    [`\uFEFF${rows.map((row) => row.join(';')).join('\n')}`],
    { type: 'text/csv;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'doce-margem-vendas.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function EditorPanel({
  title,
  editing,
  onCancel,
  children,
}: {
  title: string;
  editing: boolean;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="panel form-panel">
      <div className="panel-header">
        <div>
          <p className="section-kicker">
            {editing ? 'MODO DE EDIÇÃO' : 'NOVO REGISTRO'}
          </p>
          <h2>{title}</h2>
        </div>
        {editing && (
          <button className="cancel-edit" onClick={onCancel}>
            <X size={14} /> Cancelar
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
function SaveButton({ editing }: { editing: boolean }) {
  return (
    <Button type="submit" className="form-submit">
      {editing ? <Pencil size={16} /> : <Plus size={16} />}
      {editing ? 'Salvar alterações' : 'Salvar registro'}
    </Button>
  );
}
function SaveToast({ text }: { text: string }) {
  return (
    <div className="save-toast">
      <CheckCircle2 size={16} /> {text}
    </div>
  );
}
function DataHeader({ title }: { title: string }) {
  return (
    <div>
      <p className="section-kicker">DADOS REAIS</p>
      <h2>{title}</h2>
    </div>
  );
}
function Loading() {
  return <div className="loading-state">Carregando dados...</div>;
}

function IngredientTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Stored<Ingredient>[];
  onEdit: (item: Stored<Ingredient>) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="product-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ingrediente</th>
            <th>Compra</th>
            <th>Custo útil</th>
            <th>Estoque</th>
            <th>Fornecedor</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isLow = item.minStock > 0 && item.stock <= item.minStock;
            return (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                  <small className="table-subtitle">
                    {item.category || 'Outros'}
                    {item.active === false ? ' · Inativo' : ''}
                  </small>
                </td>
                <td>
                  {item.unit} · {money.format(item.price)}
                  <small className="table-subtitle">
                    {item.wastePercent
                      ? `${item.wastePercent}% de perda`
                      : 'Sem perda informada'}
                  </small>
                </td>
                <td className="profit-value">
                  {money.format(
                    ingredientUnitCost(item.price, item.qty, item.wastePercent),
                  )}{' '}
                  / {item.baseUnit || 'un'}
                </td>
                <td>
                  <span className={isLow ? 'stock-pill low' : 'stock-pill'}>
                    {isLow && <AlertTriangle size={12} />}
                    {item.stock ?? item.qty} {item.baseUnit || 'un'}
                  </span>
                </td>
                <td>{item.supplier || '—'}</td>
                <td>
                  <RowActions
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item.id)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function PackagingTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Stored<Packaging>[];
  onEdit: (item: Stored<Packaging>) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="product-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Tipo</th>
            <th>Pacote</th>
            <th>Preço</th>
            <th>Custo unitário</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
              </td>
              <td>{item.type}</td>
              <td>{item.pack} un.</td>
              <td>{money.format(item.price)}</td>
              <td className="profit-value">
                {money.format(item.pack ? item.price / item.pack : 0)}
              </td>
              <td>
                <RowActions
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item.id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ExpenseTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Stored<Expense>[];
  onEdit: (item: Stored<Expense>) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="product-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Despesa</th>
            <th>Categoria</th>
            <th>Valor mensal</th>
            <th>Rateio / 650 un.</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
              </td>
              <td>{item.category}</td>
              <td>{money.format(item.value)}</td>
              <td>{money.format(item.value / 650)}</td>
              <td>
                <RowActions
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item.id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ProductTable({
  items,
  onEdit,
  onDelete,
  onDuplicate,
  readOnly = false,
}: {
  items: Stored<Product>[];
  onEdit?: (item: Stored<Product>) => void;
  onDelete?: (id: number) => void;
  onDuplicate?: (item: Stored<Product>) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="product-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Custo</th>
            <th>Preços</th>
            <th>Lucro</th>
            <th>Margem</th>
            {!readOnly && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
                <small className="table-subtitle">{item.size}</small>
              </td>
              <td>{money.format(item.cost)}</td>
              <td>
                <strong>{money.format(item.price)}</strong>
                <small className="table-subtitle">
                  Mín. {money.format(item.minimumPrice ?? item.cost)}
                  {item.promotionalPrice
                    ? ` · Promo ${money.format(item.promotionalPrice)}`
                    : ''}
                </small>
              </td>
              <td className="profit-value">{money.format(item.profit)}</td>
              <td>
                <span className="margin-pill">
                  {item.margin.toFixed(1).replace('.', ',')}%
                </span>
                {item.cmvPercent !== undefined && (
                  <small className="table-subtitle">
                    CMV {item.cmvPercent.toFixed(1).replace('.', ',')}%
                  </small>
                )}
              </td>
              {!readOnly && (
                <td>
                  <RowActions
                    onEdit={() => onEdit?.(item)}
                    onDuplicate={() => onDuplicate?.(item)}
                    onDelete={() => onDelete?.(item.id)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function SalesTable({
  items,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  items: Stored<Sale>[];
  onEdit?: (item: Stored<Sale>) => void;
  onDelete?: (id: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="product-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Venda</th>
            <th>Qtd.</th>
            <th>Receita líquida</th>
            <th>Lucro</th>
            <th>Pagamento</th>
            <th>Status</th>
            {!readOnly && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.productName}</strong>
                <small className="table-subtitle">
                  {item.date
                    ? new Date(`${item.date}T12:00:00`).toLocaleDateString(
                        'pt-BR',
                      )
                    : '—'}
                  {item.customer ? ` · ${item.customer}` : ''}
                </small>
              </td>
              <td>{item.quantity}</td>
              <td>
                <strong>{money.format(item.netRevenue)}</strong>
              </td>
              <td
                className={item.profit >= 0 ? 'profit-value' : 'negative-value'}
              >
                {money.format(item.profit)}
              </td>
              <td>
                {item.payment}
                <small className="table-subtitle">{item.channel}</small>
              </td>
              <td>
                <span
                  className={`sale-status ${item.status.toLocaleLowerCase('pt-BR').replace('í', 'i')}`}
                >
                  {item.status}
                </span>
              </td>
              {!readOnly && (
                <td>
                  <RowActions
                    onEdit={() => onEdit?.(item)}
                    onDelete={() => onDelete?.(item.id)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimulatorView() {
  const [margin, setMargin] = useState(55);
  const [ingredientCost, setIngredientCost] = useState(0);
  const [packagingCost, setPackagingCost] = useState(0);
  const [labor, setLabor] = useState(0);
  const [variableRate, setVariableRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [ingredientIncrease, setIngredientIncrease] = useState(0);
  const [monthlyUnits, setMonthlyUnits] = useState(650);
  const [fixedIncluded, setFixedIncluded] = useState(false);
  const expenses = useRecords<Expense>('expense');
  const monthlyFixed = expenses.items.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const fixedUnit = fixedIncluded
    ? monthlyFixed / Math.max(monthlyUnits, 1)
    : 0;
  const adjustedIngredientCost =
    ingredientCost * (1 + ingredientIncrease / 100);
  const pricing = calculatePricing({
    ingredients: adjustedIngredientCost,
    packaging: packagingCost,
    labor,
    fixedAllocation: fixedUnit,
    marketplacePercent: variableRate,
    targetMarginPercent: margin,
  });
  const promotion = calculatePromotion(
    pricing.recommendedPrice,
    discount,
    pricing.minimumPrice,
  );
  const finalPrice = promotion.promotionalPrice;
  const rateCost = (finalPrice * variableRate) / 100;
  const contribution =
    finalPrice - adjustedIngredientCost - packagingCost - labor - rateCost;
  const profit = contribution - fixedUnit;
  const breakEven = calculateBreakEven(
    monthlyFixed,
    finalPrice,
    adjustedIngredientCost + packagingCost + labor,
    variableRate,
  );
  return (
    <>
      <ModuleHeading
        eyebrow="LABORATÓRIO"
        title="Simulador"
        subtitle="Teste seus números reais sem alterar os produtos cadastrados."
      />
      <div className="simulator-layout">
        <section className="panel simulator-controls">
          <div className="panel-header">
            <DataHeader title="Ajuste as variáveis" />
          </div>
          <RangeField
            label="Margem desejada"
            value={margin}
            min={10}
            max={80}
            suffix="%"
            onChange={setMargin}
          />
          <RangeField
            label="Custo da receita"
            value={ingredientCost}
            min={0}
            max={100}
            step={0.1}
            prefix="R$"
            onChange={setIngredientCost}
          />
          <RangeField
            label="Custo da embalagem"
            value={packagingCost}
            min={0}
            max={30}
            step={0.1}
            prefix="R$"
            onChange={setPackagingCost}
          />
          <RangeField
            label="Mão de obra"
            value={labor}
            min={0}
            max={50}
            step={0.1}
            prefix="R$"
            onChange={setLabor}
          />
          <RangeField
            label="Taxas variáveis"
            value={variableRate}
            min={0}
            max={25}
            suffix="%"
            onChange={setVariableRate}
          />
          <RangeField
            label="Aumento dos ingredientes"
            value={ingredientIncrease}
            min={0}
            max={30}
            suffix="%"
            onChange={setIngredientIncrease}
          />
          <RangeField
            label="Desconto"
            value={discount}
            min={0}
            max={40}
            suffix="%"
            onChange={setDiscount}
          />
          <RangeField
            label="Produção mensal"
            value={monthlyUnits}
            min={1}
            max={3000}
            suffix=" un."
            onChange={setMonthlyUnits}
          />
          <label className="toggle-line">
            <span>
              <strong>Incluir despesas fixas</strong>
              <small>{money.format(fixedUnit)} por unidade</small>
            </span>
            <input
              type="checkbox"
              checked={fixedIncluded}
              onChange={(event) => setFixedIncluded(event.target.checked)}
            />
          </label>
        </section>
        <section className="simulator-result">
          <div className="price-orbit">
            <small>PREÇO SUGERIDO</small>
            <strong>{money.format(finalPrice)}</strong>
            <span>por unidade</span>
          </div>
          <div className="result-grid">
            <Result
              label="Custo total"
              value={money.format(pricing.totalCostBeforeRates)}
            />
            <Result
              label="Lucro unitário"
              value={money.format(profit)}
              positive
            />
            <Result label="Contribuição" value={money.format(contribution)} />
            <Result
              label="Markup"
              value={`${pricing.markup.toFixed(2).replace('.', ',')}×`}
            />
          </div>
          <div className="result-grid secondary-results">
            <Result
              label="Preço mínimo"
              value={money.format(pricing.minimumPrice)}
            />
            <Result
              label="CMV"
              value={`${pricing.cmvPercent.toFixed(1).replace('.', ',')}%`}
            />
            <Result
              label="Ponto de equilíbrio"
              value={`${breakEven.units} un.`}
            />
            <Result
              label="Faturamento de equilíbrio"
              value={money.format(breakEven.revenue)}
            />
          </div>
          <div className="health-banner">
            {promotion.belowMinimum ? (
              <AlertTriangle size={18} />
            ) : (
              <TrendingUp size={18} />
            )}
            <div>
              <strong>
                {promotion.belowMinimum
                  ? 'Preço promocional abaixo do mínimo'
                  : pricing.totalCostBeforeRates
                    ? 'Simulação atualizada'
                    : 'Informe os custos'}
              </strong>
              <small>
                {pricing.totalCostBeforeRates
                  ? promotion.belowMinimum
                    ? 'Reduza o desconto ou revise custos e taxas antes de vender.'
                    : 'O preço reflete custos, taxas, margem e cenário informado.'
                  : 'Comece pelo custo da receita.'}
              </small>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-field">
      <span>
        <strong>{label}</strong>
        <output>
          {prefix ? `${prefix} ` : ''}
          {value.toFixed(step < 1 ? 2 : 0).replace('.', ',')}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
function Result({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="result-item">
      <small>{label}</small>
      <strong className={positive ? 'profit-value' : ''}>{value}</strong>
    </div>
  );
}

function ReportsView() {
  const products = useRecords<Product>('product');
  const sales = useRecords<Sale>('sale');
  const reports = [
    {
      title: 'Vendas e resultado',
      detail: 'Faturamento, custos e lucro realizado',
      icon: ShoppingCart,
    },
    {
      title: 'Fichas técnicas',
      detail: 'Ingredientes, rendimento e custo por porção',
      icon: FlaskConical,
    },
    {
      title: 'Custos por produto',
      detail: 'Composição completa do custo unitário',
      icon: Calculator,
    },
    {
      title: 'Margens e lucratividade',
      detail: 'Preço, contribuição e lucro por item',
      icon: TrendingUp,
    },
  ];
  function csv() {
    const rows = [
      ['Produto', 'Custo', 'Preço', 'Margem', 'Lucro'],
      ...products.items.map((item) => [
        item.name,
        item.cost,
        item.price,
        item.margin,
        item.profit,
      ]),
    ];
    const blob = new Blob(
      [`\uFEFF${rows.map((row) => row.join(';')).join('\n')}`],
      { type: 'text/csv;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'doce-margem-relatorio.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <ModuleHeading
        eyebrow="ANÁLISE"
        title="Relatórios"
        subtitle="Acompanhe produtos e vendas com dados reais da sua conta."
        action={
          <Button
            onClick={() => exportSalesCsv(sales.items)}
            className="primary-action"
          >
            <Download size={16} /> Exportar vendas
          </Button>
        }
      />
      <section className="report-grid">
        {reports.map(({ title, detail, icon: Icon }) => (
          <article className="panel report-card" key={title}>
            <span>
              <Icon size={21} />
            </span>
            <div>
              <h2>{title}</h2>
              <p>{detail}</p>
            </div>
            <div className="report-actions">
              <button onClick={() => window.print()}>
                <FileText size={15} /> Salvar PDF
              </button>
              <button
                onClick={
                  title === 'Vendas e resultado'
                    ? () => exportSalesCsv(sales.items)
                    : csv
                }
              >
                <Download size={15} /> CSV
              </button>
            </div>
          </article>
        ))}
      </section>
      <section className="panel report-preview">
        <div className="panel-header">
          <DataHeader title="Histórico de vendas" />
          <span className="rate-badge">{sales.items.length} lançamentos</span>
        </div>
        {sales.items.length ? (
          <SalesTable items={sales.items} readOnly />
        ) : (
          <EmptyState
            icon={<ShoppingCart />}
            title="Sem vendas para o relatório"
            text="Lance vendas para acompanhar o resultado realizado."
          />
        )}
      </section>
      <section className="panel report-preview">
        <div className="panel-header">
          <DataHeader title="Lucratividade do portfólio" />
          <span className="rate-badge">Dados reais</span>
        </div>
        {products.items.length ? (
          <ProductTable items={products.items} readOnly />
        ) : (
          <EmptyState
            icon={<FileText />}
            title="Sem produtos para o relatório"
            text="Cadastre produtos para gerar sua análise."
          />
        )}
      </section>
    </>
  );
}
