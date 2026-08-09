// Deliberately broken: imports a module that does not exist, so the dynamic
// import in the loader throws. The loader must surface this, not skip the file.
import { neverExists } from "./this-module-does-not-exist";

export default {
  description: "A tool that fails to import.",
  execute: () => neverExists,
};
