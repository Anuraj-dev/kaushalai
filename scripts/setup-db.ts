import { mkdirSync } from "node:fs";

mkdirSync("data", { recursive: true });
console.log("Database directory ready. Migrations and seed data are added in ticket #19.");
