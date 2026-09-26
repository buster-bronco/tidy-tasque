// actor sheet macro to sync the token name with the actor name
if (item || !actor) return ui.notifications.warn("No actor on this sheet");
const name = actor.name;
// synthetic token actors belong to one unlinked token
if (actor.isToken) return actor.token.update({ name });
await actor.update({ "prototypeToken.name": name });
// linked tokens share the base actor; unlinked copies are left alone
for (const t of actor.getDependentTokens({ linked: true })) await t.update({ name });
