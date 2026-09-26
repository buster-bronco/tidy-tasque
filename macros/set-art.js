// one image for portrait and paired token
if (!actor) return ui.notifications.warn("No actor on this sheet");
const FilePicker = foundry.applications.apps.FilePicker.implementation;
new FilePicker({
  type: "image",
  current: token?.texture.src ?? actor.img,
  callback: async (path) => {
    // synthetic token actors have no prototype token
    await actor.update(actor.isToken ? { img: path } : { img: path, "prototypeToken.texture.src": path });
    await token?.update({ "texture.src": path });
  },
}).render(true);
