export const ID = "tidy-tasque";
export const API_VERSION = 1;

export interface MenuContext {
  app: any;
  document: any;
  actor: any;
  token: any;
}

export interface MenuEntry {
  id: string;
  label: string;
  icon?: string;
  group?: string;
  order?: number;
  condition?: (context: MenuContext) => boolean;
  callback?: (context: MenuContext) => unknown;
  children?: MenuEntry[];
}

const entries = new Map<string, MenuEntry>();

// ids are namespaced by the caller, like "emotive-hud.emotes"
export function registerEntry(entry: MenuEntry): void {
  if (!entry?.id || !entry.label) throw new Error(`${ID} | registerEntry needs an id and label`);
  if (!entry.callback && !entry.children?.length) throw new Error(`${ID} | entry ${entry.id} needs a callback or children`);
  entries.set(entry.id, entry);
}

export function unregisterEntry(id: string): boolean {
  return entries.delete(id);
}

export function getEntries(): MenuEntry[] {
  return [...entries.values()];
}

// appv1 sheets expose the doc as app.document (older ones as app.object)
export function contextOf(app: any): MenuContext {
  const document = app.document ?? app.object ?? null;
  const actor = document?.documentName === "Actor" ? document : document?.actor ?? null;
  const token = actor?.token ?? actor?.getActiveTokens?.()[0]?.document ?? null;
  return { app, document, actor, token };
}

// world setting holds macro uuids, one per line or comma separated
function macroUuids(): string[] {
  const raw: string = game.settings.get(ID, "macros") ?? "";
  return raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
}

// macro.execute(scope) exposes scope keys as script variables
function macroEntries(): MenuEntry[] {
  const result: MenuEntry[] = [];
  for (const uuid of macroUuids()) {
    const macro = fromUuidSync(uuid);
    if (macro?.documentName !== "Macro" || !macro.canExecute) continue;
    result.push({
      id: `macro.${uuid}`,
      label: macro.name,
      icon: "fa-solid fa-code",
      group: "TIDY_TASQUE.group.macros",
      callback: (context) => macro.execute({ ...context }),
    });
  }
  return result;
}

function passes(entry: MenuEntry, context: MenuContext): boolean {
  if (!entry.condition) return true;
  try {
    return !!entry.condition(context);
  } catch (err) {
    console.error(`${ID} | condition failed for ${entry.id}`, err);
    return false;
  }
}

// drops entries whose condition fails, recursing into submenus
function visible(list: MenuEntry[], context: MenuContext): MenuEntry[] {
  return list
    .filter((entry) => passes(entry, context))
    .map((entry) => (entry.children ? { ...entry, children: visible(entry.children, context) } : entry))
    .filter((entry) => entry.callback || entry.children?.length)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// grouped in first-seen order; ungrouped entries share the "" group
export function groupedEntries(context: MenuContext): Map<string, MenuEntry[]> {
  const groups = new Map<string, MenuEntry[]>();
  for (const entry of visible([...getEntries(), ...macroEntries()], context)) {
    const key = entry.group ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  return groups;
}

// one broken integration shouldn't take the menu down
export async function run(entry: MenuEntry, context: MenuContext): Promise<void> {
  try {
    await entry.callback?.(context);
  } catch (err) {
    console.error(`${ID} | ${entry.id} failed`, err);
    ui.notifications?.error(`${game.i18n.localize(entry.label)}: ${(err as Error)?.message ?? err}`);
  }
}

export const api = { version: API_VERSION, registerEntry, unregisterEntry, getEntries };
export type TidyTasqueApi = typeof api;
