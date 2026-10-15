// The card in the page's top-right corner. It renders a plain view model (see view.js) into a closed shadow root and
// turns clicks on [data-act] elements into handler calls; it knows nothing about the game itself.
import { STYLE } from "./styles.js";

// BO1 zombies scoreboard colours for players 1 to 4.
export const PLAYER_COLORS = ["#f2efe9", "#5aa8ff", "#f4c542", "#63d471"];

export class Card {
  constructor(handlers) {
    this.handlers = handlers;
    this.host = document.createElement("bo1-coop-card");
    this.root = this.host.attachShadow({ mode: "closed" });
    const mark = PLAYER_COLORS.map((c) => `<i style="background:${c}"></i>`).join("");
    this.root.innerHTML = `<style>${STYLE}</style><div class="card"><div class="head"><span class="mark">${mark}</span><span class="title"><b>Co-op</b><span class="tagline"></span></span><span class="chip"></span><button class="icon" data-act="collapse" title="Minimise">–</button></div><div class="body"></div></div><div class="pill"></div>`;
    this.body = this.root.querySelector(".body");
    this.chip = this.root.querySelector(".chip");
    this.tagline = this.root.querySelector(".tagline");
    this.pill = this.root.querySelector(".pill");
    this.collapseButton = this.root.querySelector('[data-act="collapse"]');
    this.view = null;
    for (const type of ["keydown", "keyup", "keypress", "click", "mousedown", "mouseup", "pointerdown", "pointerup", "wheel"]) {
      this.host.addEventListener(type, (event) => event.stopPropagation());
    }
    this.root.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-act]");
      if (!button || button.disabled) return;
      const act = button.dataset.act;
      if (act === "collapse") {
        const collapsed = this.host.classList.toggle("collapsed");
        this.collapseButton.textContent = collapsed ? "+" : "–";
        return;
      }
      const field = button.dataset.field ? this.root.querySelector(`input[data-field="${button.dataset.field}"]`) : null;
      this.handlers[act]?.(field ? field.value : button.dataset.arg);
    });
    this.root.addEventListener("keydown", (event) => {
      const input = event.target.matches?.("input[data-act]") ? event.target : null;
      if (event.key === "Enter" && input) this.handlers[input.dataset.act]?.(input.value);
    });
  }
  mount() {
    const attach = () => {
      if (!this.host.isConnected) document.documentElement.append(this.host);
    };
    if (document.documentElement) attach();
    else document.addEventListener("readystatechange", attach, { once: true });
  }
  /** Re-renders only when the view changes, so typing in an input is never interrupted. */
  render(view2) {
    const key = JSON.stringify(view2);
    if (key === this.view) return;
    const focused = this.root.activeElement?.dataset?.field;
    const previous = new Map([...this.root.querySelectorAll("input[data-field]")].map((i) => [i.dataset.field, i.value]));
    this.view = key;
    this.chip.className = `chip ${view2.chip?.tone ?? ""}`;
    this.chip.textContent = view2.chip?.text ?? "";
    this.tagline.textContent = view2.tagline ?? "";
    this.host.classList.toggle("compact", Boolean(view2.compact));
    this.pill.replaceChildren(...this.pillParts(view2.pill));
    this.body.replaceChildren(...view2.blocks.map((block) => this.block(block)));
    for (const input of this.root.querySelectorAll("input[data-field]")) {
      if (previous.has(input.dataset.field)) input.value = previous.get(input.dataset.field);
      if (input.dataset.field === focused) input.focus();
    }
  }
  toggleChip(c) {
    const e = document.createElement("button");
    e.className = `tchip ${c.on ? "on" : ""} ${c.plain ? "plain" : ""}`;
    e.textContent = c.label;
    e.dataset.act = c.act;
    if (c.arg != null) e.dataset.arg = c.arg;
    return e;
  }
  stepper(s) {
    const box = document.createElement("div");
    box.className = "stepper";
    const label = document.createElement("span");
    label.className = "flabel";
    label.textContent = s.label;
    const value = document.createElement("span");
    value.className = "sval";
    value.textContent = s.value;
    const make = (b, text) => {
      const e = document.createElement("button");
      e.className = "sbtn";
      e.textContent = text;
      e.dataset.act = b.act;
      e.dataset.arg = b.arg;
      return e;
    };
    box.append(label, make(s.dec, "\u2212"), value, make(s.inc, "+"));
    return box;
  }
  pillParts(pill) {
    if (!pill) return [];
    const parts = [];
    for (const p of pill.players ?? []) {
      const d = document.createElement("span");
      d.className = `pd ${p.on ? "on" : ""}`;
      d.style.color = PLAYER_COLORS[p.n - 1];
      parts.push(d);
    }
    for (const text of pill.texts ?? []) {
      if (parts.length) parts.push(Object.assign(document.createElement("span"), { className: "sep" }));
      parts.push(document.createTextNode(text));
    }
    return parts;
  }
  block(block) {
    const el = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    const button = (b) => {
      const e = el("button", `act ${b.style ?? ""}`, b.label);
      e.dataset.act = b.act;
      if (b.arg != null) e.dataset.arg = b.arg;
      if (b.field) e.dataset.field = b.field;
      if (b.disabled) e.disabled = true;
      return e;
    };
    switch (block.kind) {
      case "text":
        return el("div", block.cls ?? "", block.text);
      case "label": {
        const box = el("div", "label", block.text);
        if (block.aside) box.append(el("em", "", block.aside));
        return box;
      }
      case "room": {
        const box = el("div", "panel");
        const label = el("div", "label", block.label);
        if (block.aside) label.append(el("em", "", block.aside));
        box.append(label, el("div", "code", block.code));
        if (block.buttons?.length) {
          const row = el("div", "row");
          for (const b of block.buttons) row.append(button(b));
          box.append(row);
        }
        return box;
      }
      case "map": {
        const box = el("div", "map");
        box.append(el("div", "glyph", block.glyph ?? "?"));
        const info = el("div");
        const name = el("div", "name", block.name);
        if (block.tag) name.append(el("span", "tag hell", block.tag));
        info.append(name, el("div", "sub", block.sub ?? ""));
        box.append(info);
        return box;
      }
      case "players": {
        const box = el("div");
        const label = el("div", "label", block.label);
        if (block.aside) label.append(el("em", "", block.aside));
        const list = el("div", "players");
        for (const p of block.players) {
          const row = el("div", `player ${p.empty ? "empty" : ""} ${p.me ? "me" : ""}`);
          const badge = el("div", "badge", String(p.n));
          badge.style.background = PLAYER_COLORS[p.n - 1];
          const who = el("div", "who");
          const name = el("div", "name", p.name);
          for (const t of p.tags ?? []) name.append(el("span", `tag ${t.cls}`, t.text));
          const st = el("div", "st");
          if (p.status) st.append(el("span", `dot ${p.tone ?? ""}`), document.createTextNode(p.status));
          who.append(name, st);
          row.append(badge, who);
          if (p.ping != null) {
            const ping = el("div", "ping");
            const bars = el("span", `bars q${p.ping < 80 ? 3 : p.ping < 180 ? 2 : 1}`);
            bars.append(el("i"), el("i"), el("i"));
            ping.append(bars, el("span", "", `${p.ping} ms`));
            row.append(ping);
          }
          list.append(row);
        }
        box.append(label, list);
        return box;
      }
      case "steps": {
        const box = el("div", "steps");
        block.steps.forEach((text, i) => {
          const state = i < block.current ? "done" : i === block.current ? `now ${block.fail ? "fail" : ""}` : "";
          const step = el("div", `step ${state}`);
          step.append(el("i"), el("span", "", text));
          box.append(step);
        });
        return box;
      }
      case "callout": {
        const box = el("div", `call ${block.tone ?? ""}`);
        const text = el("div");
        if (block.title) text.append(el("b", "", `${block.title} `));
        text.append(document.createTextNode(block.text ?? ""));
        box.append(text);
        if (block.buttons?.length) {
          const row = el("div", "row");
          for (const b of block.buttons) row.append(button(b));
          box.append(row);
        }
        return box;
      }
      case "buttons": {
        const row = el("div", "row");
        for (const b of block.buttons) row.append(button(b));
        return row;
      }
      case "input": {
        const box = el("div");
        if (block.label) box.append(el("div", "label", block.label));
        const row = el("div", "row");
        const input = el("input");
        input.placeholder = block.placeholder ?? "";
        input.spellcheck = false;
        if (block.maxLength) input.maxLength = block.maxLength;
        input.dataset.field = block.field;
        input.dataset.act = block.act;
        if (block.value) input.value = block.value;
        row.append(input, button({ act: block.act, label: block.button, field: block.field, style: `${block.style ?? ""} slim` }));
        box.append(row);
        return box;
      }
      case "kv": {
        const box = el("dl", "kv");
        for (const [k, v, cls] of block.items) box.append(el("dt", "", k), el("dd", cls ?? "", v));
        return box;
      }
      case "meter": {
        const box = el("div", "small muted");
        box.append(document.createTextNode(block.label));
        const bar = el("div", `meter ${block.fraction >= 1 ? "full" : block.fraction >= 0.75 ? "warn" : ""}`);
        const fill = el("span");
        fill.style.width = `${Math.round(Math.min(1, Math.max(0, block.fraction)) * 100)}%`;
        bar.append(fill);
        box.append(bar);
        return box;
      }
      case "section": {
        const box = el("div", `section ${block.open ? "" : "closed"}`);
        const toggle = el("button", "toggle", block.title);
        toggle.dataset.act = block.act;
        box.append(toggle);
        if (block.open) for (const child of block.blocks) box.append(this.block(child));
        return box;
      }
      case "credits":
        return el("div", "credits", block.text);
      case "chips": {
        const box = el("div", "chips");
        for (const c of block.chips) box.append(this.toggleChip(c));
        return box;
      }
      case "stepper":
        return this.stepper(block);
      case "grid": {
        const box = el("div", "grid");
        for (const b of block.buttons) box.append(button({ ...b, style: `${b.style ?? ""} tiny` }));
        return box;
      }
      case "funPlayer": {
        const box = el("div", "fplayer");
        const head = el("div", "fhead");
        const badge = el("span", "fbadge", block.n ? String(block.n) : "\u2605");
        badge.style.background = block.n ? PLAYER_COLORS[block.n - 1] : "var(--accent)";
        head.append(badge, el("b", "", block.name));
        if (block.money?.value) head.append(el("span", "fmoney", `$${block.money.value}`));
        box.append(head);
        const chips = el("div", "chips");
        for (const c of block.chips) chips.append(this.toggleChip(c));
        box.append(chips, this.stepper(block.speed));
        const money = el("div", "frow");
        money.append(el("span", "flabel", block.money.label));
        for (const b of block.money.buttons) money.append(button({ ...b, style: "tiny" }));
        box.append(money);
        return box;
      }
      default:
        return el("div");
    }
  }
}
