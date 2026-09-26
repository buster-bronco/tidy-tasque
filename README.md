# Tidy Tasque

Collapses sheet header buttons into a dropdown and adds a right-click sheet menu to actor and item sheets.

## Development

```sh
npm install
npm run build      # dist/
npm run dev        # watch + copy dist to FOUNDRY_VTT_PATH from .env
npm run typecheck
```

## Menu API

Other modules and users can add their own entries to the right-click menu. Entries show below the sheet's header buttons, grouped by `group`, with close kept last.

### From a module

```js
Hooks.once("tidyTasque.ready", (api) => {
  api.registerEntry({
    id: "emotive-hud.emotes",              // namespace with your module id
    label: "EMOTIVE_HUD.menu.emotes",      // i18n key or plain text
    icon: "fa-solid fa-face-smile",
    group: "Emotive HUD",
    condition: ({ actor }) => !!actor,
    callback: ({ actor }) => openEmotePicker(actor),
  });
});
```

`tidyTasque.ready` fires on `setup`. The api is also on `game.modules.get("tidy-tasque").api` from `init` on.

| api | |
| --- | --- |
| `version` | api version, currently `1` |
| `registerEntry(entry)` | adds or replaces an entry by `id` |
| `unregisterEntry(id)` | removes one, returns whether it existed |
| `getEntries()` | all registered entries |

Entry fields:

| field | |
| --- | --- |
| `id` | unique, namespaced |
| `label` | localized if it's an i18n key |
| `icon` | font awesome class |
| `group` | section label; entries without one share an unlabeled section |
| `order` | sort within the section, default `0` |
| `condition(context)` | hide the entry when it returns false |
| `callback(context)` | run on click; may be async |
| `children` | submenu entries, same shape |

`context` is `{ app, document, actor, token }`. `actor` is the sheet's actor, or the owning actor of an item sheet. `token` is the actor's token document, or its first active token on the canvas.

Errors thrown from a callback are logged and shown as a notification instead of breaking the menu.

### From a macro

Put macro UUIDs in **Settings → Tidy Tasque → Menu Macros**, one per line or comma separated. Each shows under a **Macros** section and runs as:

```ts
macro({ app: ActorSheet | ItemSheet, document: Actor | Item, actor: Actor | null, token: TokenDocument | null })
```

See `/macros` for some example macros. To get the UUID of a macro, click on `Copy Document UUID` next to the close button the macro edit menu.