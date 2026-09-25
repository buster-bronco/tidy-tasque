// loose foundry globals; the community typings lag behind v13
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const game: any;
declare const ui: any;
declare const Hooks: any;

declare module "*.scss";
declare function fromUuidSync(uuid: string): any;
