import { useEffect, useReducer, useRef, useState } from 'react';
import Board from './components/Board';
import { createStrategy, heroes, initialMap } from './data/catalog';
import { strategyReducer } from './domain/strategy';
import { loadImage, validateImageFile } from './domain/image';
import type { EditorTool, HeroElement, Point, Role, Team } from './domain/types';

const roleLabels: Record<Role, string> = { tank: 'タンク', damage: 'ダメージ', support: 'サポート' };
const demoImage = initialMap.areas[0].image;

export default function App() {
  const [strategy, dispatch] = useReducer(strategyReducer, undefined, createStrategy);
  const [heroId, setHeroId] = useState(heroes[0].id);
  const [team, setTeam] = useState<Team>('ally');
  const [tool, setTool] = useState<EditorTool>('place');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  const elements = strategy.elements.filter((e): e is HeroElement => e.type === 'hero');
  const selected = elements.find(e => e.id === selectedId);

  useEffect(() => {
    let cancelled = false;
    const initialRequest = requestId.current;
    if (demoImage.kind === 'original-demo') loadImage(demoImage.url)
      .then(result => { if (!cancelled && requestId.current === initialRequest) setImage(result); })
      .catch((reason: Error) => { if (!cancelled && requestId.current === initialRequest) setError(reason.message); });
    return () => { cancelled = true; };
  }, []);

  function place(point: Point) {
    const id = crypto.randomUUID();
    dispatch({ type: 'place', element: { id, type: 'hero', heroId, team, position: point }, at: new Date().toISOString() });
    setSelectedId(id);
    setTool('select');
  }

  async function changeImage(file?: File) {
    if (file) {
      const message = validateImageFile(file);
      if (message) { setError(message); return; }
    }
    if (elements.length && !window.confirm('背景を変更すると現在のヒーロー配置をクリアします。変更しますか？')) return;
    const id = ++requestId.current;
    const url = file ? URL.createObjectURL(file) : demoImage.kind === 'original-demo' ? demoImage.url : '';
    setBusy(true);
    setError('');
    try {
      const result = await loadImage(url);
      if (id !== requestId.current) return;
      setImage(result);
      setLocalName(file?.name ?? null);
      setSelectedId(null);
      dispatch({ type: 'reset-map', revision: file ? `local-${crypto.randomUUID()}` : demoImage.revision, at: new Date().toISOString() });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '読み込みに失敗しました。');
    } finally {
      if (file) URL.revokeObjectURL(url);
      if (id === requestId.current) setBusy(false);
    }
  }

  return <div className="app">
    <header className="app-header">
      <div className="brand"><span className="brand-mark" aria-hidden="true">P</span><div><strong>OW2 PLANT</strong><span className="eyebrow">TACTICAL WORKSPACE</span></div></div>
      <span className="phase-tag">PHASE 01 <span>配置デモ</span></span>
    </header>
    <main>
      <div className="title-row">
        <div><p className="eyebrow">HYBRID / {initialMap.areas[0].name}</p><h1>{initialMap.name}</h1></div>
        <div className="status"><span className="status-dot" />編集中 · このPhaseでは保存されません</div>
      </div>
      <div className="workspace">
        <aside className="sidebar">
          <label className="field">戦術名<input maxLength={80} value={strategy.name} onChange={e => dispatch({ type: 'rename', name: e.target.value, at: new Date().toISOString() })} /></label>
          <label className="field">戦術のサイド<select value={strategy.side} onChange={e => dispatch({ type: 'side', side: e.target.value as typeof strategy.side, at: new Date().toISOString() })}>
            <option value="attack">攻撃</option><option value="defense">防衛</option><option value="common">共通</option>
          </select></label>
          <div className="section-heading"><h2>ヒーロー</h2><span>9 HEROES</span></div>
          <div className="segmented" aria-label="配置するチーム">
            <button aria-pressed={team === 'ally'} onClick={() => setTeam('ally')}>● 味方</button>
            <button aria-pressed={team === 'enemy'} onClick={() => setTeam('enemy')}>◌ 敵</button>
          </div>
          <div className="hero-catalog">
            {(Object.keys(roleLabels) as Role[]).map(role => <div className="role-group" key={role}>
              <h3>{roleLabels[role]}</h3><div className="hero-grid">{heroes.filter(h => h.role === role).map(hero =>
                <button key={hero.id} className="hero-button" aria-pressed={heroId === hero.id} onClick={() => { setHeroId(hero.id); setTool('place'); }}>
                  <span className="hero-badge">{hero.shortName}</span><span>{hero.name}</span>
                </button>)}</div>
            </div>)}
          </div>
          <p className="help">ヒーローを選び、盤面をタップして配置。配置後はそのままドラッグで移動できます。</p>
        </aside>
        <div className="editor">
          <div className="toolbar" aria-label="編集ツール">
            <div className="tool-group">
              <button aria-pressed={tool === 'select'} onClick={() => setTool('select')}>↖ 選択・移動</button>
              <button aria-pressed={tool === 'place'} onClick={() => setTool('place')}>＋ 配置</button>
              <button aria-pressed={tool === 'pan'} onClick={() => setTool('pan')}>✥ パン</button>
            </div>
            <span className="element-count" data-testid="element-count">{elements.length} 個配置</span>
          </div>
          <div className="map-notice">{localName ? `端末内の画像：${localName}` : 'デモ用の自作模式図です。King’s Rowの実際の地形ではありません。'}</div>
          {error && <p role="alert" className="error">{error}</p>}
          {image ? <Board key={strategy.mapRevision} image={image} elements={elements} tool={tool} onPlace={place}
            selectedId={selectedId} onSelect={setSelectedId}
            onMove={(id, position) => dispatch({ type: 'move', id, position, at: new Date().toISOString() })} />
            : <div className="loading" role="status">{error ? '背景画像を読み込めません。下のボタンで再試行できます。' : '盤面を読み込み中…'}</div>}
          <div className="board-footer"><span>PC：ホイールで拡大 · スマホ：2本指で拡大・移動</span><span>味方 ● / 敵 ◌</span></div>
          <details className="image-settings"><summary>背景画像の設定</summary>
            <p>利用権限のあるKing’s Row第1拠点の俯瞰画像を選択してください。画像は端末内でのみ使用し、送信・保存しません。</p>
            <label className="file-label">画像を選択（PNG / JPEG / WebP・10MBまで）<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => {
              const file = e.target.files?.[0]; e.target.value = ''; if (file) void changeImage(file);
            }} /></label>
            <button disabled={busy} onClick={() => void changeImage()}>デモ画像に戻す</button>
            {busy && <p role="status">画像を読み込み中…</p>}
          </details>
          <details className="placements"><summary>配置一覧（{elements.length}）</summary>
            {!elements.length && <p>まだ配置されていません。</p>}
            <ul>{elements.map(element => <li key={element.id} data-testid="placement" data-x={element.position.x} data-y={element.position.y}>
              <button onClick={() => { setSelectedId(element.id); setTool('select'); }} aria-pressed={selectedId === element.id}>
                {heroes.find(h => h.id === element.heroId)?.name} · {element.team === 'ally' ? '味方' : '敵'}
              </button><span>X {Math.round(element.position.x * 100)}% / Y {Math.round(element.position.y * 100)}%</span>
            </li>)}</ul>
            {selected && <div className="coordinate-fields"><p>選択中のヒーローを数値で移動（%）</p>
              {(['x', 'y'] as const).map(axis => <label key={axis}>{axis.toUpperCase()}<input type="number" min="0" max="100" step="1"
                value={Math.round(selected.position[axis] * 100)} onChange={e => {
                  if (!Number.isFinite(e.target.valueAsNumber)) return;
                  dispatch({ type: 'move', id: selected.id, position: { ...selected.position, [axis]: e.target.valueAsNumber / 100 }, at: new Date().toISOString() });
                }} /></label>)}
            </div>}
          </details>
        </div>
      </div>
    </main>
    <footer className="app-footer">非公式のファン制作ポートフォリオ。Blizzard Entertainmentとの提携・承認関係はありません。Overwatchおよび関連名称は各権利者に帰属します。</footer>
  </div>;
}
