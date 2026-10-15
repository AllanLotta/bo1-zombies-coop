// The card's look. It lives in a closed shadow root, so nothing here leaks into vel.gg's page or the other way round.

export const STYLE = `
:host { all: initial; position: fixed; top: 12px; right: 12px; z-index: 2147483647; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg);
  --bg: #121110; --bg2: #1b1917; --bg3: #24211e; --line: #34302b; --fg: #ece6dc; --muted: #9d958a; --dim: #6f685f;
  --accent: #e2552f; --accent2: #f07a4f; --ok: #63d471; --wait: #f4c542; --bad: #ff6b5a; }
* { box-sizing: border-box; }
.card { width: 312px; max-height: calc(100vh - 24px); overflow: auto; background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,.55); scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: linear-gradient(180deg, #1d1a17, var(--bg)); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 1; }
.mark { display: grid; grid-template-columns: 6px 6px; gap: 2px; flex: none; }
.mark i { width: 6px; height: 6px; border-radius: 1.5px; opacity: .9; }
.title { flex: 1; min-width: 0; }
.title b { display: block; font-size: 13px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
.title span { display: block; font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chip { flex: none; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 99px; background: var(--bg3); color: var(--muted); border: 1px solid var(--line); white-space: nowrap; }
.chip.ok { color: var(--ok); border-color: rgba(99,212,113,.35); background: rgba(99,212,113,.08); }
.chip.wait { color: var(--wait); border-color: rgba(244,197,66,.35); background: rgba(244,197,66,.08); }
.chip.bad { color: var(--bad); border-color: rgba(255,107,90,.4); background: rgba(255,107,90,.08); }
.chip.live::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; margin-right: 5px; vertical-align: 1px; animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .25; } }
button.icon { all: unset; cursor: pointer; color: var(--muted); width: 22px; height: 22px; display: grid; place-items: center; border-radius: 5px; font-size: 15px; }
button.icon:hover { background: var(--bg3); color: var(--fg); }
.body { padding: 12px; display: grid; gap: 10px; }
:host(.collapsed) .body { display: none; }
:host(.collapsed) .head { border-bottom: 0; }
.muted { color: var(--muted); } .small { font-size: 12px; } .error { color: var(--bad); }
.label { font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); margin-bottom: 6px; display: flex; justify-content: space-between; align-items: baseline; }
.label em { font-style: normal; letter-spacing: 0; text-transform: none; font-weight: 600; color: var(--muted); font-size: 11px; }
.panel { background: var(--bg2); border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
.panel .code { font: 700 17px/1.2 ui-monospace, "SF Mono", Menlo, Consolas, monospace; letter-spacing: .05em; color: #fff; user-select: all; white-space: nowrap; margin-bottom: 9px; }
.map { display: flex; align-items: center; gap: 10px; }
.map .glyph { width: 34px; height: 34px; border-radius: 6px; flex: none; display: grid; place-items: center; background: radial-gradient(circle at 30% 30%, #3a2a22, #1a1411); border: 1px solid #4a3328; color: var(--accent2); font-weight: 900; font-size: 15px; }
.map .name { font-weight: 700; font-size: 14px; }
.map .sub { font-size: 11.5px; color: var(--muted); }
.tag { display: inline-block; font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; padding: 1px 5px; border-radius: 4px; vertical-align: 1px; margin-left: 5px; }
.tag.host { background: rgba(226,85,47,.18); color: var(--accent2); }
.tag.you { background: rgba(255,255,255,.1); color: var(--fg); }
.tag.hell { background: rgba(255,107,90,.15); color: var(--bad); }
.players { display: grid; gap: 6px; }
.player { display: flex; align-items: center; gap: 10px; padding: 7px 9px; border-radius: 7px; background: var(--bg3); border: 1px solid transparent; }
.player.me { border-color: var(--line); }
.player.empty { background: transparent; border: 1px dashed var(--line); }
.badge { width: 26px; height: 26px; border-radius: 50%; flex: none; display: grid; place-items: center; font-weight: 800; font-size: 12px; color: #111; position: relative; }
.player.empty .badge { background: transparent !important; color: var(--dim); box-shadow: inset 0 0 0 1.5px var(--line); }
.who { flex: 1; min-width: 0; }
.who .name { font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.player.empty .who .name { color: var(--dim); font-weight: 500; }
.who .st { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 5px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dim); flex: none; }
.dot.ok { background: var(--ok); } .dot.wait { background: var(--wait); animation: pulse 1.6s ease-in-out infinite; } .dot.bad { background: var(--bad); }
.ping { flex: none; text-align: right; font: 600 11px ui-monospace, Menlo, monospace; color: var(--muted); display: grid; justify-items: end; gap: 2px; }
.bars { display: flex; gap: 2px; align-items: flex-end; height: 10px; }
.bars i { width: 3px; border-radius: 1px; background: var(--line); }
.bars i:nth-child(1) { height: 4px; } .bars i:nth-child(2) { height: 7px; } .bars i:nth-child(3) { height: 10px; }
.bars.q3 i { background: var(--ok); } .bars.q2 i:nth-child(-n+2) { background: var(--wait); } .bars.q1 i:nth-child(1) { background: var(--bad); }
.steps { display: flex; align-items: flex-start; }
.step { flex: 1; display: grid; justify-items: center; gap: 4px; position: relative; font-size: 10.5px; color: var(--dim); text-align: center; }
.step::before { content: ""; position: absolute; top: 6px; left: -50%; width: 100%; height: 2px; background: var(--line); z-index: 0; }
.step:first-child::before { display: none; }
.step i { width: 14px; height: 14px; border-radius: 50%; background: var(--bg); border: 2px solid var(--line); z-index: 1; }
.step.done { color: var(--muted); } .step.done::before { background: var(--accent); } .step.done i { background: var(--accent); border-color: var(--accent); }
.step.now { color: var(--fg); font-weight: 700; } .step.now::before { background: var(--accent); } .step.now i { border-color: var(--accent2); box-shadow: 0 0 0 3px rgba(226,85,47,.25); }
.step.now.fail i { border-color: var(--bad); box-shadow: 0 0 0 3px rgba(255,107,90,.2); }
.call { border-radius: 8px; padding: 9px 10px; background: var(--bg2); border: 1px solid var(--line); border-left: 3px solid var(--muted); display: grid; gap: 8px; }
.call.info { border-left-color: #5aa8ff; } .call.ok { border-left-color: var(--ok); } .call.wait { border-left-color: var(--wait); } .call.bad { border-left-color: var(--bad); background: rgba(255,107,90,.06); }
.call b { font-weight: 700; }
.row { display: flex; gap: 6px; } .row > * { flex: 1; }
button.act { all: unset; box-sizing: border-box; text-align: center; cursor: pointer; padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg3); color: var(--fg); font-weight: 650; font-size: 12.5px; transition: background .12s, border-color .12s; }
button.act:hover, button.act:focus-visible { background: #2e2a26; border-color: #4a443d; }
button.act.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button.act.primary:hover { background: var(--accent2); border-color: var(--accent2); }
button.act.ghost { background: transparent; color: var(--muted); }
button.act.ghost:hover { color: var(--fg); }
button.act.done { background: rgba(99,212,113,.15); border-color: rgba(99,212,113,.4); color: var(--ok); }
button.act.slim { flex: 0 0 auto; padding: 6px 10px; }
button.act[disabled] { opacity: .5; cursor: default; }
input { all: unset; box-sizing: border-box; padding: 7px 9px; border: 1px solid var(--line); border-radius: 7px; background: #0c0b0a; color: var(--fg); font: 12.5px ui-monospace, Menlo, monospace; min-width: 0; flex: 1; }
input:focus { border-color: var(--accent); }
input::placeholder { color: var(--dim); }
.kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px; margin: 0; }
.kv dt { color: var(--muted); } .kv dd { margin: 0; text-align: right; }
.meter { height: 5px; border-radius: 3px; background: var(--bg3); overflow: hidden; margin-top: 5px; }
.meter > span { display: block; height: 100%; background: var(--ok); }
.meter.warn > span { background: var(--wait); } .meter.full > span { background: var(--bad); }
.section { border-top: 1px solid var(--line); padding-top: 10px; display: grid; gap: 10px; }
.section > button.toggle { all: unset; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); }
.section > button.toggle:hover { color: var(--muted); }
.section > button.toggle::after { content: "\\25BE"; font-size: 12px; transition: transform .15s; }
.section.closed > button.toggle::after { transform: rotate(-90deg); }
.credits { font-size: 11px; color: var(--dim); text-align: center; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
button.tchip { all: unset; cursor: pointer; font-size: 11.5px; font-weight: 650; padding: 4px 9px; border-radius: 99px; border: 1px solid var(--line); background: var(--bg3); color: var(--muted); }
button.tchip:hover { color: var(--fg); border-color: #4a443d; }
button.tchip.on { background: rgba(226,85,47,.2); border-color: var(--accent); color: #fff; }
button.tchip.plain { border-style: dashed; }
.stepper { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.stepper .flabel { flex: 1; }
.sval { min-width: 46px; text-align: center; font: 600 12px ui-monospace, Menlo, monospace; color: var(--fg); }
button.sbtn { all: unset; cursor: pointer; width: 24px; height: 22px; display: grid; place-items: center; border-radius: 6px; background: var(--bg3); border: 1px solid var(--line); color: var(--fg); font-weight: 700; }
button.sbtn:hover { border-color: var(--accent); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
button.act.tiny { padding: 5px 6px; font-size: 11.5px; font-weight: 600; }
.fplayer { display: grid; gap: 7px; padding: 9px; border-radius: 8px; background: var(--bg2); border: 1px solid var(--line); }
.fhead { display: flex; align-items: center; gap: 8px; }
.fhead b { flex: 1; font-weight: 700; }
.fbadge { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: #111; flex: none; }
.fmoney { font: 600 12px ui-monospace, Menlo, monospace; color: var(--ok); }
.frow { display: flex; align-items: center; gap: 5px; }
.frow .flabel { flex: 1; font-size: 12px; }
.flabel { color: var(--muted); }
.pill { display: none; }
:host(.compact) .card { display: none; }
:host(.compact) .pill { display: flex; align-items: center; gap: 8px; pointer-events: none; background: rgba(12,11,10,.72); border: 1px solid rgba(255,255,255,.08); border-radius: 99px; padding: 4px 10px; font: 600 11.5px system-ui, sans-serif; color: #ddd; backdrop-filter: blur(4px); }
:host(.compact) .pill:empty { display: none; }
.pill .pd { width: 9px; height: 9px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px currentColor; color: var(--dim); }
.pill .pd.on { background: currentColor; }
.pill .sep { width: 1px; height: 12px; background: rgba(255,255,255,.15); }
`;
