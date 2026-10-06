/**
 * The running build, stamped by `vite.config.ts` (`define`): the package
 * version and the git commit it was built from. Support asks for both to
 * tell which release a hospital is on (checklist OBS-03).
 */
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;
