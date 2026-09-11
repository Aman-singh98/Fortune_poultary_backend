// Must be the very first import: ES module imports are hoisted above all
// other top-level code, so a plain `import dotenv from "dotenv"; dotenv.config();`
// here would still run AFTER `./app.js` (and everything it imports, like
// config/cloudinary.js) has already been evaluated with an empty process.env.
// `import "dotenv/config"` runs dotenv's config-loading as a side effect of
// the import itself, so it's guaranteed to happen before the next import line.
import "dotenv/config";

import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Fortune Poultry API running on http://localhost:${PORT}`);
  });
};

start();
