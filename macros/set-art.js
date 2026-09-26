// item art on an item, else one image for portrait and paired token
if (!item && !actor) return ui.notifications.warn("No actor or item on this sheet");
const FilePicker = foundry.applications.apps.FilePicker.implementation;
new FilePicker({
  type: "image",
  current: item?.img ?? token?.texture.src ?? actor.img,
  callback: async (path) => {
    if (item) return item.update({ img: path });
    // synthetic token actors have no prototype token
    await actor.update(actor.isToken ? { img: path } : { img: path, "prototypeToken.texture.src": path });
    await token?.update({ "texture.src": path });
  },
}).render(true);
