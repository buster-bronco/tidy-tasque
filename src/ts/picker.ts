import { ID, formatRefs, macroRefs, parseRefs, type DocumentType, type MacroRef } from "./api";

const { ApplicationV2 } = foundry.applications.api;

// escapes macro names and uuids for innerhtml
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// macro rows only; the column header shares the .macro class
const MACRO_ROW = ".macro[data-uuid]";

function t(key: string): string {
  return game.i18n.localize(`TIDY_TASQUE.picker.${key}`);
}

// settings menu that writes the macros and itemMacros settings
export class MacroPicker extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${ID}-macro-picker`,
    tag: "form",
    classes: [`${ID}-picker`],
    window: { title: "TIDY_TASQUE.picker.name", icon: "fa-solid fa-code", resizable: true },
    position: { width: 520, height: 640 },
    form: { handler: MacroPicker.onSubmit, closeOnSubmit: true },
  };

  // game.macros holds world macros only; compendium ones go in the other fields
  static worldMacros(): any[] {
    return game.macros.contents.filter((m: any) => m.canExecute).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }

  async _renderHTML(): Promise<string> {
    const macros = MacroPicker.worldMacros();
    const world = new Set(macros.map((m) => m.uuid));
    const sheet = macroRefs("macros");
    const rows = macroRefs("itemMacros");
    const sheetOf = new Map(sheet.map((r) => [r.uuid, r.documentType ?? "all"]));
    const inRows = new Set(rows.map((r) => r.uuid));
    const other = (refs: MacroRef[]) => esc(formatRefs(refs.filter((r) => !world.has(r.uuid))));

    const option = (value: string, current: string) => `<option value="${value}"${value === current ? " selected" : ""}>${t(value)}</option>`;
    const list = macros
      .map((m) => {
        const current = sheetOf.get(m.uuid) ?? "off";
        return `<div class="macro" data-uuid="${esc(m.uuid)}" data-name="${esc(m.name.toLowerCase())}">
          <img src="${esc(m.img)}" alt="">
          <span class="name">${esc(m.name)}</span>
          <select>${["off", "all", "actor", "item"].map((v) => option(v, current)).join("")}</select>
          <label><input type="checkbox"${inRows.has(m.uuid) ? " checked" : ""}> ${t("rows")}</label>
        </div>`;
      })
      .join("");

    return `<p class="hint">${t("hint")}</p>
      <input type="search" class="filter" placeholder="${t("filter")}">
      <div class="macro head"><span class="name"></span><span class="col">${t("sheet")}</span><span class="col">${t("rows")}</span></div>
      <div class="macros">${list || `<p class="hint">${t("empty")}</p>`}</div>
      <div class="form-group"><label>${t("otherSheet")}</label><input type="text" name="otherSheet" value="${other(sheet)}"></div>
      <div class="form-group"><label>${t("otherRows")}</label><input type="text" name="otherRows" value="${other(rows)}"></div>
      <p class="hint">${t("otherHint")}</p>
      <footer class="form-footer"><button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${t("save")}</button></footer>`;
  }

  _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
  }

  // filters the list by macro name
  _onRender(): void {
    const root: HTMLElement = (this as any).element;
    const filter = root.querySelector<HTMLInputElement>("input.filter")!;
    filter.addEventListener("input", () => {
      const query = filter.value.trim().toLowerCase();
      for (const row of root.querySelectorAll<HTMLElement>(MACRO_ROW)) row.hidden = !row.dataset.name!.includes(query);
    });
    // enter in a form input triggers implicit submit
    filter.addEventListener("keydown", (event) => {
      if (event.key === "Enter") event.preventDefault();
    });
  }

  static async onSubmit(_event: Event, form: HTMLFormElement): Promise<void> {
    const sheet: MacroRef[] = [];
    const rows: MacroRef[] = [];
    for (const row of form.querySelectorAll<HTMLElement>(MACRO_ROW)) {
      const uuid = row.dataset.uuid!;
      const value = row.querySelector("select")!.value;
      if (value !== "off") sheet.push({ uuid, documentType: value === "all" ? null : (value as DocumentType) });
      if (row.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked) rows.push({ uuid, documentType: null });
    }
    sheet.push(...parseRefs((form.elements.namedItem("otherSheet") as HTMLInputElement).value));
    rows.push(...parseRefs((form.elements.namedItem("otherRows") as HTMLInputElement).value));
    await game.settings.set(ID, "macros", formatRefs(sheet));
    await game.settings.set(ID, "itemMacros", formatRefs(rows));
  }
}
