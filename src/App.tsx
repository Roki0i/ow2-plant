import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Board from './components/Board';
import { createStrategy, heroes, initialMap } from './data/catalog';
import type { HistoryAction } from './domain/history';
import { createWorkspace, workspaceReducer } from './domain/workspace';
import { copyStrategy, exportStrategy, importStrategy, loadStrategies, MAX_JSON_SIZE, saveStrategies, STORAGE_KEY } from './domain/persistence';
import { loadImage, validateImageFile } from './domain/image';
import type { BoardElement, EditorTool, HeroElement, Point, Role, Team } from './domain/types';

const roleLabels: Record<Role, string> = { tank: 'タンク', damage: 'ダメージ', support: 'サポート' };
const demoImage = initialMap.areas[0].image;

export default function App() {
  const [initial, setInitial] = useState(() => {
    try { return { strategies: loadStrategies(window.localStorage), raw: window.localStorage.getItem(STORAGE_KEY), error: '' }; }
    catch { return { strategies: [], raw: null, error: '保存データを読み込めませんでした。既存の保存領域は上書きしていません。JSON Exportで編集内容を退避できます。' }; }
  });
  const baseline = useRef<string | null>(initial.raw);
  const baselineReady = useRef(true);
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef(false);
  const [workspace, update] = useReducer(workspaceReducer, initial.strategies, createWorkspace);
  const history = workspace.entries.find(e => e.present.id === workspace.activeId)!;
  const dispatch = useCallback((action: HistoryAction) => update({ type: 'edit', action }), []);
  const [storageError, setStorageError] = useState(initial.error);
  const [savedEntries, setSavedEntries] = useState<typeof workspace.entries | null>(null);
  const [notice, setNotice] = useState('');
  const localImages = useRef(new Map<string, { image: HTMLImageElement; name: string }>());
  useEffect(() => {
    function changed(event: StorageEvent) {
      if (event.storageArea !== window.localStorage || (event.key !== STORAGE_KEY && event.key !== null)) return;
      if (window.localStorage.getItem(STORAGE_KEY) !== baseline.current) {
        conflictRef.current = true; setConflict(true);
      }
    }
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  useEffect(() => {
    if (initial.error || conflictRef.current) return;
    try {
      const latest = window.localStorage.getItem(STORAGE_KEY);
      if (baselineReady.current && latest !== baseline.current) {
        conflictRef.current = true;
        // Reflect an external storage change without overwriting in-memory edits.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConflict(true); return;
      }
      saveStrategies(window.localStorage, workspace.entries.map(e => e.present));
      baseline.current = window.localStorage.getItem(STORAGE_KEY); baselineReady.current = true;
      // Reflect the result of the synchronous external storage write.
      setSavedEntries(workspace.entries);
      setStorageError('');
    } catch { setStorageError('保存に失敗しました（容量不足またはストレージ利用不可）。編集内容はメモリに保持しています。JSON Exportで退避するか、保存を再試行してください。'); }
  }, [workspace.entries, initial.error]);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!conflictRef.current && !storageError) return;
      event.preventDefault(); event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [storageError]);
  function retrySave() {
    if (conflictRef.current && !window.confirm('他タブの保存内容を現在の戦術一覧で上書きしますか？必要なら先にJSON Exportしてください。')) return;
    if (initial.error && !window.confirm('読み込めなかった保存データを、現在の戦術一覧で上書きしますか？')) return;
    try { saveStrategies(window.localStorage, workspace.entries.map(e => e.present)); baseline.current = window.localStorage.getItem(STORAGE_KEY); baselineReady.current = true; conflictRef.current = false; setConflict(false); setInitial(previous => ({ ...previous, error: '' })); setSavedEntries(workspace.entries); setStorageError(''); }
    catch { setStorageError('保存に失敗しました。編集内容はメモリに保持しています。'); }
  }
  function download() {
    try {
      const json = exportStrategy(history.present);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'strategy.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(history.present.mapRevision.startsWith('local-') ? 'JSONを書き出しました。ローカル背景画像はJSONに含まれず、共有されません。受信者は画像を別途選択してください。' : 'JSONを書き出しました。');
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Exportに失敗しました。'); }
  }
  async function readJson(file: File) {
    try {
      if (file.size > MAX_JSON_SIZE) throw new Error('JSONは5MB以下にしてください。');
      const imported = importStrategy(await file.text());
      // Resolve against current entries in the reducer, even if reading completes after another import.
      update({ type: 'import', strategy: imported });
      setNotice(imported.mapRevision.startsWith('local-') ? 'Importしました。ローカル背景画像は共有されません。画像を別途選択してください。' : 'Importしました。同じIDがある場合は新しいIDで追加します。');
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Importに失敗しました。'); }
  }
  const strategy = history.present;
  const [drawingStyle, setDrawingStyle] = useState({ color: '#79ddd0', width: 3 });
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
  const selected = strategy.elements.find(e => e.id === selectedId);

  useEffect(() => {
    let cancelled = false;
    const initialRequest = ++requestId.current;
    // Reset editor state when synchronizing a different external background.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(null); setBusy(false); setImage(null); setError('');
    const cached = localImages.current.get(strategy.mapRevision);
    setLocalName(cached?.name ?? null);
    if (strategy.mapRevision.startsWith('local-')) {
      setImage(cached?.image ?? null);
      return () => { cancelled = true; };
    }
    if (demoImage.kind === 'original-demo') loadImage(demoImage.url)
      .then(result => { if (!cancelled && requestId.current === initialRequest) setImage(result); })
      .catch((reason: Error) => { if (!cancelled && requestId.current === initialRequest) setError(reason.message); });
    return () => { cancelled = true; };
  }, [strategy.id, strategy.mapRevision]);

  const place = useCallback((point: Point) => {
    const id = crypto.randomUUID();
    dispatch({ type: 'place', element: { id, type: 'hero', heroId, team, position: point }, at: new Date().toISOString() });
    setSelectedId(id);
    setTool('select');
  }, [dispatch, heroId, team]);
  const move = useCallback((id: string, position: Point) => dispatch({ type: 'move', id, position, at: new Date().toISOString() }), [dispatch]);
  const draw = useCallback((element: Exclude<BoardElement, HeroElement>) => {
    dispatch({ type: 'draw', element, at: new Date().toISOString() }); setSelectedId(element.id); setTool('select');
  }, [dispatch]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.closest('input, textarea, select') || target.isContentEditable)) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedId) { event.preventDefault(); update({ type: 'edit', action: { type: 'delete', id: selectedId, at: new Date().toISOString() } }); }
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); update({ type: 'edit', action: { type: event.shiftKey ? 'redo' : 'undo', at: new Date().toISOString() } });
      }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [selectedId]);

  function styleChange(color: string, width: number) {
    setDrawingStyle({ color, width });
    if (selected && selected.type !== 'hero') dispatch({ type: 'style', id: selected.id, color, width, at: new Date().toISOString() });
  }
  const currentStyle = selected && selected.type !== 'hero' ? selected : drawingStyle;

  async function changeImage(file?: File) {
    if (file) {
      const message = validateImageFile(file);
      if (message) { setError(message); return; }
    }
    const restoring = !!file && strategy.mapRevision.startsWith('local-') && !image;
    if (!restoring && strategy.elements.length && !window.confirm('背景を変更すると現在の配置・描画と編集履歴をクリアします。変更しますか？')) return;
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
      const revision = restoring ? strategy.mapRevision : file ? `local-${crypto.randomUUID()}` : demoImage.revision;
      if (file) localImages.current.set(revision, { image: result, name: file.name });
      if (!restoring) dispatch({ type: 'reset-map', revision, at: new Date().toISOString() });
    } catch (reason) {
      if (id !== requestId.current) return;
      setError(reason instanceof Error ? reason.message : '読み込みに失敗しました。');
    } finally {
      if (file) URL.revokeObjectURL(url);
      if (id === requestId.current) setBusy(false);
    }
  }

  return <div className="app">
    <header className="app-header">
      <div className="brand"><span className="brand-mark" aria-hidden="true">P</span><div><strong>OW2 PLANT</strong><span className="eyebrow">TACTICAL WORKSPACE</span></div></div>
      <span className="phase-tag">PHASE 04 <span>品質・公開仕上げ</span></span>
    </header>
    <main>
      <div className="title-row">
        <div><p className="eyebrow">HYBRID / {initialMap.areas[0].name}</p><h1>{initialMap.name}</h1></div>
        <div className="status"><span className="status-dot" />{conflict ? '未保存 · 他タブと競合' : storageError ? '未保存 · 保存エラー' : savedEntries === workspace.entries ? 'ブラウザに保存済み' : '保存中…'}</div>
      </div>
      <section className="strategy-library" aria-label="戦術の保存と共有">
        <label className="field">戦術一覧<select value={strategy.id} onChange={e => update({ type: 'open', id: e.target.value })}>
          {workspace.entries.map(e => <option key={e.present.id} value={e.present.id}>{e.present.name || '無題の戦術'}</option>)}
        </select></label>
        <div className="library-actions">
          <button onClick={() => update({ type: 'add', strategy: createStrategy() })}>新規作成</button>
          <button onClick={() => update({ type: 'add', strategy: copyStrategy(strategy, workspace.entries.map(e => e.present), true) })}>戦術を複製</button>
          <button onClick={() => { if (window.confirm(`「${strategy.name}」を削除しますか？`)) update({ type: 'remove' }); }}>戦術を削除</button>
          <button onClick={download}>JSON Export</button>
          <label className="file-label">JSON Import<input type="file" accept=".json,application/json" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void readJson(file); }} /></label>
        </div>
        {conflict && <div className="conflict" role="alert">
          <p>他タブで保存データが変更されました。自動保存を停止し、このタブの編集内容を保持しています。再読込すると現在の編集と履歴は破棄されます。必要なら先にJSON Exportしてください。</p>
          <button onClick={() => { if (window.confirm('このタブの編集を破棄して、保存済みデータを再読込しますか？')) { conflictRef.current = false; window.location.reload(); } }}>保存済みを再読込</button>
          <button onClick={() => setNotice('現在の編集を保持しています。自動保存は停止中です。JSON Exportで退避するか、「現在の内容で保存」を選んでください。')}>現在の編集を保持</button>
          <button onClick={retrySave}>現在の内容で保存</button>
        </div>}
        {storageError && <><p className="error" role="alert">{storageError}</p><button onClick={retrySave}>保存を再試行</button></>}
        {notice && <p role="status">{notice}</p>}
      </section>
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
          <div className="mobile-picker">
            <label>ヒーロー選択<select aria-label="ヒーロー選択" value={heroId} onChange={e => { setHeroId(e.target.value); setTool('place'); }}>{heroes.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
            <label>チーム<select aria-label="チーム" value={team} onChange={e => setTeam(e.target.value as Team)}><option value="ally">● 味方</option><option value="enemy">◌ 敵</option></select></label>
          </div>
          <div className="toolbar" aria-label="編集ツール">
            <div className="tool-group">
              <button aria-pressed={tool === 'select'} onClick={() => setTool('select')}>↖ 選択・移動</button>
              <button aria-pressed={tool === 'place'} onClick={() => setTool('place')}>＋ 配置</button>
              {(['line', 'arrow', 'stroke'] as const).map((mode, index) => <button key={mode} aria-pressed={tool === mode}
                onClick={() => { setTool(mode); setSelectedId(null); }}>{['直線', '矢印', 'フリーハンド'][index]}</button>)}
              <button aria-pressed={tool === 'pan'} onClick={() => setTool('pan')}>✥ パン</button>
            </div>
            <span className="element-count" data-testid="element-count">{elements.length} 個配置</span>
          </div>
          <div className="edit-properties">
            <label>色<select aria-label="描画色" value={currentStyle.color} onChange={e => styleChange(e.target.value, currentStyle.width)}>
              <option value="#79ddd0">ミント</option><option value="#ff9690">赤</option><option value="#f5d778">黄</option><option value="#ffffff">白</option><option value="#91baff">青</option>
            </select></label>
            <label>線幅<select aria-label="線幅" value={currentStyle.width} onChange={e => styleChange(currentStyle.color, Number(e.target.value))}>
              {[1, 3, 6, 12].map(width => <option key={width} value={width}>{width} px</option>)}
            </select></label>
            <button disabled={!selected} onClick={() => selected && dispatch({ type: 'delete', id: selected.id, at: new Date().toISOString() })}>削除</button>
            <button disabled={!history.past.length} onClick={() => dispatch({ type: 'undo', at: new Date().toISOString() })}>Undo</button>
            <button disabled={!history.future.length} onClick={() => dispatch({ type: 'redo', at: new Date().toISOString() })}>Redo</button>
          </div>
          <div className="map-notice">{strategy.mapRevision.startsWith('local-') ? `ローカル背景画像${localName ? `：${localName}` : '：未設定'}。画像は保存・JSON共有されません。${!image ? '配置は保持されています。背景画像の設定から同じ画像を再選択してください。' : ''}` : 'デモ用の自作模式図です。King’s Rowの実際の地形ではありません。'}</div>
          {error && <p role="alert" className="error">{error}</p>}
          {image ? <Board key={`${strategy.id}:${strategy.mapRevision}`} image={image} elements={strategy.elements} tool={tool} drawingStyle={drawingStyle}
            onDraw={draw} onPlace={place}
            selectedId={selectedId} onSelect={setSelectedId}
            onMove={move} />
            : <div className="loading" role="status">{strategy.mapRevision.startsWith('local-') ? 'ローカル背景画像を再選択してください。配置・描画は保持されています。' : error ? '背景画像を読み込めません。下のボタンで再試行できます。' : '盤面を読み込み中…'}</div>}
          <div className="board-footer"><span>PC：ホイールで拡大 · スマホ：2本指で拡大・移動</span><span>味方 ● / 敵 ◌</span></div>
          <details className="image-settings"><summary>背景画像の設定</summary>
            <p>利用権限のあるKing’s Row第1拠点の俯瞰画像を選択してください。画像は端末内でのみ使用し、送信・保存しません。</p>
            <label className="file-label">画像を選択（PNG / JPEG / WebP・10MBまで）<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => {
              const file = e.target.files?.[0]; e.target.value = ''; if (file) void changeImage(file);
            }} /></label>
            <button disabled={busy} onClick={() => void changeImage()}>デモ画像に戻す</button>
            {busy && <p role="status">画像を読み込み中…</p>}
          </details>
          <details className="keyboard-editor"><summary>キーボード・数値で配置と描画</summary>
            <p>座標は盤面の左上が0%、右下が100%。配置一覧から選択・移動、描画一覧から選択・色変更・削除できます。Ctrl / ⌘ + ZでUndo、Shiftも押すとRedo。</p>
            <form onSubmit={event => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const start = { x: Number(data.get('x')) / 100, y: Number(data.get('y')) / 100 };
              const end = { x: Number(data.get('endX')) / 100, y: Number(data.get('endY')) / 100 };
              if (tool === 'line' || tool === 'arrow' || tool === 'stroke') {
                const id = crypto.randomUUID();
                dispatch({ type: 'draw', element: tool === 'stroke' ? { id, type: tool, points: [start, end], ...drawingStyle } : { id, type: tool, start, end, ...drawingStyle }, at: new Date().toISOString() });
                setSelectedId(id);
              } else place(start);
            }}>
              <div className="numeric-grid">{[['x', '開始 X', 50], ['y', '開始 Y', 50], ['endX', '終了 X', 75], ['endY', '終了 Y', 75]].map(([name, label, value]) => <label key={name}>{label} (%)<input name={String(name)} type="number" min="0" max="100" step="any" required defaultValue={value} /></label>)}</div>
              <button type="submit">{tool === 'line' || tool === 'arrow' || tool === 'stroke' ? '数値で描画を追加' : '数値でヒーローを配置'}</button>
            </form>
          </details>
          <details className="drawings"><summary>描画一覧（{strategy.elements.length - elements.length}）</summary>
            <ul>{strategy.elements.filter(e => e.type !== 'hero').map(e => <li key={e.id} data-testid="drawing" data-element={JSON.stringify(e)}>
              <button aria-pressed={selectedId === e.id} onClick={() => { setSelectedId(e.id); setTool('select'); }}>{e.type === 'line' ? '直線' : e.type === 'arrow' ? '矢印' : 'フリーハンド'}を選択</button>
            </li>)}</ul>
          </details>
          <details className="placements"><summary>配置一覧（{elements.length}）</summary>
            {!elements.length && <p>まだ配置されていません。</p>}
            <ul>{elements.map(element => <li key={element.id} data-testid="placement" data-x={element.position.x} data-y={element.position.y}>
              <button onClick={() => { setSelectedId(element.id); setTool('select'); }} aria-pressed={selectedId === element.id}>
                {heroes.find(h => h.id === element.heroId)?.name} · {element.team === 'ally' ? '味方' : '敵'}
              </button><span>X {Math.round(element.position.x * 100)}% / Y {Math.round(element.position.y * 100)}%</span>
            </li>)}</ul>
            {selected?.type === 'hero' && <div className="coordinate-fields"><p>選択中のヒーローを数値で移動（%）</p>
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
