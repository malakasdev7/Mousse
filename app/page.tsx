'use client';

import {
  AlertTriangle, ArrowUpRight, BarChart3, Bell, Calculator, ChevronDown,
  CircleDollarSign, Download, FileText, FlaskConical, Menu, Moon, PackageOpen, Plus,
  Search, Settings, ShoppingBasket, Sparkles, Sun, TrendingUp,
  UtensilsCrossed, WalletCards, X, Copy, CheckCircle2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const products = [
  { name: 'Mousse de maracujá', size: '150 ml', cost: 4.82, price: 12, margin: 59.8, profit: 7.18, tone: 'amber' },
  { name: 'Mousse de chocolate', size: '250 ml', cost: 7.46, price: 18, margin: 58.6, profit: 10.54, tone: 'cocoa' },
  { name: 'Trio degustação', size: '3 × 100 ml', cost: 11.9, price: 29.9, margin: 60.2, profit: 18, tone: 'berry' },
  { name: 'Premium de pistache', size: '180 ml', cost: 9.64, price: 22, margin: 56.2, profit: 12.36, tone: 'sage' },
];

const nav = [
  { label: 'Visão geral', icon: BarChart3 }, { label: 'Ingredientes', icon: ShoppingBasket },
  { label: 'Embalagens', icon: PackageOpen }, { label: 'Receitas', icon: FlaskConical },
  { label: 'Produtos', icon: UtensilsCrossed }, { label: 'Despesas', icon: WalletCards },
  { label: 'Simulador', icon: Calculator }, { label: 'Relatórios', icon: FileText },
];

export default function Home() {
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeView, setActiveView] = useState('Visão geral');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <aside className={`sidebar-shell ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <div><p className="brand-name">Doce Margem</p><p className="brand-kicker">Gestão de preços</p></div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <nav className="main-nav" aria-label="Navegação principal">
          <p className="nav-label">Minha operação</p>
          {nav.map(({ label, icon: Icon }, index) => (
            <button key={label} onClick={() => { setActiveView(label); setMobileOpen(false); }} className={`nav-item ${activeView === label ? 'active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === 'Ingredientes' && <span className="nav-count">24</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="monthly-card">
            <span className="mini-icon"><TrendingUp size={15} /></span><p>Resultado projetado</p>
            <strong>{money.format(4280)}</strong><small>+12,4% neste mês</small>
          </div>
          <button className="nav-item"><Settings size={18} /><span>Configurações</span></button>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}

      <section className="app-content">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="search-box"><Search size={17} /><input aria-label="Buscar" placeholder="Buscar receitas, produtos, insumos..." /><kbd>⌘ K</kbd></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Alternar tema" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-button notification-button" aria-label="Notificações"><Bell size={18} /><span /></button>
            <div className="user-chip"><div className="avatar">GM</div><div><strong>Gustavo</strong><small>Administrador</small></div><ChevronDown size={15} /></div>
          </div>
        </header>

        <div className="page-wrap">
          {activeView === 'Visão geral' ? <>
          <div className="page-heading">
            <div><p className="eyebrow">SEGUNDA, 31 DE AGOSTO</p><h1>Olá, Gustavo. Vamos precificar?</h1><p>Acompanhe seus custos e mantenha cada pote realmente lucrativo.</p></div>
            <Button onClick={() => setActiveView('Produtos')} className="primary-action"><Plus size={17} /> Novo produto</Button>
          </div>
          <div className="alert-strip">
            <div className="alert-icon"><AlertTriangle size={19} /></div>
            <div><strong>2 insumos tiveram aumento de custo</strong><p>O chocolate subiu 8,2% e pode reduzir sua margem em até 2,4 pontos.</p></div>
            <button>Revisar preços <ArrowUpRight size={15} /></button>
          </div>
          <section className="metric-grid" aria-label="Indicadores principais">
            <Metric icon={<CircleDollarSign size={20} />} label="Faturamento estimado" value={money.format(7420)} detail="↑ 8,6% vs. mês anterior" tone="rose" />
            <Metric icon={<WalletCards size={20} />} label="Custo médio por produto" value={money.format(7.18)} detail="↓ R$ 0,24 neste mês" tone="cream" />
            <Metric icon={<TrendingUp size={20} />} label="Margem média" value="58,7%" detail="Meta mensal: 55%" tone="sage" />
            <Metric icon={<UtensilsCrossed size={20} />} label="Produtos precificados" value="12" detail="4 atualizados esta semana" tone="lilac" />
          </section>

          <section className="dashboard-grid">
            <article className="panel performance-panel">
              <div className="panel-header"><div><p className="section-kicker">DESEMPENHO</p><h2>Custo, preço e lucro</h2></div><select aria-label="Período"><option>Últimos 6 meses</option><option>Este ano</option></select></div>
              <div className="chart-legend"><span><i className="dot cost" /> Custo</span><span><i className="dot revenue" /> Venda</span><span><i className="dot profit" /> Lucro</span></div>
              <div className="bar-chart" aria-label="Comparação de custo, venda e lucro por mês">
                {[42, 51, 47, 63, 59, 72].map((height, index) => <div className="bar-month" key={index}><div className="bar-group"><span className="bar cost" style={{ height: `${height * .46}%` }} /><span className="bar revenue" style={{ height: `${height}%` }} /><span className="bar profit" style={{ height: `${height * .54}%` }} /></div><small>{['Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'][index]}</small></div>)}
              </div>
            </article>
            <article className="panel quick-panel">
              <div className="panel-header"><div><p className="section-kicker">ATALHOS</p><h2>Precifique mais rápido</h2></div></div>
              <QuickLink onClick={() => setActiveView('Simulador')} icon={<Calculator size={19} />} tone="rose" title="Simular preço" detail="Teste margem, desconto e atacado" />
              <QuickLink onClick={() => setActiveView('Receitas')} icon={<FlaskConical size={19} />} tone="gold" title="Nova receita" detail="Monte uma ficha técnica completa" />
              <QuickLink onClick={() => setActiveView('Ingredientes')} icon={<ShoppingBasket size={19} />} tone="green" title="Registrar compra" detail="Atualize o custo dos insumos" />
            </article>
          </section>

          <section className="panel products-panel">
            <div className="panel-header"><div><p className="section-kicker">PORTFÓLIO</p><h2>Rentabilidade dos produtos</h2></div><button className="text-button">Ver todos <ArrowUpRight size={15} /></button></div>
            <div className="product-table-wrap"><table><thead><tr><th>Produto</th><th>Custo unit.</th><th>Preço</th><th>Margem</th><th>Lucro</th><th /></tr></thead>
              <tbody>{products.map((product) => <tr key={product.name}><td><div className="product-cell"><span className={`product-dot ${product.tone}`} /><div><strong>{product.name}</strong><small>{product.size}</small></div></div></td><td>{money.format(product.cost)}</td><td><strong>{money.format(product.price)}</strong></td><td><span className="margin-pill">{product.margin.toFixed(1).replace('.', ',')}%</span></td><td className="profit-value">+{money.format(product.profit)}</td><td><button className="row-button" aria-label={`Abrir ${product.name}`}><ArrowUpRight size={16} /></button></td></tr>)}</tbody>
            </table></div>
          </section>
          </> : <ModuleView view={activeView} />}
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>;
}

function QuickLink({ icon, tone, title, detail, onClick }: { icon: React.ReactNode; tone: string; title: string; detail: string; onClick?: () => void }) {
  return <button onClick={onClick} className="quick-link"><span className={`quick-icon ${tone}`}>{icon}</span><div><strong>{title}</strong><small>{detail}</small></div><ArrowUpRight size={17} /></button>;
}

const ingredientSeed = [
  { name: 'Leite condensado', unit: 'caixa 395 g', qty: 395, price: 6.49, supplier: 'Atacadão', date: '28/08/2026', expiry: '12/2026' },
  { name: 'Creme de leite', unit: 'caixa 200 g', qty: 200, price: 3.79, supplier: 'Assaí', date: '27/08/2026', expiry: '01/2027' },
  { name: 'Chocolate 50%', unit: 'pacote 1 kg', qty: 1000, price: 39.9, supplier: 'Cacau Foods', date: '25/08/2026', expiry: '02/2027' },
  { name: 'Polpa de maracujá', unit: 'pacote 1 kg', qty: 1000, price: 18.5, supplier: 'Fruta Boa', date: '22/08/2026', expiry: '11/2026' },
];
const packageSeed = [
  { name: 'Pote cristal 150 ml', type: 'Pote', pack: 50, price: 34.5 }, { name: 'Tampa 150 ml', type: 'Tampa', pack: 50, price: 14.5 },
  { name: 'Colher sobremesa', type: 'Colher', pack: 100, price: 8.9 }, { name: 'Etiqueta redonda', type: 'Etiqueta', pack: 100, price: 22 },
];
const recipeSeed = [
  { name: 'Mousse de maracujá', ingredients: 4, yield: '1.250 g', waste: 3, cost: 27.84, unit: 0.0223 },
  { name: 'Mousse de chocolate', ingredients: 5, yield: '1.100 g', waste: 2, cost: 35.62, unit: 0.0324 },
  { name: 'Ganache meio amargo', ingredients: 3, yield: '600 g', waste: 1, cost: 24.8, unit: 0.0413 },
];
const expenseSeed = [
  { name: 'Aluguel', category: 'Estrutura', value: 1200 }, { name: 'Energia', category: 'Utilidades', value: 380 },
  { name: 'Gás', category: 'Utilidades', value: 160 }, { name: 'Marketing', category: 'Comercial', value: 250 },
  { name: 'Pró-labore', category: 'Pessoal', value: 1800 },
];

function ModuleView({ view }: { view: string }) {
  const [ingredients, setIngredients] = useState(ingredientSeed);
  const [packages, setPackages] = useState(packageSeed);
  const [expenses, setExpenses] = useState(expenseSeed);
  const [saved, setSaved] = useState(false);
  const [margin, setMargin] = useState(55);
  const [ingredientCost, setIngredientCost] = useState(4.82);
  const [packagingCost, setPackagingCost] = useState(0.96);
  const [labor, setLabor] = useState(1.25);
  const [variableRate, setVariableRate] = useState(5);
  const [discount, setDiscount] = useState(0);
  const [fixedIncluded, setFixedIncluded] = useState(true);
  useEffect(() => {
    fetch('/api/records').then((response) => response.ok ? response.json() : []).then((records: Array<{ kind: string; payload: Record<string, unknown> }>) => {
      const storedIngredients = records.filter((record) => record.kind === 'ingredient').map((record) => record.payload as typeof ingredientSeed[number]);
      const storedPackages = records.filter((record) => record.kind === 'packaging').map((record) => record.payload as typeof packageSeed[number]);
      const storedExpenses = records.filter((record) => record.kind === 'expense').map((record) => record.payload as typeof expenseSeed[number]);
      if (storedIngredients.length) setIngredients([...storedIngredients, ...ingredientSeed]);
      if (storedPackages.length) setPackages([...storedPackages, ...packageSeed]);
      if (storedExpenses.length) setExpenses([...storedExpenses, ...expenseSeed]);
    }).catch(() => undefined);
  }, []);
  const monthlyUnits = 650;
  const fixedTotal = expenses.reduce((sum, item) => sum + item.value, 0);
  const fixedUnit = fixedIncluded ? fixedTotal / monthlyUnits : 0;
  const baseCost = ingredientCost + packagingCost + labor + fixedUnit;
  const salePrice = baseCost / (1 - margin / 100 - variableRate / 100);
  const finalPrice = salePrice * (1 - discount / 100);
  const contribution = finalPrice - (ingredientCost + packagingCost + labor + finalPrice * variableRate / 100);

  function persist(kind: string, payload: Record<string, unknown>) {
    setSaved(true);
    fetch('/api/records', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, payload }) }).catch(() => undefined);
    window.setTimeout(() => setSaved(false), 2200);
  }

  if (view === 'Simulador') return <SimulatorView margin={margin} setMargin={setMargin} ingredientCost={ingredientCost} setIngredientCost={setIngredientCost} packagingCost={packagingCost} setPackagingCost={setPackagingCost} labor={labor} setLabor={setLabor} variableRate={variableRate} setVariableRate={setVariableRate} discount={discount} setDiscount={setDiscount} fixedIncluded={fixedIncluded} setFixedIncluded={setFixedIncluded} fixedUnit={fixedUnit} baseCost={baseCost} finalPrice={finalPrice} contribution={contribution} />;
  if (view === 'Relatórios') return <ReportsView />;
  if (view === 'Produtos') return <ProductsView persist={persist} saved={saved} />;
  if (view === 'Receitas') return <RecipesView persist={persist} saved={saved} />;

  const isIngredients = view === 'Ingredientes';
  const isPackages = view === 'Embalagens';
  const isExpenses = view === 'Despesas';
  const title = isIngredients ? 'Ingredientes e compras' : isPackages ? 'Embalagens e adicionais' : 'Despesas fixas e rateio';
  const subtitle = isIngredients ? 'Acompanhe custo fracionado, fornecedores, validade e histórico de compra.' : isPackages ? 'Centralize potes, tampas, etiquetas e todos os extras de cada venda.' : 'Entenda quanto da estrutura mensal precisa entrar no preço de cada unidade.';

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (isIngredients) {
      const item = { name: String(form.get('name')), unit: String(form.get('unit')), qty: Number(form.get('qty')), price: Number(form.get('price')), supplier: String(form.get('supplier')), date: new Date().toLocaleDateString('pt-BR'), expiry: String(form.get('expiry')) };
      setIngredients([item, ...ingredients]); persist('ingredient', item);
    } else if (isPackages) {
      const item = { name: String(form.get('name')), type: String(form.get('type')), pack: Number(form.get('qty')), price: Number(form.get('price')) };
      setPackages([item, ...packages]); persist('packaging', item);
    } else {
      const item = { name: String(form.get('name')), category: String(form.get('type')), value: Number(form.get('price')) };
      setExpenses([item, ...expenses]); persist('expense', item);
    }
    event.currentTarget.reset();
  }

  return <>
    <ModuleHeading eyebrow="CADASTRO" title={title} subtitle={subtitle} />
    {saved && <div className="save-toast"><CheckCircle2 size={16} /> Registro salvo com sucesso</div>}
    <div className="module-layout">
      <section className="panel form-panel">
        <div className="panel-header"><div><p className="section-kicker">NOVO REGISTRO</p><h2>{isIngredients ? 'Registrar ingrediente' : isPackages ? 'Adicionar embalagem' : 'Adicionar despesa mensal'}</h2></div></div>
        <form onSubmit={submit} className="data-form">
          <label>Nome<input name="name" required placeholder={isIngredients ? 'Ex.: Leite condensado' : isPackages ? 'Ex.: Pote 150 ml' : 'Ex.: Energia'} /></label>
          <div className="form-row">
            <label>{isIngredients ? 'Unidade de compra' : isPackages ? 'Categoria' : 'Categoria'}<input name={isIngredients ? 'unit' : 'type'} required placeholder={isIngredients ? 'Ex.: caixa 395 g' : 'Ex.: Utilidades'} /></label>
            <label>{isExpenses ? 'Valor mensal' : 'Quantidade comprada'}<input name={isExpenses ? 'price' : 'qty'} required type="number" step="0.01" placeholder="0,00" /></label>
          </div>
          {!isExpenses && <div className="form-row"><label>Preço pago<input name="price" required type="number" step="0.01" placeholder="R$ 0,00" /></label>{isIngredients && <label>Fornecedor<input name="supplier" required placeholder="Nome do fornecedor" /></label>}</div>}
          {isIngredients && <label>Validade<input name="expiry" type="month" /></label>}
          <Button type="submit" className="form-submit"><Plus size={16} /> Salvar registro</Button>
        </form>
      </section>
      <section className="panel data-panel">
        <div className="panel-header"><div><p className="section-kicker">VISÃO ATUAL</p><h2>{isExpenses ? `${money.format(fixedTotal)} por mês` : `${isIngredients ? ingredients.length : packages.length} itens cadastrados`}</h2></div>{isExpenses && <span className="rate-badge">{money.format(fixedTotal / monthlyUnits)} / unidade</span>}</div>
        {isExpenses ? <ExpenseTable items={expenses} /> : isIngredients ? <IngredientTable items={ingredients} /> : <PackageTable items={packages} />}
      </section>
    </div>
  </>;
}

function ModuleHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="page-heading module-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function IngredientTable({ items }: { items: typeof ingredientSeed }) {
  return <div className="product-table-wrap"><table><thead><tr><th>Ingrediente</th><th>Compra</th><th>Custo fracionado</th><th>Fornecedor</th><th>Validade</th></tr></thead><tbody>{items.map((item, i) => <tr key={`${item.name}-${i}`}><td><strong>{item.name}</strong></td><td>{item.unit} · {money.format(item.price)}</td><td className="profit-value">{money.format(item.price / item.qty)} / g/ml/un.</td><td>{item.supplier}</td><td>{item.expiry || '—'}</td></tr>)}</tbody></table></div>;
}
function PackageTable({ items }: { items: typeof packageSeed }) {
  return <div className="product-table-wrap"><table><thead><tr><th>Item</th><th>Tipo</th><th>Pacote</th><th>Preço pago</th><th>Custo unitário</th></tr></thead><tbody>{items.map((item, i) => <tr key={`${item.name}-${i}`}><td><strong>{item.name}</strong></td><td>{item.type}</td><td>{item.pack} un.</td><td>{money.format(item.price)}</td><td className="profit-value">{money.format(item.price / item.pack)}</td></tr>)}</tbody></table></div>;
}
function ExpenseTable({ items }: { items: typeof expenseSeed }) {
  return <div className="product-table-wrap"><table><thead><tr><th>Despesa</th><th>Categoria</th><th>Valor mensal</th><th>Rateio / 650 un.</th></tr></thead><tbody>{items.map((item, i) => <tr key={`${item.name}-${i}`}><td><strong>{item.name}</strong></td><td>{item.category}</td><td>{money.format(item.value)}</td><td>{money.format(item.value / 650)}</td></tr>)}</tbody></table></div>;
}

function RecipesView({ persist, saved }: { persist: (kind: string, payload: Record<string, unknown>) => void; saved: boolean }) {
  const [recipes, setRecipes] = useState(recipeSeed);
  useEffect(() => { fetch('/api/records').then((response) => response.ok ? response.json() : []).then((records: Array<{ kind: string; payload: typeof recipeSeed[number] }>) => { const savedRecipes = records.filter((record) => record.kind === 'recipe').map((record) => record.payload); if (savedRecipes.length) setRecipes([...savedRecipes, ...recipeSeed]); }).catch(() => undefined); }, []);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const cost = Number(form.get('cost')); const yieldQty = Number(form.get('yield')); const waste = Number(form.get('waste'));
    const item = { name: String(form.get('name')), ingredients: Number(form.get('ingredients')), yield: `${yieldQty.toLocaleString('pt-BR')} g`, waste, cost: cost * (1 + waste / 100), unit: cost * (1 + waste / 100) / yieldQty };
    setRecipes([item, ...recipes]); persist('recipe', item); event.currentTarget.reset();
  }
  return <>
    <ModuleHeading eyebrow="FICHAS TÉCNICAS" title="Receitas" subtitle="Transforme compras em custo por grama, ml ou porção — com perdas incluídas." />
    {saved && <div className="save-toast"><CheckCircle2 size={16} /> Receita salva com sucesso</div>}
    <div className="module-layout">
      <section className="panel form-panel"><div className="panel-header"><div><p className="section-kicker">NOVA FICHA</p><h2>Montar receita</h2></div></div>
        <form onSubmit={submit} className="data-form"><label>Nome da receita<input name="name" required placeholder="Ex.: Mousse de limão" /></label><div className="form-row"><label>Nº de ingredientes<input name="ingredients" type="number" required defaultValue="4" /></label><label>Custo dos ingredientes<input name="cost" type="number" step="0.01" required placeholder="R$ 0,00" /></label></div><div className="form-row"><label>Rendimento total (g/ml)<input name="yield" type="number" required placeholder="1000" /></label><label>Perda opcional (%)<input name="waste" type="number" step="0.1" defaultValue="0" /></label></div><label>Observações<textarea name="notes" placeholder="Textura, preparo, conservação..." /></label><Button type="submit" className="form-submit"><Plus size={16} /> Salvar ficha técnica</Button></form>
      </section>
      <section className="panel data-panel"><div className="panel-header"><div><p className="section-kicker">RECEITAS ATIVAS</p><h2>{recipes.length} fichas técnicas</h2></div></div><div className="recipe-list">{recipes.map((recipe, i) => <article className="recipe-card" key={`${recipe.name}-${i}`}><div className="recipe-top"><span className="recipe-glyph"><FlaskConical size={18} /></span><div><strong>{recipe.name}</strong><small>{recipe.ingredients} ingredientes · rendimento {recipe.yield}</small></div><button aria-label="Duplicar receita" onClick={() => { const copy = { ...recipe, name: `${recipe.name} (cópia)` }; setRecipes([copy, ...recipes]); persist('recipe', copy); }}><Copy size={15} /></button></div><div className="recipe-metrics"><span><small>Custo total</small><strong>{money.format(recipe.cost)}</strong></span><span><small>Custo por g/ml</small><strong>{money.format(recipe.unit)}</strong></span><span><small>Perda</small><strong>{recipe.waste}%</strong></span></div></article>)}</div></section>
    </div>
  </>;
}

function ProductsView({ persist, saved }: { persist: (kind: string, payload: Record<string, unknown>) => void; saved: boolean }) {
  const [items, setItems] = useState(products);
  useEffect(() => { fetch('/api/records').then((response) => response.ok ? response.json() : []).then((records: Array<{ kind: string; payload: typeof products[number] }>) => { const savedProducts = records.filter((record) => record.kind === 'product').map((record) => record.payload); if (savedProducts.length) setItems([...savedProducts, ...products]); }).catch(() => undefined); }, []);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const cost = Number(form.get('ingredients')) + Number(form.get('packaging')) + Number(form.get('extras')) + Number(form.get('labor')) + Number(form.get('fees')); const margin = Number(form.get('margin')); const price = cost / (1 - margin / 100); const item = { name: String(form.get('name')), size: String(form.get('size')), cost, price, margin, profit: price - cost, tone: 'berry' }; setItems([item, ...items]); persist('product', item); event.currentTarget.reset();
  }
  return <>
    <ModuleHeading eyebrow="PRECIFICAÇÃO" title="Produtos finais" subtitle="Some receita, embalagem, adicionais, trabalho e taxas para encontrar o preço sustentável." />
    {saved && <div className="save-toast"><CheckCircle2 size={16} /> Produto precificado e salvo</div>}
    <div className="module-layout">
      <section className="panel form-panel"><div className="panel-header"><div><p className="section-kicker">NOVO PRODUTO</p><h2>Compor custo final</h2></div></div><form onSubmit={submit} className="data-form"><div className="form-row"><label>Nome<input name="name" required placeholder="Mousse premium" /></label><label>Tamanho<input name="size" required placeholder="180 ml" /></label></div><label>Receita base<select name="recipe"><option>Mousse de maracujá</option><option>Mousse de chocolate</option><option>Ganache meio amargo</option></select></label><div className="form-row"><label>Custo da receita usada<input name="ingredients" type="number" step="0.01" required placeholder="R$ 0,00" /></label><label>Embalagem<input name="packaging" type="number" step="0.01" required defaultValue="0.96" /></label></div><div className="form-row"><label>Toppings e adicionais<input name="extras" type="number" step="0.01" defaultValue="0" /></label><label>Mão de obra<input name="labor" type="number" step="0.01" defaultValue="1.25" /></label></div><div className="form-row"><label>Entrega, comissão e impostos<input name="fees" type="number" step="0.01" defaultValue="0" /></label><label>Margem desejada (%)<input name="margin" type="number" step="0.1" defaultValue="55" /></label></div><Button type="submit" className="form-submit"><Calculator size={16} /> Calcular e salvar</Button></form></section>
      <section className="panel data-panel"><div className="panel-header"><div><p className="section-kicker">PREÇOS ATUAIS</p><h2>Comparação de rentabilidade</h2></div></div><div className="product-table-wrap"><table><thead><tr><th>Produto</th><th>Custo</th><th>Preço sugerido</th><th>Lucro</th><th>Margem</th><th /></tr></thead><tbody>{items.map((item, i) => <tr key={`${item.name}-${i}`}><td><strong>{item.name}</strong><small className="table-subtitle">{item.size}</small></td><td>{money.format(item.cost)}</td><td><strong>{money.format(item.price)}</strong></td><td className="profit-value">+{money.format(item.profit)}</td><td><span className="margin-pill">{item.margin.toFixed(1).replace('.', ',')}%</span></td><td><button className="row-button" aria-label="Duplicar produto" onClick={() => { const copy = { ...item, name: `${item.name} (cópia)` }; setItems([copy, ...items]); persist('product', copy); }}><Copy size={14} /></button></td></tr>)}</tbody></table></div></section>
    </div>
  </>;
}

type SimulatorProps = { margin:number;setMargin:(v:number)=>void;ingredientCost:number;setIngredientCost:(v:number)=>void;packagingCost:number;setPackagingCost:(v:number)=>void;labor:number;setLabor:(v:number)=>void;variableRate:number;setVariableRate:(v:number)=>void;discount:number;setDiscount:(v:number)=>void;fixedIncluded:boolean;setFixedIncluded:(v:boolean)=>void;fixedUnit:number;baseCost:number;finalPrice:number;contribution:number };
function SimulatorView(props: SimulatorProps) {
  const markup = props.finalPrice / props.baseCost;
  const profit = props.finalPrice - props.baseCost - props.finalPrice * props.variableRate / 100;
  return <>
    <ModuleHeading eyebrow="LABORATÓRIO DE PREÇOS" title="Simulador" subtitle="Teste cenários sem alterar seus produtos cadastrados." />
    <div className="simulator-layout">
      <section className="panel simulator-controls"><div className="panel-header"><div><p className="section-kicker">CENÁRIO</p><h2>Ajuste as variáveis</h2></div></div>
        <RangeField label="Margem desejada" value={props.margin} min={10} max={80} suffix="%" onChange={props.setMargin} />
        <RangeField label="Custo da receita" value={props.ingredientCost} min={1} max={20} step={.1} prefix="R$" onChange={props.setIngredientCost} />
        <RangeField label="Custo da embalagem" value={props.packagingCost} min={.1} max={8} step={.1} prefix="R$" onChange={props.setPackagingCost} />
        <RangeField label="Mão de obra" value={props.labor} min={0} max={10} step={.1} prefix="R$" onChange={props.setLabor} />
        <RangeField label="Taxas variáveis" value={props.variableRate} min={0} max={25} suffix="%" onChange={props.setVariableRate} />
        <RangeField label="Promoção / desconto" value={props.discount} min={0} max={40} suffix="%" onChange={props.setDiscount} />
        <label className="toggle-line"><span><strong>Incluir despesas fixas</strong><small>Rateio atual: {money.format(props.fixedUnit)} por unidade</small></span><input type="checkbox" checked={props.fixedIncluded} onChange={(e) => props.setFixedIncluded(e.target.checked)} /></label>
      </section>
      <section className="simulator-result"><div className="price-orbit"><small>PREÇO SUGERIDO</small><strong>{money.format(props.finalPrice)}</strong><span>por unidade</span></div><div className="result-grid"><Result label="Custo total" value={money.format(props.baseCost)} /><Result label="Lucro unitário" value={money.format(profit)} positive /><Result label="Contribuição" value={money.format(props.contribution)} /><Result label="Markup" value={`${markup.toFixed(2).replace('.', ',')}×`} /></div><div className={`health-banner ${profit > 0 ? 'healthy' : ''}`}><TrendingUp size={18} /><div><strong>{profit > 0 ? 'Cenário saudável' : 'Atenção à margem'}</strong><small>{profit > 0 ? 'O preço cobre custos, taxas e a margem escolhida.' : 'Reduza o desconto ou ajuste o preço.'}</small></div></div></section>
    </div>
  </>;
}
function RangeField({ label, value, min, max, step=1, prefix, suffix, onChange }: { label:string;value:number;min:number;max:number;step?:number;prefix?:string;suffix?:string;onChange:(v:number)=>void }) { return <label className="range-field"><span><strong>{label}</strong><output>{prefix ? `${prefix} ` : ''}{value.toFixed(step < 1 ? 2 : 0).replace('.', ',')}{suffix}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>; }
function Result({ label, value, positive }: { label:string;value:string;positive?:boolean }) { return <div className="result-item"><small>{label}</small><strong className={positive ? 'profit-value' : ''}>{value}</strong></div>; }

function ReportsView() {
  const reports = [
    { title:'Fichas técnicas', detail:'Ingredientes, rendimento, perda e custo por porção', icon:FlaskConical },
    { title:'Custos por produto', detail:'Composição completa do custo unitário', icon:Calculator },
    { title:'Margens e lucratividade', detail:'Preço, contribuição e lucro por item', icon:TrendingUp },
    { title:'Histórico de compras', detail:'Evolução de preços por ingrediente e fornecedor', icon:ShoppingBasket },
  ];
  function csv() { const rows = [['Produto','Custo','Preço','Margem','Lucro'],...products.map(p=>[p.name,p.cost,p.price,p.margin,p.profit])]; const content = rows.map(row=>row.join(';')).join('\n'); const blob = new Blob([`\uFEFF${content}`],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const anchor=document.createElement('a'); anchor.href=url; anchor.download='doce-margem-relatorio.csv'; anchor.click(); URL.revokeObjectURL(url); }
  return <><ModuleHeading eyebrow="ANÁLISE" title="Relatórios" subtitle="Leve seus números para reuniões, contabilidade ou planejamento." action={<Button onClick={csv} className="primary-action"><Download size={16}/> Exportar CSV</Button>} /><section className="report-grid">{reports.map(({title,detail,icon:Icon})=><article className="panel report-card" key={title}><span><Icon size={21}/></span><div><h2>{title}</h2><p>{detail}</p></div><div className="report-actions"><button onClick={()=>window.print()}><FileText size={15}/> Salvar PDF</button><button onClick={csv}><Download size={15}/> CSV</button></div></article>)}</section><section className="panel report-preview"><div className="panel-header"><div><p className="section-kicker">PRÉVIA</p><h2>Lucratividade do portfólio</h2></div><span className="rate-badge">Atualizado agora</span></div><div className="product-table-wrap"><table><thead><tr><th>Produto</th><th>Custo</th><th>Preço</th><th>Margem</th><th>Lucro</th></tr></thead><tbody>{products.map(p=><tr key={p.name}><td><strong>{p.name}</strong></td><td>{money.format(p.cost)}</td><td>{money.format(p.price)}</td><td>{p.margin.toFixed(1).replace('.',',')}%</td><td className="profit-value">{money.format(p.profit)}</td></tr>)}</tbody></table></div></section></>;
}
