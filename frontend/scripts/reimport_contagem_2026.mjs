import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// load env from .env.local
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url),'utf8')
  .split(/\r?\n/).filter(l=>l && !l.startsWith('#') && l.includes('='))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const URL_=env.NEXT_PUBLIC_SUPABASE_URL, KEY=env.SUPABASE_SERVICE_ROLE_KEY;
const GKEY='AIzaSyBKprFuR1gpvoTB4hV16rKlBk3oF0v1BhQ';
const APPLY = process.argv.includes('--apply');
const sb = createClient(URL_, KEY, { auth:{persistSession:false} });
const op = () => sb.schema('operations').from('contagem_estoque_insumos');

const SHEETS = {
  3: '1QhuD52kQrdCv4XMfKR5NSRMttx6NzVBZO0S8ajQK1H8',
  4: '1PXqIquLaUh12wka_Md4YufOo4FoHilrP_x6qmPSW440',
};
const toISO=(s)=>{ if(typeof s!=='string'||!s.includes('/'))return null; const[d,m,y]=s.split('/'); if(!y||y.length!==4)return null; const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; return /^\d{4}-\d{2}-\d{2}$/.test(iso)?iso:null; };
const tipoFromDate=(iso)=>{ const dt=new Date(iso+'T00:00:00Z'); const day=Number(iso.slice(8,10)); const dow=dt.getUTCDay(); // 0=Sun..1=Mon
  if(day===1)return 'mensal'; if(dow===1)return 'semanal'; return 'diaria'; };

async function fetchSheet(id){
  const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent('INSUMOS!A1:AMJ400')}?key=${GKEY}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`);
  const j=await r.json(); if(j.error) throw new Error(JSON.stringify(j.error)); return j.values||[];
}

function parse(rows){
  const dateRow=rows[3]||[], header=rows[5]||[];
  const TODAY=new Date().toISOString().slice(0,10);
  const dcols=[]; for(let c=0;c<dateRow.length;c++){ const iso=toISO(dateRow[c]); if(iso && iso>='2026-01-01' && iso<=TODAY){ const h=(header[c]||'').toString().toUpperCase(); if(h.includes('FECHADO')) dcols.push({c,iso}); } }
  const agg=new Map(); let dups=0;
  for(const {c,iso} of dcols){
    const tipo=tipoFromDate(iso);
    for(let i=6;i<rows.length;i++){ const row=rows[i]; if(!row)continue;
      const cod=(row[3]||'').toString().trim().toUpperCase(); const nome=(row[6]||'').toString().trim();
      if(!cod||!nome||cod==='CÓD') continue;
      const f=row[c], fl=row[c+1];
      const fechado = typeof f==='number'? f : null;
      const flut    = typeof fl==='number'? fl : null;
      if(fechado===null && flut===null) continue; // não contado nessa data
      const key=`${iso}|${cod}`; const ex=agg.get(key);
      if(ex){ dups++; ex.estoque_fechado=(ex.estoque_fechado||0)+(fechado||0); ex.estoque_flutuante=(ex.estoque_flutuante||0)+(flut||0); ex.estoque_final=(ex.estoque_fechado||0)+(ex.estoque_flutuante||0); }
      else agg.set(key,{ data_contagem:iso, insumo_codigo:cod, insumo_nome:nome, tipo_contagem:tipo,
        estoque_fechado:fechado, estoque_flutuante:flut, estoque_final:(fechado||0)+(flut||0) });
    }
  }
  return { recs:[...agg.values()], ndates:dcols.length, dups };
}

for(const bar of [3,4]){
  const rows=await fetchSheet(SHEETS[bar]);
  const { recs, ndates, dups } = parse(rows);
  // catalogo
  const { data:cat, error:ce } = await sb.schema('operations').from('insumos')
    .select('id,codigo,categoria,tipo_local,unidade_medida,custo_unitario').eq('bar_id',bar);
  if(ce) throw ce;
  const map=new Map(cat.map(r=>[String(r.codigo).toUpperCase(), r]));
  const semCat=new Set(); const codes=new Set();
  for(const r of recs){ codes.add(r.insumo_codigo); const m=map.get(r.insumo_codigo);
    if(m){ r.insumo_id=m.id; r.categoria=m.categoria; r.tipo_local=m.tipo_local; r.unidade_medida=m.unidade_medida; r.custo_unitario=m.custo_unitario; }
    else { r.insumo_id=null; semCat.add(r.insumo_codigo); } }
  const byTipo=recs.reduce((a,r)=>(a[r.tipo_contagem]=(a[r.tipo_contagem]||0)+1,a),{});
  console.log(`\n=== BAR ${bar} === datas2026=${ndates} linhas=${recs.length} codigos=${codes.size} dups_somados=${dups} por_tipo=${JSON.stringify(byTipo)}`);
  console.log(`  sem cadastro (insumo_id null): ${semCat.size} codigos -> ${[...semCat].slice(0,40).join(',')}`);

  if(APPLY){
    const { count:antes } = await op().select('*',{count:'exact',head:true}).eq('bar_id',bar);
    const { error:de } = await op().delete().eq('bar_id',bar); if(de) throw de;
    console.log(`  WIPE bar ${bar}: apagadas ${antes} linhas`);
    const now=new Date().toISOString();
    const payload=recs.map(r=>({ bar_id:bar, ...r, usuario_contagem:'Reimport Planilha 2026', observacoes:'reimport-2026', updated_at:now }));
    let ins=0;
    for(let i=0;i<payload.length;i+=500){ const chunk=payload.slice(i,i+500);
      const { error } = await op().upsert(chunk,{ onConflict:'bar_id,data_contagem,insumo_codigo' });
      if(error){ console.log('  ERRO lote', i, error.message); throw error; } ins+=chunk.length; }
    const { count:depois } = await op().select('*',{count:'exact',head:true}).eq('bar_id',bar);
    console.log(`  INSERIDAS ${ins} -> total bar ${bar} agora ${depois}`);
  }
}
console.log(APPLY?'\n>> APPLY concluído':'\n>> DRY-RUN (use --apply para gravar)');
