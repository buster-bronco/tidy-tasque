import "../styles/style.scss";
import { ID, api, contextOf, groupedEntries, run, type MenuContext, type MenuEntry } from "./api";

let menu: HTMLMenuElement | null = null;

function mode(): string {
  return game.settings.get(ID, "mode");
}

// appv1 app.element is a jquery wrapper
function rootOf(app: any): HTMLElement | null {
  return app.element?.[0] ?? app.element ?? null;
}

// header buttons drawn by _renderOuter, minus our own toggle
function headerButtons(root: HTMLElement): HTMLAnchorElement[] {
  return [...root.querySelectorAll<HTMLAnchorElement>(".window-header .header-button")].filter((a) => !a.classList.contains(`${ID}-toggle`));
}

// icon-only buttons keep their name in the tooltip
function labelOf(a: HTMLElement): string {
  return a.textContent?.trim() || a.dataset.tooltip || a.title || a.className;
}

function closeMenu() {
  menu?.remove();
  menu = null;
}

// one menu row; fa icon class plus a text label
function row(icon: string, label: string): HTMLLIElement {
  const item = document.createElement("li");
  item.innerHTML = `<i class="${icon}"></i><span></span>`;
  item.querySelector("span")!.textContent = label;
  return item;
}

function entryRow(entry: MenuEntry, context: MenuContext): HTMLLIElement {
  const item = row(entry.icon ?? "", game.i18n.localize(entry.label));
  if (entry.children?.length) {
    // submenu flies out on hover
    item.classList.add("parent");
    const sub = document.createElement("menu");
    sub.className = `${ID}-submenu`;
    for (const child of entry.children) sub.append(entryRow(child, context));
    item.append(sub);
    if (!entry.callback) return item;
  }
  item.addEventListener("click", (event) => {
    event.stopPropagation();
    closeMenu();
    run(entry, context);
  });
  return item;
}

// row that closes the menu before running its action
function buttonRow(icon: string, label: string, action: (event: MouseEvent) => unknown): HTMLLIElement {
  const item = row(icon, label);
  item.addEventListener("click", (event) => {
    event.stopPropagation();
    closeMenu();
    action(event);
  });
  return item;
}

function groupHeader(label: string): HTMLLIElement {
  const header = document.createElement("li");
  header.className = "group";
  header.textContent = label;
  return header;
}

function appendGroups(target: HTMLMenuElement, groups: Map<string, MenuEntry[]>, context: MenuContext) {
  for (const [group, list] of groups) {
    target.append(groupHeader(group ? game.i18n.localize(group) : ""));
    for (const entry of list) target.append(entryRow(entry, context));
  }
}

// appv1 _getHeaderButtons builds button defs without rendering the sheet
function itemHeaderButtons(item: any): any[] {
  try {
    return (item.sheet?._getHeaderButtons?.() ?? []).filter((b: any) => !b.class?.split(" ").includes("close"));
  } catch (err) {
    console.error(`${ID} | header buttons failed for ${item.uuid}`, err);
    return [];
  }
}

function itemSection(target: HTMLMenuElement, item: any) {
  const title = groupHeader(item.name);
  title.classList.add("title");
  target.append(title);

  if (item.testUserPermission(game.user, "LIMITED")) {
    target.append(buttonRow("fa-solid fa-pen-to-square", game.i18n.localize("TIDY_TASQUE.item.open"), () => item.sheet.render(true)));
  }
  for (const b of itemHeaderButtons(item)) {
    target.append(buttonRow(b.icon ?? "", game.i18n.localize(b.label ?? ""), (event) => b.onclick?.(event)));
  }
  target.append(
    buttonRow("fa-solid fa-passport", game.i18n.localize("TIDY_TASQUE.item.copyUuid"), async () => {
      await game.clipboard.copyPlainText(item.uuid);
      ui.notifications?.info(game.i18n.format("TIDY_TASQUE.item.copied", { uuid: item.uuid }));
    }),
  );

  // item.sheet is the unrendered item sheet; context.document is the item
  const context = contextOf(item.sheet);
  appendGroups(target, groupedEntries(context, "item"), context);

  if (item.isOwner) {
    const del = buttonRow("fa-solid fa-trash", game.i18n.localize("TIDY_TASQUE.item.delete"), () => item.deleteDialog());
    del.classList.add("danger");
    target.append(del);
  }
  target.append(groupHeader(game.i18n.localize("TIDY_TASQUE.group.sheet")));
}

function openMenu(app: any, root: HTMLElement, x: number, y: number, item: any = null) {
  closeMenu();
  const buttons = headerButtons(root);
  const context = contextOf(app);
  const groups = groupedEntries(context);
  if (!item && !buttons.length && !groups.size) return;

  menu = document.createElement("menu");
  menu.className = `${ID}-menu`;
  if (item) itemSection(menu, item);

  const closeRows: HTMLLIElement[] = [];
  for (const a of buttons) {
    // click() fires the listener appv1 bound to the hidden button
    const line = buttonRow(a.querySelector("i")?.className ?? "", labelOf(a), () => a.click());
    if (a.classList.contains("close")) {
      line.classList.add("close");
      closeRows.push(line);
    } else menu.append(line);
  }

  // registered and macro entries sit between the header buttons and close
  appendGroups(menu, groups, context);
  menu.append(...closeRows);
  document.body.append(menu);

  // clamp to the viewport
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, window.innerWidth - width - 4)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - height - 4)}px`;
}

function applyMode(root: HTMLElement) {
  root.classList.toggle(`${ID}-collapsed`, mode() === "dropdown");
}

function decorate(app: any) {
  const root = rootOf(app);
  const header = root?.querySelector(".window-header");
  if (!root || !header) return;
  applyMode(root);
  // header survives re-renders; only wire it once
  if (header.querySelector(`.${ID}-toggle`)) return;

  const toggle = document.createElement("a");
  toggle.className = `header-button control ${ID}-toggle`;
  toggle.dataset.tooltip = game.i18n.localize("TIDY_TASQUE.toggle");
  toggle.innerHTML = `<i class="fa-solid fa-ellipsis-vertical"></i>`;
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = toggle.getBoundingClientRect();
    openMenu(app, root, rect.left, rect.bottom + 2);
  });
  const close = header.querySelector(".header-button.close");
  if (close) close.before(toggle);
  else header.append(toggle);

  // whole window; bubbles up after the sheet's own context menus
  root.addEventListener("contextmenu", (event) => {
    // foundry contextmenus preventdefault when they open
    if (event.defaultPrevented || event.shiftKey) return;
    // text fields keep the browser menu for copy/paste
    if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable], prose-mirror")) return;
    event.preventDefault();
    event.stopPropagation();
    openMenu(app, root, event.clientX, event.clientY, itemAt(app, event.target as HTMLElement));
  });
}

// item rows carry data-item-id, some systems data-item-uuid
function itemAt(app: any, target: HTMLElement): any {
  const actor = app.document ?? app.object;
  if (actor?.documentName !== "Actor") return null;
  const el = target.closest<HTMLElement>("[data-item-uuid], [data-item-id]");
  if (!el) return null;
  const { itemUuid, itemId } = el.dataset;
  const item = itemUuid ? fromUuidSync(itemUuid) : actor.items.get(itemId);
  return item?.documentName === "Item" ? item : null;
}

Hooks.once("init", () => {
  game.settings.register(ID, "mode", {
    name: "TIDY_TASQUE.mode.name",
    hint: "TIDY_TASQUE.mode.hint",
    scope: "client",
    config: true,
    type: String,
    choices: { ribbon: "TIDY_TASQUE.mode.ribbon", dropdown: "TIDY_TASQUE.mode.dropdown" },
    default: "dropdown",
    // ui.windows holds open appv1 apps
    onChange: () => {
      for (const app of Object.values(ui.windows)) {
        const root = rootOf(app);
        if (root?.querySelector(`.${ID}-toggle`)) applyMode(root);
      }
    },
  });

  game.settings.register(ID, "macros", {
    name: "TIDY_TASQUE.macros.name",
    hint: "TIDY_TASQUE.macros.hint",
    scope: "client",
    config: true,
    type: String,
    default: "",
  });

  game.settings.register(ID, "itemMacros", {
    name: "TIDY_TASQUE.itemMacros.name",
    hint: "TIDY_TASQUE.itemMacros.hint",
    scope: "client",
    config: true,
    type: String,
    default: "",
  });

  game.modules.get(ID).api = api;
});

// setup runs after every module's init, so listeners are in place
Hooks.once("setup", () => Hooks.callAll("tidyTasque.ready", api));

// render hooks fire for each class in the chain, so these catch system subclasses
Hooks.on("renderActorSheet", (app: any) => decorate(app));
Hooks.on("renderItemSheet", (app: any) => decorate(app));

// dismiss on outside click or escape
document.addEventListener("pointerdown", (event) => {
  if (menu && !menu.contains(event.target as Node)) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});
Hooks.on("closeApplication", () => closeMenu());
