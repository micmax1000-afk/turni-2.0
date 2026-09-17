/* V36 — Guard centrale dello stato. */
'use strict';
window.TurniPSDataGuard = Object.freeze({
  schemaVersion: 2,
  validate(state){
    if(!state || typeof state !== 'object') return false;
    if(typeof state.turni !== 'object' || state.turni === null || Array.isArray(state.turni)) return false;
    if(!Array.isArray(state.assenze) || !Array.isArray(state.sequenzaTurni)) return false;
    if(!Array.isArray(state.indennitaPersonalizzate)) return false;
    if(!state.noteGiorni || typeof state.noteGiorni !== 'object' || Array.isArray(state.noteGiorni)) return false;
    return true;
  },
  normalize(state){
    const s = state && typeof state === 'object' ? state : {};
    return {...s, turni:s.turni && typeof s.turni==='object' && !Array.isArray(s.turni)?s.turni:{}, assenze:Array.isArray(s.assenze)?s.assenze:[], indennitaPersonalizzate:Array.isArray(s.indennitaPersonalizzate)?s.indennitaPersonalizzate:[], sequenzaTurni:Array.isArray(s.sequenzaTurni)?s.sequenzaTurni:[], noteGiorni:s.noteGiorni&&typeof s.noteGiorni==='object'?s.noteGiorni:{}, conguagliPerMese:s.conguagliPerMese&&typeof s.conguagliPerMese==='object'?s.conguagliPerMese:{}, storico:s.storico&&typeof s.storico==='object'?s.storico:{}, coloriTurni:s.coloriTurni&&typeof s.coloriTurni==='object'?s.coloriTurni:{}};
  }
});
