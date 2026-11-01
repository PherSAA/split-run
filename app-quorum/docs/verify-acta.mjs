// Verifica un acta de quórum fuera de la app: node verify-acta.mjs acta.json
import { readFileSync } from 'fs'; import { webcrypto as c } from 'crypto';
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const sha = async s => Buffer.from(await c.subtle.digest('SHA-256', new TextEncoder().encode(s))).toString('hex');
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const ver = async (jwk, firma, h) => { try { const k = await c.subtle.importKey('jwk', { ...jwk, ext: true }, ALG, true, ['verify']); return await c.subtle.verify(SIG, k, Buffer.from(firma, 'hex'), new TextEncoder().encode(h)); } catch { return false; } };
const A = JSON.parse(readFileSync(process.argv[2]));
const out = { informe_ok: false, votos: [], verifican: 0, quorum: false };
out.informe_ok = await sha(canon(A.informe.env)) === A.informe.hash && await ver(A.informe.env.emisor.jwk, A.informe.firma, A.informe.hash);
for (const v of A.votos) {
  const g = A.grupo.find(x => x.celula === v.voto.celula && x.fp === v.voto.fp);
  const ok = !!g && await sha(canon(v.voto)) === v.hash && await ver(g.jwk, v.firma, v.hash);
  out.votos.push({ celula: v.voto.celula, firma_ok: ok, veredicto: v.voto.veredicto });
  if (ok && v.voto.veredicto === 'verifica' && v.voto.informe_hash === A.informe.hash && v.voto.raiz === A.raiz) out.verifican++;
}
out.quorum = out.informe_ok && out.verifican >= 2 && out.votos.every(v => v.firma_ok);
out.coincide_con_acta = (out.quorum ? 'quorum' : 'sin-quorum') === A.resultado;
console.log(JSON.stringify(out)); process.exit(out.quorum && out.coincide_con_acta ? 0 : 1);
