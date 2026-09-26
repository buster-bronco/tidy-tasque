const sizes = { tiny: 0.5, sm: 1, med: 1, lg: 2, huge: 3, grg: 4 };
const size = await foundry.applications.api.DialogV2.prompt({
  window: { title: "Resize" },
  content: `<select name="size">${Object.keys(sizes).map((s) => `<option>${s}</option>`).join("")}</select>`,
  ok: { callback: (_e, button) => button.form.elements.size.value },
});
if (!size || !actor) return;
await actor.update({ "system.traits.size.value": size });
await token?.update({ width: sizes[size], height: sizes[size] });