/* V36 — Registro migrazioni persistenti. */
'use strict';
const TURNIPS_SCHEMA_KEY='turnips_schema_version';
function turniPSRunMigrations(){const storage=typeof TurniPSStorage!=='undefined'?TurniPSStorage:localStorage; let v=Number(storage.getItem(TURNIPS_SCHEMA_KEY)||1); if(!Number.isFinite(v)||v<1)v=1; if(v<2){v=2;storage.setItem(TURNIPS_SCHEMA_KEY,String(v));} return v;}
window.turniPSRunMigrations=turniPSRunMigrations;
